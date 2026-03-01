require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('./config/passport');
const db = require('./config/database');

const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', `${__dirname}/../views`);

// Static files
app.use(express.static(`${__dirname}/../public`));

// Body parsing
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Session
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fallback-secret',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 }, // 30 days, refreshed on each request
  })
);

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/', indexRouter);
app.use('/auth', authRouter);

async function initDB() {
  const conn = await db.getConnection();
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      google_id VARCHAR(255) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      display_name VARCHAR(255) NOT NULL,
      avatar_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_google_id (google_id)
    )`,
    `CREATE TABLE IF NOT EXISTS questions (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      category VARCHAR(100) DEFAULT 'General',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS games (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      host_user_id INT UNSIGNED NOT NULL,
      status ENUM('waiting','active','finished') DEFAULT 'waiting',
      current_question_id INT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (current_question_id) REFERENCES questions(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS game_users (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      game_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      score INT DEFAULT 0,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_game_user (game_id, user_id),
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS game_questions (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      game_id INT UNSIGNED NOT NULL,
      question_id INT UNSIGNED NOT NULL,
      order_index INT UNSIGNED NOT NULL,
      asked_at TIMESTAMP NULL DEFAULT NULL,
      UNIQUE KEY uq_game_question (game_id, question_id),
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS game_answers (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      game_question_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      answer TEXT,
      is_correct BOOLEAN DEFAULT NULL,
      answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_game_answer (game_question_id, user_id),
      FOREIGN KEY (game_question_id) REFERENCES game_questions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
  ];
  for (const sql of tables) await conn.query(sql);
  conn.release();
  console.log('Database tables ready');
}

async function seedIfEmpty() {
  try {
    const [[{ count }]] = await db.query('SELECT COUNT(*) as count FROM questions');
    if (count > 0) {
      console.log(`Questions already seeded (${count} rows). Skipping.`);
      return;
    }
    console.log('Questions table is empty — seeding in background...');
    const { execFile } = require('child_process');
    const path = require('path');
    const child = execFile('node', [path.join(__dirname, '../db/seed.js')], { env: process.env });
    child.stdout.on('data', (d) => process.stdout.write(d));
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('exit', (code) => console.log(`Seed exited with code ${code}`));
  } catch (err) {
    console.error('Seed check failed:', err.message);
  }
}

// Start server (init DB schema, then listen)
initDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    seedIfEmpty();
  })
  .catch((err) => {
    console.error('Database init failed:', err.message);
    process.exit(1);
  });
