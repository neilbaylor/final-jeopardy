#!/usr/bin/env node
/**
 * Initializes the database schema and seeds questions if the table is empty.
 * Run as Railway preDeployCommand: node db/init.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const { execSync } = require('child_process');

async function main() {
  const conn = await mysql.createConnection({
    ...(process.env.DB_SOCKET
      ? { socketPath: process.env.DB_SOCKET }
      : { host: process.env.DB_HOST || 'localhost', port: parseInt(process.env.DB_PORT || '3306') }),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'final_jeopardy',
    multipleStatements: false,
  });

  console.log('Connected. Creating tables...');

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
      status ENUM('waiting', 'active', 'finished') DEFAULT 'waiting',
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

  for (const sql of tables) {
    await conn.query(sql);
  }
  console.log('Tables ready.');

  const [[{ count }]] = await conn.query('SELECT COUNT(*) as count FROM questions');
  await conn.end();

  if (count > 0) {
    console.log(`Questions table already has ${count} rows. Skipping seed.`);
  } else {
    console.log('Questions table is empty. Running seed...');
    execSync('node db/seed.js', { stdio: 'inherit', cwd: require('path').join(__dirname, '..') });
  }
}

main().catch(err => {
  console.error('Init failed:', err.message);
  process.exit(1);
});
