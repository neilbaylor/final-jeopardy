#!/usr/bin/env node
/**
 * One-time backfill: sets originally_asked on every existing question by
 * re-scraping the air date from j-archive season pages.
 *
 * Trigger via: GET /admin/backfill-dates?secret=<BACKFILL_SECRET>
 * Or manually: node src/backfill-dates.js
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

function parseAirDate(title) {
  if (!title) return null;
  const isoMatch = title.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const months = { January:'01', February:'02', March:'03', April:'04', May:'05', June:'06',
                   July:'07', August:'08', September:'09', October:'10', November:'11', December:'12' };
  const longMatch = title.match(/(\w+) (\d{1,2}), (\d{4})/);
  if (longMatch && months[longMatch[1]]) {
    return `${longMatch[3]}-${months[longMatch[1]]}-${longMatch[2].padStart(2, '0')}`;
  }
  return null;
}

// Returns [{ url, airDate }, ...]
async function getEpisodeLinks(season) {
  const html = await fetchPage(`https://j-archive.com/showseason.php?season=${season}`);
  const $ = cheerio.load(html);
  const links = [];
  $('a[href*="showgame.php"]').each((_, el) => {
    const href = $(el).attr('href');
    const full = href.startsWith('http') ? href : `https://j-archive.com/${href}`;
    if (links.find(l => l.url === full)) return;
    const airDate = parseAirDate($(el).attr('title'));
    links.push({ url: full, airDate });
  });
  return links;
}

// Returns the Final Jeopardy question text for a game page
async function extractQuestion(url) {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);
  const finalRound = $('.final_round');
  if (!finalRound.length) return null;
  return finalRound.find('#clue_FJ').text().trim() || null;
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

  console.log('[backfill] Connected to database.');

  let updated = 0;
  let skipped = 0;

  for (const season of SEASONS) {
    console.log(`\n[backfill] Season ${season}...`);
    let links;
    try {
      links = await getEpisodeLinks(season);
      console.log(`[backfill]   ${links.length} episode links found.`);
    } catch (err) {
      console.error(`[backfill]   ERROR fetching season ${season}: ${err.message}`);
      continue;
    }

    for (const { url, airDate } of links) {
      if (!airDate) {
        console.log(`[backfill]   SKIP (no date in title): ${url}`);
        skipped++;
        continue;
      }

      try {
        const questionText = await extractQuestion(url);
        if (!questionText) {
          console.log(`[backfill]   SKIP (no FJ clue): ${url}`);
          skipped++;
          await new Promise(r => setTimeout(r, 500));
          continue;
        }

        const [result] = await db.execute(
          'UPDATE questions SET originally_asked = ? WHERE question = ? AND originally_asked IS NULL',
          [airDate, questionText]
        );

        if (result.affectedRows > 0) {
          console.log(`[backfill]   UPDATED ${airDate}: ${questionText.substring(0, 60)}...`);
          updated++;
        } else {
          // Already set, or question not found
          const [[{ cnt }]] = await db.execute(
            'SELECT COUNT(*) AS cnt FROM questions WHERE question = ?', [questionText]
          );
          if (cnt === 0) {
            console.log(`[backfill]   NOT FOUND in DB: ${questionText.substring(0, 60)}...`);
          } else {
            console.log(`[backfill]   ALREADY SET: ${questionText.substring(0, 60)}...`);
          }
          skipped++;
        }

        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error(`[backfill]   ERROR ${url}: ${err.message}`);
        skipped++;
      }
    }
  }

  console.log(`\n[backfill] Done. Updated: ${updated}, Skipped/not-found: ${skipped}`);
  await db.end();
}

main().catch(err => {
  console.error('[backfill] Fatal:', err);
  process.exit(1);
});
