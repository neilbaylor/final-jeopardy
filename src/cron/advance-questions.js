require('dotenv').config();
const db = require('../config/database');
const { pushDisplayName, sendPush } = require('../utils/push');

async function advanceStaleQuestions() {
  const conn = await db.getConnection();
  try {
    // Find all games where the latest question's asked_at is more than 24 hours ago
    const [staleGames] = await conn.execute(
      `SELECT g.id AS game_id, gq.id AS game_question_id
       FROM games g
       JOIN game_questions gq ON gq.game_id = g.id
       WHERE gq.id = (
         SELECT id FROM game_questions WHERE game_id = g.id ORDER BY id DESC LIMIT 1
       )
       AND gq.asked_at IS NOT NULL
       AND gq.asked_at < NOW() - INTERVAL 24 HOUR`
    );

    console.log(`Found ${staleGames.length} stale game(s)`);

    for (const { game_id } of staleGames) {
      const [[nextQuestion]] = await conn.execute(
        `SELECT id FROM questions
         WHERE id NOT IN (SELECT question_id FROM game_questions WHERE game_id = ?)
         ORDER BY RAND() LIMIT 1`,
        [game_id]
      );
      if (nextQuestion) {
        await conn.execute(
          'INSERT INTO game_questions (game_id, question_id, asked_at) VALUES (?, ?, NOW())',
          [game_id, nextQuestion.id]
        );
        console.log(`Advanced game ${game_id} to question ${nextQuestion.id}`);

        if (process.env.VAPID_PUBLIC_KEY) {
          const [players] = await conn.execute(
            'SELECT u.id, u.display_name FROM game_users gu JOIN users u ON u.id = gu.user_id WHERE gu.game_id = ?',
            [game_id]
          );
          const othersCount = players.length - 2;
          for (const player of players) {
            const others = players.filter(p => p.id !== player.id);
            const randomFriend = others[Math.floor(Math.random() * others.length)];
            const friendName = pushDisplayName(randomFriend?.display_name || '');
            const withOthers = othersCount > 0 ? ` and ${othersCount} other friend${othersCount > 1 ? 's' : ''}` : '';
            const body = `Tap to answer the next question with your friend ${friendName}${withOthers}`;
            sendPush(player.id, { title: 'New Question', body, url: `/game?id=${game_id}` }, db).catch(() => {});
          }
        }
      } else {
        console.log(`Game ${game_id} has no remaining questions`);
      }
    }
  } finally {
    conn.release();
    await db.end();
  }
}

advanceStaleQuestions().catch(err => {
  console.error('advance-questions cron error:', err);
  process.exit(1);
});
