// Shared player card HTML builder used by dashboard and game pages.
function buildGamePlayersHtml(players, summaryText) {
  const visible = players.slice(0, 3);
  const overflow = players.length - 3;
  const overflowHtml = overflow > 0
    ? `<div class="game-player-overflow">+${overflow}</div>`
    : '';
  const summary = summaryText
    ? `<div class="game-row-summary">${summaryText}</div>`
    : '';
  return `<div class="players-row">${visible.map(buildPlayerCardHtml).join('') + overflowHtml}</div>${summary}`;
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
  const badge = `<div class="player-answered-badge"><svg width="7.5" height="7.5" viewBox="0 0 6 6" fill="none"><polyline points="1,3 2.5,4.5 5,1.5" stroke="#fff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
  const avatarHtml = `<div class="player-avatar-wrap">${avatarInner}${badge}</div>`;
  const statusClass = p._answered ? 'answered' : 'waiting';
  const statusText = p._answered ? 'Answered' : 'Waiting';
  return `<div class="game-player">
    ${avatarHtml}
    <div class="game-player-info">
      <span class="player-name">${displayName}</span>
      <span class="player-status ${statusClass}">${statusText}</span>
    </div>
  </div>`;
}
