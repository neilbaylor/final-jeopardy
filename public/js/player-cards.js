// Shared player card HTML builder used by dashboard and game pages.

// MySQL dateStrings:true returns "YYYY-MM-DD HH:MM:SS" with no timezone — treat as UTC.
function parseDbDate(str) {
  if (!str) return new Date(0);
  if (typeof str !== 'string') return new Date(str);
  return new Date(str.includes('Z') || str.includes('+') ? str : str.replace(' ', 'T') + 'Z');
}

function relativeAnswerTime(ts) {
  if (!ts) return 'Waiting';
  const diffMs = Date.now() - parseDbDate(ts).getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);
  if (diffHrs < 1) return 'Recently';
  if (diffHrs >= 24) return '1+ day ago';
  const hrs = Math.floor(diffHrs);
  return hrs + ' hr ago';
}

function nextQuestionIn(createdAt) {
  const msRemaining = 24 * 60 * 60 * 1000 - (Date.now() - parseDbDate(createdAt).getTime());
  if (msRemaining <= 0) return null;
  const hrs = Math.round(msRemaining / (1000 * 60 * 60));
  if (hrs >= 24) return '1 day+';
  return hrs === 1 ? '1 hour' : `${hrs} hours`;
}

function nextQuestionSummary(createdAt, players) {
  const t = nextQuestionIn(createdAt);
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
  const gapPx = players.length === 2 ? 17 : players.length === 3 ? 12 : 7;
  const rowStyle = gapPx !== 7 ? ` style="gap: ${gapPx}px"` : '';
  return `<div class="players-row"${rowStyle}>${visible.map(buildPlayerCardHtml).join('') + overflowHtml}</div>${summary}`;
}

function buildPlayerCardHtml(p) {
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
  let badge = '';
  if (hasAnswer && isCorrect) {
    badge = `<div class="player-answered-badge"><svg width="7.5" height="7.5" viewBox="0 0 6 6" fill="none"><polyline points="1,3 2.5,4.5 5,1.5" stroke="#fff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
  } else if (hasAnswer && isCorrect === false) {
    badge = `<div class="player-answered-badge incorrect"><svg width="7.5" height="7.5" viewBox="0 0 6 6" fill="none"><line x1="1.5" y1="1.5" x2="4.5" y2="4.5" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/><line x1="4.5" y1="1.5" x2="1.5" y2="4.5" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/></svg></div>`;
  }
  const avatarHtml = `<div class="player-avatar-wrap">${avatarInner}${badge}</div>`;
  const statusClass = hasAnswer ? 'answered' : 'waiting';
  const statusText = relativeAnswerTime(p._answeredAt);
  return `<div class="game-player">
    ${avatarHtml}
    <div class="game-player-info">
      <span class="player-name">${displayName}</span>
      <span class="player-status ${statusClass}">${statusText}</span>
    </div>
  </div>`;
}
