// Keep in sync with CACHE_NAME in sw.js
const CURRENT_VERSION = 'v10.0.2';

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function timeAgo(isoStr) {
  if (!isoStr) return 'never';
  const diff = Math.floor((Date.now() - new Date(isoStr + 'Z')) / 1000);
  if (diff < 60)          return 'just now';
  if (diff < 3600)        return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)       return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7)   return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 86400 * 30)  return `${Math.floor(diff / 86400 / 7)}w ago`;
  return new Date(isoStr + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function renderAdminView(container) {
  container.innerHTML = `
    <div class="list-header">
      <div class="view-title">Manage Access</div>
    </div>
    <div class="support-body">
      <div class="support-section">
        <div class="support-section-title">User Activity</div>
        <p class="support-section-desc">Who has opened the app, what version they're running, and what platform they're on.</p>
        <div id="admin-activity"><p class="support-section-desc">Loading…</p></div>
      </div>

      <div class="support-section">
        <div class="support-section-title">@carolinasda.org accounts</div>
        <p class="support-section-desc">All verified @carolinasda.org Google accounts are always allowed — no action needed.</p>
      </div>

      <div class="support-section">
        <div class="support-section-title">Add an email address</div>
        <p class="support-section-desc">Grant access to any individual email (any domain).</p>
        <div class="admin-add-row">
          <input type="email" id="admin-email-input" class="search-input" placeholder="name@example.com" autocomplete="off">
          <button id="admin-add-btn" class="support-btn">Add</button>
        </div>
      </div>

      <div class="support-section">
        <div class="support-section-title">Explicitly allowed emails</div>
        <div id="admin-list"><p class="support-section-desc">Loading…</p></div>
      </div>
    </div>
  `;

  document.getElementById('admin-add-btn').addEventListener('click', () => addEmail());
  document.getElementById('admin-email-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addEmail();
  });

  loadActivity();
  loadAllowedEmails();
}

async function loadActivity() {
  const el = document.getElementById('admin-activity');
  if (!el) return;

  const res = await fetch('/api/admin/activity');
  if (!res.ok) {
    el.innerHTML = '<p class="support-section-desc" style="color:var(--red)">Failed to load activity.</p>';
    return;
  }

  const users = await res.json();
  if (!users.length) {
    el.innerHTML = '<p class="support-section-desc">No activity recorded yet.</p>';
    return;
  }

  el.innerHTML = users.map(u => {
    const versionClass = !u.app_version ? 'unknown'
      : u.app_version === CURRENT_VERSION ? 'current' : 'outdated';
    const versionLabel = u.app_version ?? '—';
    const avatarHtml = u.picture
      ? `<img class="admin-activity-avatar" src="${esc(u.picture)}" alt="" referrerpolicy="no-referrer">`
      : `<div class="admin-activity-avatar admin-activity-avatar-placeholder"></div>`;
    const meta = [
      `Last seen ${timeAgo(u.last_seen)}`,
      u.open_count ? `${u.open_count} opens` : null,
      u.login_count ? `${u.login_count} login${u.login_count !== 1 ? 's' : ''}` : null,
      u.platform ?? null,
    ].filter(Boolean).join(' · ');
    return `
      <div class="admin-activity-row">
        ${avatarHtml}
        <div class="admin-activity-info">
          <div class="item-name">${esc(u.name ?? u.email)}</div>
          <div class="item-sub">${esc(u.email)}</div>
          <div class="item-sub">${esc(meta)}</div>
        </div>
        <span class="admin-version-badge ${versionClass}">${esc(versionLabel)}</span>
      </div>`;
  }).join('');
}

async function addEmail() {
  const input = document.getElementById('admin-email-input');
  const email = input.value.trim();
  if (!email || !email.includes('@')) return;

  const btn = document.getElementById('admin-add-btn');
  btn.disabled = true;
  btn.textContent = 'Adding…';

  const res = await fetch('/api/admin/allowed-emails', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email }),
  });

  btn.disabled = false;
  btn.textContent = 'Add';

  if (res.ok) {
    input.value = '';
    loadAllowedEmails();
  } else {
    alert('Failed to add email — please try again.');
  }
}

async function loadAllowedEmails() {
  const list = document.getElementById('admin-list');
  if (!list) return;

  const res = await fetch('/api/admin/allowed-emails');
  if (!res.ok) {
    list.innerHTML = '<p class="support-section-desc" style="color:var(--red)">Failed to load list.</p>';
    return;
  }

  const emails = await res.json();
  if (!emails.length) {
    list.innerHTML = '<p class="support-section-desc">None yet.</p>';
    return;
  }

  list.innerHTML = emails.map(e => `
    <div class="admin-email-row">
      <div class="admin-email-info">
        <div class="item-name">${esc(e.email)}</div>
        <div class="item-sub">Added by ${esc(e.added_by)}</div>
      </div>
      <button class="admin-delete-btn" data-email="${esc(e.email)}">Remove</button>
    </div>
  `).join('');

  list.querySelectorAll('.admin-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { email } = btn.dataset;
      if (!confirm(`Remove access for ${email}?`)) return;
      btn.disabled = true;
      const res = await fetch(`/api/admin/allowed-emails?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
      if (res.ok) {
        loadAllowedEmails();
      } else {
        btn.disabled = false;
        alert('Failed to remove — please try again.');
      }
    });
  });
}
