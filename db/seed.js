#!/usr/bin/env node
/**
 * Scrapes Final Jeopardy questions from j-archive.com Season 41
 * and seeds the questions table.
 * Usage: node db/seed.js
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SEASONS = [28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41];

function fetchPage(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; seed-script/1.0)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPage(new URL(res.headers.location, url).href, redirectCount + 1).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString()));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function getEpisodeLinks(season) {
  const html = await fetchPage(`https://j-archive.com/showseason.php?season=${season}`);
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
  const html = await fetchPage(url);
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
    ...(process.env.DB_SOCKET
      ? { socketPath: process.env.DB_SOCKET }
      : { host: process.env.DB_HOST || 'localhost', port: process.env.DB_PORT || 3306 }),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'final_jeopardy',
  });

  console.log('Connected to database.');

  // Skip seeding entirely if the table already has data (unless forced)
  const [[{ cnt }]] = await db.execute('SELECT COUNT(*) AS cnt FROM questions');
  if (cnt > 0 && !process.env.FORCE_RESEED) {
    console.log(`DB already has ${cnt} questions — skipping seed.`);
    await db.end();
    return;
  }

  // Fetch all episode links first — only wipe the table if scraping is actually working
  const linksBySeason = [];
  for (const season of SEASONS) {
    const links = await getEpisodeLinks(season);
    console.log(`Season ${season}: found ${links.length} episode links.`);
    linksBySeason.push({ season, links });
  }
  const totalLinks = linksBySeason.reduce((n, s) => n + s.links.length, 0);
  if (totalLinks === 0) throw new Error('No episode links found — aborting to preserve existing data');

  await db.execute('DELETE FROM questions');
  console.log('Cleared existing questions.');

  let inserted = 0;
  let skipped = 0;

  for (const { season, links } of linksBySeason) {
    console.log(`\nProcessing Season ${season}...`);
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
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
  await db.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
