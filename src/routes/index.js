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

module.exports = router;
