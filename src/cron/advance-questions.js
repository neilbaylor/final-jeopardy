require('dotenv').config();
const db = require('../config/database');
const { pushDisplayName, sendPush } = require('../utils/push');

async function advanceStaleQuestions() {
  const conn = await db.getConnection();
  try {
    // Find all games where the latest question is more than 24 hours old
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

    // Find all expired 90-minute reminders
    const [reminders] = await conn.execute(
      `SELECT qr.user_id, qr.game_id, qr.game_question_id,
              ga.id AS answered
       FROM question_reminders qr
       LEFT JOIN game_answers ga ON ga.user_id = qr.user_id AND ga.game_question_id = qr.game_question_id
       WHERE qr.created_at < NOW() - INTERVAL 90 MINUTE`
    );
    console.log(`Found ${reminders.length} expired reminder(s)`);

    // Per-user notification queue: Map<userId, [{type:'stale'|'reminder', title, body, icon, url}]>
    const userNotifs = new Map();
    function queueNotif(userId, type, payload) {
      if (!userNotifs.has(userId)) userNotifs.set(userId, []);
      userNotifs.get(userId).push({ type, ...payload });
    }

    // Collect reminder notifications (don't send yet)
    await Promise.all(
      reminders.filter(r => !r.answered).map(async r => {
        const [players] = await conn.execute(
          'SELECT u.id, u.display_name, u.avatar_url FROM game_users gu JOIN users u ON u.id = gu.user_id WHERE gu.game_id = ?',
          [r.game_id]
        );
        const others = players.filter(p => p.id !== r.user_id);
        const othersCount = players.length - 2;
        const withOthers = othersCount > 0 ? ` with ${othersCount} other friend${othersCount > 1 ? 's' : ''}` : '';
        const andOthers  = othersCount > 0 ? ` and ${othersCount} other friend${othersCount > 1 ? 's' : ''}` : '';

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
          body = `${friendName} answered ${result}. Tap to answer your new question${withOthers}`;
          icon = answeredFriend?.avatar_url || undefined;
        } else {
          const randomFriend = others[Math.floor(Math.random() * others.length)];
          const friendName = pushDisplayName(randomFriend?.display_name || '');
          body = `Don't forget about the new question you unlocked, tap to answer with ${friendName}${andOthers}`;
          icon = randomFriend?.avatar_url || undefined;
        }
        queueNotif(r.user_id, 'reminder', { title: 'New Question', body, icon, url: `/game?id=${r.game_id}` });
      })
    );

    // Advance stale games and collect notifications
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
          for (const player of players) {
            const others = players.filter(p => p.id !== player.id);
            const randomFriend = others[Math.floor(Math.random() * others.length)];
            const friendName = pushDisplayName(randomFriend?.display_name || '');
            const withOthers = othersCount > 0 ? ` and ${othersCount} other friend${othersCount > 1 ? 's' : ''}` : '';
            const body = `A new question has been unlocked. Tap to answer with ${friendName}${withOthers}`;
            queueNotif(player.id, 'stale', { title: 'New Question', body, icon: randomFriend?.avatar_url || undefined, url: `/game?id=${game_id}` });
          }
        }
      } else {
        console.log(`Game ${game_id} has no remaining questions`);
      }
    }

    // Delete expired reminders
    await conn.execute('DELETE FROM question_reminders WHERE created_at < NOW() - INTERVAL 90 MINUTE');

    // Send one notification per user, preferring stale over reminder
    const sends = [];
    for (const [userId, notifs] of userNotifs) {
      const staleNotifs = notifs.filter(n => n.type === 'stale');
      const preferred = staleNotifs.length > 0 ? staleNotifs[0] : notifs[0];
      const total = notifs.length;
      let { title, body, icon, url } = preferred;
      if (total > 1) {
        const others = total - 1;
        title = `${total} New Questions`;
        body = `${body}. Plus ${others} other new question${others !== 1 ? 's' : ''}`;
      }
      sends.push(sendPush(userId, { title, body, icon, url }, db).catch(() => {}));
    }
    await Promise.all(sends);

  } finally {
    conn.release();
    await db.end();
  }
}

advanceStaleQuestions().catch(err => {
  console.error('advance-questions cron error:', err);
  process.exit(1);
});
