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
  str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  str = str.replace(/['\u2018\u2019]/g, '');
  str = str.replace(/\b([IVXLCDMivxlcdm]+)\b/g, (m) => {
    const u = m.toUpperCase();
    if (!_romanRe.test(u)) return m;
    const n = romanToNum(u);
    return n > 0 ? String(n) : m;
  });
  return str
    .toLowerCase()
    .replace(/[&+,]/g, ' ')
    .replace(/\band\b/g, ' ')
    .replace(/\b(\d+)(?:st|nd|rd|th)\b/g, '$1')
    .replace(/\b(\d+)\b/g, (_, n) => numToWords(parseInt(n, 10)))
    .replace(/['\u2018\u2019]/g, '') // strip apostrophes (ASCII + smart quotes)
    .replace(/[^a-z0-9\s]/g, ' ')
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

function extractLastName(namePart) {
  const words = namePart.trim().split(/\s+/);
  if (words.length === 2 && COMMON_FIRST_NAMES.has(words[0].toLowerCase())) {
    return words[1];
  }
  return null;
}

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

  const splitConnectors = s => s.split(/\s*(?:\band\b|\bor\b|[&,])\s*/i).map(p => p.trim()).filter(Boolean);
  const correctParts = splitConnectors(correctAnswer);
  if (correctParts.length > 1) {
    let userParts = splitConnectors(userAnswer);
    if (userParts.length !== correctParts.length) {
      const spaceParts = userAnswer.trim().split(/\s+/);
      if (spaceParts.length === correctParts.length) userParts = spaceParts;
    }
    if (userParts.length === correctParts.length) {
      const normUser = userParts.map(normalizeAnswer);
      const normCorrect = correctParts.map(normalizeAnswer);
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
  const oneOfMatch = correctAnswer.match(/^\((\d+)\s+of(?:\s+\d+)?\)\s*/i);
  if (oneOfMatch) {
    const required = parseInt(oneOfMatch[1], 10);
    const candidatesOrig = correctAnswer.slice(oneOfMatch[0].length).split(/\s*(?:&|,|\band\b|\bor\b)\s*/i).map(s => s.trim());
    const candidates = candidatesOrig.map(s => normalizeAnswer(s));
    let userParts = userAnswer.split(/\s*(?:&|,|\band\b|\bor\b)\s*/i).map(s => normalizeAnswer(s.trim())).filter(Boolean);
    if (userParts.length === 1 && required > 1) {
      userParts = userAnswer.trim().split(/\s+/).map(s => normalizeAnswer(s));
    }
    if (userParts.length !== required) return false;
    const nOfFuzzy = (u, cNorm, cOrig) => {
      if (u === cNorm) return true;
      const ratio = Math.min(u.length, cNorm.length) / Math.max(u.length, cNorm.length);
      if (ratio >= 0.7 && natural.JaroWinklerDistance(u, cNorm) >= 0.88) return true;
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

  if (a.includes(' ') && b.endsWith(a) && b.length > a.length && b[b.length - a.length - 1] === ' ' && a.length / b.length >= 0.72) return true;
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

  // Last-name-only: single "FirstName LastName" correct answer — also accept just the last name.
  const singleLn = extractLastName(correctAnswer);
  if (singleLn !== null) {
    const lnNorm = normalizeAnswer(singleLn);
    if (a === lnNorm) return true;
    if (natural.JaroWinklerDistance(a, lnNorm) >= 0.88) return true;
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

  // ── Ayn Rand edge cases ───────────────────────────────────────────────────
  { correct: 'Ayn Rand',               user: 'Rand',              expect: true,  note: 'Ayn Rand — last name only' },
  { correct: 'Ayn Rand',               user: 'Ann Rand',          expect: true,  note: 'Ayn Rand — "Ayn" fuzzy matches "Ann"' },
  { correct: 'Ayn Rand',               user: 'Ayn Rand',          expect: true,  note: 'Ayn Rand — exact match' },

  // ── Last-name-only: single person ─────────────────────────────────────────
  { correct: 'John Thompson',          user: 'Thompson',            expect: true,  note: 'last-name — single person, last name only' },
  { correct: 'John Thompson',          user: 'John Thompson',       expect: true,  note: 'last-name — single person, full name still accepted' },
  { correct: 'John Thompson',          user: 'John',                expect: false, note: 'last-name — first name only rejected' },
  { correct: 'John Thompson',          user: 'Smith',               expect: false, note: 'last-name — wrong last name rejected' },
  { correct: 'Mary Johnson',           user: 'Johnson',             expect: true,  note: 'last-name — female first name, last name only' },
  { correct: 'Mary Johnson',           user: 'mary johnson',        expect: true,  note: 'last-name — full name lowercase accepted' },
  { correct: 'Michael Jordan',         user: 'Jordan',              expect: true,  note: 'last-name — single person, last name only' },
  { correct: 'Michael Jordan',         user: 'Jordon',              expect: true,  note: 'last-name — last name typo still matches' },

  // ── Last-name-only: non-person answers should NOT trigger ──────────────────
  { correct: 'New York',               user: 'York',                expect: false, note: 'last-name — not a person name, should not accept last word' },
  { correct: 'Mount Everest',          user: 'Everest',             expect: false, note: 'last-name — "Mount" not a first name, no last-name logic' },
  { correct: 'Jupiter',               user: 'Jupiter',              expect: true,  note: 'last-name — single word, exact match' },

  // ── Last-name-only: two people joined by "and" ────────────────────────────
  { correct: 'John Thompson and Tyler Clark',   user: 'Thompson and Clark',   expect: true,  note: 'last-name — two people, both last names' },
  { correct: 'John Thompson and Tyler Clark',   user: 'Thompson & Clark',     expect: true,  note: 'last-name — two people, & separator' },
  { correct: 'John Thompson and Tyler Clark',   user: 'Clark and Thompson',   expect: true,  note: 'last-name — two people, reversed order' },
  { correct: 'John Thompson and Tyler Clark',   user: 'Thompson',             expect: false, note: 'last-name — two people, only one last name given' },
  { correct: 'John Thompson and Tyler Clark',   user: 'Smith and Clark',      expect: false, note: 'last-name — two people, one wrong last name' },
  { correct: 'John Thompson and Tyler Clark',   user: 'John Thompson',        expect: true,  note: 'last-name — two people, one full name; JW prefix over-accept ⚠️ known' },

  // ── Last-name-only: two people joined by "&" ─────────────────────────────
  { correct: 'Neil Taylor & Joe Ross',          user: 'Taylor and Ross',      expect: true,  note: 'last-name — & in correct, full last names' },
  { correct: 'Neil Taylor & Joe Ross',          user: 'Ross & Taylor',        expect: true,  note: 'last-name — & in correct, reversed order' },
  { correct: 'Neil Taylor & Joe Ross',          user: 'Taylor',               expect: false, note: 'last-name — & in correct, only one last name' },

  // ── Last-name-only: (1 of N) with person names ────────────────────────────
  { correct: '(1 Of) John Thompson & Tyler Clark & Mike Johnson',  user: 'Thompson',  expect: true,  note: 'last-name + (1 of) — pick one last name' },
  { correct: '(1 Of) John Thompson & Tyler Clark & Mike Johnson',  user: 'Clark',     expect: true,  note: 'last-name + (1 of) — different last name' },
  { correct: '(1 Of) John Thompson & Tyler Clark & Mike Johnson',  user: 'Johnson',   expect: true,  note: 'last-name + (1 of) — third last name' },
  { correct: '(1 Of) John Thompson & Tyler Clark & Mike Johnson',  user: 'Smith',     expect: false, note: 'last-name + (1 of) — wrong last name' },
  { correct: '(1 Of) John Thompson & Tyler Clark & Mike Johnson',  user: 'Thompson & Clark', expect: false, note: 'last-name + (1 of) — gave 2, need 1' },
  { correct: '(1 Of) John Thompson & Tyler Clark & Mike Johnson',  user: 'John Thompson', expect: true, note: 'last-name + (1 of) — full name still accepted' },

  // ── Last-name-only: (2 of N) with person names ────────────────────────────
  { correct: '(2 Of) John Thompson & Tyler Clark & Mike Johnson',  user: 'Thompson & Clark',   expect: true,  note: 'last-name + (2 of) — both last names' },
  { correct: '(2 Of) John Thompson & Tyler Clark & Mike Johnson',  user: 'Clark & Johnson',    expect: true,  note: 'last-name + (2 of) — different valid pair' },
  { correct: '(2 Of) John Thompson & Tyler Clark & Mike Johnson',  user: 'Thompson',            expect: false, note: 'last-name + (2 of) — only one last name given' },
  { correct: '(2 Of) John Thompson & Tyler Clark & Mike Johnson',  user: 'Thompson & Smith',   expect: false, note: 'last-name + (2 of) — one wrong last name' },

  // ── Last-name-only: (1 of M) format ──────────────────────────────────────
  { correct: '(1 of 3) John Thompson & Tyler Clark & Mike Johnson', user: 'Thompson', expect: true,  note: 'last-name + (1 of 3) — last name accepted' },
  { correct: '(1 of 3) John Thompson & Tyler Clark & Mike Johnson', user: 'Clark',    expect: true,  note: 'last-name + (1 of 3) — another last name' },
  { correct: '(1 of 3) John Thompson & Tyler Clark & Mike Johnson', user: 'Smith',    expect: false, note: 'last-name + (1 of 3) — wrong last name' },

  // ── Last-name-only: mixed — some names, some non-names ───────────────────
  // If only some parts are names, only those parts get last-name treatment
  { correct: 'John Thompson and Paris',  user: 'Thompson and Paris',  expect: true,  note: 'last-name — mixed: person + non-person' },

  // ── Last-name-only: three-word names should NOT trigger ───────────────────
  { correct: 'Mary Jo Smith',            user: 'Smith',               expect: false, note: 'last-name — 3-word name, no last-name simplification' },

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

  // ── Comma-separated correct answers ───────────────────────────────────────
  // Commas in the DB answer are treated as part separators, same as "and" / "&"
  { correct: 'Jamaica, Jordan, and Japan',  user: 'Jordan Jamaica Japan',      expect: true,  note: 'comma — 3 countries, space-split no connector, any order' },
  { correct: 'Jamaica, Jordan, and Japan',  user: 'Jamaica, Jordan, and Japan', expect: true,  note: 'comma — exact match' },
  { correct: 'Jamaica, Jordan, and Japan',  user: 'Jamaica and Jordan and Japan', expect: true, note: 'comma — "and" separator in user input' },
  { correct: 'Jamaica, Jordan, and Japan',  user: 'Japan Jordan Jamaica',      expect: true,  note: 'comma — different order, space-split' },
  { correct: 'Red, White, and Blue',        user: 'White Blue Red',            expect: true,  note: 'comma — 3 colors, space-split no connector' },
  { correct: 'Red, White, and Blue',        user: 'Red, White, and Blue',      expect: true,  note: 'comma — 3 colors, exact match' },
  { correct: 'Faith, Hope, and Charity',    user: 'Hope Faith Charity',        expect: true,  note: 'comma — 3 words, space-split any order' },

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

  // ── Lowercase / mixed-case roman numerals ────────────────────────────────
  { correct: 'Henry Viii',          user: 'Henry viii',        expect: true,  note: 'roman numeral — lowercase viii matches Viii' },
  { correct: 'Henry VIII',          user: 'Henry viii',        expect: true,  note: 'roman numeral — lowercase viii matches VIII' },
  { correct: 'World War ii',        user: 'World War 2',       expect: true,  note: 'roman numeral — lowercase ii = 2' },
  { correct: 'Super Bowl iv',       user: 'Super Bowl 4',      expect: true,  note: 'roman numeral — lowercase iv = 4' },

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

  // ── "X or Y" — pure "or" connector: accept either alternative ────────────
  { correct: 'Neil or Joe',              user: 'Neil',              expect: true,  note: '"X or Y" — first option accepted' },
  { correct: 'Neil or Joe',              user: 'Joe',               expect: true,  note: '"X or Y" — second option accepted' },
  { correct: 'Neil or Joe',              user: 'Bob',               expect: false, note: '"X or Y" — non-option rejected' },
  { correct: 'Neil or Joe',             user: 'Neil and Joe',       expect: true,  note: '"X or Y" — both parts still accepted (multi-part path)' },
  { correct: 'Neil or Joe',             user: 'Joe or Neil',        expect: true,  note: '"X or Y" — reversed order still accepted' },
  { correct: 'Paris or London',          user: 'Paris',             expect: true,  note: '"X or Y" — first city' },
  { correct: 'Paris or London',          user: 'London',            expect: true,  note: '"X or Y" — second city' },
  { correct: 'Paris or London',          user: 'Berlin',            expect: false, note: '"X or Y" — wrong city rejected' },
  { correct: 'Paris or London',          user: 'Londun',            expect: true,  note: '"X or Y" — fuzzy match on alternative' },
  { correct: 'True or False',            user: 'True',              expect: true,  note: '"X or Y" — first of two simple words' },
  { correct: 'True or False',            user: 'False',             expect: true,  note: '"X or Y" — second of two simple words' },
  { correct: 'A or B or C',             user: 'B',                 expect: true,  note: '"X or Y or Z" — middle option accepted' },
  { correct: 'A or B or C',             user: 'C',                 expect: true,  note: '"X or Y or Z" — last option accepted' },
  { correct: 'A or B or C',             user: 'D',                 expect: false, note: '"X or Y or Z" — non-option rejected' },
  // "and" / "&" connectors still require all parts
  // Note: short prefix like "Neil" JW-matches "neil joe" (≈0.9) — known JW over-accept ⚠️
  { correct: 'Neil and Joe',            user: 'Neil',              expect: true,  note: '"X and Y" — JW prefix over-accept ⚠️ known' },
  { correct: 'Neil and Joe',            user: 'Joe',               expect: false, note: '"X and Y" — second half alone rejected' },
  { correct: 'Neil & Joe',              user: 'Neil',              expect: true,  note: '"X & Y" — JW prefix over-accept ⚠️ known' },
  // Last-name matching on or-alternatives
  { correct: 'Neil Taylor or Joe Ross', user: 'Taylor',            expect: true,  note: '"X or Y" names — last name of first option' },
  { correct: 'Neil Taylor or Joe Ross', user: 'Ross',              expect: true,  note: '"X or Y" names — last name of second option' },
  { correct: 'Neil Taylor or Joe Ross', user: 'Neil Taylor',       expect: true,  note: '"X or Y" names — full first option accepted' },
  { correct: 'Neil Taylor or Joe Ross', user: 'Smith',             expect: false, note: '"X or Y" names — wrong last name rejected' },

  // Diacritic normalization
  { correct: "CôTe D'ivoire",           user: "Cote d'Ivoire",     expect: true,  note: 'diacritics: ô matches o, case-insensitive' },
  { correct: "CôTe D'ivoire",           user: 'cote Divoire',      expect: true,  note: 'diacritics: ô matches o, apostrophe dropped' },
  { correct: "Côte d'Ivoire",           user: 'Ivory Coast',       expect: false, note: 'diacritics: wrong answer still rejected' },
  { correct: 'São Paulo',               user: 'Sao Paulo',         expect: true,  note: 'diacritics: ã matches a' },
  { correct: 'Björk',                   user: 'Bjork',             expect: true,  note: 'diacritics: ö matches o' },
  { correct: 'Réunion',                 user: 'Reunion',           expect: true,  note: 'diacritics: é matches e' },
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
