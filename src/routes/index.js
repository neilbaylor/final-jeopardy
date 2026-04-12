const express = require('express');
const db = require('../config/database');
const natural = require('natural');
const { computeStreaks } = require('../utils/streaks');
const title = require('title').default;
const router = express.Router();
const { pushDisplayName, sendPush: _sendPush } = require('../utils/push');
const sendPush = (userId, payload) => _sendPush(userId, payload, db);

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
  str = str.replace(/\b([IVXLCDMivxlcdm]+)\b/g, (m, _p1, offset, original) => {
    // Skip tokens that are part of dot-separated abbreviations (e.g. G.I., I.R.S., D.C.)
    if (original[offset - 1] === '.' || original[offset + m.length] === '.') return m;
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
    .replace(/([a-z])\.([a-z])/g, '$1$2') // collapse abbreviation dots: e.t. → et, u.s.a. → usa
    .replace(/[^a-z0-9\s]/g, ' ') // non-alphanumeric → space
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Common English first names used to detect "FirstName LastName" patterns.
const COMMON_FIRST_NAMES = new Set([
  // Male
  'aaron','abel','abraham','adam','adrian','alan','albert','alberto','alex','alexander','alexis','alfred','alvin',
  'andrew','andy','angelo','anthony','antonio','archer','arnold','arthur','austin','ayn',
  'barry','ben','benjamin','bill','billy','blake','bob','bobby','brad','bradley','brandon','brendan',
  'brett','brian','bruce','bryan','bryce',
  'calvin','carl','carlos','chad','charles','charlie','chris','christian','christopher','chuck',
  'clark','clayton','clifford','clinton','cody','colin','conner','connor','corey','craig',
  'dale','dallas','dan','daniel','danny','darrell','darren','dave','david','dean','dennis',
  'derek','dick','diego','dominic','donald','douglas','drew','dustin','dylan',
  'earl','eddie','edgar','edward','eli','elijah','elton','elvis','eric','ernest','ethan','eugene','evan',
  'felix','floyd','frank','franklin','fred','freddie','frederic','frederick',
  'gabriel','gary','gene','geoffrey','george','gerald','gilbert','glen','gordon','graham','grant','gregory',
  'hannibal','harold','harry','harvey','henry','herbert','homer','howard','hugo',
  'ian','ivan',
  'jack','jacob','jake','james','jason','javier','jay','jeff','jeffrey','jeremy','jerome',
  'jerry','jesse','jim','jimmy','joe','joel','john','johnny','jon','jonathan','jordan','jorge',
  'jose','joseph','joshua','juan','julian','julius','justin',
  'karl','keith','ken','kenneth','kevin','kurt','kyle',
  'lance','larry','lawrence','leo','leon','leonard','liam','lloyd','logan','louis','luc','lucas','luke',
  'malcolm','marcus','mario','mark','martin','mason','matt','matthew','max','michael','miguel','mike','miles',
  'mitchell','morris',
  'nathan','neil','nelson','neville','nicholas','nick','noah','noel','norman',
  'oliver','omar','oscar','otto','owen',
  'patrick','paul','pedro','pete','peter','phillip','preston',
  'ralph','ray','raymond','reginald','richard','rick','robert','robin','roger','roland','ronald',
  'ross','roy','ruben','russell','ryan',
  'sam','samuel','scott','sean','seth','simon','stanley','stephen','steve','steven','stuart',
  'ted','terry','theodore','thomas','timothy','tom','tony','travis','trevor','troy','tyler',
  'victor','vincent','wade','walter','warren','wayne','wesley','william','winston','wyatt',
  'zachary','zach',
  // Male — French
  'claude','emile','etienne','francois','gustave','jean','jules','pierre','rene',
  // Male — German/Austrian
  'dieter','ernst','franz','gottfried','gunther','hans','heinrich','helmut','joachim',
  'leopold','ludwig','reinhold','rudolf','ulrich','walther','wilhelm','wolfgang',
  // Male — Italian
  'cesare','giacomo','giovanni','giuseppe','guglielmo','luigi','matteo','michelangelo','raffaello',
  // Male — Russian/Slavic
  'aleksei','alexei','boris','dmitri','fyodor','igor','mikhail','nikolai','pyotr','sergei',
  'stanislav','vasily','vladimir','yuri',
  // Male — Spanish/Portuguese
  'alejandro','enrique','pablo','rodrigo','salvador','xavier',
  // Male — Scandinavian
  'bjorn','edvard','gunnar','henrik','ingmar','lars','leif','magnus','niels','olaf','sven','thor',
  // Male — Dutch/Flemish
  'jan','piet','rembrandt','willem',
  // Male — Hungarian
  'attila','bela','laszlo','zoltan',
  // Male — Other
  'akira','ignaz','napoleon','nikola',
  // Female
  'abigail','ada','adele','adriana','agnes','alexa','alexandra','alexis','alice','alicia','alison',
  'allison','alma','alyssa','amanda','amber','amelia','amy','ana','andrea','angela','anita',
  'ann','anna','anne','annie','april','ashley','audrey','aurora','ava',
  'barbara','beatrice','becky','bernadette','bernice','beth','betty','beverly','bonnie','brenda','brittany',
  'brooke','caitlin','camille','candice','carol','carolyn','carrie','cassandra','catherine','cecilia',
  'charlene','charlotte','cheryl','chloe','christal','christina','christine','cindy','claire',
  'claudia','colleen','connie','constance','courtney','crystal','cynthia',
  'daisy','danielle','dawn','deanna','deborah','debra','denise','diana','diane','dolores','donna','doris','dorothy',
  'edith','eleanor','elena','elisa','elizabeth','ella','ellen','eloise','emily','emma','erica','erin','estelle','eva','evelyn',
  'faith','felicia','fiona','florence','frances','francesca',
  'gabrielle','gemma','georgia','gina','gloria','grace',
  'hailey','hannah','harriet','heather','helen','holly',
  'ida','irene','iris','isabel','isabella',
  'jacqueline','jade','jane','janet','janice','jasmine','jean','jeanette','jennifer','jessica',
  'joan','joanna','jocelyn','josephine','joyce','joy','judith','judy','julia','julie','june',
  'karen','kate','kat','katherine','kathleen','kathryn','katie','kelly','kim','kimberly','kristen','kristin',
  'laura','lauren','leah','lena','lily','linda','lisa','liz','lorraine','louise','lucy','luna',
  'mae','maggie','margaret','marguerite','maria','marie','marilyn','marjorie','marlene','martha','mary',
  'megan','melanie','melissa','michelle','mildred','minnie','miranda','molly','monica',
  'nancy','naomi','natalie','natasha','nell','nichole','nicole','nina','nora','norma',
  'olivia','paige','pamela','patricia','paula','penelope','phyllis',
  'rachel','rebecca','renee','rita','roberta','rosa','rose','rosemary','ruby','ruth',
  'samantha','sandra','sara','sarah','savannah','shannon','sharon','shelley','shirley',
  'sierra','sofia','sophia','sophie','stella','stephanie','sue','susan','suzanne','sylvia',
  'tammy','teresa','tiffany','tina','tonya','tracey','tracy',
  'vanessa','vera','veronica','victoria','violet','virginia','vivian','wendy','whitney',
  'yolanda','yvonne','zoe','zoey',
  // Female — French
  'amelie','cecile','colette','delphine','elise','genevieve','heloise','madeleine','margot','mathilde','simone',
  // Female — German/Austrian
  'elke','frida','hannelore','hedwig','hildegard','ingrid','lotte','ulrike','wilhelmina',
  // Female — Italian
  'chiara','giulia','lucia','luisa','paola',
  // Female — Russian/Slavic
  'irina','nadia','natalia','olga','svetlana','tatiana','valentina','yelena',
  // Female — Scandinavian
  'astrid','birgit','dagmar','freya','sigrid','solveig',
  // Female — Spanish/Portuguese
  'carmen','fatima','pilar','rosario',
  // Female — Other
  'giselle','isolde',
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

function stripJeopardyPreamble(str) {
  return str.replace(/^\s*(who(?:\s+(?:is|was|were))|what\s+(?:is|was|were)|where\s+(?:is|was|were)|when\s+(?:is|was|were))\s+/i, '').replace(/\?\s*$/, '').trim();
}

// Geographic qualifiers — when the correct answer is "City, <qualifier>", the qualifier
// is stripped and the user only needs to name the city. Only fires for known geo terms.
const GEO_QUALIFIERS = new Set([
  // US states
  'alabama','alaska','arizona','arkansas','california','colorado','connecticut','delaware',
  'florida','georgia','hawaii','idaho','illinois','indiana','iowa','kansas','kentucky',
  'louisiana','maine','maryland','massachusetts','michigan','minnesota','mississippi',
  'missouri','montana','nebraska','nevada','new hampshire','new jersey','new mexico',
  'new york','north carolina','north dakota','ohio','oklahoma','oregon','pennsylvania',
  'rhode island','south carolina','south dakota','tennessee','texas','utah','vermont',
  'virginia','washington','west virginia','wisconsin','wyoming',
  // DC + territories
  'district of columbia','dc','puerto rico','guam','american samoa','us virgin islands',
  // Canadian provinces & territories
  'alberta','british columbia','manitoba','new brunswick','newfoundland',
  'newfoundland and labrador','nova scotia','ontario','prince edward island','quebec',
  'saskatchewan','northwest territories','nunavut','yukon',
  // UK constituent countries
  'england','scotland','wales','northern ireland','great britain',
  // World countries (UN member states + common variants)
  'afghanistan','albania','algeria','andorra','angola','antigua and barbuda','argentina',
  'armenia','australia','austria','azerbaijan','bahamas','bahrain','bangladesh','barbados',
  'belarus','belgium','belize','benin','bhutan','bolivia','bosnia','bosnia and herzegovina',
  'botswana','brazil','brunei','bulgaria','burkina faso','burundi','cabo verde','cambodia',
  'cameroon','canada','central african republic','chad','chile','china','colombia',
  'comoros','congo','democratic republic of the congo','costa rica','croatia','cuba',
  'cyprus','czech republic','czechia','denmark','djibouti','dominica','dominican republic',
  'ecuador','egypt','el salvador','equatorial guinea','eritrea','estonia','eswatini',
  'ethiopia','fiji','finland','france','gabon','gambia','germany','ghana','greece',
  'grenada','guatemala','guinea','guinea-bissau','guyana','haiti','honduras','hungary',
  'iceland','india','indonesia','iran','iraq','ireland','israel','italy','jamaica',
  'japan','jordan','kazakhstan','kenya','kiribati','kosovo','kuwait','kyrgyzstan','laos',
  'latvia','lebanon','lesotho','liberia','libya','liechtenstein','lithuania','luxembourg',
  'madagascar','malawi','malaysia','maldives','mali','malta','marshall islands',
  'mauritania','mauritius','mexico','micronesia','moldova','monaco','mongolia','montenegro',
  'morocco','mozambique','myanmar','namibia','nauru','nepal','netherlands','new zealand',
  'nicaragua','niger','nigeria','north korea','north macedonia','norway','oman','pakistan',
  'palau','palestine','panama','papua new guinea','paraguay','peru','philippines','poland',
  'portugal','qatar','romania','russia','rwanda','saint kitts and nevis','saint lucia',
  'saint vincent and the grenadines','samoa','san marino','saudi arabia','senegal',
  'serbia','seychelles','sierra leone','singapore','slovakia','slovenia','solomon islands',
  'somalia','south africa','south korea','south sudan','spain','sri lanka','sudan',
  'suriname','sweden','switzerland','syria','taiwan','tajikistan','tanzania','thailand',
  'timor-leste','togo','tonga','trinidad and tobago','tunisia','turkey','turkmenistan',
  'tuvalu','uganda','ukraine','united arab emirates','uae','united kingdom','uk',
  'united states','usa','us','uruguay','uzbekistan','vanuatu','vatican','venezuela',
  'vietnam','yemen','zambia','zimbabwe',
  // Historical / common alternates
  'soviet union','ussr','yugoslavia','burma','persia','siam','rhodesia','ceylon',
]);

// Parse "name N of", "N of M", "either of", "any N of" anchored to the START of a question clue.
// Returns N (required count) or 0 if not detected.
function parseNOfFromQuestion(questionText) {
  if (!questionText) return 0;
  const q = questionText.trim();
  let m;
  // "Name 2 of..." / "Name 2 of the 4..." / "Give 2 of..."
  m = q.match(/^(?:name|give|list)\s+(\d+)\s+of\b/i);
  if (m) return parseInt(m[1], 10);
  // "1 of 2 states" / "1 of the 2..."
  m = q.match(/^(\d+)\s+of\s+(?:the\s+)?\d+\b/i);
  if (m) return parseInt(m[1], 10);
  // "Either of these..." → N=1
  if (/^either\s+of\b/i.test(q)) return 1;
  // "Any 2 of..." / "Any one of..."
  m = q.match(/^any\s+(?:one|(\d+))\s+of\b/i);
  if (m) return m[1] ? parseInt(m[1], 10) : 1;
  return 0;
}

// Fuzzy match helper used by both (N Of) correct-answer format and question-derived N-of logic.
function nOfFuzzyMatch(u, cNorm, cOrig) {
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
}

// Titles that may optionally precede a name in a correct answer.
// Multi-word variants listed first so they match before their single-word prefixes.
const TITLE_PREFIXES = [
  'prime minister', 'vice president', 'secretary of state', 'attorney general',
  'chief justice', 'commanding general', 'supreme commander',
  'president', 'senator', 'governor', 'commissioner', 'mayor', 'chancellor',
  'king', 'queen', 'prince', 'princess', 'duke', 'duchess', 'emperor', 'empress',
  'czar', 'tsar', 'sultan', 'pharaoh', 'pope',
  'general', 'admiral', 'colonel', 'captain', 'major', 'sergeant', 'lieutenant',
  'commander', 'marshal',
  'doctor', 'dr', 'professor', 'prof', 'reverend', 'rev', 'father', 'brother', 'sister',
  'saint', 'st',
  'sir', 'lord', 'lady', 'dame',
];

// If `answer` starts with a known title prefix followed by a space, returns the remainder.
// Otherwise returns null.
function stripTitlePrefix(answer) {
  const lower = answer.toLowerCase();
  for (const t of TITLE_PREFIXES) {
    if (lower.startsWith(t + ' ')) {
      return answer.slice(t.length + 1).trim();
    }
  }
  return null;
}

function isAnswerCorrect(userAnswer, correctAnswer, questionText) {
  userAnswer = stripJeopardyPreamble(userAnswer);
  const a = normalizeAnswer(userAnswer);
  const b = normalizeAnswer(correctAnswer);
  if (a === b) return true;
  // Skip JW for pure-number correct answers (years, counts, etc.) — numbers like
  // "2008" and "2016" share a long word prefix ("two thousand") that inflates JW.
  const isNumericAnswer = /^\s*[\d,\s]+\s*$/.test(correctAnswer);
  if (!isNumericAnswer && natural.JaroWinklerDistance(a, b) >= 0.885) return true;

  // Abbreviation dot equivalence: "D.C." ↔ "DC", "G.I. Joe" ↔ "GI Joe", "C.I.A." ↔ "CIA".
  // Uses a lightweight strip (no Roman numeral conversion) so e.g. "DC" isn't treated as
  // Roman numeral 600 when it should match "D.C.".
  if (/[A-Z]\.[A-Z]/.test(correctAnswer) || /[A-Z]\.[A-Z]/.test(userAnswer)) {
    const abbrevStrip = s => s
      .replace(/([A-Za-z])\.(?=[A-Za-z\s]|$)/g, '$1')
      .replace(/([A-Za-z])\./g, '$1')
      .toLowerCase()
      .replace(/\b(the|a|an)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const aDots = abbrevStrip(userAnswer);
    const bDots = abbrevStrip(correctAnswer);
    if (aDots === bDots) return true;
    if (!isNumericAnswer && natural.JaroWinklerDistance(aDots, bDots) >= 0.885) return true;
  }

  // Geographic qualifier: "Orlando, Florida" → accept "Orlando"; "Toronto, Canada" → accept "Toronto".
  // Uses lastIndexOf so double qualifiers work too: "Quebec City, Quebec, Canada" → last = "Canada" → accept "Quebec City".
  {
    const lastComma = correctAnswer.lastIndexOf(',');
    if (lastComma !== -1) {
      const rawQualifier = correctAnswer.slice(lastComma + 1).trim();
      const normQualifier = rawQualifier.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
      if (GEO_QUALIFIERS.has(normQualifier)) {
        const prefix = correctAnswer.slice(0, lastComma).trim();
        if (matchesPart(a, normalizeAnswer(prefix), prefix)) return true;
      }
    }
  }

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
    const usedCandidates = new Set();
    const matched = userParts.filter(u => {
      const idx = candidatesOrig.findIndex((cOrig, i) => !usedCandidates.has(i) && nOfFuzzyMatch(u, candidates[i], cOrig));
      if (idx === -1) return false;
      usedCandidates.add(idx);
      return true;
    });
    return matched.length === required;
  }

  // N-of from question text: e.g. "Name 2 of the 4 states...", "1 of 2 countries...", "Either of these...".
  // Only triggers when the correct answer has multiple &/and-separated candidates and the question
  // starts with a recognized N-of pattern. Does NOT return false on mismatch — falls through instead.
  if (questionText) {
    const nFromQ = parseNOfFromQuestion(questionText);
    if (nFromQ > 0) {
      const candidatesOrig = correctAnswer.split(/\s*(?:&|\band\b)\s*/i).map(s => s.trim()).filter(Boolean);
      if (candidatesOrig.length > 1 && candidatesOrig.length >= nFromQ) {
        const candidates = candidatesOrig.map(s => normalizeAnswer(s));
        let userParts = userAnswer.split(/\s*(?:&|,|\band\b|\bor\b)\s*/i).map(s => normalizeAnswer(s.trim())).filter(Boolean);
        if (userParts.length === 1 && nFromQ > 1) {
          userParts = userAnswer.trim().split(/\s+/).map(s => normalizeAnswer(s));
        }
        if (userParts.length === nFromQ) {
          const usedQ = new Set();
          const matchedQ = userParts.filter(u => {
            const idx = candidatesOrig.findIndex((cOrig, i) => !usedQ.has(i) && nOfFuzzyMatch(u, candidates[i], cOrig));
            if (idx === -1) return false;
            usedQ.add(idx);
            return true;
          });
          if (matchedQ.length === nFromQ) return true;
        }
      }
    }
  }

  // Allow omitting a leading qualifier (e.g. "Virgin Islands" for "U.S. Virgin Islands").
  // Require multi-word answer and suffix must be ≥75% of the full answer length.
  if (a.includes(' ') && b.endsWith(a) && b.length > a.length && b[b.length - a.length - 1] === ' ' && a.length / b.length >= 0.72) return true;

  // "(Or X)" at end — accept either the primary answer OR the alternative.
  // e.g. "February 14 (Or Valentine's Day)" → accepts "February 14" or "Valentine's Day"
  // e.g. "Batman (or Bruce Wayne)"           → accepts "Batman", "Bruce Wayne", or "Wayne"
  const orAltMatch = correctAnswer.match(/^(.*?)\s*\(\s*or\s+([^)]+)\)\s*$/i);
  if (orAltMatch) {
    const primary = orAltMatch[1].trim();
    const alt = orAltMatch[2].trim();
    if (matchesPart(a, normalizeAnswer(primary), primary)) return true;
    if (matchesPart(a, normalizeAnswer(alt), alt)) return true;
  }

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

  // Title prefix: "President Ronald Reagan" → accept "Ronald Reagan" or "Reagan";
  // "Prime Minister Boris Johnson" → accept "Boris Johnson" or "Johnson".
  {
    const withoutTitle = stripTitlePrefix(correctAnswer);
    if (withoutTitle !== null) {
      const bNoTitle = normalizeAnswer(withoutTitle);
      // Exact full-name match
      if (a === bNoTitle) return true;
      // JW full-name match — require length ratio ≥ 0.6 to prevent prefix inflation
      // (e.g. "Ronald" must not match "Ronald Reagan" just because of the shared prefix)
      const ratio = Math.min(a.length, bNoTitle.length) / Math.max(a.length, bNoTitle.length);
      if (ratio >= 0.6 && natural.JaroWinklerDistance(a, bNoTitle) >= 0.88) return true;
      // Last-name only (e.g. "Reagan" for "Ronald Reagan")
      const ln = extractLastName(withoutTitle);
      if (ln !== null) {
        const lnNorm = normalizeAnswer(ln);
        if (a === lnNorm) return true;
        if (natural.JaroWinklerDistance(a, lnNorm) >= 0.88) return true;
      }
    }
  }

  return false;
}

// Splash screen
router.get('/splash', (req, res) => {
  if (/android/i.test(req.headers['user-agent'] || '')) return res.redirect('/');
  res.render('splash');
});

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
    return res.status(409).json({ error: 'There is a max of 5 players per game' });
  }

  const allUserIds = [Number(userId), ...friendIds.map(Number)];
  const n = allUserIds.length;
  const placeholders = allUserIds.map(() => '?').join(',');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Check if the user is already at the game limit (admin user id 1 is exempt)
    const [[{ gameCount }]] = await conn.query(
      'SELECT COUNT(*) AS gameCount FROM game_users WHERE user_id = ?',
      [Number(userId)]
    );
    if (Number(userId) !== 1 && gameCount >= 10) {
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
        const [[creator]] = await db.query('SELECT display_name, avatar_url FROM users WHERE id = ?', [Number(userId)]);
        const creatorName = pushDisplayName(creator?.display_name || '');
        const friendCount = allUserIds.length - 2;
        const withOthers = friendCount > 0 ? ` with ${friendCount} other friend${friendCount > 1 ? 's' : ''}` : '';
        const body = `${creatorName} started a new game. Tap to answer your first question${withOthers}`;
        const notifPayload = { title: 'New Game Created', body, url: `/game?id=${gameId}`, icon: creator?.avatar_url || undefined };
        setTimeout(() => {
          for (const uid of friendIds.map(Number)) {
            sendPush(uid, notifPayload);
          }
        }, 0);
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

// API: get stats for a user
router.get('/api/stats', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  try {
    const [[row]] = await db.query(
      `SELECT
         COUNT(ga.id)                              AS total_questions,
         SUM(ga.is_correct = 1)                   AS correct_answers
       FROM game_users gu
       JOIN game_questions gq ON gq.game_id = gu.game_id
       JOIN game_answers ga   ON ga.game_question_id = gq.id AND ga.user_id = gu.user_id
       WHERE gu.user_id = ?`,
      [Number(userId)]
    );

    const [answers] = await db.query(
      `SELECT ga.is_correct, gq.game_id
       FROM game_users gu
       JOIN game_questions gq ON gq.game_id = gu.game_id
       JOIN game_answers ga   ON ga.game_question_id = gq.id AND ga.user_id = gu.user_id
       WHERE gu.user_id = ?
       ORDER BY gq.asked_at, gq.id`,
      [Number(userId)]
    );

    const { longest_streak_overall: longestStreakOverall, longest_streak_single_game: longestStreakSingleGame } = computeStreaks(answers);

    const [gameRows] = await db.query(
      `SELECT gq.game_id,
              COUNT(ga.id)        AS question_count,
              MIN(gq.asked_at)    AS first_question_date
       FROM game_users gu
       JOIN game_questions gq ON gq.game_id = gu.game_id
       JOIN game_answers ga   ON ga.game_question_id = gq.id AND ga.user_id = gu.user_id
       WHERE gu.user_id = ?
       GROUP BY gq.game_id
       ORDER BY question_count DESC
       LIMIT 1`,
      [Number(userId)]
    );
    const longestGame = gameRows.length > 0 ? {
      game_id: gameRows[0].game_id,
      first_question_date: gameRows[0].first_question_date,
      question_count: Number(gameRows[0].question_count),
    } : null;

    res.json({
      total_questions:            Number(row.total_questions  || 0),
      correct_answers:            Number(row.correct_answers  || 0),
      longest_streak_overall:     longestStreakOverall,
      longest_streak_single_game: longestStreakSingleGame,
      longest_game:               longestGame,
    });
  } catch (err) {
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
      `SELECT gq.id AS game_question_id, q.answer AS correct_answer, q.question AS question_text
       FROM game_questions gq
       JOIN questions q ON gq.question_id = q.id
       WHERE gq.game_id = ? AND gq.question_id = ?`,
      [gameId, Number(questionId)]
    );
    if (!gq) return res.status(404).json({ error: 'Question is not part of this game' });

    // 3. Determine correctness
    const correct = isAnswerCorrect(String(answer), gq.correct_answer, gq.question_text);

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
    let newQuestionCreated = false;
    if (answers.length >= total) {
      const [[nextQuestion]] = await conn.execute(
        `SELECT id FROM questions
         WHERE id NOT IN (SELECT question_id FROM game_questions WHERE game_id = ?)
         ORDER BY RAND() LIMIT 1`,
        [gameId]
      );
      if (nextQuestion) {
        const [newGqResult] = await conn.execute(
          'INSERT INTO game_questions (game_id, question_id, asked_at) VALUES (?, ?, NOW())',
          [gameId, nextQuestion.id]
        );
        newQuestionCreated = newGqResult.insertId;
      }
    }

    await conn.commit();

    // Remind the answerer in 90 min if they haven't answered the new question
    if (newQuestionCreated) {
      db.query(
        'INSERT IGNORE INTO question_reminders (user_id, game_id, game_question_id) VALUES (?, ?, ?)',
        [Number(playerId), gameId, newQuestionCreated]
      ).catch(() => {});
    }

    if (newQuestionCreated && process.env.VAPID_PUBLIC_KEY) {
      const answererId = Number(playerId);
      const answererCorrect = correct;
      const gamePlayerCount = Number(total);
      setTimeout(async () => {
        try {
          const [[answerer]] = await db.query('SELECT display_name, avatar_url FROM users WHERE id = ?', [answererId]);
          const answererName = pushDisplayName(answerer?.display_name || '');
          const result = answererCorrect ? 'Correctly' : 'Incorrectly';
          const resultPunct = answererCorrect ? '!' : '.';
          const othersCount = gamePlayerCount - 2;
          const withOthers = othersCount > 0 ? ` with ${othersCount} other friend${othersCount > 1 ? 's' : ''}` : '';
          const body = `${answererName} answered a question ${result}${resultPunct} A new question has been unlocked, tap to answer${withOthers}`;
          const otherUserIds = answers.filter(a => a.user_id !== answererId).map(a => a.user_id);
          for (const uid of otherUserIds) {
            sendPush(uid, { title: 'New Question', body, url: `/game?id=${gameId}`, icon: answerer?.avatar_url || undefined });
          }
        } catch (err) {
          console.error('[push] new question notify error:', err.message);
        }
      }, 0);
    }

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

router.delete('/api/users/:targetUserId', async (req, res) => {
  const { requesterId } = req.query;
  if (String(requesterId) !== '1') return res.status(403).json({ error: 'Forbidden' });
  const targetUserId = Number(req.params.targetUserId);
  try {
    // Delete all games the user is in (cascades game_users, game_questions, game_answers)
    const [gameRows] = await db.query('SELECT DISTINCT game_id FROM game_users WHERE user_id = ?', [targetUserId]);
    if (gameRows.length > 0) {
      const ids = gameRows.map(r => r.game_id);
      await db.query(`DELETE FROM games WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    }
    // Delete the user (cascades push_subscriptions, game_answers, game_users)
    await db.query('DELETE FROM users WHERE id = ?', [targetUserId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
module.exports.isAnswerCorrect = isAnswerCorrect;
