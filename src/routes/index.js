const express = require('express');
const db = require('../config/database');
const router = express.Router();

// Login page
router.get('/', (req, res) => {
  res.render('login', { error: req.query.error || null, user: req.user || null });
});

// Dashboard
router.get('/dashboard', (req, res) => {
  res.render('dashboard');
});

// Game
router.get('/game', (req, res) => {
  res.render('game');
});

// API: fetch current user by ID (used by client-side localStorage auth)
router.get('/api/me', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const [rows] = await db.execute('SELECT id, display_name, avatar_url FROM users WHERE id = ?', [userId]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// API: fetch all users except the requesting user
router.get('/api/users', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const [rows] = await db.execute(
      'SELECT id, display_name, avatar_url FROM users WHERE id != ?',
      [userId]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Database error' });
  }
});

// API: create a new game
router.post('/api/games', async (req, res) => {
  const { userId, friendIds } = req.body;
  if (!userId || !Array.isArray(friendIds) || friendIds.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (friendIds.length >= 9) {
    return res.status(409).json({ error: 'There is a max of 10 players per game' });
  }

  const allUserIds = [Number(userId), ...friendIds.map(Number)];
  const n = allUserIds.length;
  const placeholders = allUserIds.map(() => '?').join(',');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Check if the user is already at the game limit
    const [[{ gameCount }]] = await conn.query(
      'SELECT COUNT(*) AS gameCount FROM game_users WHERE user_id = ?',
      [Number(userId)]
    );
    if (gameCount >= 10) {
      await conn.rollback();
      return res.status(409).json({ error: 'You have reached the maximum number of games' });
    }

    // Check if any friend is at the game limit
    const friendPlaceholders = friendIds.map(() => '?').join(',');
    const [friendCounts] = await conn.query(
      `SELECT u.display_name, COUNT(gu.game_id) AS gameCount
       FROM users u
       LEFT JOIN game_users gu ON gu.user_id = u.id
       WHERE u.id IN (${friendPlaceholders})
       GROUP BY u.id`,
      friendIds.map(Number)
    );
    for (const friend of friendCounts) {
      if (friend.gameCount >= 10) {
        await conn.rollback();
        return res.status(409).json({ error: `Sorry, ${friend.display_name} has reached the maximum number of games` });
      }
    }

    // Check if a game already exists with exactly these users
    const [existing] = await conn.query(
      `SELECT gu.game_id
       FROM game_users gu
       WHERE gu.user_id IN (${placeholders})
       GROUP BY gu.game_id
       HAVING COUNT(DISTINCT gu.user_id) = ?
         AND gu.game_id IN (
           SELECT game_id FROM game_users GROUP BY game_id HAVING COUNT(*) = ?
         )
       LIMIT 1`,
      [...allUserIds, n, n]
    );

    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: friendIds.length === 1 ? 'A game already exists with that friend' : 'A game already exists with those friends' });
    }

    // Create the game
    const [gameResult] = await conn.query('INSERT INTO games () VALUES ()');
    const gameId = gameResult.insertId;

    // Add all players
    for (const uid of allUserIds) {
      await conn.query('INSERT INTO game_users (game_id, user_id) VALUES (?, ?)', [gameId, uid]);
    }

    // Pick a random question
    const [[question]] = await conn.query('SELECT id FROM questions ORDER BY RAND() LIMIT 1');
    if (!question) {
      await conn.rollback();
      return res.status(500).json({ error: 'No questions available' });
    }
    await conn.query(
      'INSERT INTO game_questions (game_id, question_id, asked_at) VALUES (?, ?, NOW())',
      [gameId, question.id]
    );

    await conn.commit();
    res.json({ gameId });
  } catch (err) {
    await conn.rollback();
    console.error('Create game error:', err);
    res.status(500).json({ error: 'Failed to create game' });
  } finally {
    conn.release();
  }
});

