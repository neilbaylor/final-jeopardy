const express = require('express');
const db = require('../config/database');
const natural = require('natural');
const title = require('title').default;
const webpush = require('web-push');
const router = express.Router();

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_MAILTO || 'mailto:admin@fjwf.today',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Send a push notification to a single stored subscription; silently remove if expired/invalid
async function sendPush(userId, payload) {
  try {
    const [[row]] = await db.query('SELECT subscription FROM push_subscriptions WHERE user_id = ?', [userId]);
    if (!row) { console.log(`[push] no subscription for user ${userId}`); return; }
    console.log(`[push] sending to user ${userId}`);
    await webpush.sendNotification(JSON.parse(row.subscription), JSON.stringify(payload));
    console.log(`[push] sent ok to user ${userId}`);
  } catch (err) {
    console.error(`[push] failed for user ${userId}:`, err.statusCode, err.message);
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired or gone — clean it up
      await db.query('DELETE FROM push_subscriptions WHERE user_id = ?', [userId]).catch(() => {});
    }
  }
}

function pushDisplayName(displayName) {
  const parts = (displayName || '').trim().split(' ');
  const first = parts[0] || '';
  if (first.length <= 6) return first;
  const last = parts[parts.length - 1] || '';
  return (first[0] + (last[0] || '')).toUpperCase();
}

const _ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
               'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
               'seventeen', 'eighteen', 'nineteen'];
const _tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function numToWords(n) {
  if (n === 0) return 'zero';
  if (n < 20) return _ones[n];
  if (n < 100) return _tens[Math.floor(n / 10)] + (n % 10 ? ' ' + _ones[n % 10] : '');
  if (n < 1000) return _ones[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + numToWords(n % 100) : '');
  if (n < 1000000) return numToWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
  return String(n);
}

function stripOneOf(str) {
  return str.replace(/^\(\d+\s+of(?:\s+\d+)?\)\s*/i, '');
}

// Matches well-formed Roman numerals only (1–3999); rejects random all-caps words like "MIDI".
const _romanRe = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
function romanToNum(s) {
  const vals = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let result = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = vals[s[i]], next = vals[s[i + 1]];
    result += (next && cur < next) ? -cur : cur;
  }
  return result;
}

