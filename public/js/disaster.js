// Disaster response mode: incident-scoped status check-ins for pastors and
// churches, plus a standing (non-incident) county-readiness editor. Kept
// entirely separate from the /api/data + IndexedDB pipeline (see db.js) —
// everything here is fetched live with cache: 'no-store', since stale
// disaster status is worse than no status.

const POD_SUPPLIES = [
  ['water', 'Water'],
  ['toiletPaper', 'Toilet Paper'],
  ['paperTowels', 'Paper Towels'],
  ['food', 'Food'],
  ['cleaningSupplies', 'Cleaning Supplies'],
  ['floodBuckets', 'Flood Buckets'],
];
const RESPONSE_HOUR_SUGGESTIONS = [2, 4, 8, 24];

let allPastors = [];
let currentUser = null;
let lastActive = { active: false };

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function initDisaster(pastors, user) {
  allPastors = pastors;
  currentUser = user;
}

function myPastor() {
  const identity = (currentUser?.directoryEmail || currentUser?.email || '').toLowerCase();
  return allPastors.find(p => (p.email || '').toLowerCase() === identity) || null;
}

// Polled from app.js on load and periodically — toggles the tab and caches
// whether the signed-in user can manage the active incident.
export async function checkDisasterActive() {
  try {
    const res = await fetch('/api/disaster/active', { cache: 'no-store' });
    lastActive = res.ok ? await res.json() : { active: false };
  } catch {
    lastActive = { active: false };
  }
  return lastActive;
}

export function getLastActive() {
  return lastActive;
}

// ── Main tab ─────────────────────────────────────────────────────────────────
export async function renderDisasterView(container) {
  if (!lastActive.active) {
    if (currentUser?.isAdmin) {
      container.innerHTML = `
        <div class="list-header"><div class="view-title">Disaster Response</div></div>
        <div class="support-body">
          <div class="support-section">
            <div class="support-section-title">Start an incident</div>
            <p class="support-section-desc">Once started, the Disaster tab appears for everyone and pastors/churches can check in.</p>
            <div class="admin-add-row">
              <input type="text" id="dis-new-name" class="search-input" placeholder="Incident name (e.g. Hurricane Helene)" autocomplete="off">
            </div>
            <div class="admin-add-row">
              <input type="text" id="dis-new-emails" class="search-input" placeholder="Coordination team emails (comma-separated)" autocomplete="off">
            </div>
            <div class="admin-add-row">
              <label><input type="checkbox" id="dis-new-sim"> This is a simulation / drill (not an actual incident)</label>
            </div>
            <div class="admin-add-row">
              <button id="dis-new-start" class="support-btn">Start</button>
            </div>
          </div>
        </div>`;
      container.querySelector('#dis-new-start').addEventListener('click', startIncident);
    } else {
      container.innerHTML = `<div class="empty-state">No active disaster incident.</div>`;
    }
    return;
  }

  const simBanner = lastActive.isSimulation ? `
    <div class="banner" style="background:var(--amber-bg, #fef9e7);color:#7d4e00;border:1px solid var(--amber, #f39c12);font-weight:600;text-align:center;padding:10px;">
      ⚠️ SIMULATION MODE — This is a drill, not an actual incident. Do not treat any status or notification below as real.
    </div>` : '';

  container.innerHTML = `
    <div class="list-header"><div class="view-title">${esc(lastActive.name)}</div></div>
    ${simBanner}
    <div class="support-body" id="dis-body"><p class="support-section-desc">Loading…</p></div>
  `;

  const body = container.querySelector('#dis-body');
  const [statusRes, churchRes] = await Promise.all([
    fetch('/api/disaster/status', { cache: 'no-store' }),
    fetch('/api/disaster/church-status', { cache: 'no-store' }),
  ]);
  const statusData = statusRes.ok ? await statusRes.json() : { pastorStatuses: [] };
  const churchData = churchRes.ok ? await churchRes.json() : { churchStatuses: [] };

  const me = myPastor();
  const myStatus = me ? statusData.pastorStatuses.find(s => s.pastorId === me.id) : null;
  const myChurches = me?.churches ?? [];

  body.innerHTML = [
    me ? checkInSectionHtml(myStatus) : '',
    myChurches.map(name => churchStatusSectionHtml(name, churchData.churchStatuses.find(s => s.churchName === name))).join(''),
    lastActive.canManage ? adminDashboardHtml(statusData.pastorStatuses, churchData.churchStatuses) : '',
    currentUser?.isAdmin ? disasterAdminSectionHtml() : '',
  ].join('');

  if (me) wireCheckIn(body, me);
  myChurches.forEach(name => wireChurchStatus(body, name));
  if (lastActive.canManage) wireContactListGenerator(body, statusData.pastorStatuses, churchData.churchStatuses);
  if (currentUser?.isAdmin) {
    wireDisasterAdminSection(body);
    wireIncidentClose(body);
  }
}

