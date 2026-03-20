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
    const userParts = userAnswer.split(/\s*&\s*/).map(s => normalizeAnswer(s.trim()));
    if (userParts.length !== required) return false;
    const usedCandidates = new Set();
    const matched = userParts.filter(u => {
      const idx = candidates.findIndex((c, i) => !usedCandidates.has(i) && (u === c || natural.JaroWinklerDistance(u, c) >= 0.88));
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

  // Case / spacing insensitivity
  { correct: '(2 Of) Red & Blue & Green',          user: 'red & blue',            expect: true,  note: '(2 of) — lowercase input' },
  { correct: '(2 Of) Red & Blue & Green',          user: 'RED & BLUE',            expect: true,  note: '(2 of) — uppercase input' },
  { correct: '(2 of) Red & Blue & Green',          user: 'Red & Blue',            expect: true,  note: '(2 of) — lowercase "of" in answer' },

  // Duplicate picks
  { correct: '(2 Of) Red & Blue & Green',          user: 'Red & Red',             expect: false, note: '(2 of) — duplicate picks' },
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
