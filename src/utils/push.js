const webpush = require('web-push');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_MAILTO || 'mailto:admin@fjwf.today',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

function pushDisplayName(displayName) {
  const parts = (displayName || '').trim().split(' ');
  const first = parts[0] || '';
  if (first.length <= 6) return first;
  const last = parts[parts.length - 1] || '';
  return (first[0] + (last[0] || '')).toUpperCase();
}

async function sendPush(userId, payload, db) {
  try {
    const [[row]] = await db.query('SELECT subscription FROM push_subscriptions WHERE user_id = ?', [userId]);
    if (!row) { console.log(`[push] no subscription for user ${userId}`); return; }
    const sub = typeof row.subscription === 'string' ? JSON.parse(row.subscription) : row.subscription;
    await webpush.sendNotification(sub, JSON.stringify(payload));
  } catch (err) {
    console.error(`[push] failed for user ${userId}:`, err.statusCode, err.message);
    if (err.statusCode === 410 || err.statusCode === 404) {
      await db.query('DELETE FROM push_subscriptions WHERE user_id = ?', [userId]).catch(() => {});
    }
  }
}

module.exports = { pushDisplayName, sendPush };