async function startIncident() {
  const name = document.getElementById('dis-new-name').value.trim();
  const coordinationEmails = document.getElementById('dis-new-emails').value.trim();
  const isSimulation = document.getElementById('dis-new-sim').checked;
  if (!name) return;
  const res = await fetch('/api/admin/disaster/incidents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, coordinationEmails: coordinationEmails || null, isSimulation }),
  });
  if (res.ok) {
    await checkDisasterActive();
    location.reload();
  } else {
    alert('Failed to start incident.');
  }
}

// ── Pastor check-in ──────────────────────────────────────────────────────────
function checkInSectionHtml(status) {
  const s = status || {};
  return `
    <div class="support-section" id="dis-checkin">
      <div class="support-section-title">My Status</div>
      <p class="support-section-desc">${s.updatedAt ? `Last updated ${esc(s.updatedAt)} by ${esc(s.confirmedBy || '')}` : 'Not yet reported.'}</p>
      <div class="admin-add-row">
        <label><input type="radio" name="dis-status" value="ok" ${s.status === 'ok' ? 'checked' : ''}> I'm OK</label>
        <label><input type="radio" name="dis-status" value="unknown" ${s.status !== 'ok' ? 'checked' : ''}> Unknown / Not yet checked in</label>
      </div>
      <div class="admin-add-row">
        <label><input type="checkbox" id="dis-dmg-residence" ${s.propertyDamageResidence ? 'checked' : ''}> Property damage at residence</label>
      </div>
      <div class="admin-add-row">
        <label><input type="checkbox" id="dis-dmg-church" ${s.propertyDamageChurch ? 'checked' : ''}> Property damage at church</label>
      </div>
      <div class="admin-add-row">
        <textarea id="dis-note" class="search-input" placeholder="Note (optional)" rows="2">${esc(s.note || '')}</textarea>
      </div>
      <div class="admin-add-row">
        <label><input type="checkbox" id="dis-notify"> Notify coordination team</label>
      </div>
      <div class="admin-add-row">
        <input type="file" id="dis-photo-residence" accept="image/*" capture="environment">
        <button id="dis-save-checkin" class="support-btn">Save</button>
      </div>
      <div id="dis-checkin-photos"></div>
    </div>
  `;
}

function wireCheckIn(container, pastor) {
  container.querySelector('#dis-save-checkin').addEventListener('click', async () => {
    const btn = container.querySelector('#dis-save-checkin');
    btn.disabled = true;
    const status = container.querySelector('input[name="dis-status"]:checked')?.value || 'unknown';
    const res = await fetch('/api/disaster/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pastorId: pastor.id,
        status,
        note: container.querySelector('#dis-note').value.trim() || null,
        propertyDamageResidence: container.querySelector('#dis-dmg-residence').checked,
        propertyDamageChurch: container.querySelector('#dis-dmg-church').checked,
        notifyCoordination: container.querySelector('#dis-notify').checked,
      }),
    });
    const file = container.querySelector('#dis-photo-residence').files[0];
    if (res.ok && file) await uploadPhoto('pastor', pastor.id, file);
    btn.disabled = false;
    if (res.ok) { btn.textContent = 'Saved'; setTimeout(() => btn.textContent = 'Save', 1500); }
    else alert('Failed to save status.');
  });
  loadPhotos(container.querySelector('#dis-checkin-photos'), 'pastor', pastor.id);
}

