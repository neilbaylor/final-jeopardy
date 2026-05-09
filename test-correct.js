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

  // ── Last-name-only: three-word person names ──────────────────────────────
  // Mary Jo Smith is now a 3-word person name → middle "Jo" not a stop word → "Smith" accepted
  { correct: 'Mary Jo Smith',            user: 'Smith',               expect: true,  note: '3-word name — Mary Jo Smith → Smith accepted' },
  { correct: 'William Randolph Hearst',  user: 'Hearst',              expect: true,  note: '3-word name — William Randolph Hearst → Hearst' },
  { correct: 'William Randolph Hearst',  user: 'William Randolph Hearst', expect: true, note: '3-word name — full name still accepted' },
  { correct: 'William Randolph Hearst',  user: 'William Hearst',      expect: true,  note: '3-word name — drop middle name' },
  { correct: 'William Randolph Hearst',  user: 'Pulitzer',            expect: false, note: '3-word name — wrong surname rejected' },
  { correct: 'Edgar Allan Poe',          user: 'Poe',                 expect: true,  note: '3-word name — Edgar Allan Poe → Poe' },
  { correct: 'John Wilkes Booth',        user: 'Booth',               expect: true,  note: '3-word name — John Wilkes Booth → Booth' },
  { correct: 'Ralph Waldo Emerson',      user: 'Emerson',             expect: true,  note: '3-word name — Ralph Waldo Emerson → Emerson' },
  { correct: 'Ebenezer Scrooge',         user: 'Scrooge',             expect: true,  note: 'last-name — Ebenezer is a known first name' },
  { correct: 'Henry Wadsworth Longfellow', user: 'Longfellow',        expect: true,  note: '3-word name — Henry Wadsworth Longfellow → Longfellow' },
  { correct: 'Mary Tyler Moore',         user: 'Moore',               expect: true,  note: '3-word name — Mary Tyler Moore → Moore' },

  // 3-word non-person answers with stop words: middle stop word blocks shortcut
  { correct: 'Jack the Ripper',          user: 'Ripper',              expect: false, note: '3-word — "the" stop word blocks last-name shortcut' },
  { correct: 'Joan of Arc',              user: 'Arc',                 expect: false, note: '3-word — "of" stop word blocks last-name shortcut' },
  { correct: 'Winnie the Pooh',          user: 'Pooh',                expect: false, note: '3-word — "the" stop word blocks last-name shortcut' },
  { correct: 'Adam and Eve',             user: 'Eve',                 expect: false, note: '3-word — "and" stop word blocks last-name shortcut' },

  // 3-word names where first word is NOT a known first name → no shortcut
  { correct: 'Pumpkin Spice Latte',      user: 'Latte',               expect: false, note: '3-word — first word not a known first name' },
  { correct: 'New York City',            user: 'City',                expect: false, note: '3-word — first word not a known first name' },

  // ── Multi-part: 3-word person names ──────────────────────────────────────
  { correct: 'James Garfield & William Randolph Hearst', user: 'Hearst and Garfield', expect: true,  note: '3-word combo — 2-word + 3-word last names, reversed' },
  { correct: 'James Garfield & William Randolph Hearst', user: 'Garfield and Hearst', expect: true,  note: '3-word combo — 2-word + 3-word last names, in order' },
  { correct: 'James Garfield & William Randolph Hearst', user: 'Garfield & Hearst',   expect: true,  note: '3-word combo — & separator' },
  { correct: 'James Garfield & William Randolph Hearst', user: 'Hearst',              expect: false, note: '3-word combo — only one half' },
  { correct: 'James Garfield & William Randolph Hearst', user: 'Garfield',            expect: false, note: '3-word combo — only first half' },
  { correct: 'James Garfield & William Randolph Hearst', user: 'Hearst and Pulitzer', expect: false, note: '3-word combo — one wrong rejected' },
  { correct: 'Edgar Allan Poe & John Wilkes Booth',      user: 'Poe and Booth',       expect: true,  note: '3-word combo — both 3-word names' },
  { correct: 'Edgar Allan Poe & John Wilkes Booth',      user: 'Booth and Poe',       expect: true,  note: '3-word combo — both 3-word, reversed' },
  { correct: 'Edgar Allan Poe & John Wilkes Booth',      user: 'Poe & Booth',         expect: true,  note: '3-word combo — & separator' },
  { correct: 'Ralph Waldo Emerson and Henry Wadsworth Longfellow', user: 'Emerson and Longfellow', expect: true, note: '3-word combo — both 3-word, "and" in correct' },
  { correct: 'Ralph Waldo Emerson and Henry Wadsworth Longfellow', user: 'Longfellow and Emerson', expect: true, note: '3-word combo — both 3-word, reversed' },
  { correct: 'William Randolph Hearst & James K. Polk',  user: 'Hearst and Polk',     expect: true,  note: '3-word + middle-initial combo' },
  { correct: 'William Randolph Hearst & James K. Polk',  user: 'Polk and Hearst',     expect: true,  note: '3-word + middle-initial combo, reversed' },

  // ── Inverse: user adds a middle name that the DB answer does not have ────
  { correct: 'William Hearst',           user: 'William Randolph Hearst', expect: true,  note: 'inverse — user adds middle name to 2-word DB answer' },
  { correct: 'Hearst',                   user: 'William Randolph Hearst', expect: true,  note: 'inverse — user expands single-word DB answer' },
  { correct: 'Poe',                      user: 'Edgar Allan Poe',     expect: true,  note: 'inverse — single-word DB, user adds first + middle' },
  { correct: 'Booth',                    user: 'John Wilkes Booth',   expect: true,  note: 'inverse — single-word DB, user adds first + middle' },
  { correct: 'Smith',                    user: 'Mary Jo Smith',       expect: true,  note: 'inverse — single-word DB, user provides 3-word name' },
  { correct: 'Hearst',                   user: 'Pulitzer',            expect: false, note: 'inverse — wrong user surname rejected' },
  { correct: 'William Hearst',           user: 'Randolph Pulitzer',   expect: false, note: 'inverse — user wrong surname even with middle' },
  { correct: 'Poe',                      user: 'Stephen King',        expect: false, note: 'inverse — entirely wrong person rejected' },


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
  { correct: '1776',               user: 'Seventeen Seventy Six', expect: true,  note: 'year-style: 1776 ↔ Seventeen Seventy Six' },

  // ── Apostrophe normalization ──────────────────────────────────────────────
  { correct: "Rock 'n' Roll",      user: "Rock n Roll",        expect: true,  note: "apostrophe — curly apostrophe stripped" },
  { correct: "O'Brien",            user: "OBrien",             expect: true,  note: "apostrophe — name apostrophe stripped" },

  // ── Suffix / leading-qualifier omission (≥72% length, word boundary) ──────
  { correct: 'U.S. Virgin Islands',           user: 'Virgin Islands',          expect: true,  note: 'suffix — omit leading "U.S." qualifier' },
  { correct: 'British Virgin Islands',        user: 'Virgin Islands',          expect: false, note: 'suffix — ratio 0.609 < 0.72, rejected' },
  { correct: 'The United States of America',  user: 'States of America',       expect: false, note: 'suffix — too short (<72% of full length)' },
  { correct: 'The United States of America',  user: 'United States of America', expect: true, note: 'suffix — omit "The", long enough' },
  { correct: 'Lake Superior',                 user: 'Superior',                expect: true,  note: 'geo prefix — "Lake" treated as optional prefix' },
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

  // ── Title + single-word name: accept [anything] LastName ──────────────────
  { correct: 'General MacArthur',   user: 'MacArthur',        expect: true,  note: 'title + single name — bare surname' },
  { correct: 'General MacArthur',   user: 'Tyler MacArthur',  expect: true,  note: 'title + single name — any-first-name + surname' },
  { correct: 'General MacArthur',   user: 'Douglas MacArthur',expect: true,  note: 'title + single name — real first name' },
  { correct: 'General MacArthur',   user: 'General MacArthur',expect: true,  note: 'title + single name — exact match' },
  { correct: 'General MacArthur',   user: 'macarthur',        expect: true,  note: 'title + single name — lowercase' },
  { correct: 'General MacArthur',   user: 'Mcarthur',         expect: true,  note: 'title + single name — spelling variant via JW' },
  { correct: 'General MacArthur',   user: 'Patton',           expect: false, note: 'title + single name — different surname rejected' },
  { correct: 'General MacArthur',   user: 'Tyler Patton',     expect: false, note: 'title + single name — different surname with first rejected' },
  { correct: 'Sir Lancelot',        user: 'Lancelot',         expect: true,  note: 'title + single name — bare name' },
  { correct: 'Sir Lancelot',        user: 'Joe Lancelot',     expect: true,  note: 'title + single name — any-first-name + name' },
  { correct: 'Sir Lancelot',        user: 'Sir Lancelot',     expect: true,  note: 'title + single name — exact match' },
  { correct: 'Sir Lancelot',        user: 'Arthur',           expect: false, note: 'title + single name — wrong name rejected' },
  { correct: 'Sir Lancelot',        user: 'Sir Galahad',      expect: false, note: 'title + single name — different knight rejected' },
  { correct: 'Admiral Nelson',      user: 'Nelson',           expect: true,  note: 'title + single name — Admiral + bare name' },
  { correct: 'Admiral Nelson',      user: 'Horatio Nelson',   expect: true,  note: 'title + single name — Admiral + full name' },
  { correct: 'Admiral Nelson',      user: 'Wellington',       expect: false, note: 'title + single name — wrong admiral rejected' },
  { correct: 'Captain Kirk',        user: 'Kirk',             expect: true,  note: 'title + single name — Captain + bare name' },
  { correct: 'Captain Kirk',        user: 'James Kirk',       expect: true,  note: 'title + single name — Captain + first+last' },
  { correct: 'Captain Kirk',        user: 'Picard',           expect: false, note: 'title + single name — wrong captain rejected' },
  { correct: 'King Arthur',         user: 'Arthur',           expect: true,  note: 'title + single name — King + bare name' },
  { correct: 'King Arthur',         user: 'Prince Arthur',    expect: true,  note: 'title + single name — King + prefix + name' },
  { correct: 'King Arthur',         user: 'Lancelot',         expect: false, note: 'title + single name — wrong king rejected' },
  { correct: 'Doctor Strange',      user: 'Strange',          expect: true,  note: 'title + single name — Doctor + bare name' },
  { correct: 'Doctor Strange',      user: 'Stephen Strange',  expect: true,  note: 'title + single name — Doctor + real first name' },
  { correct: 'Lord Byron',          user: 'Byron',            expect: true,  note: 'title + single name — Lord + bare name' },
  { correct: 'Lord Byron',          user: 'George Byron',     expect: true,  note: 'title + single name — Lord + first + name' },
  { correct: 'Saint Nicholas',      user: 'Nicholas',         expect: true,  note: 'title + single name — Saint + bare name' },
  { correct: 'Mr. Rogers',          user: 'Fred Rogers',      expect: true,  note: 'abbrev title + single name — Mr. + real name' },
  { correct: 'Mr. Rogers',          user: 'Anybody Rogers',   expect: true,  note: 'abbrev title + single name — Mr. + any first name' },
  { correct: 'Colonel Mustard',     user: 'Mustard',          expect: true,  note: 'title + single name — Colonel + bare' },
  { correct: 'Colonel Mustard',     user: 'Yellow Mustard',   expect: true,  note: 'title + single name — Colonel + any word' },

  // ── Middle-of-word punctuation collapses (M*A*S*H) ───────────────────────
  { correct: 'M*A*S*H',     user: 'MASH',            expect: true,  note: 'punctuation: M*A*S*H → MASH' },
  { correct: 'M*A*S*H',     user: 'mash',            expect: true,  note: 'punctuation: lowercase mash' },
  { correct: 'M*A*S*H',     user: 'M*A*S*H',         expect: true,  note: 'punctuation: exact match with asterisks' },
  { correct: 'M*A*S*H',     user: 'm*a*s*h',         expect: true,  note: 'punctuation: lowercase with asterisks' },
  { correct: 'M*A*S*H',     user: 'M.A.S.H.',        expect: true,  note: 'punctuation: dotted form accepted' },
  { correct: 'MASH',        user: 'M*A*S*H',         expect: true,  note: 'punctuation: reverse — db MASH, user M*A*S*H' },
  { correct: 'M*A*S*H',     user: 'Seinfeld',        expect: false, note: 'punctuation: wrong show rejected' },
  { correct: 'U-S-A',       user: 'USA',             expect: true,  note: 'punctuation: hyphen-separated collapses' },
  { correct: 'U.S.A.',      user: 'U*S*A',           expect: true,  note: 'punctuation: mixed separators' },
  { correct: 'K-I-S-S',     user: 'KISS',            expect: true,  note: 'punctuation: hyphenated band name' },

  // ── Numeric answers — JW must not match similar-looking numbers ───────────
  { correct: '2008',   user: '2008',   expect: true,  note: 'numeric: exact year match' },
  { correct: '2008',   user: '2016',   expect: false, note: 'numeric: different year rejected (JW "two thousand" prefix)' },
  { correct: '2008',   user: '2009',   expect: false, note: 'numeric: off-by-one year rejected' },
  { correct: '1999',   user: '1998',   expect: false, note: 'numeric: adjacent years rejected' },
  { correct: '1776',   user: '1766',   expect: false, note: 'numeric: similar year rejected' },
  { correct: '42',     user: '42',     expect: true,  note: 'numeric: exact small number match' },
  { correct: '42',     user: '43',     expect: false, note: 'numeric: adjacent small number rejected' },
  { correct: '100',    user: '1000',   expect: false, note: 'numeric: different magnitude rejected' },

  // ── Institution shorthand (university/college/school/academy/institute) ──────
  { correct: 'University of Oregon',        user: 'Oregon',                expect: true,  note: 'institution: University of X → X' },
  { correct: 'Oregon University',           user: 'Oregon',                expect: true,  note: 'institution: X University → X' },
  { correct: 'Oregon College',              user: 'Oregon',                expect: true,  note: 'institution: X College → X' },
  { correct: 'College of Oregon',           user: 'Oregon',                expect: true,  note: 'institution: College of X → X' },
  { correct: 'Stanford University',         user: 'Stanford',              expect: true,  note: 'institution: Stanford University → Stanford' },
  { correct: 'Harvard University',          user: 'Harvard',               expect: true,  note: 'institution: Harvard University → Harvard' },
  { correct: 'Yale University',             user: 'Yale',                  expect: true,  note: 'institution: Yale University → Yale' },
  { correct: 'University of California',    user: 'California',            expect: true,  note: 'institution: UC → California' },
  { correct: 'Ohio State University',       user: 'Ohio State',            expect: true,  note: 'institution: multi-word core OSU' },
  { correct: 'Juilliard School',            user: 'Juilliard',             expect: true,  note: 'institution: X School → X' },
  { correct: 'School of Hard Knocks',       user: 'Hard Knocks',           expect: true,  note: 'institution: School of X → X' },
  { correct: 'Naval Academy',               user: 'Naval',                 expect: true,  note: 'institution: X Academy → X' },
  { correct: 'West Point Academy',          user: 'West Point',            expect: true,  note: 'institution: X Academy → multi-word X' },
  { correct: 'Institute of Technology',     user: 'Technology',            expect: true,  note: 'institution: Institute of X → X' },
  { correct: 'Massachusetts Institute of Technology', user: 'Massachusetts Technology', expect: true, note: 'institution: MIT long form core' },
  { correct: 'Stanford University',         user: 'stanford',              expect: true,  note: 'institution: lowercase' },
  { correct: 'Stanford University',         user: 'Stamford',              expect: true,  note: 'institution: typo via JW' },
  // Negatives — wrong school / insufficient word
  { correct: 'Stanford University',         user: 'Yale',                  expect: false, note: 'institution: wrong school rejected' },
  { correct: 'Oregon University',           user: 'California',            expect: false, note: 'institution: wrong state rejected' },
  { correct: 'Harvard University',          user: 'Howard',                expect: false, note: 'institution: Howard rejected for Harvard (JW close)' },

  // ── Institution shorthand inside multi-part answers ──────────────────────────
  { correct: 'University of Oregon & Stanford University', user: 'Stanford and Oregon',       expect: true, note: 'multi-part institutions: shorthand both, swapped' },
  { correct: 'University of Oregon & Stanford University', user: 'Oregon and Stanford',       expect: true, note: 'multi-part institutions: shorthand both, in order' },
  { correct: 'University of Oregon & Stanford University', user: 'Oregon & Stanford',         expect: true, note: 'multi-part institutions: & connector' },
  { correct: 'University of Oregon & Stanford University', user: 'Oregon, Stanford',          expect: true, note: 'multi-part institutions: comma connector' },
  { correct: 'University of Oregon & Stanford University', user: 'Stanford University and University of Oregon', expect: true, note: 'multi-part institutions: full forms swapped' },
  { correct: 'University of Oregon and Stanford University', user: 'Stanford and Oregon',     expect: true, note: 'multi-part institutions: and-joined DB' },
  { correct: 'Harvard University and Yale University',    user: 'Harvard and Yale',           expect: true, note: 'multi-part institutions: two universities' },
  { correct: 'Oregon College & Stanford University',      user: 'Oregon and Stanford',        expect: true, note: 'multi-part institutions: mixed types' },
  // Multi-part negatives
  { correct: 'University of Oregon & Stanford University', user: 'Oregon',                    expect: false, note: 'multi-part institutions: only 1 of 2 rejected' },
  { correct: 'University of Oregon & Stanford University', user: 'Oregon and Yale',           expect: false, note: 'multi-part institutions: 1 right 1 wrong' },
  { correct: 'University of Oregon & Stanford University', user: 'Yale and Harvard',          expect: false, note: 'multi-part institutions: both wrong' },

  // ── Non-institution answers unaffected ───────────────────────────────────────
  { correct: 'Abraham Lincoln',             user: 'Lincoln',               expect: true,  note: 'institution: non-institution still works (Lincoln)' },
  { correct: 'Ebenezer Scrooge',            user: 'Scrooge',               expect: true,  note: 'institution: non-institution still works (Scrooge)' },

  // ── First-name spelling variants (Caitlin/Kaitlin/Kaitlyn/Katelyn/etc.) ──────
  { correct: 'Caitlin Clark',  user: 'Caitlin Clark',  expect: true,  note: 'first-name variant: exact' },
  { correct: 'Caitlin Clark',  user: 'Clark',          expect: true,  note: 'first-name variant: bare last name' },
  { correct: 'Caitlin Clark',  user: 'Kaitlin Clark',  expect: true,  note: 'first-name variant: Kaitlin spelling' },
  { correct: 'Caitlin Clark',  user: 'Kaitlyn Clark',  expect: true,  note: 'first-name variant: Kaitlyn spelling' },
  { correct: 'Caitlin Clark',  user: 'Katelyn Clark',  expect: true,  note: 'first-name variant: Katelyn spelling' },
  { correct: 'Caitlin Clark',  user: 'Caitlyn Clark',  expect: true,  note: 'first-name variant: Caitlyn spelling' },
  { correct: 'Caitlin Clark',  user: 'Katelynn Clark', expect: true,  note: 'first-name variant: Katelynn spelling' },
  { correct: 'Caitlin Clark',  user: 'kaitlyn clark',  expect: true,  note: 'first-name variant: lowercase' },
  // Reverse — DB has the variant, user has the canonical
  { correct: 'Kaitlyn Clark',  user: 'Caitlin Clark',  expect: true,  note: 'first-name variant: reverse direction' },
  { correct: 'Katelyn Clark',  user: 'Clark',          expect: true,  note: 'first-name variant: variant DB → bare last name' },
  // Catherine/Cathryn — both canonical now
  { correct: 'Catherine Smith', user: 'Cathryn Smith', expect: true,  note: 'first-name variant: Cathryn for Catherine' },
  { correct: 'Cathryn Smith',   user: 'Smith',         expect: true,  note: 'first-name variant: Cathryn DB recognized' },
  // Sanity: different last name should still reject
  { correct: 'Caitlin Clark',  user: 'Kaitlyn Smith',  expect: false, note: 'first-name variant: wrong last name rejected' },
  { correct: 'Caitlin Clark',  user: 'Katelyn',        expect: false, note: 'first-name variant: only first name rejected' },

  // ── Other first-name spelling variants ───────────────────────────────────────
  { correct: 'Eric Cartman',     user: 'Erik Cartman',     expect: true,  note: 'first-name variant: Erik for Eric' },
  { correct: 'Eric Cartman',     user: 'Erick Cartman',    expect: true,  note: 'first-name variant: Erick for Eric' },
  { correct: 'Sean Connery',     user: 'Shawn Connery',    expect: true,  note: 'first-name variant: Shawn for Sean' },
  { correct: 'Sean Connery',     user: 'Shaun Connery',    expect: true,  note: 'first-name variant: Shaun for Sean' },
  { correct: 'Michael Jordan',   user: 'Micheal Jordan',   expect: true,  note: 'first-name variant: Micheal for Michael' },
  { correct: 'Allen Iverson',    user: 'Alan Iverson',     expect: true,  note: 'first-name variant: Alan for Allen' },
  { correct: 'Allen Iverson',    user: 'Allan Iverson',    expect: true,  note: 'first-name variant: Allan for Allen' },
  { correct: 'Brittany Spears',  user: 'Britney Spears',   expect: true,  note: 'first-name variant: Britney for Brittany' },
  { correct: 'Megan Rapinoe',    user: 'Meghan Rapinoe',   expect: true,  note: 'first-name variant: Meghan for Megan' },
  { correct: 'Hannah Storm',     user: 'Hanna Storm',      expect: true,  note: 'first-name variant: Hanna for Hannah' },
  { correct: 'Rachel Green',     user: 'Rachael Green',    expect: true,  note: 'first-name variant: Rachael for Rachel' },
  { correct: 'Rebecca Black',    user: 'Rebekah Black',    expect: true,  note: 'first-name variant: Rebekah for Rebecca' },
  { correct: 'Crystal Smith',    user: 'Krystal Smith',    expect: true,  note: 'first-name variant: Krystal for Crystal' },
  { correct: 'Jacob Black',      user: 'Jakob Black',      expect: true,  note: 'first-name variant: Jakob for Jacob' },
  { correct: 'Joseph Stalin',    user: 'Josef Stalin',     expect: true,  note: 'first-name variant: Josef for Joseph' },
  { correct: 'Stephen Hawking',  user: 'Stephan Hawking',  expect: true,  note: 'first-name variant: Stephan for Stephen' },
  { correct: 'Stephanie Powers', user: 'Stefanie Powers',  expect: true,  note: 'first-name variant: Stefanie for Stephanie' },
  { correct: 'Lindsay Lohan',    user: 'Lindsey Lohan',    expect: true,  note: 'first-name variant: Lindsey for Lindsay' },
  { correct: 'Hailey Bieber',    user: 'Haley Bieber',     expect: true,  note: 'first-name variant: Haley for Hailey' },
  { correct: 'Hailey Bieber',    user: 'Hayley Bieber',    expect: true,  note: 'first-name variant: Hayley for Hailey' },
  { correct: 'Michelle Obama',   user: 'Michele Obama',    expect: true,  note: 'first-name variant: Michele for Michelle' },
  { correct: 'Catherine Smith',  user: 'Katharine Smith',  expect: true,  note: 'first-name variant: Katharine for Catherine' },
  { correct: 'Nicholas Cage',    user: 'Nicolas Cage',     expect: true,  note: 'first-name variant: Nicolas for Nicholas' },
  { correct: 'Thomas Edison',    user: 'Tomas Edison',     expect: true,  note: 'first-name variant: Tomas for Thomas' },
  { correct: 'Zachary Taylor',   user: 'Zackary Taylor',   expect: true,  note: 'first-name variant: Zackary for Zachary' },
  { correct: 'Derek Jeter',      user: 'Derrick Jeter',    expect: true,  note: 'first-name variant: Derrick for Derek' },
  { correct: 'Dylan Thomas',     user: 'Dillon Thomas',    expect: true,  note: 'first-name variant: Dillon for Dylan' },
  // Sanity rejects
  { correct: 'Eric Cartman',     user: 'Erik Smith',       expect: false, note: 'first-name variant: variant + wrong last name rejected' },
  { correct: 'Sean Connery',     user: 'Shawn',            expect: false, note: 'first-name variant: variant first name alone rejected' },

  // ── Government departments / ministries ──────────────────────────────────────
  { correct: 'Department of Homeland Security',     user: 'Homeland Security',     expect: true,  note: 'department: Dept of X → X' },
  { correct: 'Department of Homeland Security',     user: 'homeland security',     expect: true,  note: 'department: lowercase' },
  { correct: 'The Department of Homeland Security', user: 'Homeland Security',     expect: true,  note: 'department: with leading "The"' },
  { correct: 'Department of State',                 user: 'State',                 expect: true,  note: 'department: Dept of State' },
  { correct: 'Department of Defense',               user: 'Defense',               expect: true,  note: 'department: Dept of Defense' },
  { correct: 'Department of the Treasury',          user: 'Treasury',              expect: true,  note: 'department: Dept of the X' },
  { correct: 'Department of Justice',               user: 'Justice',               expect: true,  note: 'department: Dept of Justice' },
  { correct: 'Department of Education',             user: 'Education',             expect: true,  note: 'department: Dept of Education' },
  { correct: 'Ministry of Defence',                 user: 'Defence',               expect: true,  note: 'department: Ministry of X' },
  { correct: 'Ministry of Magic',                   user: 'Magic',                 expect: true,  note: 'department: fictional Ministry of X' },
  // Multi-part
  { correct: 'Department of State & Department of Defense', user: 'State and Defense', expect: true, note: 'department: multi-part shorthand' },
  { correct: 'Department of State & Department of Defense', user: 'Defense and State', expect: true, note: 'department: multi-part swapped' },
  // Negatives
  { correct: 'Department of Homeland Security',     user: 'Department',            expect: false, note: 'department: just "Department" rejected' },
  { correct: 'Department of Homeland Security',     user: 'Justice',               expect: false, note: 'department: wrong department rejected' },
  { correct: 'Department of State',                 user: 'Defense',               expect: false, note: 'department: wrong word rejected' },

  // ── Nickname ↔ formal name (Teddy ↔ Theodore) ────────────────────────────────
  { correct: 'Theodore Roosevelt', user: 'Teddy Roosevelt',     expect: true,  note: 'nickname: Teddy accepted for Theodore DB' },
  { correct: 'Teddy Roosevelt',    user: 'Theodore Roosevelt',  expect: true,  note: 'nickname: Theodore accepted for Teddy DB' },
  { correct: 'Teddy Roosevelt',    user: 'Roosevelt',           expect: true,  note: 'nickname: Teddy DB still accepts bare last name' },
  { correct: 'Teddy Roosevelt',    user: 'Tyler Roosevelt',     expect: true,  note: 'nickname: Teddy DB accepts any first + Roosevelt' },
  { correct: 'Teddy Roosevelt',    user: 'Teddy Smith',         expect: false, note: 'nickname: Teddy DB rejects wrong last name' },

  // ── Multi-part with no connectors, uniform word counts ──────────────────────
  { correct: 'Condoleeza Rice & James Buchanan', user: 'Condoleeza Rice James Buchanan', expect: true,  note: 'multi-part: uniform 2-word parts, no connector' },
  { correct: 'Condoleeza Rice & James Buchanan', user: 'condeleza rice james buchanan',   expect: true,  note: 'multi-part: typo via JW per part' },
  { correct: 'Condoleeza Rice & James Buchanan', user: 'James Buchanan Condoleeza Rice',  expect: true,  note: 'multi-part: order swapped, no connector' },
  { correct: 'Condoleeza Rice & James Buchanan', user: 'james buchanan condeleza rice',   expect: true,  note: 'multi-part: swapped + typo + lowercase' },
  { correct: 'Neil Taylor & Joe Ross',           user: 'Neil Taylor Joe Ross',            expect: true,  note: 'multi-part: 2-word parts, no connector' },
  { correct: 'Neil Taylor & Joe Ross',           user: 'Joe Ross Neil Taylor',            expect: true,  note: 'multi-part: 2-word parts, swapped order' },
  // Negatives for new path
  { correct: 'Condoleeza Rice & James Buchanan', user: 'Condoleeza Rice Yale Harvard',    expect: false, note: 'multi-part: half wrong rejected' },
  { correct: 'Condoleeza Rice & James Buchanan', user: 'Condoleeza Rice James',           expect: false, note: 'multi-part: short by one word rejected' },

  // ── Roald Dahl recognized as first name ──────────────────────────────────────
  { correct: 'Roald Dahl', user: 'Dahl',           expect: true,  note: 'roald: bare last name accepted' },
  { correct: 'Roald Dahl', user: 'Roald Dahl',     expect: true,  note: 'roald: full name accepted' },
  { correct: 'Roald Dahl', user: 'roald dahl',     expect: true,  note: 'roald: lowercase' },
  { correct: 'Roald Dahl', user: 'Tyler Dahl',     expect: true,  note: 'roald: any first + Dahl' },
  { correct: 'Roald Dahl', user: 'Smith',          expect: false, note: 'roald: wrong last name rejected' },

  // ── Year-style number reading (1984 ↔ "Nineteen Eighty-Four") ───────────────
  { correct: 'Nineteen Eighty-Four', user: '1984',                  expect: true,  note: 'year-style: digit → words' },
  { correct: '1984',                 user: 'Nineteen Eighty-Four',  expect: true,  note: 'year-style: words → digit' },
  { correct: '1984',                 user: 'nineteen eighty four',  expect: true,  note: 'year-style: spaces, lowercase' },
  { correct: 'Nineteen Eighty-Four', user: 'nineteen eighty four',  expect: true,  note: 'year-style: hyphen vs space' },
  { correct: 'Nineteen Hundred',     user: '1900',                  expect: true,  note: 'year-style: nineteen hundred' },
  { correct: 'Nineteen Oh Five',     user: '1905',                  expect: true,  note: 'year-style: nineteen oh five' },
  { correct: 'twenty twenty-three',  user: '2023',                  expect: true,  note: 'year-style: twenty twenty three' },
  // Existing cardinal path still works
  { correct: '2001 a space odyssey', user: 'two thousand and one a space odyssey', expect: true, note: 'cardinal: 2001 a space odyssey' },
  { correct: '17 candles',           user: 'seventeen candles',     expect: true,  note: 'cardinal: small number' },
  // Negative — different years rejected
  { correct: 'Nineteen Eighty-Four', user: '1985',                  expect: false, note: 'year-style: different year rejected' },
  { correct: '1984',                 user: 'Nineteen Eighty-Five',  expect: false, note: 'year-style: different word year rejected' },

  // ── Foreign leading articles ─────────────────────────────────────────────
  { correct: 'la Marseillaise',      user: 'Marseillaise',          expect: true,  note: 'foreign article: la stripped' },
  { correct: 'La Marseillaise',      user: 'la Marseillaise',       expect: true,  note: 'foreign article: full form still matches' },
  { correct: 'Le Mans',              user: 'Mans',                  expect: true,  note: 'foreign article: le stripped' },
  { correct: 'Les Misérables',       user: 'Misérables',            expect: true,  note: 'foreign article: les stripped' },
  { correct: 'El Dorado',            user: 'Dorado',                expect: true,  note: 'foreign article: el stripped' },
  { correct: "L'Étranger",           user: 'Étranger',              expect: true,  note: "foreign article: l' elision stripped" },
  { correct: 'Der Spiegel',          user: 'Spiegel',               expect: true,  note: 'foreign article: der stripped' },
  { correct: 'la Marseillaise',      user: 'something else',        expect: false, note: 'foreign article: still rejects wrong answer' },

  // ── Tail-after-first-name (3+ word names) ────────────────────────────────
  { correct: 'Jacqueline Kennedy Onassis', user: 'Kennedy Onassis',  expect: true,  note: '3-word name: accept tail after first name' },
  { correct: 'Jacqueline Kennedy Onassis', user: 'Onassis',          expect: true,  note: '3-word name: still accept last only' },
  { correct: 'Jacqueline Kennedy Onassis', user: 'Jacqueline Kennedy Onassis', expect: true, note: '3-word name: full form' },
  { correct: 'Jacqueline Kennedy Onassis', user: 'something else',   expect: false, note: '3-word name: rejects wrong' },
  { correct: 'Edgar Allan Poe',            user: 'Allan Poe',        expect: true,  note: '3-word name: accept tail (Allan Poe)' },

  // ── "X of Y" word-order reversal ─────────────────────────────────────────
  { correct: 'the Code of Hammurabi',      user: 'Hammurabi code',   expect: true,  note: 'X of Y → Y X reversal' },
  { correct: 'the Code of Hammurabi',      user: 'the code of Hammurabi', expect: true, note: 'X of Y: full form' },
  { correct: 'Battle of Hastings',         user: 'Hastings battle',  expect: true,  note: 'X of Y reversal (no article)' },
  { correct: 'the Code of Hammurabi',      user: 'something else',   expect: false, note: 'X of Y: rejects wrong' },

  // ── Leading parens: each word independently optional ─────────────────────
  { correct: '(senator john) McCain',      user: 'John McCain',      expect: true,  note: 'leading parens: partial subset (first name only)' },
  { correct: '(senator john) McCain',      user: 'Senator McCain',   expect: true,  note: 'leading parens: partial subset (title only)' },
  { correct: '(senator john) McCain',      user: 'Senator John McCain', expect: true, note: 'leading parens: full form' },
  { correct: '(senator john) McCain',      user: 'McCain',           expect: true,  note: 'leading parens: bare form' },
  { correct: '(senator john) McCain',      user: 'something else',   expect: false, note: 'leading parens: rejects wrong' },
  { correct: '(Randolph) Caldecott',       user: 'Randolph Caldecott', expect: true, note: 'leading parens: 1-word optional' },

  // ── Distinctive-word fallback in multi-part answers ──────────────────────
  // Two-part with "Gulf of" scaffold
  { correct: 'the Gulf of Tonkin & the Gulf of Thailand', user: 'Thailand and Tonkin',  expect: true,  note: 'multi-part scaffold: distinctive only, reordered' },
  { correct: 'the Gulf of Tonkin & the Gulf of Thailand', user: 'Tonkin and Thailand',  expect: true,  note: 'multi-part scaffold: distinctive only, original order' },
  { correct: 'the Gulf of Tonkin & the Gulf of Thailand', user: 'Thailand & Tonkin',    expect: true,  note: 'multi-part scaffold: distinctive only, & connector' },
  { correct: 'the Gulf of Tonkin & the Gulf of Thailand', user: 'Tonkinn & Thailand',   expect: true,  note: 'multi-part scaffold: typo on distinctive (JW)' },
  { correct: 'the Gulf of Tonkin & the Gulf of Thailand', user: 'Thailand & Tinkin',    expect: true,  note: 'multi-part scaffold: typo other side' },
  { correct: 'the Gulf of Tonkin & the Gulf of Thailand', user: 'the Gulf of Thailand & the Gulf of Tonkin', expect: true, note: 'multi-part scaffold: full form still works' },
  { correct: 'the Gulf of Tonkin & the Gulf of Thailand', user: 'Thailand',             expect: false, note: 'multi-part scaffold: only one part rejected' },
  { correct: 'the Gulf of Tonkin & the Gulf of Thailand', user: 'Atlantic & Pacific',   expect: false, note: 'multi-part scaffold: wrong distinctives rejected' },
  { correct: 'the Gulf of Tonkin & the Gulf of Thailand', user: 'Thailand & Vietnam',   expect: false, note: 'multi-part scaffold: one wrong distinctive' },

  // Three-part with "ocean" scaffold
  { correct: 'Atlantic Ocean, Pacific Ocean and Indian Ocean', user: 'Pacific & Indian & Atlantic', expect: true,  note: '3-part scaffold: distinctive only, reordered' },
  { correct: 'Atlantic Ocean, Pacific Ocean and Indian Ocean', user: 'Atlantic, Pacific, Indian',   expect: true,  note: '3-part scaffold: distinctive only, comma' },
  { correct: 'Atlantic Ocean, Pacific Ocean and Indian Ocean', user: 'Atlantic and Pacific and Indian', expect: true, note: '3-part scaffold: distinctive only, repeated and' },
  { correct: 'Atlantic Ocean, Pacific Ocean and Indian Ocean', user: 'Atlantic Ocean, Pacific Ocean and Indian Ocean', expect: true, note: '3-part scaffold: full form still works' },
  { correct: 'Atlantic Ocean, Pacific Ocean and Indian Ocean', user: 'Pacific Ocean & Indian Ocean & Atlantic Ocean',  expect: true, note: '3-part scaffold: full form reordered' },
  { correct: 'Atlantic Ocean, Pacific Ocean and Indian Ocean', user: 'Atlantik & Pasific & Indian',  expect: true,  note: '3-part scaffold: typos on distinctives' },
  { correct: 'Atlantic Ocean, Pacific Ocean and Indian Ocean', user: 'Pacific & Indian',             expect: false, note: '3-part scaffold: missing one part' },
  { correct: 'Atlantic Ocean, Pacific Ocean and Indian Ocean', user: 'Pacific & Indian & Arctic',    expect: false, note: '3-part scaffold: wrong distinctive' },

  // Edge: parts with no scaffold → fallback shouldn't fire
  { correct: 'Tom & Jerry',                user: 'Tom',              expect: false, note: 'no scaffold: single part still rejected' },
  { correct: 'Mercury & Venus & Mars',     user: 'Mercury',          expect: false, note: 'no scaffold: 1 of 3 rejected' },
  { correct: 'Mercury & Venus & Mars',     user: 'Venus & Mercury & Mars', expect: true,  note: 'no scaffold: full form reordered still works' },

  // Edge: parts where scaffold equals the entire part (no distinctive content) → should NOT match empty
  { correct: 'Ocean & Ocean',              user: 'Ocean',            expect: false, note: 'scaffold = entire part: no distinctive content; 1 vs 2 parts' },

  // Edge: longer scaffold (multi-word common prefix)
  { correct: 'King James I & King James II', user: 'I and II',        expect: true,  note: 'multi-word scaffold (King James): distinctive only' },
  { correct: 'King James I & King James II', user: 'II and I',        expect: true,  note: 'multi-word scaffold: reversed' },

  // Edge: scaffold word also normalizes to a stop word — already stripped, shouldn't matter
  { correct: 'the Battle of Yorktown & the Battle of Trenton', user: 'Trenton & Yorktown', expect: true, note: 'multi-part with article scaffold' },

  // Edge: user gives wrong count
  { correct: 'the Gulf of Tonkin & the Gulf of Thailand', user: 'Tonkin Thailand Cambodia', expect: false, note: 'multi-part scaffold: 3 parts vs 2 rejected' },

  // ── Shared-title-prefix JW guard ──────────────────────────────────────────
  // Two answers that share the same TITLE_PREFIX must not pass solely because
  // of the prefix bonus on Jaro-Winkler. The post-prefix cores must also match.
  { correct: 'Mount Zion',           user: 'Mount Sinai',          expect: false, note: 'shared "Mount" — different mountains' },
  { correct: 'Mount Sinai',          user: 'Mount Zion',           expect: false, note: 'shared "Mount" — reversed' },
  { correct: 'Mount Everest',        user: 'Mount Vesuvius',       expect: false, note: 'shared "Mount" — different mountains' },
  { correct: 'Mount Kilimanjaro',    user: 'Mount Rushmore',       expect: false, note: 'shared "Mount" — totally different' },
  { correct: 'Mount Olympus',        user: 'Mount McKinley',       expect: false, note: 'shared "Mount" — different mountains' },
  { correct: 'Mount Fuji',           user: 'Mount Etna',           expect: false, note: 'shared "Mount" — short suffixes' },
  { correct: 'Saint Mark',           user: 'Saint Mary',           expect: false, note: 'shared "Saint" — different people' },
  { correct: 'Saint Peter',          user: 'Saint Paul',           expect: false, note: 'shared "Saint" — different apostles' },
  { correct: 'Saint Louis',          user: 'Saint Lucia',          expect: false, note: 'shared "Saint" — city vs island' },
  { correct: 'President Lincoln',    user: 'President Jackson',    expect: false, note: 'shared "President" — different presidents' },
  { correct: 'President Roosevelt',  user: 'President Eisenhower', expect: false, note: 'shared "President" — different presidents' },
  { correct: 'King Henry',           user: 'King Edward',          expect: false, note: 'shared "King" — different kings' },
  { correct: 'Queen Mary',           user: 'Queen Anne',           expect: false, note: 'shared "Queen" — different queens' },
  { correct: 'Pope John',            user: 'Pope Paul',            expect: false, note: 'shared "Pope" — different popes' },
  { correct: 'Lake Erie',            user: 'Lake Eyre',            expect: false, note: 'no "Lake" prefix in TITLE_PREFIXES — JW may differ' },
  { correct: 'Mt. Sinai',            user: 'Mt. Zion',             expect: false, note: 'Mt. expanded to Mount on both sides — different mountains' },
  { correct: 'Mount Sinai',          user: 'Mt Zion',              expect: false, note: 'mixed Mt/Mount — different mountains' },
  { correct: 'Doctor House',         user: 'Doctor Who',           expect: false, note: 'shared "Doctor" — different shows' },

  // ── Shared-title-prefix JW guard: still accepts legitimate matches ───────
  // Same title + same/typo'd core should still match.
  { correct: 'Mount Everest',        user: 'Mount Everst',         expect: true,  note: 'shared "Mount" — typo in core, fuzzy passes' },
  { correct: 'Mount Kilimanjaro',    user: 'Mount Kilamanjaro',    expect: true,  note: 'shared "Mount" — common typo' },
  { correct: 'Saint Patrick',        user: 'Saint Patrik',         expect: true,  note: 'shared "Saint" — typo in core' },
  { correct: 'President Roosevelt',  user: 'President Roosvelt',   expect: true,  note: 'shared "President" — typo in core' },

  // ── Shared-title-prefix JW guard: only one side has the prefix ───────────
  // When only one side has a title prefix, existing strip-title logic handles
  // suffix-only matches; this guard shouldn't change behavior there.
  { correct: 'Mount Everest',        user: 'Everest',              expect: true,  note: 'one-sided prefix — accept core only' },
  { correct: 'President Lincoln',    user: 'Lincoln',              expect: true,  note: 'one-sided prefix — last name accepted' },
  { correct: 'Saint Patrick',        user: 'Patrick',              expect: true,  note: 'one-sided prefix — name only' },
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
