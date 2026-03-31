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

    // Check 90-minute reminders
    const [reminders] = await conn.execute(
      `SELECT qr.user_id, qr.game_id, qr.game_question_id,
              ga.id AS answered
       FROM question_reminders qr
       LEFT JOIN game_answers ga ON ga.user_id = qr.user_id AND ga.game_question_id = qr.game_question_id
       WHERE qr.created_at < NOW() - INTERVAL 90 MINUTE`
    );
    console.log(`Found ${reminders.length} expired reminder(s)`);
    if (reminders.length > 0) {
      const sends = reminders
        .filter(r => !r.answered)
        .map(async r => {
          const [players] = await conn.execute(
            'SELECT u.id, u.display_name, u.avatar_url FROM game_users gu JOIN users u ON u.id = gu.user_id WHERE gu.game_id = ?',
            [r.game_id]
          );
          const others = players.filter(p => p.id !== r.user_id);
          const othersCount = players.length - 2;
          const withOthers = othersCount > 0 ? ` and ${othersCount} other friend${othersCount > 1 ? 's' : ''}` : '';

          // Check if any friend has already answered this question
          const [friendAnswers] = await conn.execute(
            `SELECT ga.user_id, ga.is_correct FROM game_answers ga
             WHERE ga.game_question_id = ? AND ga.user_id != ?`,
            [r.game_question_id, r.user_id]
          );
          let body, icon;
          if (friendAnswers.length > 0) {
            const fa = friendAnswers[Math.floor(Math.random() * friendAnswers.length)];
            const answeredFriend = others.find(p => p.id === fa.user_id) || others[0];
            const friendName = pushDisplayName(answeredFriend?.display_name || '');
            const result = fa.is_correct ? 'Correctly' : 'Incorrectly';
            body = `${friendName} already answered ${result}. Tap to answer your new question${withOthers}`;
            icon = answeredFriend?.avatar_url || undefined;
          } else {
            const randomFriend = others[Math.floor(Math.random() * others.length)];
            const friendName = pushDisplayName(randomFriend?.display_name || '');
            body = `Tap to answer your new question with your friend ${friendName}${withOthers}`;
            icon = randomFriend?.avatar_url || undefined;
          }
          return sendPush(r.user_id, { title: 'New Question', body, url: `/game?id=${r.game_id}`, icon }, db).catch(() => {});
        });
      await Promise.all(sends);
      await conn.execute('DELETE FROM question_reminders WHERE created_at < NOW() - INTERVAL 90 MINUTE');
    }

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
            'SELECT u.id, u.display_name, u.avatar_url FROM game_users gu JOIN users u ON u.id = gu.user_id WHERE gu.game_id = ?',
            [game_id]
          );
          const othersCount = players.length - 2;
          const sends = [];
          for (const player of players) {
            const others = players.filter(p => p.id !== player.id);
            const randomFriend = others[Math.floor(Math.random() * others.length)];
            const friendName = pushDisplayName(randomFriend?.display_name || '');
            const withOthers = othersCount > 0 ? ` and ${othersCount} other friend${othersCount > 1 ? 's' : ''}` : '';
            const body = `Tap to answer your new question with your friend ${friendName}${withOthers}`;
            sends.push(sendPush(player.id, { title: 'New Question', body, url: `/game?id=${game_id}`, icon: randomFriend?.avatar_url || undefined }, db).catch(() => {}));
          }
          await Promise.all(sends);
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