// ── Church POD / donation / transport ───────────────────────────────────────
function churchStatusSectionHtml(name, status) {
  const s = status || {};
  const supplies = new Set(s.podSupplies || []);
  return `
    <div class="support-section" data-church="${esc(name)}">
      <div class="support-section-title">${esc(name)}</div>
      <div class="admin-add-row">
        <select class="search-input dis-church-status">
          <option value="unknown" ${s.status === 'unknown' || !s.status ? 'selected' : ''}>Unknown</option>
          <option value="ok" ${s.status === 'ok' ? 'selected' : ''}>OK / Unaffected</option>
          <option value="affected" ${s.status === 'affected' ? 'selected' : ''}>Affected</option>
        </select>
      </div>
      <div class="admin-add-row"><label><input type="checkbox" class="dis-is-pod" ${s.isPod ? 'checked' : ''}> Point of Distribution (POD)</label></div>
      <div class="admin-add-row" style="flex-wrap:wrap;gap:8px;">
        ${POD_SUPPLIES.map(([key, label]) => `<label style="margin-right:12px;"><input type="checkbox" class="dis-supply" value="${key}" ${supplies.has(key) ? 'checked' : ''}> ${label}</label>`).join('')}
      </div>
      <div class="admin-add-row"><label><input type="checkbox" class="dis-is-donation" ${s.isDonationDropoff ? 'checked' : ''}> Donation drop-off location</label></div>
      <div class="admin-add-row"><label><input type="checkbox" class="dis-is-transport" ${s.isTransportation ? 'checked' : ''}> Willing to provide transportation</label></div>
      <div class="admin-add-row">
        <textarea class="search-input dis-church-notes" placeholder="Notes (optional)" rows="2">${esc(s.notes || '')}</textarea>
      </div>
      <div class="admin-add-row">
        <input type="file" class="dis-church-photo" accept="image/*" capture="environment">
        <button class="support-btn dis-save-church">Save</button>
      </div>
      <div class="dis-church-photos"></div>
    </div>
  `;
}

function wireChurchStatus(container, name) {
  const section = [...container.querySelectorAll('[data-church]')].find(el => el.dataset.church === name);
  if (!section) return;
  section.querySelector('.dis-save-church').addEventListener('click', async () => {
    const btn = section.querySelector('.dis-save-church');
    btn.disabled = true;
    const podSupplies = [...section.querySelectorAll('.dis-supply:checked')].map(el => el.value);
    const res = await fetch('/api/disaster/church-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        churchName: name,
        status: section.querySelector('.dis-church-status').value,
        isPod: section.querySelector('.dis-is-pod').checked,
        podSupplies,
        isDonationDropoff: section.querySelector('.dis-is-donation').checked,
        isTransportation: section.querySelector('.dis-is-transport').checked,
        notes: section.querySelector('.dis-church-notes').value.trim() || null,
      }),
    });
    const file = section.querySelector('.dis-church-photo').files[0];
    if (res.ok && file) await uploadPhoto('church', name, file);
    btn.disabled = false;
    if (res.ok) { btn.textContent = 'Saved'; setTimeout(() => btn.textContent = 'Save', 1500); }
    else alert('Failed to save church status.');
  });
  loadPhotos(section.querySelector('.dis-church-photos'), 'church', name);
}

// ── Photos ───────────────────────────────────────────────────────────────────
async function uploadPhoto(subjectType, subjectId, file) {
  const form = new FormData();
  form.append('subjectType', subjectType);
  form.append('subjectId', subjectId);
  form.append('file', file);
  await fetch('/api/disaster/photos', { method: 'POST', body: form }).catch(() => {});
}

async function loadPhotos(el, subjectType, subjectId) {
  if (!el) return;
  const res = await fetch(`/api/disaster/photos?subjectType=${subjectType}&subjectId=${encodeURIComponent(subjectId)}`, { cache: 'no-store' });
  if (!res.ok) return;
  const photos = await res.json();
  if (!photos.length) return;
  el.innerHTML = photos.map(p => `<img src="${esc(p.url)}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:6px;margin:4px 4px 0 0;">`).join('');
}

