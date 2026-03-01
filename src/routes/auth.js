const express = require('express');
const passport = require('../config/passport');
const router = express.Router();

// Initiate Google OAuth flow
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/?error=auth_failed' }),
  (req, res) => {
    const userId = req.user.id;
    req.logout((err) => {
      req.session.destroy(() => {
        res.redirect(`/?uid=${userId}`);
      });
    });
  }
);

// Logout
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

module.exports = router;
