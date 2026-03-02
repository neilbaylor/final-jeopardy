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
      'SELECT id, display_name, avatar_url FROM users WHERE id != ? ORDER BY display_name ASC',
      [userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// API: create a new game
router.post('/api/games', async (req, res) => {
  const { userId, friendIds } = req.body;
  if (!userId || !Array.isArray(friendIds) || friendIds.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const allUserIds = [Number(userId), ...friendIds.map(Number)];
  const n = allUserIds.length;
  const placeholders = allUserIds.map(() => '?').join(',');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

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
      return res.status(409).json({ error: 'A game already exists with those friends' });
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
      'INSERT INTO game_questions (game_id, question_id) VALUES (?, ?)',
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

// API: get all games for a user
router.get('/api/games', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const [games] = await db.execute(
      `SELECT g.id, g.created_at FROM games g
       JOIN game_users gu ON g.id = gu.game_id
       WHERE gu.user_id = ?
       ORDER BY g.updated_at DESC`,
      [userId]
    );
    if (!games.length) return res.json([]);

    const gameIds = games.map(g => g.id);
    const ph = gameIds.map(() => '?').join(',');

    const [players] = await db.execute(
      `SELECT gu.game_id, u.id, u.display_name, u.avatar_url
       FROM game_users gu
       JOIN users u ON gu.user_id = u.id
       WHERE gu.game_id IN (${ph}) AND gu.user_id != ?`,
      [...gameIds, userId]
    );

    const [questions] = await db.execute(
      `SELECT gq.id AS game_question_id, gq.game_id, gq.asked_at,
              q.id AS question_id, q.question, q.answer, q.category
       FROM game_questions gq
       JOIN questions q ON gq.question_id = q.id
       WHERE gq.game_id IN (${ph})
         AND gq.id = (SELECT MAX(gq2.id) FROM game_questions gq2 WHERE gq2.game_id = gq.game_id)`,
      gameIds
    );

    const [answers] = await db.execute(
      `SELECT ga.id, ga.game_question_id, ga.answer, ga.is_correct, ga.answered_at, gq.game_id
       FROM game_answers ga
       JOIN game_questions gq ON ga.game_question_id = gq.id
       WHERE gq.game_id IN (${ph}) AND ga.user_id = ?`,
      [...gameIds, userId]
    );

    const playersByGame = {};
    for (const p of players) {
      (playersByGame[p.game_id] ||= []).push({ id: p.id, display_name: p.display_name, avatar_url: p.avatar_url });
    }
    const questionByGame = {};
    for (const q of questions) questionByGame[q.game_id] = q;
    const answersByGame = {};
    for (const a of answers) {
      (answersByGame[a.game_id] ||= []).push(a);
    }

    res.json(games.map(g => ({
      id: g.id,
      created_at: g.created_at,
      players: playersByGame[g.id] || [],
      current_question: questionByGame[g.id] || null,
      my_answers: answersByGame[g.id] || [],
    })));
  } catch (err) {
    console.error('Get games error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