// ── Admin dashboard ──────────────────────────────────────────────────────────
function adminDashboardHtml(pastorStatuses, churchStatuses) {
  const damaged = pastorStatuses.filter(s => s.propertyDamageResidence || s.propertyDamageChurch);
  return `
    <div class="support-section">
      <div class="support-section-title">Dashboard</div>
      <p class="support-section-desc">${pastorStatuses.filter(s => s.status === 'ok').length} OK · ${pastorStatuses.length - pastorStatuses.filter(s => s.status === 'ok').length} unknown/not checked in · ${damaged.length} with property damage reported</p>
      ${damaged.length ? damaged.map(s => `
        <div class="admin-activity-row">
          <div class="admin-activity-info">
            <div class="item-name">${esc(s.displayName)}</div>
            <div class="item-sub">${[s.propertyDamageResidence ? 'Residence damage' : null, s.propertyDamageChurch ? 'Church damage' : null].filter(Boolean).join(' · ')}</div>
            ${s.note ? `<div class="item-sub">${esc(s.note)}</div>` : ''}
          </div>
        </div>`).join('') : ''}
    </div>
    <div class="support-section">
      <div class="support-section-title">Generate Contact List</div>
      <div class="admin-add-row">
        <select id="dis-contact-category" class="search-input">
          <option value="pod">POD churches</option>
          <option value="donation">Donation drop-off churches</option>
          <option value="transport">Transportation-capable churches</option>
        </select>
        <button id="dis-contact-generate" class="support-btn">Email List</button>
      </div>
    </div>
  `;
}

function wireContactListGenerator(container, pastorStatuses, churchStatuses) {
  container.querySelector('#dis-contact-generate').addEventListener('click', () => {
    const category = container.querySelector('#dis-contact-category').value;
    const key = category === 'pod' ? 'isPod' : category === 'donation' ? 'isDonationDropoff' : 'isTransportation';
    const churchNames = new Set(churchStatuses.filter(s => s[key]).map(s => s.churchName));
    const emails = allPastors.filter(p => p.email && p.churches?.some(c => churchNames.has(c))).map(p => p.email);
    if (!emails.length) { alert('No matching churches with an emailed pastor.'); return; }
    window.location.href = `mailto:${emails.join(',')}`;
  });
}

// ── Disaster-admin grant/revoke (permanent admins only) ─────────────────────
function disasterAdminSectionHtml() {
  return `
    <div class="support-section">
      <div class="support-section-title">Disaster Admins</div>
      <p class="support-section-desc">Deputize a pastor to help update statuses and contact people during this incident. Access ends when the incident closes.</p>
      <div class="admin-add-row">
        <input type="email" id="dis-admin-email" class="search-input" placeholder="pastor@example.com" autocomplete="off">
        <button id="dis-admin-add" class="support-btn">Grant</button>
      </div>
      <div id="dis-admin-list"><p class="support-section-desc">Loading…</p></div>
    </div>
    <div class="support-section">
      <button id="dis-close-incident" class="support-btn" style="background:var(--red)">Close Incident</button>
    </div>
  `;
}

async function loadDisasterAdmins(el) {
  const res = await fetch(`/api/admin/disaster/admins?incidentId=${encodeURIComponent(lastActive.incidentId)}`);
  if (!res.ok) return;
  const rows = await res.json();
  const active = rows.filter(r => !r.revoked_at);
  el.innerHTML = active.length ? active.map(r => `
    <div class="admin-email-row" data-email="${esc(r.email)}">
      <div class="admin-email-info">
        <div class="item-name">${esc(r.email)}</div>
        <div class="item-sub">Granted by ${esc(r.granted_by)}</div>
      </div>
      <div class="admin-email-actions">
        <button class="admin-delete-btn dis-admin-revoke" data-email="${esc(r.email)}">Revoke</button>
      </div>
    </div>
  `).join('') : '<p class="support-section-desc">None yet.</p>';

  el.querySelectorAll('.dis-admin-revoke').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await fetch(`/api/admin/disaster/admins?incidentId=${encodeURIComponent(lastActive.incidentId)}&email=${encodeURIComponent(btn.dataset.email)}`, { method: 'DELETE' });
      loadDisasterAdmins(el);
    });
  });
}

