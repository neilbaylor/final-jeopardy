const assert = require('assert');
const { computeStreaks } = require('./streaks');

// Helper to build answer rows
const a = (game_id, is_correct) => ({ game_id, is_correct });

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

// ─── longest_streak_overall ────────────────────────────────────────────────

test('overall: empty answers → 0', () => {
  const { longest_streak_overall } = computeStreaks([]);
  assert.strictEqual(longest_streak_overall, 0);
});

test('overall: all correct → equals count', () => {
  const { longest_streak_overall } = computeStreaks([
    a(1, true), a(1, true), a(1, true),
  ]);
  assert.strictEqual(longest_streak_overall, 3);
});

test('overall: all wrong → 0', () => {
  const { longest_streak_overall } = computeStreaks([
    a(1, false), a(1, false),
  ]);
  assert.strictEqual(longest_streak_overall, 0);
});

test('overall: streak resets on wrong answer', () => {
  const { longest_streak_overall } = computeStreaks([
    a(1, true), a(1, true), a(1, false), a(1, true),
  ]);
  assert.strictEqual(longest_streak_overall, 2);
});

test('overall: streak spans across games', () => {
  const { longest_streak_overall } = computeStreaks([
    a(1, true), a(1, true),
    a(2, true), a(2, true), a(2, true), // streak of 5 crossing games
  ]);
  assert.strictEqual(longest_streak_overall, 5);
});

test('overall: wrong answer between games breaks cross-game streak', () => {
  const { longest_streak_overall } = computeStreaks([
    a(1, true), a(1, true), a(1, false),
    a(2, true), a(2, true),
  ]);
  assert.strictEqual(longest_streak_overall, 2);
});

test('overall: picks longest across multiple streaks', () => {
  const { longest_streak_overall } = computeStreaks([
    a(1, true), a(1, false),
    a(1, true), a(1, true), a(1, true), a(1, false),
    a(1, true),
  ]);
  assert.strictEqual(longest_streak_overall, 3);
});

// ─── longest_streak_single_game ───────────────────────────────────────────

test('single-game: empty answers → 0', () => {
  const { longest_streak_single_game } = computeStreaks([]);
  assert.strictEqual(longest_streak_single_game, 0);
});

test('single-game: streak does not cross game boundary', () => {
  // game 1: correct, correct, game 2: correct, correct, correct
  // overall=5 but single-game best is 3
  const { longest_streak_single_game } = computeStreaks([
    a(1, true), a(1, true),
    a(2, true), a(2, true), a(2, true),
  ]);
  assert.strictEqual(longest_streak_single_game, 3);
});

test('single-game: interleaved games tracked independently', () => {
  // answers from games interleaved by date
  const { longest_streak_single_game } = computeStreaks([
    a(1, true),
    a(2, true), a(2, true), a(2, true),
    a(1, false),
    a(1, true), a(1, true),
  ]);
  // game 1: true, false, true, true → best = 2
  // game 2: true, true, true → best = 3
  assert.strictEqual(longest_streak_single_game, 3);
});

test('single-game: wrong answer resets only its game', () => {
  const { longest_streak_single_game, longest_streak_overall } = computeStreaks([
    a(1, true), a(1, true), a(1, true), // game 1 streak = 3
    a(2, false),                         // game 2 wrong, resets game 2 only
    a(1, true),                          // game 1 continues: streak = 4
  ]);
  assert.strictEqual(longest_streak_single_game, 4);
  // overall: true,true,true,false(game2),true → resets at false → overall best = 3
  assert.strictEqual(longest_streak_overall, 3);
});

test('single-game: multiple games, picks the best', () => {
  const { longest_streak_single_game } = computeStreaks([
    a(1, true), a(1, true),               // game 1 best = 2
    a(2, true),                            // game 2 best = 1
    a(3, true), a(3, true), a(3, true),   // game 3 best = 3
  ]);
  assert.strictEqual(longest_streak_single_game, 3);
});

// ─── both together ────────────────────────────────────────────────────────

test('combined: single correct answer', () => {
  const { longest_streak_overall, longest_streak_single_game } = computeStreaks([
    a(1, true),
  ]);
  assert.strictEqual(longest_streak_overall, 1);
  assert.strictEqual(longest_streak_single_game, 1);
});

// ─── Summary ──────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
