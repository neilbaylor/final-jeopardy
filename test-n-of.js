require('./src/app'); // load env
const natural = require('natural');

// Inline the same isAnswerCorrect logic from routes/index.js
function normalizeAnswer(str) {
  str = str.replace(/\b([IVXLCDM]+)\b/g, (m) => {
    if (/[a-z]/.test(m)) return m;
    const vals = { I:1,V:5,X:10,L:50,C:100,D:500,M:1000 };
    let r = 0;
    for (let i = 0; i < m.length; i++) {
      const c = vals[m[i]], n = vals[m[i+1]];
      r += (n && c < n) ? -c : c;
    }
    return r > 0 ? String(r) : m;
  });
  return str.toLowerCase()
    .replace(/[&+,]/g, ' ').replace(/\band\b/g, ' ')
    .replace(/\b(\d+)(?:st|nd|rd|th)\b/g, '$1')
    .replace(/\b(\d+)\b/g, (_, n) => {
      const ones = ['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
      const tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
      function w(x) { if(x===0)return'zero'; if(x<20)return ones[x]; if(x<100)return tens[Math.floor(x/10)]+(x%10?' '+ones[x%10]:''); return String(x); }
      return w(parseInt(n, 10));
    })
    .replace(/['']/g, '').replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();
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
  const oneOfMatch = correctAnswer.match(/^\((\d+)\s+of\)\s*/i);
  if (oneOfMatch) {
    const required = parseInt(oneOfMatch[1], 10);
    const candidates = correctAnswer.slice(oneOfMatch[0].length).split('&').map(s => normalizeAnswer(s.trim()));
    let userParts = userAnswer.split(/\s*(?:&|,|\band\b)\s*/i).map(s => normalizeAnswer(s.trim())).filter(Boolean);
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
  // (1 Of) — single pick from list
  { correct: '(1 Of) Mercury & Venus & Mars',     user: 'Mercury',              expect: true,  note: '(1 of) — correct single pick' },
  { correct: '(1 Of) Mercury & Venus & Mars',     user: 'Venus',                expect: true,  note: '(1 of) — another valid single pick' },
  { correct: '(1 Of) Mercury & Venus & Mars',     user: 'Pluto',                expect: false, note: '(1 of) — wrong planet' },
  { correct: '(1 Of) Mercury & Venus & Mars',     user: 'Mercury & Venus',      expect: false, note: '(1 of) — gave 2, need 1' },
  { correct: '(1 Of) Mercury & Venus & Mars',     user: 'Mercurry',             expect: true,  note: '(1 of) — typo, fuzzy match' },

  // (2 Of) — pick exactly 2 of 5
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

  // (3 Of) — pick exactly 3 of 4
  { correct: '(3 Of) North & South & East & West', user: 'North & South & East',   expect: true,  note: '(3 of) — correct 3' },
  { correct: '(3 Of) North & South & East & West', user: 'North & South & West',   expect: true,  note: '(3 of) — another valid 3' },
  { correct: '(3 Of) North & South & East & West', user: 'North & South',          expect: false, note: '(3 of) — gave 2, need 3' },
  { correct: '(3 Of) North & South & East & West', user: 'North & South & East & West', expect: false, note: '(3 of) — gave all 4, need 3' },
  { correct: '(3 Of) North & South & East & West', user: 'North & South & Up',     expect: false, note: '(3 of) — 2 right 1 wrong' },

  // Alternative separators
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: 'Mercury and Venus',   expect: true,  note: '(2 of) — "and" separator' },
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: 'Mercury, Venus',      expect: true,  note: '(2 of) — comma separator' },
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: 'Mercury Venus',       expect: true,  note: '(2 of) — space separator' },
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: 'mercury venus',       expect: true,  note: '(2 of) — space, lowercase' },
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: 'Pluto and Venus',     expect: false, note: '(2 of) — "and", one wrong' },
  { correct: '(2 Of) Mercury & Venus & Mars & Jupiter & Saturn', user: 'Pluto, Venus',        expect: false, note: '(2 of) — comma, one wrong' },
  { correct: '(3 Of) North & South & East & West',               user: 'North, South, East', expect: true,  note: '(3 of) — comma separator' },
  { correct: '(3 Of) North & South & East & West',               user: 'North and South and East', expect: true, note: '(3 of) — "and" separator' },
  // Space-split ambiguity: 2-word answer where each word is a candidate
  { correct: '(1 Of) Mercury & Venus & Mars',                    user: 'Mercury Venus',       expect: false, note: '(1 of) — space split should not fire (N=1)' },

  // Case / spacing insensitivity
  { correct: '(2 Of) Red & Blue & Green',          user: 'red & blue',            expect: true,  note: '(2 of) — lowercase input' },
  { correct: '(2 Of) Red & Blue & Green',          user: 'RED & BLUE',            expect: true,  note: '(2 of) — uppercase input' },
  { correct: '(2 of) Red & Blue & Green',          user: 'Red & Blue',            expect: true,  note: '(2 of) — lowercase "of" in answer' },

  // Duplicate picks
  { correct: '(2 Of) Red & Blue & Green',          user: 'Red & Red',             expect: false, note: '(2 of) — duplicate picks' },

  // ── Exact match ──────────────────────────────────────────────────────────
  { correct: 'Paris',              user: 'Paris',           expect: true,  note: 'exact match' },
  { correct: 'Paris',              user: 'paris',           expect: true,  note: 'exact match — lowercase' },
  { correct: 'Paris',              user: 'London',          expect: false, note: 'exact match — wrong answer' },
  { correct: 'The Beatles',        user: 'Beatles',         expect: true,  note: 'exact — article "the" stripped' },
  { correct: 'A Streetcar Named Desire', user: 'Streetcar Named Desire', expect: true, note: 'exact — leading article stripped' },

  // ── Fuzzy / typo match ───────────────────────────────────────────────────
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
  { correct: 'Tom & Jerry',        user: 'Tom & Jerry & Spike',  expect: true,  note: 'multi-part — extra name; JW("tom jerry spike","tom jerry")=0.92 ⚠️ known fuzzy over-accept' },

  // ── Optional parentheses ─────────────────────────────────────────────────
  { correct: 'Mt. Everest (Nepal)', user: 'Mt. Everest',          expect: true,  note: 'optional parens — without parens' },
  { correct: 'Mt. Everest (Nepal)', user: 'Mt. Everest Nepal',    expect: true,  note: 'optional parens — including hint' },
  { correct: 'Mt. Everest (Nepal)', user: 'K2',                   expect: false, note: 'optional parens — wrong answer' },

  // ── Roman numerals ───────────────────────────────────────────────────────
  { correct: 'Henry VIII',         user: 'Henry 8',           expect: true,  note: 'roman numeral — VIII = 8' },
  { correct: 'Henry VIII',         user: 'Henry the 8th',     expect: true,  note: 'roman numeral — ordinal form' },
  { correct: 'Super Bowl IV',      user: 'Super Bowl 4',      expect: true,  note: 'roman numeral — IV = 4' },
  { correct: 'World War II',       user: 'World War 2',       expect: true,  note: 'roman numeral — II = 2' },

  // ── Number / ordinal normalization ───────────────────────────────────────
  { correct: 'The 39 Steps',       user: 'The Thirty-Nine Steps', expect: true,  note: 'number norm — hyphen→space, both normalize to "thirty nine steps"' },
  { correct: 'Apollo 13',          user: 'Apollo Thirteen',    expect: true,  note: 'number norm — 13 = thirteen' },
  { correct: '1st',                user: 'first',              expect: false, note: 'ordinal — ordinal stripped, word form does not match' },

  // ── Suffix / leading-qualifier omission (≥72% length, word boundary) ─────
  // correct normalized length vs user normalized length ratios shown
  { correct: 'U.S. Virgin Islands',          user: 'Virgin Islands',         expect: true,  note: 'suffix — omit leading "U.S." qualifier' },
  { correct: 'The United States of America', user: 'States of America',      expect: false, note: 'suffix — too short (<72% of full length)' },
  { correct: 'The United States of America', user: 'United States of America', expect: true, note: 'suffix — omit "The", long enough' },
  { correct: 'Lake Superior',                user: 'Superior',               expect: false, note: 'suffix — single word, a.includes(" ") fails' },
  { correct: 'Mount Saint Helens',           user: 'Saint Helens',           expect: false, note: 'suffix — ratio 0.667 < 0.72, rejected' },
  { correct: 'Mount Saint Helens',           user: 'Helens',                 expect: false, note: 'suffix — single word rejected' },
  { correct: 'New York City',                user: 'York City',              expect: false, note: 'suffix — ratio 0.692 < 0.72, rejected' },
  { correct: 'New York City',                user: 'City',                   expect: false, note: 'suffix — single word rejected' },
  { correct: 'New York City',                user: 'New York',               expect: true,  note: 'suffix — not a suffix, but JW=0.923 ⚠️ fuzzy over-accept' },
  // boundary check — must break on a space, not mid-word
  { correct: 'Springfield',                  user: 'field',                  expect: false, note: 'suffix — no space boundary, single word anyway' },
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

// column widths
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
