const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Login page
router.get('/', (req, res) => {
  res.render('login', { error: req.query.error || null });
});

// Show first 5 questions
router.get('/questions', async (req, res) => {
  const [questions] = await db.query(
    'SELECT id, category, question, answer FROM questions ORDER BY id LIMIT 5'
  );
  res.render('questions', { questions });
});

module.exports = router;
