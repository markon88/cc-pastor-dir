import { VERSION as CURRENT_VERSION } from './version.js';

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

      <div class="support-section">
        <div class="support-section-title">eAdventist Sync Log</div>
        <p class="support-section-desc">Runs automatically Tuesday & Friday at 4 AM ET. Items marked <strong>insert</strong> or <strong>unmatched</strong> need review.</p>
        <div id="admin-sync-log"><p class="support-section-desc">Loading…</p></div>
      </div>

      <div class="support-section">
        <div class="support-section-title">Dark Counties</div>
        <p class="support-section-desc">NC/SC counties with no church on record, derived from geocoded church addresses. Churches missing a county (bad/incomplete address) are listed separately below.</p>
        <div id="admin-dark-counties"><p class="support-section-desc">Loading…</p></div>
      </div>
    </div>
  `;

  document.getElementById('admin-add-btn').addEventListener('click', () => addEmail());
  document.getElementById('admin-email-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addEmail();
  });

  loadActivity();
  loadAllowedEmails();
  loadSyncLog();
  loadDarkCounties();
}

async function loadSyncLog() {
  const el = document.getElementById('admin-sync-log');
  if (!el) return;

  const res = await fetch('/api/admin/sync-log');
  if (!res.ok) {
    el.innerHTML = '<p class="support-section-desc" style="color:var(--red)">Failed to load sync log.</p>';
    return;
  }

  const entries = await res.json();
  if (!entries.length) {
    el.innerHTML = '<p class="support-section-desc">No sync activity yet.</p>';
    return;
  }

  const actionClass = a => {
    if (a === 'insert' || a === 'unmatched') return 'admin-sync-badge-warn';
    if (a === 'error')                        return 'admin-sync-badge-error';
    return 'admin-sync-badge-ok';
  };

  el.innerHTML = entries.map(e => {
    let details = '';
    try {
      const d = JSON.parse(e.details ?? '{}');
      if (d.note)      details = d.note;
      else if (d.error) details = d.error;
      else if (e.action === 'sync_complete') {
        details = `${d.processed} processed · ${d.updated ?? d.inserted ?? 0} changed`;
        if (d.unmatched) details += ` · ${d.unmatched} unmatched`;
      }
    } catch {}
    return `
      <div class="admin-activity-row">
        <div class="admin-activity-info">
          <div class="item-name">${esc(e.entity_name ?? e.sync_type)}</div>
          ${details ? `<div class="item-sub">${esc(details)}</div>` : ''}
          <div class="item-sub">${esc(timeAgo(e.created_at))}</div>
        </div>
        <span class="admin-version-badge ${actionClass(e.action)}">${esc(e.action)}</span>
      </div>`;
  }).join('');
}

async function loadDarkCounties() {
  const el = document.getElementById('admin-dark-counties');
  if (!el) return;

  const res = await fetch('/api/admin/dark-counties');
  if (!res.ok) {
    el.innerHTML = '<p class="support-section-desc" style="color:var(--red)">Failed to load dark counties.</p>';
    return;
  }

  const { darkCounties, churchesMissingCounty } = await res.json();

  const countyLists = Object.entries(darkCounties).map(([state, counties]) => `
    <div class="item-sub" style="margin-bottom:8px;">
      <strong>${esc(state)}</strong> (${counties.length}): ${counties.length ? esc(counties.join(', ')) : 'none — every county has a church'}
    </div>
  `).join('');

  const missingHtml = churchesMissingCounty.length ? `
    <div class="item-sub" style="margin-top:12px;"><strong>Churches missing a county</strong> (bad/incomplete address — needs manual review):</div>
    ${churchesMissingCounty.map(c => `
      <div class="admin-activity-row">
        <div class="admin-activity-info">
          <div class="item-name">${esc(c.name)}</div>
          <div class="item-sub">${esc([c.street, c.city, c.state, c.zip].filter(Boolean).join(', ') || 'No address on file')}</div>
        </div>
      </div>
    `).join('')}
  ` : '';

  el.innerHTML = countyLists + missingHtml;
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
    <div class="admin-email-row" data-email="${esc(e.email)}">
      <div class="admin-email-info">
        <div class="item-name">${esc(e.email)}</div>
        <div class="item-sub">
          Added by ${esc(e.added_by)}
          ${e.directory_email
            ? ` · Maps to <strong>${esc(e.directory_email)}</strong>`
            : ' · <span class="admin-no-mapping">No directory mapping</span>'}
        </div>
      </div>
      <div class="admin-email-actions">
        <button class="admin-map-btn" data-email="${esc(e.email)}" data-current="${esc(e.directory_email ?? '')}">Map</button>
        <button class="admin-delete-btn" data-email="${esc(e.email)}">Remove</button>
      </div>
    </div>
    <div class="admin-map-form hidden" id="map-form-${esc(e.email)}">
      <input type="email" class="search-input admin-map-input" placeholder="pastor@carolinasda.org" value="${esc(e.directory_email ?? '')}">
      <div class="admin-map-row-btns">
        <button class="support-btn admin-map-save" data-email="${esc(e.email)}" style="flex:1">Save</button>
        <button class="admin-map-cancel support-btn" data-email="${esc(e.email)}" style="flex:1;background:var(--text-sub)">Cancel</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.admin-map-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const form = document.getElementById(`map-form-${btn.dataset.email}`);
      form.classList.toggle('hidden');
    });
  });

  list.querySelectorAll('.admin-map-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(`map-form-${btn.dataset.email}`).classList.add('hidden');
    });
  });

  list.querySelectorAll('.admin-map-save').forEach(btn => {
    btn.addEventListener('click', async () => {
      const form = document.getElementById(`map-form-${btn.dataset.email}`);
      const directoryEmail = form.querySelector('.admin-map-input').value.trim();
      btn.disabled = true;
      const res = await fetch('/api/admin/allowed-emails', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: btn.dataset.email, directoryEmail: directoryEmail || null }),
      });
      if (res.ok) {
        loadAllowedEmails();
      } else {
        btn.disabled = false;
        alert('Failed to save mapping — please try again.');
      }
    });
  });

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
