require('./src/app'); // load env
const natural = require('natural');

// ─── Mirror of normalizeAnswer / isAnswerCorrect from src/routes/index.js ─────

// Matches well-formed Roman numerals only (1–3999); rejects random all-caps words like "MIDI".
const _romanRe = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

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
  str = str.replace(/\b([IVXLCDM]+)\b/g, (m) => {
    if (/[a-z]/.test(m) || !_romanRe.test(m)) return m;
    const n = romanToNum(m);
    return n > 0 ? String(n) : m;
  });
  return str
    .toLowerCase()
    .replace(/[&+,]/g, ' ')
    .replace(/\band\b/g, ' ')
    .replace(/\b(\d+)(?:st|nd|rd|th)\b/g, '$1')
    .replace(/\b(\d+)\b/g, (_, n) => numToWords(parseInt(n, 10)))
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAnswerCorrect(userAnswer, correctAnswer) {
  const a = normalizeAnswer(userAnswer);
  const b = normalizeAnswer(correctAnswer);
  if (a === b) return true;
  if (natural.JaroWinklerDistance(a, b) >= 0.88) return true;

  const splitConnectors = s => s.split(/\s*(?:\band\b|\bor\b|&)\s*/i).map(p => p.trim()).filter(Boolean);
  const correctParts = splitConnectors(correctAnswer);
  if (correctParts.length > 1) {
    const normCorrect = correctParts.map(normalizeAnswer).sort();
    let userParts = splitConnectors(userAnswer);
    if (userParts.length !== correctParts.length) {
      const spaceParts = userAnswer.trim().split(/\s+/);
      if (spaceParts.length === correctParts.length) userParts = spaceParts;
    }
    if (userParts.length === correctParts.length) {
      const normUser = userParts.map(normalizeAnswer).sort();
      if (normCorrect.every((p, i) => p === normUser[i] || natural.JaroWinklerDistance(p, normUser[i]) >= 0.88)) return true;
    }
  }

  // "(N Of) X & Y & Z" — user must name exactly N of the listed answers.
  const oneOfMatch = correctAnswer.match(/^\((\d+)\s+of(?:\s+\d+)?\)\s*/i);
  if (oneOfMatch) {
    const required = parseInt(oneOfMatch[1], 10);
    const candidates = correctAnswer.slice(oneOfMatch[0].length).split(/\s*(?:&|,|\band\b|\bor\b)\s*/i).map(s => normalizeAnswer(s.trim()));
    let userParts = userAnswer.split(/\s*(?:&|,|\band\b|\bor\b)\s*/i).map(s => normalizeAnswer(s.trim())).filter(Boolean);
    // Fallback: if no explicit separator found and N > 1, try splitting on whitespace
    if (userParts.length === 1 && required > 1) {
      userParts = userAnswer.trim().split(/\s+/).map(s => normalizeAnswer(s));
    }
    if (userParts.length !== required) return false;
    const nOfFuzzy = (u, c) => {
      if (u === c) return true;
      const ratio = Math.min(u.length, c.length) / Math.max(u.length, c.length);
      return ratio >= 0.7 && natural.JaroWinklerDistance(u, c) >= 0.88;
    };
    const usedCandidates = new Set();
    const matched = userParts.filter(u => {
      const idx = candidates.findIndex((c, i) => !usedCandidates.has(i) && nOfFuzzy(u, c));
      if (idx === -1) return false;
      usedCandidates.add(idx);
      return true;
    });
    return matched.length === required;
  }

  if (a.includes(' ') && b.endsWith(a) && b.length > a.length && b[b.length - a.length - 1] === ' ' && a.length / b.length >= 0.72) return true;
  if (/\(/.test(correctAnswer)) {
    const withoutOptional = normalizeAnswer(correctAnswer.replace(/\([^)]*\)/g, ''));
    if (a === withoutOptional) return true;
    if (natural.JaroWinklerDistance(a, withoutOptional) >= 0.88) return true;
  }
  return false;
}

// ─── Test cases ───────────────────────────────────────────────────────────────

