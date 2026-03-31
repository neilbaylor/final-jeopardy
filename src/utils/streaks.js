/**
 * Compute streak stats from an ordered array of answer rows.
 * Rows must be ordered by asked_at globally (ascending) for correct overall streak.
 * Each row: { game_id, is_correct }
 */
function computeStreaks(answers) {
  let longest_streak_overall = 0, currentStreak = 0;
  const gameCurrent = new Map(), gameLongest = new Map();

  for (const a of answers) {
    if (a.is_correct) {
      longest_streak_overall = Math.max(longest_streak_overall, ++currentStreak);
      const cur = (gameCurrent.get(a.game_id) || 0) + 1;
      gameCurrent.set(a.game_id, cur);
      gameLongest.set(a.game_id, Math.max(gameLongest.get(a.game_id) || 0, cur));
    } else {
      currentStreak = 0;
      gameCurrent.set(a.game_id, 0);
    }
  }

  const longest_streak_single_game = gameLongest.size > 0
    ? Math.max(...gameLongest.values())
    : 0;

  return { longest_streak_overall, longest_streak_single_game };
}

module.exports = { computeStreaks };
