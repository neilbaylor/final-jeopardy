-- Final Jeopardy Database Schema
-- Run: mysql -u root < db/schema.sql

CREATE DATABASE IF NOT EXISTS final_jeopardy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE final_jeopardy;

-- Users (populated via Google OAuth)
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  google_id VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_google_id (google_id)
);

-- Questions bank
CREATE TABLE IF NOT EXISTS questions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(100) DEFAULT 'General',
  difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Games (one host, many players)
CREATE TABLE IF NOT EXISTS games (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  host_user_id INT UNSIGNED NOT NULL,
  status ENUM('waiting', 'active', 'finished') DEFAULT 'waiting',
  current_question_id INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (current_question_id) REFERENCES questions(id) ON DELETE SET NULL
);

-- Players in a game (many-to-many with score tracking)
CREATE TABLE IF NOT EXISTS game_users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  game_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  score INT DEFAULT 0,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_game_user (game_id, user_id),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Questions that have been asked in a game (ordered history)
CREATE TABLE IF NOT EXISTS game_questions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  game_id INT UNSIGNED NOT NULL,
  question_id INT UNSIGNED NOT NULL,
  order_index INT UNSIGNED NOT NULL,
  asked_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uq_game_question (game_id, question_id),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- Sample questions
INSERT IGNORE INTO questions (question, answer, category, difficulty) VALUES
  ('What is the capital of France?', 'Paris', 'Geography', 'easy'),
  ('Who wrote "To Kill a Mockingbird"?', 'Harper Lee', 'Literature', 'medium'),
  ('What is the chemical symbol for gold?', 'Au', 'Science', 'easy'),
  ('In what year did World War II end?', '1945', 'History', 'easy'),
  ('What is the largest planet in our solar system?', 'Jupiter', 'Science', 'easy'),
  ('What is the speed of light (approximately)?', '299,792,458 meters per second', 'Science', 'hard'),
  ('Who painted the Mona Lisa?', 'Leonardo da Vinci', 'Art', 'easy'),
  ('What is the square root of 144?', '12', 'Math', 'easy'),
  ('Which country has the most natural lakes?', 'Canada', 'Geography', 'hard'),
  ('What year did the Berlin Wall fall?', '1989', 'History', 'medium');
