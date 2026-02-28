#!/usr/bin/env node
/**
 * Scrapes Final Jeopardy questions from j-archive.com Season 41
 * and seeds the questions table.
 * Usage: node db/seed.js
 */

const { execSync } = require('child_process');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SEASON_URL = 'https://j-archive.com/showseason.php?season=41';

function fetchPage(url) {
  const html = execSync(
    `curl -s -L --max-redirs 5 -A "Mozilla/5.0 (compatible; seed-script/1.0)" "${url}"`,
    { timeout: 20000, maxBuffer: 10 * 1024 * 1024 }
  );
  return html.toString();
}

async function getEpisodeLinks() {
  const html = fetchPage(SEASON_URL);
  const $ = cheerio.load(html);
  const links = [];
  $('a[href*="showgame.php"]').each((_, el) => {
    const href = $(el).attr('href');
    const full = href.startsWith('http') ? href : `https://j-archive.com/${href}`;
    if (!links.includes(full)) links.push(full);
  });
  return links;
}

async function extractFinalJeopardy(url) {
  const html = fetchPage(url);
  const $ = cheerio.load(html);

  const finalRound = $('.final_round');
  if (!finalRound.length) return null;

  const category = finalRound.find('.category_name').first().text().trim();
  const question = finalRound.find('#clue_FJ').text().trim();
  // The correct_response is inside a hidden toggle — it's in the onmouseover or in a <em> inside correct_response
  const answer = finalRound.find('.correct_response').first().text().trim();

  if (!category || !question || !answer) return null;

  return { category, question, answer };
}

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'final_jeopardy',
  });

  console.log('Connected to database.');
  await db.execute('DELETE FROM questions');
  console.log('Cleared existing questions.');

  const links = await getEpisodeLinks();
  console.log(`Found ${links.length} episode links.`);

  let inserted = 0;
  let skipped = 0;

  for (const link of links) {
    try {
      const data = await extractFinalJeopardy(link);
      if (!data) {
        console.log(`  SKIP (no data): ${link}`);
        skipped++;
        continue;
      }
      await db.execute(
        'INSERT INTO questions (question, answer, category) VALUES (?, ?, ?)',
        [data.question, data.answer, data.category]
      );
      console.log(`  OK [${data.category}] ${data.question.substring(0, 60)}...`);
      inserted++;
      // polite delay
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`  ERROR ${link}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
  await db.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