function normalizeAnswer(str) {
  // Strip diacritics and apostrophes first so they don't create spurious word
  // boundaries that cause single letters like C/D to be misread as Roman numerals
  str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  str = str.replace(/['\u2018\u2019]/g, '');
  // Convert Roman numerals (all-uppercase tokens) before lowercasing
  str = str.replace(/\b([IVXLCDMivxlcdm]+)\b/g, (m) => {
    const u = m.toUpperCase();
    if (!_romanRe.test(u)) return m;
    const n = romanToNum(u);
    return n > 0 ? String(n) : m;
  });

  return str
    .toLowerCase()
    .replace(/[&+,]/g, ' ')        // & + , → space
    .replace(/\band\b/g, ' ')      // word "and" → space
    .replace(/\b(\d+)(?:st|nd|rd|th)\b/g, '$1') // strip ordinal suffixes: 8th → 8
    .replace(/\b(\d+)\b/g, (_, n) => numToWords(parseInt(n, 10))) // 7 → seven
    .replace(/['\u2018\u2019]/g, '') // strip apostrophes (ASCII + smart quotes)
    .replace(/[^a-z0-9\s]/g, ' ') // non-alphanumeric → space
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Common English first names used to detect "FirstName LastName" patterns.
const COMMON_FIRST_NAMES = new Set([
  // Male
  'aaron','adam','alan','albert','alexander','alfred','andrew','anthony','arthur','austin','ayn',
  'barry','ben','benjamin','bill','billy','bob','bobby','brad','brandon','brian','bruce','bryan',
  'carl','carlos','chad','charles','chris','christopher','chuck','clark','clifford','craig','dale',
  'dan','daniel','david','dean','dennis','dick','donald','douglas','drew','dustin','dylan',
  'earl','eddie','edward','eli','elijah','eric','ethan','eugene',
  'floyd','frank','fred','gabriel','gary','gene','george','glen','gregory',
  'harold','harry','henry','ian','jacob','james','jason','jay','jeff','jeffrey',
  'jerry','jim','jimmy','joe','john','johnny','jonathan','jose','joseph','joshua','justin',
  'keith','ken','kenneth','kevin','kurt','kyle','lance','larry','leo','logan','louis','liam','lucas','luke',
  'mark','martin','mason','matt','matthew','max','michael','mike','miles',
  'nathan','neil','nicholas','nick','noah',
  'oliver','oscar','owen','paul','patrick','peter','pete',
  'ray','raymond','richard','rick','robert','roger','ronald','roy','russell','ryan',
  'sam','samuel','scott','sean','simon','stanley','stephen','steve','steven',
  'ted','thomas','timothy','timothy','tom','tony','travis','tyler',
  'victor','vincent','walter','warren','wayne','william','zachary','zach',
  // Female
  'abigail','ada','alice','amber','amy','andrea','angela','ann','anna','annie',
  'april','ashley','audrey','ava',
  'barbara','betty','brenda','brittany',
  'carol','carolyn','catherine','cheryl','chloe','christina','christine','claire','connie','crystal','cynthia',
  'danielle','dawn','deborah','debra','denise','diane','donna','doris','dorothy',
  'eleanor','elizabeth','ella','emily','emma','erica','eva','evelyn',
  'faith','frances','gina','gloria','grace','hailey','hannah','heather','helen','holly',
  'ida','irene','jacqueline','jane','janet','jean','jennifer','jessica','joan','joyce','joy','judith','judy','julie',
  'karen','kate','kat','katherine','kathleen','kelly','kimberly',
  'laura','lauren','leah','lena','lily','linda','lisa','lucy','mae','maggie','margaret','maria',
  'martha','mary','megan','melissa','michelle','minnie','molly',
  'nancy','natalie','nell','nicole','nina',
  'olivia','pamela','patricia','penelope','rachel','rebecca','rita','roberta','rose','ruth',
  'samantha','sandra','sarah','sharon','shirley','sophia','stella','stephanie','sue','susan','stephanie',
  'tammy','teresa','tiffany','tina','tonya','vanessa','vera','victoria','violet','virginia','vivian',
  'zoe','zoey',
]);

// If `namePart` is "FirstName LastName" (exactly 2 words, first is a known first name),
// returns the last name; otherwise returns null.
function extractLastName(namePart) {
  const words = namePart.trim().split(/\s+/);
  if (words.length === 2 && COMMON_FIRST_NAMES.has(words[0].toLowerCase())) {
    return words[1];
  }
  return null;
}

// Compare a normalized user part against a correct part (also normalized).
// Also accepts just the last name when correctPartOrig is a "FirstName LastName".
function matchesPart(userNorm, correctNorm, correctPartOrig) {
  if (userNorm === correctNorm) return true;
  if (natural.JaroWinklerDistance(userNorm, correctNorm) >= 0.88) return true;
  const ln = extractLastName(correctPartOrig);
  if (ln !== null) {
    const lnNorm = normalizeAnswer(ln);
    if (userNorm === lnNorm) return true;
    if (natural.JaroWinklerDistance(userNorm, lnNorm) >= 0.88) return true;
  }
  return false;
}

function isAnswerCorrect(userAnswer, correctAnswer) {
  const a = normalizeAnswer(userAnswer);
  const b = normalizeAnswer(correctAnswer);
  if (a === b) return true;
  if (natural.JaroWinklerDistance(a, b) >= 0.88) return true;

  // Order-independent match for answers joined by "and" / "or" / "&"
  // e.g. "Neil Taylor and Joe Ross" accepts "Joe Ross & Neil Taylor"
  // Also accepts just last names: "Taylor and Ross" for "Neil Taylor and Joe Ross"
  const splitConnectors = s => s.split(/\s*(?:\band\b|\bor\b|[&,])\s*/i).map(p => p.trim()).filter(Boolean);
  const correctParts = splitConnectors(correctAnswer);
  if (correctParts.length > 1) {
    let userParts = splitConnectors(userAnswer);
    // If connector-split doesn't yield the right count, try whitespace-split
    // e.g. correct "W and JFK", user answers "JFK W" (no connector)
    if (userParts.length !== correctParts.length) {
      const spaceParts = userAnswer.trim().split(/\s+/);
      if (spaceParts.length === correctParts.length) userParts = spaceParts;
    }
    if (userParts.length === correctParts.length) {
      const normUser = userParts.map(normalizeAnswer);
      const normCorrect = correctParts.map(normalizeAnswer);
      // Greedy bipartite match — supports last-name shorthand
      const usedCorrect = new Set();
      const allMatched = normUser.every(u => {
        const idx = correctParts.findIndex((cp, i) => !usedCorrect.has(i) && matchesPart(u, normCorrect[i], cp));
        if (idx === -1) return false;
        usedCorrect.add(idx);
        return true;
      });
      if (allMatched) return true;
    }
  }

  // "(N Of) X & Y & Z" — user must name exactly N of the listed answers.
  // Also accepts last names when candidates are "FirstName LastName".
  const oneOfMatch = correctAnswer.match(/^\((\d+)\s+of(?:\s+\d+)?\)\s*/i);
  if (oneOfMatch) {
    const required = parseInt(oneOfMatch[1], 10);
    const candidatesOrig = correctAnswer.slice(oneOfMatch[0].length).split(/\s*(?:&|,|\band\b|\bor\b)\s*/i).map(s => s.trim());
    const candidates = candidatesOrig.map(s => normalizeAnswer(s));
    let userParts = userAnswer.split(/\s*(?:&|,|\band\b|\bor\b)\s*/i).map(s => normalizeAnswer(s.trim())).filter(Boolean);
    // Fallback: if no explicit separator found and N > 1, try splitting on whitespace
    if (userParts.length === 1 && required > 1) {
      userParts = userAnswer.trim().split(/\s+/).map(s => normalizeAnswer(s));
    }
    if (userParts.length !== required) return false;
    const nOfFuzzy = (u, cNorm, cOrig) => {
      if (u === cNorm) return true;
      const ratio = Math.min(u.length, cNorm.length) / Math.max(u.length, cNorm.length);
      if (ratio >= 0.7 && natural.JaroWinklerDistance(u, cNorm) >= 0.88) return true;
      // Also accept last name of full-name candidates
      const ln = extractLastName(cOrig);
      if (ln !== null) {
        const lnNorm = normalizeAnswer(ln);
        if (u === lnNorm) return true;
        if (natural.JaroWinklerDistance(u, lnNorm) >= 0.88) return true;
      }
      return false;
    };
    const usedCandidates = new Set();
    const matched = userParts.filter(u => {
      const idx = candidatesOrig.findIndex((cOrig, i) => !usedCandidates.has(i) && nOfFuzzy(u, candidates[i], cOrig));
      if (idx === -1) return false;
      usedCandidates.add(idx);
      return true;
    });
    return matched.length === required;
  }

  // Allow omitting a leading qualifier (e.g. "Virgin Islands" for "U.S. Virgin Islands").
  // Require multi-word answer and suffix must be ≥75% of the full answer length.
  if (a.includes(' ') && b.endsWith(a) && b.length > a.length && b[b.length - a.length - 1] === ' ' && a.length / b.length >= 0.72) return true;

  // If the correct answer has parenthetical words, they are optional.
  // e.g. "(Randolph) Caldecott" accepts both "Caldecott" and "Randolph Caldecott".
  if (/\(/.test(correctAnswer)) {
    const withoutOptional = normalizeAnswer(correctAnswer.replace(/\([^)]*\)/g, ''));
    if (a === withoutOptional) return true;
    if (natural.JaroWinklerDistance(a, withoutOptional) >= 0.88) return true;
  }

  // "X or Y [or Z]" — pure "or" connector means any one alternative is acceptable.
  // Only applies when there are no "and" / "&" connectors (those require all parts).
  if (!/^\(\d+\s+of/i.test(correctAnswer) && /\bor\b/i.test(correctAnswer) && !/\band\b|&/.test(correctAnswer)) {
    const orParts = correctAnswer.split(/\s+or\s+/i).map(p => p.trim()).filter(Boolean);
    if (orParts.length > 1) {
      for (const part of orParts) {
        if (matchesPart(a, normalizeAnswer(part), part)) return true;
      }
    }
  }

  // Last-name-only: if the correct answer is a single "FirstName LastName", also accept
  // just the last name. Multi-person answers are handled above in the multi-part section.
  const singleLn = extractLastName(correctAnswer);
  if (singleLn !== null) {
    const lnNorm = normalizeAnswer(singleLn);
    if (a === lnNorm) return true;
    if (natural.JaroWinklerDistance(a, lnNorm) >= 0.88) return true;
  }

  return false;
}

// Login page
router.get('/', (req, res) => {
  res.render('login', { error: req.query.error || null, user: req.user || null });
});

// Dashboard
router.get('/dashboard', (req, res) => {
  res.render('dashboard');
});

// Game
router.get('/game', (req, res) => {
  res.render('game');
});

// API: fetch current user by ID (used by client-side localStorage auth)
router.get('/api/me', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const [rows] = await db.execute('SELECT id, display_name, avatar_url FROM users WHERE id = ?', [userId]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// API: save or update push subscription for a user
router.post('/api/push-subscription', async (req, res) => {
  const { userId, subscription } = req.body;
  console.log('[push] POST /api/push-subscription userId:', userId, 'hasSub:', !!subscription);
  if (!userId || !subscription) return res.status(400).json({ error: 'Missing fields' });
  try {
    await db.query(
      `INSERT INTO push_subscriptions (user_id, subscription)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE subscription = VALUES(subscription)`,
      [Number(userId), JSON.stringify(subscription)]
    );
    console.log('[push] subscription saved for userId:', userId);
    res.json({ ok: true });
  } catch (err) {
    console.error('[push] DB error saving subscription:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// API: fetch all users except the requesting user
router.get('/api/users', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const [rows] = await db.execute(
      'SELECT id, display_name, avatar_url FROM users WHERE id != ?',
      [userId]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Database error' });
  }
});

// API: create a new game
router.post('/api/games', async (req, res) => {
  const { userId, friendIds } = req.body;
  if (!userId || !Array.isArray(friendIds) || friendIds.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (friendIds.length >= 5) {
    return res.status(409).json({ error: 'There is a max of 6 players per game' });
  }

  const allUserIds = [Number(userId), ...friendIds.map(Number)];
  const n = allUserIds.length;
  const placeholders = allUserIds.map(() => '?').join(',');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Check if the user is already at the game limit
    const [[{ gameCount }]] = await conn.query(
      'SELECT COUNT(*) AS gameCount FROM game_users WHERE user_id = ?',
      [Number(userId)]
    );
    if (gameCount >= 10) {
      await conn.rollback();
      return res.status(409).json({ error: 'You have reached the maximum number of games' });
    }

    // Check if any friend is at the game limit
    const friendPlaceholders = friendIds.map(() => '?').join(',');
    const [friendCounts] = await conn.query(
      `SELECT u.display_name, COUNT(gu.game_id) AS gameCount
       FROM users u
       LEFT JOIN game_users gu ON gu.user_id = u.id
       WHERE u.id IN (${friendPlaceholders})
       GROUP BY u.id`,
      friendIds.map(Number)
    );
    for (const friend of friendCounts) {
      if (friend.gameCount >= 10) {
        await conn.rollback();
        return res.status(409).json({ error: `Sorry, ${friend.display_name} has reached the maximum number of games` });
      }
    }

    // Check if a game already exists with exactly these users
    const [existing] = await conn.query(
      `SELECT gu.game_id
       FROM game_users gu
       WHERE gu.user_id IN (${placeholders})
       GROUP BY gu.game_id
       HAVING COUNT(DISTINCT gu.user_id) = ?
         AND gu.game_id IN (
           SELECT game_id FROM game_users GROUP BY game_id HAVING COUNT(*) = ?
         )
       LIMIT 1`,
      [...allUserIds, n, n]
    );

    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: friendIds.length === 1 ? 'A game already exists with that friend' : 'A game already exists with those friends' });
    }

    // Create the game
    const [gameResult] = await conn.query('INSERT INTO games () VALUES ()');
    const gameId = gameResult.insertId;

    // Add all players
    for (const uid of allUserIds) {
      await conn.query('INSERT INTO game_users (game_id, user_id) VALUES (?, ?)', [gameId, uid]);
    }

    // Pick a random question
    const [[question]] = await conn.query('SELECT id FROM questions ORDER BY RAND() LIMIT 1');
    if (!question) {
      await conn.rollback();
      return res.status(500).json({ error: 'No questions available' });
    }
    await conn.query(
      'INSERT INTO game_questions (game_id, question_id, asked_at) VALUES (?, ?, NOW())',
      [gameId, question.id]
    );

    await conn.commit();
    res.json({ gameId });

    // Send push notifications to all players except the creator (fire-and-forget)
    console.log('[push] VAPID configured:', !!process.env.VAPID_PUBLIC_KEY);
    if (process.env.VAPID_PUBLIC_KEY) {
      try {
        const [[creator]] = await db.query('SELECT display_name FROM users WHERE id = ?', [Number(userId)]);
        const creatorName = pushDisplayName(creator?.display_name || '');
        const friendCount = allUserIds.length - 2;
        const withOthers = friendCount > 0 ? ` with ${friendCount} other${friendCount > 1 ? 's' : ''}` : '';
        const body = `${creatorName} started a new game — tap to answer your first question${withOthers}`;
        const notifPayload = { title: 'New Final Jeopardy!', body, url: `/game?id=${gameId}` };
        console.log('[push] sending to friend ids:', friendIds);
        for (const uid of friendIds.map(Number)) {
          sendPush(uid, notifPayload);
        }
      } catch (err) {
        console.error('[push] error:', err);
      }
    }
  } catch (err) {
    await conn.rollback();
    console.error('Create game error:', err);
    res.status(500).json({ error: 'Failed to create game' });
  } finally {
    conn.release();
  }
});

// API: get all games for a user, or a single game by gameId
router.get('/api/games', async (req, res) => {
  const { userId, gameId } = req.query;

  if (gameId) {
    try {
      const escapedUserId = userId ? db.escape(userId) : 'NULL';
      const [[row]] = await db.query(
        `SELECT
           g.id,
           g.created_at,
           (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', u.id, 'display_name', u.display_name, 'avatar_url', u.avatar_url,
                                            'score', (SELECT COUNT(*) FROM game_answers ga2 JOIN game_questions gq2 ON ga2.game_question_id = gq2.id WHERE gq2.game_id = g.id AND ga2.user_id = u.id AND ga2.is_correct = 1)))
            FROM game_users gu2 JOIN users u ON gu2.user_id = u.id
            WHERE gu2.game_id = g.id AND (${escapedUserId} IS NULL OR gu2.user_id != ${escapedUserId})) AS players,
           (SELECT gq.id FROM game_questions gq WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_id,
           (SELECT gq.asked_at FROM game_questions gq WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_asked_at,
           (SELECT q.id FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_question_id,
           (SELECT q.question FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_question,
           (SELECT q.answer FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_answer,
           (SELECT q.category FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_category,
           (SELECT q.originally_asked FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_originally_asked,
           (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', ga.id, 'user_id', ga.user_id, 'game_question_id', ga.game_question_id,
                                             'answer', ga.answer, 'is_correct', ga.is_correct, 'answered_at', ga.answered_at))
            FROM game_answers ga
            WHERE ga.game_question_id = (SELECT gq.id FROM game_questions gq WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1)) AS answers,
           (SELECT COUNT(*) FROM game_answers ga3 JOIN game_questions gq3 ON ga3.game_question_id = gq3.id
            WHERE gq3.game_id = g.id AND ga3.user_id = ${escapedUserId} AND ga3.is_correct = 1) AS my_score,
           (SELECT gq.id FROM game_questions gq WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1 OFFSET 1) AS pq_id,
           (SELECT gq.asked_at FROM game_questions gq WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1 OFFSET 1) AS pq_asked_at,
           (SELECT q.id FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1 OFFSET 1) AS pq_question_id,
           (SELECT q.question FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1 OFFSET 1) AS pq_question,
           (SELECT q.answer FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1 OFFSET 1) AS pq_answer,
           (SELECT q.category FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1 OFFSET 1) AS pq_category,
           (SELECT q.originally_asked FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1 OFFSET 1) AS pq_originally_asked,
           (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', ga.id, 'user_id', ga.user_id, 'game_question_id', ga.game_question_id,
                                             'answer', ga.answer, 'is_correct', ga.is_correct, 'answered_at', ga.answered_at))
            FROM game_answers ga
            WHERE ga.game_question_id = (SELECT gq.id FROM game_questions gq WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1 OFFSET 1)) AS previous_answers
         FROM games g
         WHERE g.id = ?`,
        [Number(gameId)]
      );
      if (!row) return res.status(404).json({ error: 'Game not found' });
      let currentUser = null;
      if (userId) {
        const [[member]] = await db.query(
          'SELECT avatar_url FROM users WHERE id = ? AND EXISTS (SELECT 1 FROM game_users WHERE game_id = ? AND user_id = ?)',
          [Number(userId), Number(gameId), Number(userId)]
        );
        if (!member) return res.status(403).json({ error: 'You are not a participant in this game' });
        currentUser = { avatar_url: member.avatar_url || null };
      }
      const parse = v => typeof v === 'string' ? JSON.parse(v) : v;
      return res.json({
        id: row.id,
        created_at: row.created_at,
        current_user: currentUser,
        players: parse(row.players) || [],
        current_question: row.cq_id ? {
          game_question_id: row.cq_id,
          asked_at: row.cq_asked_at,
          question_id: row.cq_question_id,
          question: row.cq_question,
          answer: title(stripOneOf(row.cq_answer)),
          category: title(row.cq_category),
          originally_asked: row.cq_originally_asked || null,
        } : null,
        answers: parse(row.answers) || [],
        my_score: row.my_score || 0,
        previous_question: row.pq_id ? {
          game_question_id: row.pq_id,
          asked_at: row.pq_asked_at,
          question_id: row.pq_question_id,
          question: row.pq_question,
          answer: title(stripOneOf(row.pq_answer)),
          category: title(row.pq_category),
          originally_asked: row.pq_originally_asked || null,
        } : null,
        previous_answers: parse(row.previous_answers) || [],
      });
    } catch (err) {
      console.error('Get game error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
  }

  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const [rows] = await db.query(
      `SELECT
         g.id,
         g.created_at,
         (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', u.id, 'display_name', u.display_name, 'avatar_url', u.avatar_url,
                                          'score', (SELECT COUNT(*) FROM game_answers ga2 JOIN game_questions gq2 ON ga2.game_question_id = gq2.id WHERE gq2.game_id = g.id AND ga2.user_id = u.id AND ga2.is_correct = 1)))
          FROM game_users gu2 JOIN users u ON gu2.user_id = u.id
          WHERE gu2.game_id = g.id AND gu2.user_id != ${db.escape(userId)}) AS players,
         (SELECT gq.id FROM game_questions gq WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_id,
         (SELECT gq.asked_at FROM game_questions gq WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_asked_at,
         (SELECT q.id FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_question_id,
         (SELECT q.question FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_question,
         (SELECT q.answer FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_answer,
         (SELECT q.category FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1) AS cq_category,
         (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', ga.id, 'user_id', ga.user_id, 'game_question_id', ga.game_question_id,
                                           'answer', ga.answer, 'is_correct', ga.is_correct, 'answered_at', ga.answered_at))
          FROM game_answers ga
          WHERE ga.game_question_id = (SELECT gq.id FROM game_questions gq WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1)) AS answers,
         (SELECT COUNT(*) FROM game_answers ga3 JOIN game_questions gq3 ON ga3.game_question_id = gq3.id
          WHERE gq3.game_id = g.id AND ga3.user_id = ${db.escape(userId)} AND ga3.is_correct = 1) AS my_score,
         (SELECT gq.id FROM game_questions gq WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1 OFFSET 1) AS pq_id,
         (SELECT gq.asked_at FROM game_questions gq WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1 OFFSET 1) AS pq_asked_at,
         (SELECT q.id FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1 OFFSET 1) AS pq_question_id,
         (SELECT q.question FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1 OFFSET 1) AS pq_question,
         (SELECT q.answer FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1 OFFSET 1) AS pq_answer,
         (SELECT q.category FROM game_questions gq JOIN questions q ON gq.question_id = q.id WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1 OFFSET 1) AS pq_category,
         (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', ga.id, 'user_id', ga.user_id, 'game_question_id', ga.game_question_id,
                                           'answer', ga.answer, 'is_correct', ga.is_correct, 'answered_at', ga.answered_at))
          FROM game_answers ga
          WHERE ga.game_question_id = (SELECT gq.id FROM game_questions gq WHERE gq.game_id = g.id ORDER BY gq.id DESC LIMIT 1 OFFSET 1)) AS previous_answers
       FROM games g
       JOIN game_users gu ON g.id = gu.game_id
       WHERE gu.user_id = ${db.escape(userId)}
       ORDER BY g.updated_at DESC`
    );

    const parse = v => typeof v === 'string' ? JSON.parse(v) : v;
    const real = rows.map(row => ({
      id: row.id,
      created_at: row.created_at,
      players: parse(row.players) || [],
      current_question: row.cq_id ? {
        game_question_id: row.cq_id,
        asked_at: row.cq_asked_at,
        question_id: row.cq_question_id,
        question: row.cq_question,
        answer: title(stripOneOf(row.cq_answer)),
        category: title(row.cq_category),
      } : null,
      answers: parse(row.answers) || [],
      my_score: row.my_score || 0,
      previous_question: row.pq_id ? {
        game_question_id: row.pq_id,
        asked_at: row.pq_asked_at,
        question_id: row.pq_question_id,
        question: row.pq_question,
        answer: title(stripOneOf(row.pq_answer)),
        category: title(row.pq_category),
      } : null,
      previous_answers: parse(row.previous_answers) || [],
    }));



    res.json(real);
  } catch (err) {
    console.error('Get games error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// API: submit an answer for a game question
router.post('/api/games/:gameId/answers', async (req, res) => {
  const gameId = Number(req.params.gameId);
  const { playerId, questionId, answer } = req.body;

  if (!playerId || !questionId || answer === undefined) {
    return res.status(400).json({ error: 'Missing required fields: playerId, questionId, answer' });
  }

  const conn = await db.getConnection();
  try {
    // 1. Check player is in this game
    const [[member]] = await conn.execute(
      'SELECT 1 FROM game_users WHERE game_id = ? AND user_id = ?',
      [gameId, Number(playerId)]
    );
    if (!member) return res.status(403).json({ error: 'Player is not part of this game' });

    // 2. Look up the game_questions row (errors if question not linked to game)
    const [[gq]] = await conn.execute(
      `SELECT gq.id AS game_question_id, q.answer AS correct_answer
       FROM game_questions gq
       JOIN questions q ON gq.question_id = q.id
       WHERE gq.game_id = ? AND gq.question_id = ?`,
      [gameId, Number(questionId)]
    );
    if (!gq) return res.status(404).json({ error: 'Question is not part of this game' });

    // 3. Determine correctness
    const correct = isAnswerCorrect(String(answer), gq.correct_answer);

    await conn.beginTransaction();

    // 4. Insert into game_answers (ignore duplicate if already answered)
    await conn.execute(
      `INSERT INTO game_answers (game_question_id, user_id, answer, is_correct)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE answer = VALUES(answer), is_correct = VALUES(is_correct)`,
      [gq.game_question_id, Number(playerId), String(answer), correct]
    );

    // 5. Fetch answers and total players to check if everyone has answered
    const [answers] = await conn.execute(
      `SELECT ga.id, ga.user_id, ga.game_question_id, ga.answer, ga.is_correct, ga.answered_at
       FROM game_answers ga
       WHERE ga.game_question_id = ?`,
      [gq.game_question_id]
    );
    const [[{ total }]] = await conn.execute(
      'SELECT COUNT(*) AS total FROM game_users WHERE game_id = ?',
      [gameId]
    );
    if (answers.length >= total) {
      const [[nextQuestion]] = await conn.execute(
        `SELECT id FROM questions
         WHERE id NOT IN (SELECT question_id FROM game_questions WHERE game_id = ?)
         ORDER BY RAND() LIMIT 1`,
        [gameId]
      );
      if (nextQuestion) {
        await conn.execute(
          'INSERT INTO game_questions (game_id, question_id, asked_at) VALUES (?, ?, NOW())',
          [gameId, nextQuestion.id]
        );
      }
    }

    await conn.commit();

    return res.json(answers);
  } catch (err) {
    await conn.rollback();
    console.error('Submit answer error:', err);
    return res.status(500).json({ error: 'Database error' });
  } finally {
    conn.release();
  }
});

router.delete('/api/games/:gameId', async (req, res) => {
  const { gameId } = req.params;
  try {
    await db.query('DELETE FROM games WHERE id = ?', [Number(gameId)]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete game error:', err);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

module.exports = router;
