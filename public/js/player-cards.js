// Shared player card HTML builder used by dashboard and game pages.

// MySQL dateStrings:true returns "YYYY-MM-DD HH:MM:SS" with no timezone — treat as UTC.
function parseDbDate(str) {
  if (!str) return new Date(0);
  if (typeof str !== 'string') return new Date(str);
  return new Date(str.includes('Z') || str.includes('+') ? str : str.replace(' ', 'T') + 'Z');
}

function relativeAnswerTime(ts, short, relativeTo) {
  if (!ts) return 'Waiting';
  const now = relativeTo ? parseDbDate(relativeTo).getTime() : Date.now();
  const diffMs = now - parseDbDate(ts).getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);
  const noAgo = !!relativeTo;
  if (diffHrs < 1) return noAgo ? 'Quickly' : 'Recent';
  if (diffHrs >= 24) return (short || noAgo) ? '1 day' : '1 day ago';
  const hrs = Math.floor(diffHrs);
  if (short || noAgo) return hrs === 1 ? '1 hr' : hrs + ' hrs';
  return hrs === 1 ? '1hr ago' : hrs + 'hrs ago';
}

function nextQuestionIn(askedAt) {
  const msRemaining = 24 * 60 * 60 * 1000 - (Date.now() - parseDbDate(askedAt).getTime());
  if (msRemaining <= 0) return null;
  const hrs = Math.round(msRemaining / (1000 * 60 * 60));
  if (msRemaining >= 24.5 * 60 * 60 * 1000) return '1 day+';
  if (hrs >= 24) return '1 day';
  if (hrs === 0) return null;
  return hrs === 1 ? '1 hour' : `${hrs} hours`;
}

function formatQuestionDate(askedAt) {
  const d = parseDbDate(askedAt);
  const hours = d.getHours();
  const mins = d.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  const h = hours % 12 || 12;
  const m = String(mins).padStart(2, '0');
  const time = `${h}:${m}${ampm}`;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  let label;
  if (dDay.getTime() === today.getTime()) {
    label = `Today at ${time}`;
  } else if (dDay.getTime() === yesterday.getTime()) {
    label = `Yesterday at ${time}`;
  } else {
    const month = d.toLocaleDateString(undefined, { month: 'long' });
    const day = d.getDate();
    label = `${month} ${day} at ${time}`;
  }
  return `Question asked <strong>${label}</strong>`;
}

function nextQuestionSummary(askedAt, players) {
  const t = nextQuestionIn(askedAt);
  const unanswered = (players || []).filter(p => !p._answered);
  let suffix;
  if (unanswered.length === 1) {
    const p = unanswered[0];
    suffix = p._isMe ? 'or after you answer' : `or after ${(p.display_name || '').trim().split(' ')[0]} answers`;
  } else {
    suffix = 'or after everyone answers';
  }
  return t ? `<strong>New question in ${t}</strong> ${suffix}` : `<strong>New question coming soon</strong> ${suffix}`;
}

function buildGamePlayersHtml(players, summaryText) {
  const visible = players.slice(0, 3);
  const overflow = players.length - 3;
  const overflowHtml = overflow > 0
    ? `<div class="game-player-overflow">+${overflow}</div>`
    : '';
  const summary = summaryText
    ? `<div class="game-row-summary">${summaryText}</div>`
    : '';
  const gapPx = players.length === 2 ? 16 : players.length === 3 ? 7 : 7;
  const rowStyle = gapPx !== 7 ? ` style="gap: ${gapPx}px"` : '';
  return `<div class="players-row"${rowStyle}>${visible.map(p => buildPlayerCardHtml(p, { simpleCoin: true })).join('') + overflowHtml}</div>${summary}`;
}

function buildPlayerCardHtml(p, opts) {
  const rawName = (p.display_name || '').trim();
  const parts = rawName.split(' ');
  const fn = parts[0] || '';
  const initials = parts.length >= 2
    ? parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase()
    : (parts[0] ? parts[0][0].toUpperCase() : '');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const displayName = p._isMe ? 'You' : esc(fn.length <= 5 ? fn : initials);
  const avatarInner = p.avatar_url
    ? `<img class="player-avatar" src="${esc(p.avatar_url)}" alt="${displayName}" />`
    : `<div class="player-avatar-placeholder">👤</div>`;
  const hasAnswer = p._answered;
  const isCorrect = p._isCorrect;
  const incorrectBadge = `<div class="player-answered-badge incorrect"><svg width="8" height="8" viewBox="0 0 8 8" fill="none" overflow="visible"><line x1="2" y1="2" x2="6" y2="6" stroke="#e53935" stroke-width="1.4" stroke-linecap="round"/><line x1="6" y1="2" x2="2" y2="6" stroke="#e53935" stroke-width="1.4" stroke-linecap="round"/></svg></div>`;
  let badge = '';
  if (hasAnswer && isCorrect) {
    badge = `<div class="player-answered-badge"><svg width="7.5" height="7.5" viewBox="0 0 6 6" fill="none"><polyline points="1,3 2.5,4.5 5,1.5" stroke="#43a047" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
  } else if (hasAnswer && isCorrect === false) {
    badge = incorrectBadge;
  } else if (!hasAnswer && opts && opts.unansweredIncorrect) {
    badge = incorrectBadge;
  }
  const score = p.score || 0;
  const coinShimmer = (hasAnswer && isCorrect) ? ' coin-shimmer' : '';
  const shimmerStyle = (hasAnswer && isCorrect) ? ` style="--shimmer-delay:${(Math.random() * 2.5).toFixed(2)}s"` : '';
  const coinBadge = score > 0
    ? `<div class="coin player-score-coin${coinShimmer}"${shimmerStyle}>${Math.min(score, 99)}</div>`
    : '';
  const avatarHtml = `<div class="player-avatar-wrap">${avatarInner}${badge}${coinBadge}</div>`;
  const unansweredAsWrong = !hasAnswer && opts && opts.unansweredIncorrect;
  const statusClass = unansweredAsWrong ? 'answered-wrong' : (!hasAnswer ? 'waiting' : isCorrect ? 'answered' : 'answered-wrong');
  const statusText = (opts && opts.askedAt && p._answeredAt)
    ? relativeAnswerTime(opts.askedAt, opts && opts.short, p._answeredAt)
    : relativeAnswerTime(unansweredAsWrong ? (opts && opts.askedAt || p._answeredAt) : p._answeredAt, unansweredAsWrong || (opts && opts.short), unansweredAsWrong ? null : (opts && opts.relativeTo));
  return `<div class="game-player">
    ${avatarHtml}
    <div class="game-player-info">
      <span class="player-name">${displayName}</span>
      <span class="player-status ${statusClass}">${statusText}</span>
    </div>
  </div>`;
}