const tests = [
  // ── (1 Of) — single pick from list ───────────────────────────────────────
  { correct: '(1 Of) Mercury & Venus & Mars',     user: 'Mercury',              expect: true,  note: '(1 of) — correct single pick' },
  { correct: '(1 Of) Mercury & Venus & Mars',     user: 'Venus',                expect: true,  note: '(1 of) — another valid single pick' },
  { correct: '(1 Of) Mercury & Venus & Mars',     user: 'Pluto',                expect: false, note: '(1 of) — wrong planet' },
  { correct: '(1 Of) Mercury & Venus & Mars',     user: 'Mercury & Venus',      expect: false, note: '(1 of) — gave 2, need 1' },
  { correct: '(1 Of) Mercury & Venus & Mars',     user: 'Mercurry',             expect: true,  note: '(1 of) — typo, fuzzy match' },

  // ── (2 Of) — pick exactly 2 of 5 ─────────────────────────────────────────
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: 'Mercury',                    expect: false, note: '(2 of) — gave 1, need 2' },
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: 'Mercury & Venus',            expect: true,  note: '(2 of) — exact 2 correct' },
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: 'Venus & Mars',               expect: true,  note: '(2 of) — different valid pair' },
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: 'Jupiter & Saturn',           expect: true,  note: '(2 of) — last two' },
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: 'Mercury & Venus & Mars',     expect: false, note: '(2 of) — gave 3, need 2' },
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: 'Pluto & Venus',              expect: false, note: '(2 of) — one wrong, one right' },
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: 'Pluto & Uranus',             expect: false, note: '(2 of) — both wrong' },
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: 'Mercurry & Veenus',          expect: true,  note: '(2 of) — both fuzzy match' },
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: 'Mercury & Pluto',            expect: false, note: '(2 of) — 1 right 1 wrong' },
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: '',                           expect: false, note: '(2 of) — empty answer' },

  // ── (3 Of) — pick exactly 3 of 4 ─────────────────────────────────────────
  { correct: '(3 Of) North & South & East & West', user: 'North & South & East',        expect: true,  note: '(3 of) — correct 3' },
  { correct: '(3 Of) North & South & East & West', user: 'North & South & West',        expect: true,  note: '(3 of) — another valid 3' },
  { correct: '(3 Of) North & South & East & West', user: 'North & South',               expect: false, note: '(3 of) — gave 2, need 3' },
  { correct: '(3 Of) North & South & East & West', user: 'North & South & East & West', expect: false, note: '(3 of) — gave all 4, need 3' },
  { correct: '(3 Of) North & South & East & West', user: 'North & South & Up',          expect: false, note: '(3 of) — 2 right 1 wrong' },

  // ── Alternative separators ────────────────────────────────────────────────
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: 'Mercury and Venus',   expect: true,  note: '(2 of) — "and" separator' },
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: 'Mercury or Venus',    expect: true,  note: '(2 of) — "or" separator' },
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: 'Mercury, Venus',      expect: true,  note: '(2 of) — comma separator' },
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: 'Mercury Venus',       expect: true,  note: '(2 of) — space separator' },
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: 'mercury venus',       expect: true,  note: '(2 of) — space, lowercase' },
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: 'Pluto and Venus',     expect: false, note: '(2 of) — "and", one wrong' },
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: 'Pluto, Venus',        expect: false, note: '(2 of) — comma, one wrong' },
  { correct: '(3 Of) North & South & East & West',               user: 'North, South, East',      expect: true,  note: '(3 of) — comma separator' },
  { correct: '(3 Of) North & South & East & West',               user: 'North and South and East', expect: true,  note: '(3 of) — "and" separator' },
  { correct: '(3 Of) North & South & East & West',               user: 'North or South or East',   expect: true,  note: '(3 of) — "or" separator' },
  { correct: '(3 Of) North or South or East or West',            user: 'North or South or East',   expect: true,  note: '(3 of) — "or" in correct, "or" in user' },
  { correct: '(3 Of) North or South or East or West',            user: 'North & South & East',     expect: true,  note: '(3 of) — "or" in correct, "&" in user' },
  // Space-split should not fire for N=1
  { correct: '(1 Of) Mercury & Venus & Mars',                    user: 'Mercury Venus',       expect: false, note: '(1 of) — space split must not fire (N=1)' },

  // ── Case / spacing insensitivity ──────────────────────────────────────────
  { correct: '(2 Of) Red & Blue & Green',          user: 'red & blue',            expect: true,  note: '(2 of) — lowercase input' },
  { correct: '(2 Of) Red & Blue & Green',          user: 'RED & BLUE',            expect: true,  note: '(2 of) — uppercase input' },
  { correct: '(2 of) Red & Blue & Green',          user: 'Red & Blue',            expect: true,  note: '(2 of) — lowercase "of" in correct' },

  // ── Duplicate picks ───────────────────────────────────────────────────────
  { correct: '(2 Of) Red & Blue & Green',          user: 'Red & Red',             expect: false, note: '(2 of) — duplicate picks rejected' },

  // ── (N of N) format — second number present ───────────────────────────────
  // isAnswerCorrect regex only matches "(N of)" — "(N of N)" is unhandled → FAILS
  { correct: '(1 of 3) Mercury & Venus & Mars',          user: 'Mercury',         expect: true,  note: '(1 of 3) — valid single pick ⚠️ unhandled format' },
  { correct: '(1 of 3) Mercury & Venus & Mars',          user: 'Pluto',           expect: false, note: '(1 of 3) — wrong pick' },
  { correct: '(2 of 4) North & South & East & West',     user: 'North & South',   expect: true,  note: '(2 of 4) — valid 2 picks ⚠️ unhandled format' },

  // ── Exact match ───────────────────────────────────────────────────────────
  { correct: 'Paris',              user: 'Paris',           expect: true,  note: 'exact match' },
  { correct: 'Paris',              user: 'paris',           expect: true,  note: 'exact match — lowercase' },
  { correct: 'Paris',              user: 'London',          expect: false, note: 'exact match — wrong answer' },
  { correct: 'The Beatles',        user: 'Beatles',         expect: true,  note: 'exact — article "the" stripped' },
  { correct: 'A Streetcar Named Desire', user: 'Streetcar Named Desire', expect: true, note: 'exact — leading article stripped' },

  // ── Fuzzy / typo match ────────────────────────────────────────────────────
  { correct: 'Shakespeare',        user: 'Shakespere',      expect: true,  note: 'fuzzy — 1-char typo' },
  { correct: 'Shakespeare',        user: 'Shakespear',      expect: true,  note: 'fuzzy — missing trailing e' },
  { correct: 'Shakespeare',        user: 'Shakspeare',      expect: true,  note: 'fuzzy — missing middle e' },
  { correct: 'Shakespeare',        user: 'Chopsticks',      expect: false, note: 'fuzzy — completely wrong' },

  // ── Multi-part answers (& connector) ─────────────────────────────────────
  { correct: 'Simon & Garfunkel',  user: 'Simon and Garfunkel', expect: true,  note: 'multi-part — "and" for "&"' },
  { correct: 'Simon & Garfunkel',  user: 'Garfunkel & Simon',  expect: true,  note: 'multi-part — order swapped' },
  { correct: 'Simon & Garfunkel',  user: 'Simon',               expect: false, note: 'multi-part — only one half' },
  { correct: 'Tom & Jerry',        user: 'Tom and Jerry',        expect: true,  note: 'multi-part — "and" separator' },
  { correct: 'Tom & Jerry',        user: 'Jerry',                expect: false, note: 'multi-part — only one half' },
  { correct: 'Tom & Jerry',        user: 'Tom & Jerry & Spike',  expect: true,  note: 'multi-part — extra name; JW over-accept ⚠️ known' },

  // ── Multi-part space-split fallback ───────────────────────────────────────
  // When user gives no connector, correct has 2 parts — space split used
  { correct: 'W and JFK',          user: 'JFK W',           expect: true,  note: 'multi-part — space-split fallback, reversed order' },
  { correct: 'Tom and Jerry',      user: 'Jerry Tom',        expect: true,  note: 'multi-part — space-split fallback, reversed' },

  // ── Optional parentheses — content stripped or included ───────────────────
  { correct: 'Mt. Everest (Nepal)',  user: 'Mt. Everest',         expect: true,  note: 'optional parens — suffix hint stripped' },
  { correct: 'Mt. Everest (Nepal)',  user: 'Mt. Everest Nepal',   expect: true,  note: 'optional parens — hint included' },
  { correct: 'Mt. Everest (Nepal)',  user: 'K2',                  expect: false, note: 'optional parens — wrong answer' },
  { correct: '(Randolph) Caldecott', user: 'Caldecott',           expect: true,  note: 'optional parens — prefix name optional' },
  { correct: '(Randolph) Caldecott', user: 'Randolph Caldecott',  expect: true,  note: 'optional parens — full name accepted' },
  { correct: 'Caldecott (Medal)',    user: 'Caldecott',           expect: true,  note: 'optional parens — trailing hint stripped' },
  { correct: 'Caldecott (Medal)',    user: 'Caldecott Medal',     expect: true,  note: 'optional parens — hint included' },

  // ── Roman numerals ────────────────────────────────────────────────────────
  { correct: 'Henry VIII',         user: 'Henry 8',           expect: true,  note: 'roman numeral — VIII = 8' },
  { correct: 'Henry VIII',         user: 'Henry the 8th',     expect: true,  note: 'roman numeral — ordinal form' },
  { correct: 'Super Bowl IV',      user: 'Super Bowl 4',      expect: true,  note: 'roman numeral — IV = 4' },
  { correct: 'World War II',       user: 'World War 2',       expect: true,  note: 'roman numeral — II = 2' },

  // ── All-caps sequences that are NOT valid roman numerals ──────────────────
  // _romanRe rejects these; they must stay as words, not become numbers
  { correct: 'MIDI controller',    user: 'midi controller',   expect: true,  note: 'all-caps non-roman — MIDI must not be converted' },
  { correct: 'DVD',                user: 'dvd',               expect: true,  note: 'all-caps non-roman — DVD must not be converted' },

  // ── Number / ordinal normalization ────────────────────────────────────────
  { correct: 'The 39 Steps',       user: 'The Thirty-Nine Steps', expect: true,  note: 'number norm — hyphen→space, normalizes to "thirty nine steps"' },
  { correct: 'Apollo 13',          user: 'Apollo Thirteen',    expect: true,  note: 'number norm — 13 = thirteen' },
  { correct: '1st',                user: 'first',              expect: false, note: 'ordinal — ordinal stripped, word form does not match' },
  { correct: 'Apollo 100',         user: 'Apollo One Hundred', expect: true,  note: 'number norm — 100 = one hundred' },
  { correct: '1776',               user: 'One Thousand Seven Hundred Seventy Six', expect: true, note: 'number norm — full word form of 1776' },
  { correct: '1776',               user: 'Seventeen Seventy Six', expect: false, note: 'number norm — spoken shorthand ≠ literal word form' },

  // ── Apostrophe normalization ──────────────────────────────────────────────
  { correct: "Rock 'n' Roll",      user: "Rock n Roll",        expect: true,  note: "apostrophe — curly apostrophe stripped" },
  { correct: "O'Brien",            user: "OBrien",             expect: true,  note: "apostrophe — name apostrophe stripped" },

  // ── Suffix / leading-qualifier omission (≥72% length, word boundary) ──────
  { correct: 'U.S. Virgin Islands',           user: 'Virgin Islands',          expect: true,  note: 'suffix — omit leading "U.S." qualifier' },
  { correct: 'British Virgin Islands',        user: 'Virgin Islands',          expect: false, note: 'suffix — ratio 0.609 < 0.72, rejected' },
  { correct: 'The United States of America',  user: 'States of America',       expect: false, note: 'suffix — too short (<72% of full length)' },
  { correct: 'The United States of America',  user: 'United States of America', expect: true, note: 'suffix — omit "The", long enough' },
  { correct: 'Lake Superior',                 user: 'Superior',                expect: false, note: 'suffix — single word, a.includes(" ") fails' },
  { correct: 'Mount Saint Helens',            user: 'Saint Helens',            expect: false, note: 'suffix — ratio 0.667 < 0.72, rejected' },
  { correct: 'Mount Saint Helens',            user: 'Helens',                  expect: false, note: 'suffix — single word rejected' },
  { correct: 'New York City',                 user: 'York City',               expect: false, note: 'suffix — ratio 0.692 < 0.72, rejected' },
  { correct: 'New York City',                 user: 'City',                    expect: false, note: 'suffix — single word rejected' },
  { correct: 'New York City',                 user: 'New York',                expect: true,  note: 'suffix — not a suffix, but JW=0.923 ⚠️ fuzzy over-accept' },
  { correct: 'Springfield',                   user: 'field',                   expect: false, note: 'suffix — no space boundary, single word anyway' },
];

