#!/usr/bin/env node
/**
 * Scrapes Final Jeopardy questions from j-archive.com and seeds the questions table.
 * - First run (empty table): seeds all seasons in SEASONS.
 * - Subsequent runs: checks MAX(originally_asked) and crawls the latest season
 *   for any episodes newer than that date.
 * Usage: node src/seed.js
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SEASONS = [28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42];
const LATEST_SEASON = 42;

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
  // ISO format: "Show #8580, aired 2021-09-13"
  const isoMatch = title.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  // Long format: "aired September 13, 2021"
  const months = { January:'01', February:'02', March:'03', April:'04', May:'05', June:'06',
                   July:'07', August:'08', September:'09', October:'10', November:'11', December:'12' };
  const longMatch = title.match(/(\w+) (\d{1,2}), (\d{4})/);
  if (longMatch && months[longMatch[1]]) {
    return `${longMatch[3]}-${months[longMatch[1]]}-${longMatch[2].padStart(2, '0')}`;
  }
  return null;
}

async function getEpisodeLinks(season) {
  const html = await fetchPage(`https://j-archive.com/showseason.php?season=${season}`);
  const $ = cheerio.load(html);
  const links = [];
  const seenUrls = new Set();
  const seenDates = new Set();
  $('a[href*="showgame.php"]').each((_, el) => {
    const href = $(el).attr('href');
    const full = href.startsWith('http') ? href : `https://j-archive.com/${href}`;
    if (seenUrls.has(full)) return;
    seenUrls.add(full);
    const airDate = parseAirDate($(el).attr('title'));
    if (airDate && seenDates.has(airDate)) return;
    if (airDate) seenDates.add(airDate);
    links.push({ url: full, airDate });
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

  const [[{ cnt }]] = await db.execute('SELECT COUNT(*) AS cnt FROM questions');

  let inserted = 0;
  let skipped = 0;

  if (cnt === 0 || process.env.FORCE_RESEED) {
    // Full seed: fetch all seasons, wipe and repopulate
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

    for (const { season, links } of linksBySeason) {
      console.log(`\nProcessing Season ${season}...`);
      for (const { url, airDate } of links) {
        try {
          const data = await extractFinalJeopardy(url);
          if (!data) { console.log(`  SKIP (no data): ${url}`); skipped++; continue; }
          await db.execute(
            'INSERT INTO questions (question, answer, category, originally_asked) VALUES (?, ?, ?, ?)',
            [data.question, data.answer, data.category, airDate || null]
          );
          console.log(`  OK [${data.category}] ${airDate || 'no-date'} ${data.question.substring(0, 60)}...`);
          inserted++;
          await new Promise(r => setTimeout(r, 500));
        } catch (err) {
          console.error(`  ERROR ${url}: ${err.message}`);
          skipped++;
        }
      }
    }
  } else {
    // Incremental update: find episodes in the latest season newer than MAX(originally_asked)
    const [[{ latest }]] = await db.execute('SELECT MAX(originally_asked) AS latest FROM questions');
    if (!latest) {
      console.log('No dated questions found — run with FORCE_RESEED=1 to do a full seed.');
      await db.end();
      return;
    }
    const latestDate = latest instanceof Date ? latest.toISOString().slice(0, 10) : String(latest).slice(0, 10);
    console.log(`Latest originally_asked in DB: ${latestDate}`);
    console.log(`Checking Season ${LATEST_SEASON} for newer episodes...`);

    const links = await getEpisodeLinks(LATEST_SEASON);
    console.log(`Season ${LATEST_SEASON}: found ${links.length} episode links.`);

    const seen = new Set();
    const newLinks = links.filter(l => {
      if (!l.airDate || l.airDate <= latestDate) return false;
      if (seen.has(l.airDate)) return false;
      seen.add(l.airDate);
      return true;
    });
    console.log(`Episodes newer than ${latestDate}: ${newLinks.length}`);

    for (const { url, airDate } of newLinks) {
      try {
        const data = await extractFinalJeopardy(url);
        if (!data) { console.log(`  SKIP (no data): ${url}`); skipped++; continue; }
        // Skip if this exact question already exists (e.g. duplicate air date)
        const [[{ dupe }]] = await db.execute(
          'SELECT COUNT(*) AS dupe FROM questions WHERE originally_asked = ?', [airDate]
        );
        if (dupe > 0) { console.log(`  SKIP (already exists): ${airDate}`); skipped++; continue; }
        await db.execute(
          'INSERT INTO questions (question, answer, category, originally_asked) VALUES (?, ?, ?, ?)',
          [data.question, data.answer, data.category, airDate]
        );
        console.log(`  NEW [${data.category}] ${airDate} ${data.question.substring(0, 60)}...`);
        inserted++;
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error(`  ERROR ${url}: ${err.message}`);
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
