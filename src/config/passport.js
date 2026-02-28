const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./database');
require('dotenv').config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const [rows] = await db.execute(
          'SELECT * FROM users WHERE google_id = ?',
          [profile.id]
        );

        if (rows.length > 0) {
          // Update existing user info
          await db.execute(
            'UPDATE users SET display_name = ?, avatar_url = ? WHERE google_id = ?',
            [profile.displayName, profile.photos?.[0]?.value || null, profile.id]
          );
          return done(null, rows[0]);
        }

        // Create new user
        const [result] = await db.execute(
          'INSERT INTO users (google_id, email, display_name, avatar_url) VALUES (?, ?, ?, ?)',
          [
            profile.id,
            profile.emails?.[0]?.value || '',
            profile.displayName,
            profile.photos?.[0]?.value || null,
          ]
        );

        const [newUser] = await db.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
        return done(null, newUser[0]);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
    done(null, rows[0] || null);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