// ─── Run & print table ────────────────────────────────────────────────────────

let pass = 0, fail = 0;

const rows = tests.map(t => {
  const got = isAnswerCorrect(t.user, t.correct);
  const ok = got === t.expect;
  if (ok) pass++; else fail++;
  return {
    correct: t.correct.length > 42 ? t.correct.slice(0, 40) + '…' : t.correct,
    user: t.user || '(empty)',
    expect: t.expect ? 'Accept' : 'Reject',
    got: got ? 'Accept' : 'Reject',
    pass: ok ? '✅' : '❌',
    note: t.note,
  };
});

const w = {
  correct: Math.max(14, ...rows.map(r => r.correct.length)),
  user:    Math.max(11, ...rows.map(r => r.user.length)),
  note:    Math.max(4,  ...rows.map(r => r.note.length)),
};

const hr = `|${'-'.repeat(w.correct+2)}|${'-'.repeat(w.user+2)}|--------|---------|----|${'-'.repeat(w.note+2)}|`;
const hd = `| ${'Correct Answer'.padEnd(w.correct)} | ${'User Answer'.padEnd(w.user)} | Expect | Got     | Ok | ${'Note'.padEnd(w.note)} |`;

console.log('');
console.log(hd);
console.log(hr);
for (const r of rows) {
  console.log(`| ${r.correct.padEnd(w.correct)} | ${r.user.padEnd(w.user)} | ${r.expect.padEnd(6)} | ${r.got.padEnd(7)} | ${r.pass}  | ${r.note.padEnd(w.note)} |`);
}
console.log('');
console.log(`Result: ${pass}/${tests.length} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