function wireDisasterAdminSection(container) {
  const listEl = container.querySelector('#dis-admin-list');
  if (listEl) loadDisasterAdmins(listEl);
  container.querySelector('#dis-admin-add')?.addEventListener('click', async () => {
    const input = container.querySelector('#dis-admin-email');
    const email = input.value.trim();
    if (!email.includes('@')) return;
    await fetch('/api/admin/disaster/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incidentId: lastActive.incidentId, email }),
    });
    input.value = '';
    loadDisasterAdmins(listEl);
  });
}

function wireIncidentClose(container) {
  container.querySelector('#dis-close-incident')?.addEventListener('click', async () => {
    if (!confirm(`Close "${lastActive.name}"? The Disaster tab will disappear once closed.`)) return;
    await fetch('/api/admin/disaster/incidents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lastActive.incidentId, active: false }),
    });
    await checkDisasterActive();
    location.reload();
  });
}

// ── Standing county-readiness editor (always visible, not incident-gated) ───
// Called from detail.js on the church detail page.
export async function renderCountyReadiness(container, churchName) {
  const section = document.createElement('div');
  section.className = 'detail-section';
  section.innerHTML = `
    <div class="detail-label">Disaster Readiness</div>
    <div id="dis-county-list"><p class="item-sub">Loading…</p></div>
    <div class="admin-add-row">
      <input type="text" id="dis-county-name" class="search-input" placeholder="County" autocomplete="off">
      <select id="dis-county-mode" class="search-input">
        <option value="local">People live there</option>
        <option value="can_travel">Willing to travel there</option>
      </select>
    </div>
    <div class="admin-add-row">
      <input type="text" id="dis-county-hours" class="search-input" placeholder="Response time (hrs) — e.g. ${RESPONSE_HOUR_SUGGESTIONS.join('/')}" autocomplete="off">
      <input type="number" id="dis-county-cert" class="search-input" placeholder="# CERT-trained" min="0" style="max-width:140px;">
      <button id="dis-county-add" class="support-btn">Add</button>
    </div>
  `;
  container.appendChild(section);

  const listEl = section.querySelector('#dis-county-list');
  const load = async () => {
    const res = await fetch(`/api/disaster/counties?church=${encodeURIComponent(churchName)}`, { cache: 'no-store' });
    const rows = res.ok ? await res.json() : [];
    listEl.innerHTML = rows.length ? rows.map(r => `
      <div class="admin-activity-row">
        <div class="admin-activity-info">
          <div class="item-name">${esc(r.county)} <span class="tag">${r.mode === 'local' ? 'lives there' : 'can travel'}</span></div>
          <div class="item-sub">${[r.responseHours ? `${esc(r.responseHours)} hr response` : null, r.certCount ? `${r.certCount} CERT-trained` : null].filter(Boolean).join(' · ') || 'No detail'}</div>
        </div>
        <button class="admin-delete-btn" data-county="${esc(r.county)}">Remove</button>
      </div>
    `).join('') : '<p class="item-sub">Not yet configured.</p>';

    listEl.querySelectorAll('.admin-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await fetch(`/api/disaster/counties?church=${encodeURIComponent(churchName)}&county=${encodeURIComponent(btn.dataset.county)}`, { method: 'DELETE' });
        load();
      });
    });
  };
  load();

  section.querySelector('#dis-county-add').addEventListener('click', async () => {
    const county = section.querySelector('#dis-county-name').value.trim();
    if (!county) return;
    const btn = section.querySelector('#dis-county-add');
    btn.disabled = true;
    const res = await fetch('/api/disaster/counties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        churchName,
        county,
        mode: section.querySelector('#dis-county-mode').value,
        responseHours: section.querySelector('#dis-county-hours').value.trim() || null,
        certCount: parseInt(section.querySelector('#dis-county-cert').value, 10) || 0,
      }),
    });
    btn.disabled = false;
    if (res.ok) {
      section.querySelector('#dis-county-name').value = '';
      section.querySelector('#dis-county-hours').value = '';
      section.querySelector('#dis-county-cert').value = '';
      load();
    } else {
      alert('Failed to save — you may not have permission to edit this church.');
    }
  });
}
