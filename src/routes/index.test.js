process.env.NODE_ENV = 'test';

// Stub out db and passport so the router module loads cleanly
require.cache[require.resolve('../config/database')] = { id: '../config/database', exports: {} };
const passport = require('passport');

const { isAnswerCorrect } = require('./index')._test;

const cases = [
  // ── Leading qualifier (the new suffix rule) ──────────────────────────────
  { user: 'Virgin Islands',       correct: 'U.S. Virgin Islands',    expect: true,  note: 'drops U.S. qualifier' },
  { user: 'Virgin Islands',       correct: 'British Virgin Islands',  expect: true,  note: 'drops British qualifier' },
  { user: 'city',                 correct: 'Mexico City',             expect: false, note: 'single word — too short' },
  { user: 'Islands',              correct: 'U.S. Virgin Islands',     expect: false, note: 'single word — too short' },
  { user: 'New Mexico',           correct: 'New Mexico',              expect: true,  note: 'exact multi-word match' },
  { user: 'New Mexico',           correct: 'Old New Mexico',          expect: true,  note: 'drops Old prefix, ratio 71% — passes (contrived)' },
  { user: 'Guinea',               correct: 'Papua New Guinea',        expect: false, note: 'single word — too short' },
  { user: 'New Guinea',           correct: 'Papua New Guinea',        expect: true,  note: 'drops Papua, ratio 76%' },

  // ── Existing behaviour sanity checks ─────────────────────────────────────
  { user: 'Paris',                correct: 'Paris',                   expect: true,  note: 'exact match' },
  { user: 'paris',                correct: 'Paris',                   expect: true,  note: 'case insensitive' },
  { user: 'Pariz',                correct: 'Paris',                   expect: true,  note: 'fuzzy (Jaro-Winkler)' },
  { user: 'London',               correct: 'Paris',                   expect: false, note: 'wrong answer' },
  { user: 'Randolph Caldecott',   correct: '(Randolph) Caldecott',    expect: true,  note: 'optional parenthetical included' },
  { user: 'Caldecott',            correct: '(Randolph) Caldecott',    expect: true,  note: 'optional parenthetical omitted' },
  { user: 'Joe Ross and Neil Taylor', correct: 'Neil Taylor and Joe Ross', expect: true, note: 'order-independent' },
];

let pass = 0, fail = 0;
const rows = cases.map(({ user, correct, expect, note }) => {
  const got = isAnswerCorrect(user, correct);
  const ok = got === expect;
  if (ok) pass++; else fail++;
  return { user, correct, expect: expect ? '✓' : '✗', got: got ? '✓' : '✗', status: ok ? 'PASS' : 'FAIL', note };
});

// Print table
const col = (s, n) => String(s).padEnd(n);
const W = [28, 28, 7, 5, 5, 35];
const header = ['user answer', 'correct answer', 'expect', 'got', 'pass', 'note'];
const sep = W.map(w => '-'.repeat(w)).join('-+-');
console.log(header.map((h, i) => col(h, W[i])).join(' | '));
console.log(sep);
rows.forEach(r => {
  const cells = [r.user, r.correct, r.expect, r.got, r.status, r.note];
  console.log(cells.map((c, i) => col(c, W[i])).join(' | '));
});
console.log(sep);
console.log(`${pass}/${cases.length} passed${fail ? `  ← ${fail} FAILED` : ''}`);
process.exit(fail > 0 ? 1 : 0);
