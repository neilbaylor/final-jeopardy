require('dotenv').config();
const { isAnswerCorrect } = require('./src/routes/index');

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
  { correct: 'Mount Everest',          user: 'Everest',             expect: true,  note: 'geo prefix — "Mount" treated as optional prefix' },
  { correct: 'Mt. Everest',            user: 'Everest',             expect: true,  note: 'geo prefix — "Mt." treated as optional prefix' },
  { correct: 'Mt. Everest',            user: 'Mount Everest',       expect: true,  note: 'geo prefix — Mt. ⇔ Mount' },
  { correct: 'Mt. Everest',            user: 'Mt. Everest',         expect: true,  note: 'geo prefix — exact match still accepted' },
  { correct: 'Mt. Everest',            user: 'K2',                  expect: false, note: 'geo prefix — wrong mountain rejected' },
  { correct: 'Mt. Rushmore',           user: 'Rushmore',            expect: true,  note: 'geo prefix — Mt. Rushmore → Rushmore' },
  { correct: 'Mt. Rushmore',           user: 'Mount Rushmore',      expect: true,  note: 'geo prefix — Mt. Rushmore ⇔ Mount Rushmore' },
  { correct: 'Jupiter',               user: 'Jupiter',              expect: true,  note: 'last-name — single word, exact match' },

  // ── Last-name-only: two people joined by "and" ────────────────────────────
  { correct: 'John Thompson and Tyler Clark',   user: 'Thompson and Clark',   expect: true,  note: 'last-name — two people, both last names' },
  { correct: 'John Thompson and Tyler Clark',   user: 'Thompson & Clark',     expect: true,  note: 'last-name — two people, & separator' },
  { correct: 'John Thompson and Tyler Clark',   user: 'Clark and Thompson',   expect: true,  note: 'last-name — two people, reversed order' },
  { correct: 'John Thompson and Tyler Clark',   user: 'Thompson',             expect: false, note: 'last-name — two people, only one last name given' },
  { correct: 'John Thompson and Tyler Clark',   user: 'Smith and Clark',      expect: false, note: 'last-name — two people, one wrong last name' },
  { correct: 'John Thompson and Tyler Clark',   user: 'John Thompson',        expect: false, note: 'last-name — two people, one full name; partial rejected' },

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

  // ── Last-name-only: middle initial (single letter, optional dot) ─────────
  { correct: 'James K. Polk',            user: 'Polk',                expect: true,  note: 'middle initial — "K." + first name → accept last name' },
  { correct: 'James K Polk',             user: 'Polk',                expect: true,  note: 'middle initial — "K" (no dot) + first name → accept last name' },
  { correct: 'James K. Polk',            user: 'James K. Polk',       expect: true,  note: 'middle initial — full name still accepted' },
  { correct: 'James K. Polk',            user: 'Jefferson',           expect: false, note: 'middle initial — wrong last name rejected' },
  { correct: 'John F. Kennedy',          user: 'Kennedy',             expect: true,  note: 'middle initial — JFK last name accepted' },
  { correct: 'George W. Bush',           user: 'Bush',                expect: true,  note: 'middle initial — "W." accepted as middle initial' },
  { correct: 'James K Polk and Joe Garfield', user: 'Garfield and Polk', expect: true, note: 'middle initial — multi-part, last names in reversed order' },
  { correct: 'James K. Polk and Joe Garfield', user: 'Polk and Garfield', expect: true, note: 'middle initial — multi-part with dot in initial' },
  { correct: 'James K Polk and Joe Garfield', user: 'Polk',            expect: false, note: 'middle initial — multi-part, only one last name given' },

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
  { correct: 'Tom & Jerry',        user: 'Tom & Jerry & Spike',  expect: false, note: 'multi-part — extra name rejected (Spike is wrong)' },

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
  { correct: 'Mao Zedong (Mao)',    user: 'Mao',                 expect: true,  note: 'trailing paren alias — short name accepted' },
  { correct: 'Mao Zedong (Mao)',    user: 'Mao Zedong',          expect: true,  note: 'trailing paren alias — full name accepted' },
  { correct: 'Mao Zedong (Mao)',    user: 'Moa',                 expect: false, note: 'trailing paren alias — 3-char transposition below JW threshold' },
  { correct: 'Mao Zedong (Mao)',    user: 'Maoo',                expect: true,  note: 'trailing paren alias — JW fuzzy on alias (extra char)' },
  { correct: 'Muhammad Ali (Cassius Clay)', user: 'Cassius Clay', expect: true, note: 'trailing paren alias — multi-word alias accepted' },
  { correct: 'Muhammad Ali (Cassius Clay)', user: 'Cassius Caly', expect: true, note: 'trailing paren alias — JW fuzzy on multi-word alias (transposition)' },
  { correct: 'Muhammad Ali (Cassius Clay)', user: 'Muhammad Ali', expect: true, note: 'trailing paren alias — primary name still accepted' },
  { correct: 'Muhammad Ali (Cassius Clay)', user: 'Clay',         expect: true,  note: 'trailing paren alias — last name of alias accepted (cassius in first names list)' },

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
  { correct: 'Mount Saint Helens',            user: 'Saint Helens',            expect: true,  note: 'geo prefix — "Mount" stripped, "Saint Helens" accepted' },
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
  { correct: 'Neil and Joe',            user: 'Neil',              expect: false, note: '"X and Y" — partial answer rejected' },
  { correct: 'Neil and Joe',            user: 'Joe',               expect: false, note: '"X and Y" — second half alone rejected' },
  { correct: 'Neil & Joe',              user: 'Neil',              expect: false, note: '"X & Y" — partial answer rejected' },
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

  // ── Abbreviation dot handling ─────────────────────────────────────────────
  { correct: 'E.T.',                user: 'ET',                expect: true,  note: 'abbrev: ET matches E.T.' },
  { correct: 'ET',                  user: 'E.T.',              expect: true,  note: 'abbrev: E.T. matches ET' },
  { correct: 'U.S.A.',              user: 'USA',               expect: true,  note: 'abbrev: USA matches U.S.A.' },
  { correct: 'J.F.K.',              user: 'JFK',               expect: true,  note: 'abbrev: JFK matches J.F.K.' },
  { correct: 'Born in the U.S.A.',  user: 'born in USA',       expect: true,  note: 'abbrev: mid-string dots in phrase' },

  // ── Non-English first names — last name shorthand ─────────────────────────
  // French
  { correct: 'Frederic Chopin',         user: 'Chopin',            expect: true,  note: 'non-English: Frederic Chopin → Chopin' },
  { correct: 'Frederic Chopin',         user: 'Frederic Chopin',   expect: true,  note: 'non-English: Frederic Chopin full name' },
  { correct: 'Claude Monet',            user: 'Monet',             expect: true,  note: 'non-English: Claude Monet → Monet' },
  { correct: 'Jules Verne',             user: 'Verne',             expect: true,  note: 'non-English: Jules Verne → Verne' },
  { correct: 'Pierre Curie',            user: 'Curie',             expect: true,  note: 'non-English: Pierre Curie → Curie' },
  // German/Austrian
  { correct: 'Wolfgang Mozart',         user: 'Mozart',            expect: true,  note: 'non-English: Wolfgang Mozart → Mozart' },
  { correct: 'Ludwig Beethoven',        user: 'Beethoven',         expect: true,  note: 'non-English: Ludwig Beethoven → Beethoven' },
  { correct: 'Franz Schubert',          user: 'Schubert',          expect: true,  note: 'non-English: Franz Schubert → Schubert' },
  // Italian
  { correct: 'Giuseppe Verdi',          user: 'Verdi',             expect: true,  note: 'non-English: Giuseppe Verdi → Verdi' },
  { correct: 'Giacomo Puccini',         user: 'Puccini',           expect: true,  note: 'non-English: Giacomo Puccini → Puccini' },
  // Russian/Slavic
  { correct: 'Fyodor Dostoevsky',       user: 'Dostoevsky',        expect: true,  note: 'non-English: Fyodor Dostoevsky → Dostoevsky' },
  { correct: 'Nikolai Gogol',           user: 'Gogol',             expect: true,  note: 'non-English: Nikolai Gogol → Gogol' },
  { correct: 'Vladimir Lenin',          user: 'Lenin',             expect: true,  note: 'non-English: Vladimir Lenin → Lenin' },
  // Spanish
  { correct: 'Pablo Picasso',           user: 'Picasso',           expect: true,  note: 'non-English: Pablo Picasso → Picasso' },
  { correct: 'Salvador Dali',           user: 'Dali',              expect: true,  note: 'non-English: Salvador Dali → Dali' },
  // Scandinavian
  { correct: 'Henrik Ibsen',            user: 'Ibsen',             expect: true,  note: 'non-English: Henrik Ibsen → Ibsen' },
  { correct: 'Edvard Munch',            user: 'Munch',             expect: true,  note: 'non-English: Edvard Munch → Munch' },
  // Female non-English
  { correct: 'Ingrid Bergman',          user: 'Bergman',           expect: true,  note: 'non-English: Ingrid Bergman → Bergman' },
  { correct: 'Simone Beauvoir',         user: 'Beauvoir',          expect: true,  note: 'non-English: Simone Beauvoir → Beauvoir' },
  { correct: 'Frida Kahlo',             user: 'Kahlo',             expect: true,  note: 'non-English: Frida Kahlo → Kahlo' },
  { correct: 'Olga Korbut',             user: 'Korbut',            expect: true,  note: 'non-English: Olga Korbut → Korbut' },

  // ── Jeopardy-style preamble stripping ────────────────────────────────────
  // "Who is" / "Who was"
  { correct: 'Ben Stein',               user: 'Who is Stein?',              expect: true,  note: 'preamble: "Who is X?" — last name match' },
  { correct: 'Ben Stein',               user: 'Who is Ben Stein?',          expect: true,  note: 'preamble: "Who is X?" — full name' },
  { correct: 'Abraham Lincoln',         user: 'Who was Lincoln?',           expect: true,  note: 'preamble: "Who was X?" — last name' },
  { correct: 'Abraham Lincoln',         user: 'Who was Abraham Lincoln?',   expect: true,  note: 'preamble: "Who was X?" — full name' },
  { correct: 'Marie Curie',             user: 'Who is Marie Curie',         expect: true,  note: 'preamble: "Who is X" — no question mark' },
  { correct: 'Napoleon Bonaparte',      user: 'who is Bonaparte',           expect: true,  note: 'preamble: lowercase "who is"' },
  // "What is" / "What was"
  { correct: 'New Zealand',             user: 'What is New Zealand?',       expect: true,  note: 'preamble: "What is X?" — place name' },
  { correct: 'photosynthesis',          user: 'What is photosynthesis?',    expect: true,  note: 'preamble: "What is X?" — science term' },
  { correct: 'photosynthesis',          user: 'What is photosynthesis',     expect: true,  note: 'preamble: "What is X" — no question mark' },
  { correct: 'The Great Wall',          user: 'What is the Great Wall?',    expect: true,  note: 'preamble: "What is X?" — article dropped' },
  { correct: 'the Titanic',             user: 'What was the Titanic?',      expect: true,  note: 'preamble: "What was X?" — historical' },
  // "Where is" / "Where was"
  { correct: 'New Zealand',             user: 'Where is New Zealand',       expect: true,  note: 'preamble: "Where is X" — no question mark' },
  { correct: 'New Zealand',             user: 'Where is New Zealand?',      expect: true,  note: 'preamble: "Where is X?" — with question mark' },
  { correct: 'Paris',                   user: 'Where is Paris?',            expect: true,  note: 'preamble: "Where is X?" — city' },
  // "When is" / "When was"
  { correct: '1776',                    user: 'When was 1776?',             expect: true,  note: 'preamble: "When was X?" — year' },
  { correct: 'Independence Day',        user: 'When is Independence Day?',  expect: true,  note: 'preamble: "When is X?" — holiday' },
  // No stripping when no preamble
  { correct: 'New Zealand',             user: 'New Zealand',                expect: true,  note: 'preamble: no preamble — unchanged' },
  { correct: 'photosynthesis',          user: 'Photosynthesis',             expect: true,  note: 'preamble: no preamble — plain answer' },
  // Trailing "?" alone should not strip answer content
  { correct: 'New Zealand',             user: 'New Zealand?',               expect: true,  note: 'preamble: trailing ? only — still accepted' },
  // Should not accidentally strip "who" mid-sentence (preamble must be at start)
  { correct: 'Doctor Who',              user: 'Doctor Who',                 expect: true,  note: 'preamble: "Who" mid-string — not stripped' },
  { correct: 'Doctor Who',              user: 'Who is Doctor Who?',         expect: true,  note: 'preamble: "Who is Doctor Who?" — preamble stripped, content intact' },

  // ── (Or X) — primary or alternative ─────────────────────────────────────
  { correct: "February 14 (Or Valentine's Day)", user: 'February 14',        expect: true,  note: "(Or X) — primary match" },
  { correct: "February 14 (Or Valentine's Day)", user: "Valentine's Day",    expect: true,  note: "(Or X) — alternative exact" },
  { correct: "February 14 (Or Valentine's Day)", user: 'Valentines Day',     expect: true,  note: "(Or X) — alternative fuzzy (no apostrophe)" },
  { correct: "February 14 (Or Valentine's Day)", user: 'Valentines day',     expect: true,  note: "(Or X) — alternative fuzzy lowercase" },
  { correct: "February 14 (Or Valentine's Day)", user: 'Valintines Day',     expect: true,  note: "(Or X) — alternative misspelling" },
  { correct: "February 14 (Or Valentine's Day)", user: 'Christmas',          expect: false, note: "(Or X) — wrong answer" },
  { correct: 'Batman (or Bruce Wayne)',           user: 'Batman',            expect: true,  note: "(Or X) — primary single name" },
  { correct: 'Batman (or Bruce Wayne)',           user: 'Bruce Wayne',       expect: true,  note: "(Or X) — alternative full name" },
  { correct: 'Batman (or Bruce Wayne)',           user: 'Wayne',             expect: true,  note: "(Or X) — alternative last name only" },
  { correct: 'Batman (or Bruce Wayne)',           user: 'Bruuce Wayne',      expect: true,  note: "(Or X) — alternative fuzzy misspelling" },
  { correct: 'Batman (or Bruce Wayne)',           user: 'Superman',          expect: false, note: "(Or X) — wrong answer" },
  { correct: 'Batman (or Bruce Wayne)',           user: 'Who is Wayne?',     expect: true,  note: "(Or X) — preamble stripped + last name" },

  // ── Abbreviations containing Roman-numeral letters ──────────────────────
  { correct: 'G.I. Joe',   user: 'gi joe',   expect: true,  note: 'abbrev: G.I. — "I" must not be converted to Roman numeral 1' },
  { correct: 'G.I. Joe',   user: 'GI Joe',   expect: true,  note: 'abbrev: G.I. — no dots in user input' },
  { correct: 'G.I. Joe',   user: 'G.I. Joe', expect: true,  note: 'abbrev: G.I. — exact match with dots' },
  { correct: 'I.R.S.',     user: 'IRS',      expect: true,  note: 'abbrev: I.R.S. — leading "I" must not become 1' },
  { correct: 'D.C.',       user: 'DC',       expect: true,  note: 'abbrev: D.C. — "DC" is Roman numeral 600 but abbrev path accepts it' },
  { correct: 'D.C.',       user: 'D.C.',     expect: true,  note: 'abbrev: D.C. — exact match' },
  { correct: 'C.I.A.',     user: 'CIA',      expect: true,  note: 'abbrev: C.I.A. — all dots stripped' },
  { correct: 'C.I.A.',     user: 'C.I.A.',   expect: true,  note: 'abbrev: C.I.A. — exact match' },
  { correct: 'F.B.I.',     user: 'FBI',      expect: true,  note: 'abbrev: F.B.I. — all dots stripped' },
  { correct: 'N.A.S.A.',   user: 'NASA',     expect: true,  note: 'abbrev: N.A.S.A. — all dots stripped' },
  { correct: 'D.C. Comics', user: 'DC Comics', expect: true, note: 'abbrev: D.C. in phrase — dots stripped' },
  { correct: 'D.C.',       user: 'Marvel',   expect: false, note: 'abbrev: D.C. — wrong answer rejected' },

  // ── Geographic qualifier stripping ───────────────────────────────────────
  // US state
  { correct: 'Orlando, Florida',          user: 'Orlando',         expect: true,  note: 'geo: city + US state — state stripped' },
  { correct: 'Orlando, Florida',          user: 'orlando',         expect: true,  note: 'geo: lowercase city accepted' },
  { correct: 'Orlando, Florida',          user: 'Orlando, Florida',expect: true,  note: 'geo: full answer still accepted' },
  { correct: 'Orlando, Florida',          user: 'Miami',           expect: false, note: 'geo: wrong city rejected' },
  { correct: 'Springfield, Illinois',     user: 'Springfield',     expect: true,  note: 'geo: Springfield + state stripped' },
  { correct: 'Springfield, Illinois',     user: 'Sprngfield',      expect: true,  note: 'geo: fuzzy match on city name' },
  { correct: 'New York, New York',        user: 'New York',        expect: true,  note: 'geo: city = state, still accepted' },
  // Canadian province / territory
  { correct: 'Toronto, Ontario',          user: 'Toronto',         expect: true,  note: 'geo: Canadian city + province stripped' },
  { correct: 'Toronto, Canada',           user: 'Toronto',         expect: true,  note: 'geo: Canadian city + country stripped' },
  { correct: 'Vancouver, British Columbia', user: 'Vancouver',     expect: true,  note: 'geo: multi-word province stripped' },
  { correct: 'Quebec City, Quebec, Canada', user: 'Quebec City',   expect: true,  note: 'geo: double qualifier — last (Canada) stripped, prefix matched' },
  // Country
  { correct: 'Paris, France',             user: 'Paris',           expect: true,  note: 'geo: city + country stripped' },
  { correct: 'London, England',           user: 'London',          expect: true,  note: 'geo: city + UK constituent stripped' },
  { correct: 'Sydney, Australia',         user: 'Sydney',          expect: true,  note: 'geo: city + country stripped' },
  { correct: 'Tokyo, Japan',              user: 'Tokyo',           expect: true,  note: 'geo: city + country stripped' },
  { correct: 'Berlin, Germany',           user: 'Berlin',          expect: true,  note: 'geo: city + country stripped' },
  // Non-geo qualifier — must NOT strip
  { correct: 'Salt, Pepper',              user: 'Salt',            expect: false, note: 'geo: non-geo qualifier not stripped' },
  { correct: 'Red, White and Blue',       user: 'Red',             expect: false, note: 'geo: non-geo multi-word not stripped' },
  { correct: 'Ace, Deuce',                user: 'Ace',             expect: false, note: 'geo: non-geo suffix — short word, JW too low, not stripped' },
  // Fuzzy city name
  { correct: 'Albuquerque, New Mexico',   user: 'Albuquerqe',      expect: true,  note: 'geo: fuzzy city name + state stripped' },

  // ── N-of from question text ───────────────────────────────────────────────
  // "1 of 2 X" pattern
  { correct: 'Alaska & Hawaii',       user: 'Alaska',          question: '1 of 2 states that are not in the contiguous U.S.',              expect: true,  note: 'q-nof: "1 of 2" — valid pick' },
  { correct: 'Alaska & Hawaii',       user: 'Hawaii',          question: '1 of 2 states that are not in the contiguous U.S.',              expect: true,  note: 'q-nof: "1 of 2" — other valid pick' },
  { correct: 'Alaska & Hawaii',       user: 'Texas',           question: '1 of 2 states that are not in the contiguous U.S.',              expect: false, note: 'q-nof: "1 of 2" — wrong state rejected' },
  { correct: 'Alaska & Hawaii',       user: 'Alaska & Hawaii', question: '1 of 2 states that are not in the contiguous U.S.',              expect: true,  note: 'q-nof: "1 of 2" — giving both candidates is always accepted' },
  // "Name N of..." pattern
  { correct: 'Mercury & Venus & Mars & Jupiter', user: 'Mercury & Venus',     question: 'Name 2 of the 4 inner and outer planets',        expect: true,  note: 'q-nof: "Name 2 of 4" — valid pair' },
  { correct: 'Mercury & Venus & Mars & Jupiter', user: 'Mars & Jupiter',      question: 'Name 2 of the 4 inner and outer planets',        expect: true,  note: 'q-nof: "Name 2 of 4" — different pair' },
  { correct: 'Mercury & Venus & Mars & Jupiter', user: 'Mercury',             question: 'Name 2 of the 4 inner and outer planets',        expect: false, note: 'q-nof: "Name 2 of 4" — gave 1, need 2' },
  { correct: 'Mercury & Venus & Mars & Jupiter', user: 'Pluto & Venus',       question: 'Name 2 of the 4 inner and outer planets',        expect: false, note: 'q-nof: "Name 2 of 4" — one wrong rejected' },
  // "Either of" pattern → N=1
  { correct: 'Red & Blue',            user: 'Red',             question: 'Either of the 2 primary colors used in this flag',             expect: true,  note: 'q-nof: "Either of" — first pick' },
  { correct: 'Red & Blue',            user: 'Blue',            question: 'Either of the 2 primary colors used in this flag',             expect: true,  note: 'q-nof: "Either of" — second pick' },
  { correct: 'Red & Blue',            user: 'Green',           question: 'Either of the 2 primary colors used in this flag',             expect: false, note: 'q-nof: "Either of" — wrong color rejected' },
  // "Any N of" pattern
  { correct: 'North & South & East & West', user: 'North & East',   question: 'Any 2 of the 4 cardinal directions',                  expect: true,  note: 'q-nof: "Any 2 of" — valid pair' },
  { correct: 'North & South & East & West', user: 'South',          question: 'Any 2 of the 4 cardinal directions',                  expect: false, note: 'q-nof: "Any 2 of" — gave 1, need 2' },
  // "and"-separated correct answers (not just &)
  { correct: 'Alaska and Hawaii',     user: 'Alaska',          question: '1 of 2 states that are not in the contiguous U.S.',              expect: true,  note: 'q-nof: "and" separator — valid pick' },
  { correct: 'Alaska and Hawaii',     user: 'Hawaii',          question: '1 of 2 states that are not in the contiguous U.S.',              expect: true,  note: 'q-nof: "and" separator — other valid pick' },
  { correct: 'Alaska and Hawaii',     user: 'Texas',           question: '1 of 2 states that are not in the contiguous U.S.',              expect: false, note: 'q-nof: "and" separator — wrong answer rejected' },
  { correct: 'Mercury and Venus and Mars', user: 'Venus & Mars', question: 'Name 2 of the 3 planets closest to the Sun',                  expect: true,  note: 'q-nof: "and" separator — valid pair, user uses &' },
  // Fuzzy match still works
  { correct: 'Alaska & Hawaii',       user: 'Alaskaa',         question: '1 of 2 states that are not in the contiguous U.S.',              expect: true,  note: 'q-nof: fuzzy match on valid pick' },
  // No question text — q-nof must NOT fire; single partial answer correctly rejected
  // (using "Red & Blue" since "red" JW-distance from "red blue" is ~0.854, below 0.885 threshold)
  { correct: 'Red & Blue',            user: 'Red',             question: '',                                                               expect: false, note: 'q-nof: no question text — single partial answer rejected' },
  // Single-candidate correct answer — q-nof must not activate
  { correct: 'Alaska',               user: 'Alaska',          question: '1 of 2 states that are not in the contiguous U.S.',              expect: true,  note: 'q-nof: single correct answer still accepted normally' },
  { correct: 'Alaska',               user: 'Hawaii',          question: '1 of 2 states that are not in the contiguous U.S.',              expect: false, note: 'q-nof: single correct answer — wrong answer rejected' },
  // Question text with N-of in the middle (should NOT trigger — anchored to start)
  { correct: 'Red & Blue',            user: 'Red',             question: 'This flag uses 1 of 2 colors',                                   expect: false, note: 'q-nof: N-of mid-question — not anchored, no trigger' },

  // ── Last-name shorthand — names not in original list ─────────────────────
  { correct: 'Neville Chamberlain',   user: 'Chamberlain',     expect: true,  note: 'last name: Neville Chamberlain → Chamberlain' },
  { correct: 'Johannes Kepler',        user: 'Kepler',          expect: true,  note: 'last name: Johannes Kepler → Kepler' },

  // ── Compound surnames (particle names) ───────────────────────────────────
  { correct: 'Leonardo da Vinci',      user: 'da Vinci',        expect: true,  note: 'compound surname: da Vinci accepted' },
  { correct: 'Leonardo da Vinci',      user: 'DaVinci',         expect: true,  note: 'compound surname: DaVinci (no space) accepted' },
  { correct: 'Leonardo da Vinci',      user: 'Vinci',           expect: true,  note: 'compound surname: bare surname accepted' },
  { correct: 'Leonardo da Vinci',      user: 'Leonardo',        expect: true,  note: 'compound surname: first name alone — JW accepts (existing behaviour)' },
  { correct: 'Vincent van Gogh',       user: 'van Gogh',        expect: true,  note: 'compound surname: van Gogh accepted' },
  { correct: 'Vincent van Gogh',       user: 'Gogh',            expect: true,  note: 'compound surname: bare surname accepted' },
  { correct: 'Ludwig van Beethoven',   user: 'van Beethoven',   expect: true,  note: 'compound surname: van Beethoven accepted' },
  { correct: 'Ludwig van Beethoven',   user: 'Beethoven',       expect: true,  note: 'compound surname: bare surname accepted' },
  { correct: 'Vincent van Gogh',       user: 'Monet',           expect: false, note: 'compound surname: wrong artist rejected' },
  { correct: 'Vincent van Gogh & Ludwig van Beethoven', user: 'Beethoven and van Gogh',  expect: true,  note: 'compound surname: multi-part, bare + particle, reversed' },
  { correct: 'Vincent van Gogh & Ludwig van Beethoven', user: 'Gogh & Beethoven',        expect: true,  note: 'compound surname: multi-part, both bare surnames' },
  { correct: 'Vincent van Gogh & Ludwig van Beethoven', user: 'Beethoven and vangough',  expect: true,  note: 'compound surname: multi-part, no-space variant' },
  { correct: 'Vincent van Gogh & Ludwig van Beethoven', user: 'Monet and Beethoven',     expect: false, note: 'compound surname: multi-part, one wrong rejected' },

  // ── Multi-part: mixed separators / missing separators ────────────────────
  { correct: 'blue, white & orange',  user: 'blue orange and white',   expect: true,  note: 'multi-part: space-separated with and, no comma between first two' },
  { correct: 'blue, white & orange',  user: 'blue and orange and white', expect: true, note: 'multi-part: all ands' },
  { correct: 'blue, white & orange',  user: 'orange white blue',        expect: true,  note: 'multi-part: space-only, no connectors' },
  { correct: 'blue, white & orange',  user: 'blue orange and green',    expect: false, note: 'multi-part: wrong colour rejected' },

  // ── JW inflation via shared prefix ───────────────────────────────────────
  { correct: 'Secretary Of State & Attorney General', user: 'secretary of state and vice president', expect: false, note: 'multi-part: shared prefix must not inflate JW' },
  { correct: 'Nat King Cole & Natalie Cole',           user: 'Nat King Cole',                         expect: false, note: 'multi-part: partial match rejected (shared prefix inflates JW)' },
  { correct: 'Nat King Cole & Natalie Cole',           user: 'Nat King Cole & Natalie Cole',           expect: true,  note: 'multi-part: full match accepted' },
  { correct: 'Elton John & Billy Joel',                user: 'Elton John',                            expect: false, note: 'multi-part: one of two names rejected' },

  // ── Title prefix stripping ────────────────────────────────────────────────
  { correct: 'President Ronald Reagan',    user: 'Ronald Reagan',   expect: true,  note: 'title: President → accept full name' },
  { correct: 'President Ronald Reagan',    user: 'Reagan',          expect: true,  note: 'title: President → accept last name' },
  { correct: 'President Ronald Reagan',    user: 'Ronald',          expect: false, note: 'title: President → first name alone rejected' },
  { correct: 'Senator John McCain',        user: 'John McCain',     expect: true,  note: 'title: Senator → accept full name' },
  { correct: 'Senator John McCain',        user: 'McCain',          expect: true,  note: 'title: Senator → accept last name' },
  { correct: 'Prime Minister Boris Johnson', user: 'Boris Johnson', expect: true,  note: 'title: Prime Minister → accept full name' },
  { correct: 'Prime Minister Boris Johnson', user: 'Johnson',       expect: true,  note: 'title: Prime Minister → accept last name' },
  { correct: 'General George Patton',      user: 'George Patton',   expect: true,  note: 'title: General → accept full name' },
  { correct: 'General George Patton',      user: 'Patton',          expect: true,  note: 'title: General → accept last name' },
  { correct: 'Commissioner Gordon',        user: 'Gordon',          expect: true,  note: 'title: Commissioner → accept surname-only answer' },
  { correct: 'King Charles',              user: 'Charles',          expect: true,  note: 'title: King → accept name' },
  { correct: 'Doctor Martin Luther King', user: 'Martin Luther King', expect: true, note: 'title: Doctor → accept name without title' },

  // ── Abbreviated titles with trailing dots ────────────────────────────────
  { correct: 'Dr. Martin Luther King',  user: 'Martin Luther King', expect: true,  note: 'abbrev: Dr. → accept name without title' },
  { correct: 'Dr. Martin Luther King',  user: 'Dr. Martin Luther King', expect: true, note: 'abbrev: Dr. → exact with dot accepted' },
  { correct: 'Dr. Martin Luther King',  user: 'Dr Martin Luther King',  expect: true, note: 'abbrev: Dr. → accept without dot' },
  { correct: 'Prof. Albert Einstein',   user: 'Albert Einstein',    expect: true,  note: 'abbrev: Prof. → strip title' },
  { correct: 'Prof. Albert Einstein',   user: 'Einstein',           expect: true,  note: 'abbrev: Prof. → strip title, last name' },
  { correct: 'Rev. Martin Luther King', user: 'Martin Luther King', expect: true,  note: 'abbrev: Rev. → strip title' },
  { correct: 'Sgt. Pepper',             user: 'Pepper',             expect: true,  note: 'abbrev: Sgt. → strip title' },
  { correct: 'Lt. Dan',                 user: 'Dan',                expect: true,  note: 'abbrev: Lt. → strip title' },
  { correct: 'Col. Mustard',            user: 'Mustard',            expect: true,  note: 'abbrev: Col. → strip title' },
  { correct: 'Capt. Kirk',              user: 'Kirk',               expect: true,  note: 'abbrev: Capt. → strip title' },
  { correct: 'Mr. Rogers',              user: 'Rogers',             expect: true,  note: 'abbrev: Mr. → strip honorific' },
  { correct: 'Mrs. Doubtfire',          user: 'Doubtfire',          expect: true,  note: 'abbrev: Mrs. → strip honorific' },
  { correct: 'Ms. Marvel',              user: 'Marvel',             expect: true,  note: 'abbrev: Ms. → strip honorific' },
  { correct: 'St. Augustine',           user: 'Augustine',          expect: true,  note: 'abbrev: St. → strip title (already supported; regression)' },


  // ── Numeric answers — JW must not match similar-looking numbers ───────────
  { correct: '2008',   user: '2008',   expect: true,  note: 'numeric: exact year match' },
  { correct: '2008',   user: '2016',   expect: false, note: 'numeric: different year rejected (JW "two thousand" prefix)' },
  { correct: '2008',   user: '2009',   expect: false, note: 'numeric: off-by-one year rejected' },
  { correct: '1999',   user: '1998',   expect: false, note: 'numeric: adjacent years rejected' },
  { correct: '1776',   user: '1766',   expect: false, note: 'numeric: similar year rejected' },
  { correct: '42',     user: '42',     expect: true,  note: 'numeric: exact small number match' },
  { correct: '42',     user: '43',     expect: false, note: 'numeric: adjacent small number rejected' },
  { correct: '100',    user: '1000',   expect: false, note: 'numeric: different magnitude rejected' },
];

// ─── Run & print table ────────────────────────────────────────────────────────

let pass = 0, fail = 0;

const rows = tests.map(t => {
  const got = isAnswerCorrect(t.user, t.correct, t.question || '');
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
