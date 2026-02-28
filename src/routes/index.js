const express = require('express');
const router = express.Router();

// Login page
router.get('/', (req, res) => {
  res.render('login', { error: req.query.error || null, user: req.user || null });
});

module.exports = router;