// API: get all games for a user, or a single game by gameId
router.get('/api/games', async (req, res) => {
  const { userId, gameId } = req.query;

  if (gameId) {
    try {
      const escapedUserId = userId ? db.escape(userId) : 'NULL';
      const [[row]] = await db.query(
        `SELECT
           g.id,
           g.created_at,
           (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', u.id, 'display_name', u.display_name, 'avatar_url', u.avatar_url))
            FROM game_users gu2 JOIN users u ON gu2.user_id = u.id
            WHERE gu2.game_id = g.id AND (${escapedUserId} IS NULL OR gu2.user_id != ${escapedUserId})) AS players,
           (SELECT gq.id FROM game_questions gq WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_id,
           (SELECT gq.asked_at FROM game_questions gq WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_asked_at,
           (SELECT q.id FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_question_id,
           (SELECT q.question FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_question,
           (SELECT q.answer FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_answer,
           (SELECT q.category FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_category,
           (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', ga.id, 'game_question_id', ga.game_question_id,
                                             'answer', ga.answer, 'is_correct', ga.is_correct, 'answered_at', ga.answered_at))
            FROM game_answers ga JOIN game_questions gq ON ga.game_question_id = gq.id
            WHERE gq.game_id = g.id AND (${escapedUserId} IS NULL OR ga.user_id = ${escapedUserId})) AS my_answers
         FROM games g
         WHERE g.id = ?`,
        [Number(gameId)]
      );
      if (!row) return res.status(404).json({ error: 'Game not found' });
      if (userId) {
        const [[member]] = await db.query(
          'SELECT 1 FROM game_users WHERE game_id = ? AND user_id = ?',
          [Number(gameId), Number(userId)]
        );
        if (!member) return res.status(403).json({ error: 'You are not a participant in this game' });
      }
      const parse = v => typeof v === 'string' ? JSON.parse(v) : v;
      return res.json({
        id: row.id,
        created_at: row.created_at,
        players: parse(row.players) || [],
        current_question: row.cq_id ? {
          game_question_id: row.cq_id,
          asked_at: row.cq_asked_at,
          question_id: row.cq_question_id,
          question: row.cq_question,
          answer: row.cq_answer,
          category: row.cq_category,
        } : null,
        my_answers: parse(row.my_answers) || [],
      });
    } catch (err) {
      console.error('Get game error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
  }

  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const [rows] = await db.query(
      `SELECT
         g.id,
         g.created_at,
         (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', u.id, 'display_name', u.display_name, 'avatar_url', u.avatar_url))
          FROM game_users gu2 JOIN users u ON gu2.user_id = u.id
          WHERE gu2.game_id = g.id AND gu2.user_id != ${db.escape(userId)}) AS players,
         (SELECT gq.id FROM game_questions gq WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_id,
         (SELECT gq.asked_at FROM game_questions gq WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_asked_at,
         (SELECT q.id FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_question_id,
         (SELECT q.question FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_question,
         (SELECT q.answer FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_answer,
         (SELECT q.category FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_category,
         (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', ga.id, 'game_question_id', ga.game_question_id,
                                           'answer', ga.answer, 'is_correct', ga.is_correct, 'answered_at', ga.answered_at))
          FROM game_answers ga JOIN game_questions gq ON ga.game_question_id = gq.id
          WHERE gq.game_id = g.id AND ga.user_id = ${db.escape(userId)}) AS my_answers
       FROM games g
       JOIN game_users gu ON g.id = gu.game_id
       WHERE gu.user_id = ${db.escape(userId)}
       ORDER BY g.updated_at DESC`
    );

    const parse = v => typeof v === 'string' ? JSON.parse(v) : v;
    const real = rows.map(row => ({
      id: row.id,
      created_at: row.created_at,
      players: parse(row.players) || [],
      current_question: row.cq_id ? {
        game_question_id: row.cq_id,
        asked_at: row.cq_asked_at,
        question_id: row.cq_question_id,
        question: row.cq_question,
        answer: row.cq_answer,
        category: row.cq_category,
      } : null,
      my_answers: parse(row.my_answers) || [],
    }));



    res.json(real);
  } catch (err) {
    console.error('Get games error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.delete('/api/games/:gameId', async (req, res) => {
  const { gameId } = req.params;
  try {
    await db.query('DELETE FROM games WHERE id = ?', [Number(gameId)]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete game error:', err);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

module.exports = router;
