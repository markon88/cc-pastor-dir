// Disaster response mode: incident-scoped status check-ins for pastors and
// churches, plus a standing (non-incident) county-readiness editor. Kept
// entirely separate from the /api/data + IndexedDB pipeline (see db.js) —
// everything here is fetched live with cache: 'no-store', since stale
// disaster status is worse than no status.

import { searchPastors } from './search.js';

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

// Standing preparedness/county data is per-church and shouldn't be editable
// (or even visible — it can carry coordinator names/phone/email) by anyone
// who merely has app access; only that church's own pastor(s) or an
// admin/standing-disaster-admin should see it. The API already enforces
// this server-side — this just keeps the UI from showing an editable form
// to someone whose save will silently 403.
function canManageChurchPreparedness(churchName) {
  if (canManageDisasterModule()) return true;
  const me = myPastor();
  return !!(me && (me.churches || []).includes(churchName));
}

function canManageDisasterModule() {
  return !!(currentUser?.isAdmin || currentUser?.isDisasterAdmin);
}

// ── Main tab ─────────────────────────────────────────────────────────────────
export async function renderDisasterView(container) {
  if (!lastActive.active) {
    if (canManageDisasterModule()) {
      newIncidentCoordinators = [];
      container.innerHTML = `
        <div class="list-header"><div class="view-title">Disaster Response</div></div>
        <div class="support-body">
          <div id="dis-coordinator"></div>
          <div class="support-section">
            <div class="support-section-title">Start an incident</div>
            <p class="support-section-desc">Once started, the Disaster tab appears for everyone and pastors/churches can check in.</p>
            <div class="admin-add-row">
              <input type="text" id="dis-new-name" class="search-input" placeholder="Incident name (e.g. Hurricane Helene)" autocomplete="off">
            </div>
            <div class="support-section-title" style="margin-top:4px;">Coordination Team</div>
            <div id="dis-new-coord-list"></div>
            <div class="detail-cta-row">
              <button type="button" id="dis-new-coord-add" class="support-btn support-btn-alt">+ Add Coordinator</button>
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
      container.querySelector('#dis-new-coord-add').addEventListener('click', openCoordinatorPicker);
      renderSelectedCoordinators();
      renderCoordinatorSection(container.querySelector('#dis-coordinator'));
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
    <div class="support-body" id="dis-body">
      <div id="dis-coordinator"></div>
      <p class="support-section-desc">Loading…</p>
    </div>
  `;

  renderCoordinatorSection(container.querySelector('#dis-coordinator'));

  const body = container.querySelector('#dis-body');
  const [statusRes, churchRes, attemptsRes] = await Promise.all([
    fetch('/api/disaster/status', { cache: 'no-store' }),
    fetch('/api/disaster/church-status', { cache: 'no-store' }),
    lastActive.canManage ? fetch('/api/disaster/contact-log', { cache: 'no-store' }) : Promise.resolve(null),
  ]);
  const statusData = statusRes.ok ? await statusRes.json() : { pastorStatuses: [] };
  const churchData = churchRes.ok ? await churchRes.json() : { churchStatuses: [] };
  const attemptsData = attemptsRes?.ok ? await attemptsRes.json() : { attempts: [] };

  const me = myPastor();
  const myStatus = me ? statusData.pastorStatuses.find(s => s.pastorId === me.id) : null;
  const myChurches = me?.churches ?? [];

  const coordinatorEl = body.querySelector('#dis-coordinator');
  body.innerHTML = [
    me ? checkInSectionHtml(myStatus) : '',
    myChurches.map(name => churchStatusSectionHtml(name, churchData.churchStatuses.find(s => s.churchName === name))).join(''),
    lastActive.canManage ? contactQueueHtml() : '',
    lastActive.canManage ? adminDashboardHtml(statusData.pastorStatuses, churchData.churchStatuses, attemptsData.attempts) : '',
    canManageDisasterModule() ? disasterAdminSectionHtml() : '',
  ].join('');
  body.prepend(coordinatorEl);

  if (me) wireCheckIn(body, me);
  myChurches.forEach(name => wireChurchStatus(body, name));
  if (lastActive.canManage) {
    wireContactListGenerator(body, statusData.pastorStatuses, churchData.churchStatuses);
    wireContactQueue(body);
  }
  if (canManageDisasterModule()) {
    wireDisasterAdminSection(body);
    wireIncidentClose(body);
  }
}

// ── Standing coordinator contacts (admin-editable) ───────────────────────────
const COORDINATOR_ROLES = [
  { role: 'main', title: 'Disaster Response Coordinator', idPrefix: 'dis-coord' },
  { role: 'transportation', title: 'Transportation Coordinator', idPrefix: 'dis-coord-trans' },
];

function renderCoordinatorSection(el) {
  if (!el) return;
  el.innerHTML = COORDINATOR_ROLES.map(r => `<div id="${r.idPrefix}-wrap"><div class="support-section"><p class="support-section-desc">Loading…</p></div></div>`).join('');
  COORDINATOR_ROLES.forEach(r => loadCoordinator(el.querySelector(`#${r.idPrefix}-wrap`), r));
}

async function loadCoordinator(el, { role, title, idPrefix }) {
  const res = await fetch(`/api/disaster/coordinator?role=${role}`, { cache: 'no-store' });
  const c = res.ok ? await res.json() : { name: null, email: null, phone: null };
  const canEdit = canManageDisasterModule();
  const hasContact = c.name || c.email || c.phone;

  el.innerHTML = `
    <div class="support-section">
      <div class="support-section-title">${esc(title)}</div>
      ${hasContact ? `
        <p class="support-section-desc">
          ${c.name ? esc(c.name) : 'Contact'}${c.phone ? ` · <a class="phone-link" href="tel:+1${esc(c.phone.replace(/\D/g, ''))}">${esc(c.phone)}</a>` : ''}${c.email ? ` · <a class="email-link" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}
        </p>
      ` : `<p class="support-section-desc">Not yet configured.</p>`}
      ${canEdit ? `
        <div class="admin-add-row">
          <input type="text" id="${idPrefix}-name" class="search-input" placeholder="Name" value="${esc(c.name || '')}" autocomplete="off">
        </div>
        <div class="admin-add-row">
          <input type="tel" id="${idPrefix}-phone" class="search-input" placeholder="Phone" value="${esc(c.phone || '')}" autocomplete="off">
          <input type="email" id="${idPrefix}-email" class="search-input" placeholder="Email" value="${esc(c.email || '')}" autocomplete="off">
        </div>
        <div class="admin-add-row">
          <button id="${idPrefix}-save" class="support-btn">Save</button>
        </div>
      ` : ''}
    </div>
  `;

  if (canEdit) {
    el.querySelector(`#${idPrefix}-save`).addEventListener('click', async () => {
      const btn = el.querySelector(`#${idPrefix}-save`);
      btn.disabled = true;
      const res = await fetch('/api/disaster/coordinator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          name: el.querySelector(`#${idPrefix}-name`).value.trim() || null,
          phone: el.querySelector(`#${idPrefix}-phone`).value.trim() || null,
          email: el.querySelector(`#${idPrefix}-email`).value.trim() || null,
        }),
      });
      btn.disabled = false;
      if (res.ok) loadCoordinator(el, { role, title, idPrefix });
      else alert('Failed to save coordinator contact.');
    });
  }
}

async function startIncident() {
  const name = document.getElementById('dis-new-name').value.trim();
  const isSimulation = document.getElementById('dis-new-sim').checked;
  if (!name) return;
  const res = await fetch('/api/admin/disaster/incidents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, coordinators: newIncidentCoordinators, isSimulation }),
  });
  if (res.ok) {
    newIncidentCoordinators = [];
    await checkDisasterActive();
    location.reload();
  } else {
    alert('Failed to start incident.');
  }
}

// ── Coordination team picker (used when starting an incident) ──────────────
let newIncidentCoordinators = [];
let coordPickerWired = false;

function coordinatorRowsHtml() {
  if (!newIncidentCoordinators.length) return '<p class="item-sub">No coordinators added yet.</p>';
  return newIncidentCoordinators.map((c, i) => `
    <div class="admin-email-row">
      <div class="admin-email-info">
        <div class="item-name">${esc(`${c.firstName} ${c.lastName}`.trim())}</div>
        <div class="item-sub">${[c.email, c.phone].filter(Boolean).map(esc).join(' · ') || 'No contact info'}</div>
      </div>
      <div class="admin-email-actions">
        <button type="button" class="admin-delete-btn dis-new-coord-remove" data-index="${i}">Remove</button>
      </div>
    </div>
  `).join('');
}

// Renders the persistent "who's already added" list — shown both on the
// underlying page (#dis-new-coord-list) and, while it's open, pinned inside
// the picker modal itself (#dis-coord-selected-list) so selecting doesn't
// bump a just-added name out of view once the search query changes.
function renderSelectedCoordinators() {
  const rowsHtml = coordinatorRowsHtml();
  [
    { listId: 'dis-new-coord-list' },
    { listId: 'dis-coord-selected-list', countId: 'dis-coord-selected-count' },
  ].forEach(({ listId, countId }) => {
    const el = document.getElementById(listId);
    if (!el) return;
    el.innerHTML = rowsHtml;
    el.querySelectorAll('.dis-new-coord-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        newIncidentCoordinators.splice(Number(btn.dataset.index), 1);
        renderSelectedCoordinators();
        if (document.getElementById('dis-coord-picker-overlay') && !document.getElementById('dis-coord-picker-overlay').classList.contains('hidden')) {
          renderCoordinatorPickList(document.getElementById('dis-coord-search').value);
        }
      });
    });
    if (countId) document.getElementById(countId).textContent = newIncidentCoordinators.length;
  });
  const selectedWrap = document.getElementById('dis-coord-selected-wrap');
  if (selectedWrap) selectedWrap.classList.toggle('hidden', newIncidentCoordinators.length === 0);
}

// Shows the full pastor directory by default (like the main Pastors tab),
// filtered live as you type — nothing is hidden behind "start typing to
// search". Selected pastors stay in the list (tagged "Added") rather than
// disappearing, since the persistent Selected section above already covers
// "who's added" — this list is just "who can I add or remove".
function renderCoordinatorPickList(query) {
  const listEl = document.getElementById('dis-coord-picker-list');
  const selectedPastorIds = new Set(newIncidentCoordinators.filter(c => c.pastorId).map(c => c.pastorId));
  const matches = searchPastors(allPastors, query)
    .slice()
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  if (!matches.length) {
    listEl.innerHTML = '<p class="item-sub">No pastors found.</p>';
    return;
  }
  listEl.innerHTML = matches.map(p => {
    const added = selectedPastorIds.has(p.id);
    return `
      <div class="list-item dis-coord-pick-item" data-id="${esc(p.id)}">
        <div>
          <div class="item-name">${esc(p.displayName)}</div>
          <div class="item-sub">${esc(p.email || '')}</div>
        </div>
        ${added ? '<span class="tag">Added ✓</span>' : ''}
      </div>
    `;
  }).join('');
  listEl.querySelectorAll('.dis-coord-pick-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      const idx = newIncidentCoordinators.findIndex(c => c.pastorId === id);
      if (idx >= 0) {
        newIncidentCoordinators.splice(idx, 1);
      } else {
        const p = allPastors.find(pp => pp.id === id);
        if (!p) return;
        newIncidentCoordinators.push({
          pastorId: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email || '',
          phone: p.primaryPhone || p.phones?.[0]?.number || '',
        });
      }
      renderSelectedCoordinators();
      renderCoordinatorPickList(document.getElementById('dis-coord-search').value);
    });
  });
}

function showManualAddScreen(show) {
  document.getElementById('dis-coord-picker-card').classList.toggle('hidden', show);
  document.getElementById('dis-coord-manual-card').classList.toggle('hidden', !show);
  if (show) document.getElementById('dis-coord-manual-first').focus();
}

function ensureCoordPickerWired() {
  if (coordPickerWired) return;
  coordPickerWired = true;
  const overlay = document.getElementById('dis-coord-picker-overlay');
  overlay.addEventListener('click', e => { if (e.target === overlay) closeCoordinatorPicker(); });
  document.getElementById('dis-coord-picker-close').addEventListener('click', closeCoordinatorPicker);
  document.getElementById('dis-coord-picker-done').addEventListener('click', closeCoordinatorPicker);
  document.getElementById('dis-coord-manual-back').addEventListener('click', () => showManualAddScreen(false));
  document.getElementById('dis-coord-search').addEventListener('input', e => renderCoordinatorPickList(e.target.value));
  document.getElementById('dis-coord-manual-open').addEventListener('click', () => showManualAddScreen(true));
  document.getElementById('dis-coord-manual-add').addEventListener('click', () => {
    const firstName = document.getElementById('dis-coord-manual-first').value.trim();
    const lastName = document.getElementById('dis-coord-manual-last').value.trim();
    const email = document.getElementById('dis-coord-manual-email').value.trim();
    const phone = document.getElementById('dis-coord-manual-phone').value.trim();
    if (!firstName || !lastName) { alert('First and last name are required.'); return; }
    newIncidentCoordinators.push({ pastorId: null, firstName, lastName, email, phone });
    renderSelectedCoordinators();
    document.getElementById('dis-coord-manual-first').value = '';
    document.getElementById('dis-coord-manual-last').value = '';
    document.getElementById('dis-coord-manual-email').value = '';
    document.getElementById('dis-coord-manual-phone').value = '';
    showManualAddScreen(false);
  });
}

function openCoordinatorPicker() {
  ensureCoordPickerWired();
  document.getElementById('dis-coord-picker-overlay').classList.remove('hidden');
  showManualAddScreen(false);
  document.getElementById('dis-coord-search').value = '';
  renderSelectedCoordinators();
  renderCoordinatorPickList('');
  document.getElementById('dis-coord-search').focus();
}

function closeCoordinatorPicker() {
  document.getElementById('dis-coord-picker-overlay').classList.add('hidden');
}

// ── Pastor check-in ──────────────────────────────────────────────────────────
// Shared self-report radio groups. All three read left-to-right as
// Yes = everything's fine, so a coordinator scanning statuses only needs
// to look for "No" as the universal red flag.
// - Self is a plain Yes/No — no "unknown", since not answering it isn't a
//   meaningful state (you always know if you personally are OK).
// - Family and property keep an explicit "unknown / not yet assessed" —
//   both are things you might genuinely not know yet (family unreachable,
//   haven't been able to check the building).
// - Property's stored value keeps its original "is there damage" meaning
//   (yes = damage), matching the property_damage_* column names and the
//   boolean derivation in status.js — only the *displayed* labels are
//   flipped here so "Yes" still reads as the good answer.
const SR_SELF_OPTS     = [['ok', 'Yes'], ['not_ok', 'No']];
const SR_FAMILY_OPTS   = [['ok', 'Yes'], ['not_ok', 'No'], ['unknown', 'Unknown / not yet assessed']];
const SR_PROPERTY_OPTS = [['no', 'Yes'], ['yes', 'No'], ['unknown', 'Unknown / not yet assessed']];

function triStateRadioHtml(name, opts, selected) {
  return `<div class="admin-add-row dis-prep-bool-row dis-tristate-row">${opts.map(([v, label]) => `
    <label><input type="radio" name="${name}" value="${v}" ${selected === v ? 'checked' : ''}> ${esc(label)}</label>
  `).join('')}</div>`;
}

function checkInSectionHtml(status) {
  const s = status || {};
  const selfSelected = s.status === 'ok' || s.status === 'not_ok' ? s.status : null;
  return `
    <div class="support-section" id="dis-checkin">
      <div class="support-section-title">My Status</div>
      <p class="support-section-desc">${s.updatedAt ? `Last updated ${esc(s.updatedAt)} by ${esc(s.confirmedBy || '')}` : 'Not yet reported.'}</p>
      <div class="detail-label">Are you OK?</div>
      ${triStateRadioHtml('dis-status', SR_SELF_OPTS, selfSelected)}
      <div class="detail-label">Is your family OK?</div>
      ${triStateRadioHtml('dis-family', SR_FAMILY_OPTS, s.familyStatus || 'unknown')}
      <div class="detail-label">Is your residence OK — no damage?</div>
      ${triStateRadioHtml('dis-dmg-residence', SR_PROPERTY_OPTS, s.propertyDamageResidenceStatus || (s.propertyDamageResidence ? 'yes' : 'unknown'))}
      <div class="detail-label">Is your church OK — no damage?</div>
      ${triStateRadioHtml('dis-dmg-church', SR_PROPERTY_OPTS, s.propertyDamageChurchStatus || (s.propertyDamageChurch ? 'yes' : 'unknown'))}
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
    const status = container.querySelector('input[name="dis-status"]:checked')?.value;
    if (!status) { alert('Please answer "Are you OK?"'); return; }
    const btn = container.querySelector('#dis-save-checkin');
    btn.disabled = true;
    const res = await fetch('/api/disaster/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pastorId: pastor.id,
        status,
        familyStatus: container.querySelector('input[name="dis-family"]:checked')?.value || 'unknown',
        note: container.querySelector('#dis-note').value.trim() || null,
        propertyDamageResidenceStatus: container.querySelector('input[name="dis-dmg-residence"]:checked')?.value || 'unknown',
        propertyDamageChurchStatus: container.querySelector('input[name="dis-dmg-church"]:checked')?.value || 'unknown',
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

// ── One-time post-login self-report prompt ──────────────────────────────────
// Shown right after login whenever an incident is active and the signed-in
// pastor has no status row yet for it — checked fresh from the server each
// time rather than a client-side dismiss flag, so it also goes away the
// moment anyone (an admin/coordinator included) enters a status for them.
export async function maybeShowSelfReportPrompt() {
  if (!lastActive.active) return false;
  const me = myPastor();
  if (!me) return false;
  const res = await fetch('/api/disaster/status', { cache: 'no-store' });
  const data = res.ok ? await res.json() : { pastorStatuses: [] };
  if (data.pastorStatuses.some(s => s.pastorId === me.id)) return false;
  renderSelfReportPrompt(me);
  return true;
}

function renderSelfReportPrompt(pastor) {
  const overlay = document.getElementById('dis-selfreport-overlay');
  const card = document.getElementById('dis-selfreport-card');
  card.innerHTML = `
    <div class="announcement-title">${lastActive.isSimulation ? '⚠️ SIMULATION — ' : ''}${esc(lastActive.name)}</div>
    <p class="announcement-body">Please take a moment to check in so coordination knows your status.</p>
    <div class="detail-label">Are you OK?</div>
    ${triStateRadioHtml('sr-self', SR_SELF_OPTS, null)}
    <div class="detail-label">Is your family OK?</div>
    ${triStateRadioHtml('sr-family', SR_FAMILY_OPTS, 'unknown')}
    <div class="detail-label">Is your property OK — no damage at home or church?</div>
    ${triStateRadioHtml('sr-damage', SR_PROPERTY_OPTS, 'unknown')}
    <div class="detail-cta-row" style="margin-top:16px;">
      <button type="button" id="dis-selfreport-save" class="support-btn">Submit</button>
    </div>
  `;
  overlay.classList.remove('hidden');

  card.querySelector('#dis-selfreport-save').addEventListener('click', async () => {
    const selfStatus = card.querySelector('input[name="sr-self"]:checked')?.value;
    if (!selfStatus) { alert('Please answer "Are you OK?"'); return; }
    const btn = card.querySelector('#dis-selfreport-save');
    btn.disabled = true;
    const damage = card.querySelector('input[name="sr-damage"]:checked').value;
    const res = await fetch('/api/disaster/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pastorId: pastor.id,
        status: selfStatus,
        familyStatus: card.querySelector('input[name="sr-family"]:checked').value,
        propertyDamageResidenceStatus: damage,
        propertyDamageChurchStatus: damage,
      }),
    });
    btn.disabled = false;
    if (res.ok) overlay.classList.add('hidden');
    else alert('Failed to save check-in — please try again, or use the Disaster tab.');
  });
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

// ── Contact queue ────────────────────────────────────────────────────────────
// Lets multiple signed-in coordinators work through the "still needs
// checking" pool without duplicating calls: claiming hands out one pastor
// at a time, and logging an outcome (with an automatic timestamp and the
// logged-in user recorded server-side) releases that claim back to the
// pool for the next person — unless the outcome actually reached them, in
// which case it resolves their status instead of returning to the pool.
function contactQueueHtml() {
  return `
    <div class="support-section" id="dis-queue">
      <div class="support-section-title">Work the Queue</div>
      <p class="support-section-desc">Claim the next pastor who hasn't checked in — this keeps others from calling the same person at the same time.</p>
      <div id="dis-queue-body"><p class="item-sub">Loading…</p></div>
    </div>
  `;
}

function queueClaimBodyHtml(claim) {
  if (!claim) {
    return `<div class="detail-cta-row"><button type="button" id="dis-queue-next" class="support-btn">Assign Me Next</button></div>`;
  }
  return `
    <div class="admin-activity-row">
      <div class="admin-activity-info">
        <div class="item-name">${esc(claim.displayName)}</div>
        <div class="item-sub">${[claim.phone, claim.email].filter(Boolean).map(esc).join(' · ') || 'No contact info on file'}</div>
      </div>
    </div>
    <div class="admin-add-row">
      <select id="dis-queue-outcome" class="search-input">
        <option value="no_answer">Called — no answer</option>
        <option value="left_voicemail">Left voicemail</option>
        <option value="reached_ok">Reached — confirmed OK</option>
        <option value="reached_not_ok">Reached — needs attention</option>
        <option value="other">Other (see note)</option>
      </select>
    </div>
    <div class="admin-add-row">
      <textarea id="dis-queue-note" class="search-input" placeholder="Note (optional)" rows="2"></textarea>
    </div>
    <div class="detail-cta-row">
      <button type="button" id="dis-queue-log" class="support-btn">Log &amp; Release</button>
    </div>
    <div class="detail-cta-row">
      <button type="button" id="dis-queue-release" class="support-btn support-btn-alt">Release Without Logging</button>
    </div>
  `;
}

function wireContactQueue(container) {
  const body = container.querySelector('#dis-queue-body');
  if (!body) return;

  function render(claim) {
    body.innerHTML = queueClaimBodyHtml(claim);
    if (!claim) {
      body.querySelector('#dis-queue-next').addEventListener('click', async () => {
        const btn = body.querySelector('#dis-queue-next');
        btn.disabled = true;
        const res = await fetch('/api/disaster/contact-claim', { method: 'POST' });
        const data = res.ok ? await res.json() : {};
        if (data.claim) render(data.claim);
        else if (data.poolEmpty) body.innerHTML = '<p class="item-sub">🎉 Nobody left to check on right now.</p>';
        else { btn.disabled = false; alert('Could not claim a pastor — please try again.'); }
      });
      return;
    }
    body.querySelector('#dis-queue-log').addEventListener('click', async () => {
      const btn = body.querySelector('#dis-queue-log');
      btn.disabled = true;
      const res = await fetch('/api/disaster/contact-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pastorId: claim.pastorId,
          outcome: body.querySelector('#dis-queue-outcome').value,
          note: body.querySelector('#dis-queue-note').value.trim() || null,
        }),
      });
      if (res.ok) refresh();
      else { btn.disabled = false; alert('Failed to log outcome.'); }
    });
    body.querySelector('#dis-queue-release').addEventListener('click', async () => {
      body.querySelector('#dis-queue-release').disabled = true;
      await fetch('/api/disaster/contact-claim', { method: 'DELETE' });
      refresh();
    });
  }

  async function refresh() {
    const res = await fetch('/api/disaster/contact-claim', { cache: 'no-store' });
    const data = res.ok ? await res.json() : { claim: null };
    render(data.claim);
  }

  refresh();
}

// ── Admin dashboard ──────────────────────────────────────────────────────────
// Full roster (every pastor, not just those who've reported) grouped by
// urgency — otherwise anyone who hasn't opened the app at all is invisible,
// and there's no way to answer "who still needs checked on".
const ROSTER_GROUP_FLAGGED = 0;
const ROSTER_GROUP_OK = 1;
const ROSTER_GROUP_NEEDS_CHECKING = 2;
const ROSTER_GROUP_LABEL = {
  [ROSTER_GROUP_FLAGGED]: '⚠️ Flagged',
  [ROSTER_GROUP_OK]: '✅ OK',
  [ROSTER_GROUP_NEEDS_CHECKING]: 'Still needs checking',
};

const OUTCOME_LABELS = {
  assigned: 'Assigned, no outcome logged yet',
  no_answer: 'Called — no answer',
  left_voicemail: 'Left voicemail',
  reached_ok: 'Reached — confirmed OK',
  reached_not_ok: 'Reached — needs attention',
  other: 'Other outcome',
};

function rosterEntry(pastor, s, attempt) {
  const flags = s ? [
    s.status === 'not_ok' ? 'Self NOT OK' : null,
    s.familyStatus === 'not_ok' ? 'Family NOT OK' : null,
    s.propertyDamageResidence ? 'Residence damage' : null,
    s.propertyDamageChurch ? 'Church damage' : null,
  ].filter(Boolean) : [];
  const group = flags.length ? ROSTER_GROUP_FLAGGED
    : s?.status === 'ok' ? ROSTER_GROUP_OK
    : ROSTER_GROUP_NEEDS_CHECKING;
  let badge = flags.length ? flags.join(' · ') : group === ROSTER_GROUP_OK ? 'OK' : 'Not yet checked in';
  if (group === ROSTER_GROUP_NEEDS_CHECKING && attempt) {
    badge += ` · Last attempt: ${OUTCOME_LABELS[attempt.outcome] ?? attempt.outcome} (${esc(attempt.loggedBy)})`;
  }
  return { pastor, status: s, group, badge };
}

function adminDashboardHtml(pastorStatuses, churchStatuses, attempts = []) {
  const damaged = pastorStatuses.filter(s => s.propertyDamageResidence || s.propertyDamageChurch);
  const byId = new Map(pastorStatuses.map(s => [s.pastorId, s]));
  const attemptById = new Map(attempts.map(a => [a.pastorId, a]));
  const roster = allPastors
    .map(p => rosterEntry(p, byId.get(p.id), attemptById.get(p.id)))
    .sort((a, b) => a.group - b.group
      || a.pastor.lastName.localeCompare(b.pastor.lastName)
      || a.pastor.firstName.localeCompare(b.pastor.firstName));

  const counts = { [ROSTER_GROUP_FLAGGED]: 0, [ROSTER_GROUP_OK]: 0, [ROSTER_GROUP_NEEDS_CHECKING]: 0 };
  roster.forEach(r => counts[r.group]++);

  let lastGroup = null;
  const rosterRows = roster.map(({ pastor, status: s, group, badge }) => {
    const header = group !== lastGroup ? `<div class="detail-label" style="margin-top:12px;">${ROSTER_GROUP_LABEL[group]} (${counts[group]})</div>` : '';
    lastGroup = group;
    return `${header}
      <div class="admin-activity-row">
        <div class="admin-activity-info">
          <div class="item-name">${esc(pastor.displayName)}</div>
          <div class="item-sub">${badge}${s?.note ? ' · ' + esc(s.note) : ''}</div>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="support-section">
      <div class="support-section-title">Dashboard</div>
      <p class="support-section-desc">${counts[ROSTER_GROUP_OK]} OK · ${counts[ROSTER_GROUP_FLAGGED]} flagged · ${counts[ROSTER_GROUP_NEEDS_CHECKING]} still need checking · ${damaged.length} with property damage reported</p>
      <div class="dis-roster-list">${rosterRows}</div>
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

// ── County response coverage (nested inside the preparedness section, only
// shown once the preparedness wizard has been started) ─────────────────────
function renderCountyReadiness(el, churchName) {
  const section = el;
  section.innerHTML = `
    <div class="detail-label" style="margin-top:16px;">Where We Can Help (Counties)</div>
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

// ── Standing preparedness wizard (always visible, not incident-gated) ───────
// Called from detail.js on the church detail page. Nothing is shown until
// the pastor opts in; every question is skippable and nothing is required.
const PREP_STEPS = [
  {
    key: 'backupPower', kind: 'bool', notesKey: 'backupPowerNotes',
    question: 'Does your church have a generator or other backup power source?',
    helper: 'Even a small generator can keep phones charged and lights on.',
  },
  {
    key: 'emergencySupplies', kind: 'bool', notesKey: 'emergencySuppliesNotes',
    question: 'Does your church keep water, first aid, or food supplies on-site?',
    helper: "Doesn't need to be much — what's on hand helps us know where to route donations.",
  },
  {
    key: 'shelterAvailable', kind: 'bool', notesKey: 'shelterNotes',
    question: "Could your church's building serve as a temporary shelter?",
    helper: 'Think fellowship hall / classrooms, not just the sanctuary.',
  },
  {
    key: 'shelterCapacityCount', kind: 'number', showIf: a => a.shelterAvailable === true,
    question: 'Roughly how many people could it hold?',
    helper: 'A rough estimate is fine.',
  },
  {
    key: 'hasCommunicationPlan', kind: 'bool',
    question: 'Does your church have a way to reach its members quickly in an emergency?',
    helper: 'e.g. a phone tree, group text, or an app.',
  },
  {
    key: 'communicationMethods', kind: 'checklist', showIf: a => a.hasCommunicationPlan === true,
    question: 'Which methods does your church use?',
    helper: 'Select all that apply.',
    options: [
      { key: 'commMethodPhoneTree', label: 'Phone tree' },
      { key: 'commMethodGroupText', label: 'Group text' },
      { key: 'commMethodApp', label: 'App (e.g. GroupMe, church app)' },
      { key: 'commMethodOther', label: 'Other' },
    ],
  },
  {
    key: 'commMethodOtherDetail', kind: 'text', showIf: a => a.commMethodOther === true,
    question: 'What other method does your church use?',
    helper: 'Briefly describe it.',
  },
  {
    key: 'donationDropoff', kind: 'bool',
    question: 'Can your church be used as a donation drop-off point during an incident?',
    helper: 'Somewhere people could bring supplies to be sorted or forwarded.',
  },
  {
    key: 'donationDropoffCoordinatorName', kind: 'text', showIf: a => a.donationDropoff === true,
    extraKeys: [
      { key: 'donationDropoffCoordinatorPhone', placeholder: 'Phone', type: 'tel' },
      { key: 'donationDropoffCoordinatorEmail', placeholder: 'Email', type: 'email' },
    ],
    question: 'Who at your church would coordinate this?',
    helper: 'Name and the best way to reach them.',
  },
  {
    key: 'transportationAvailable', kind: 'bool', notesKey: 'transportationNotes',
    question: 'Are there people at your church prepared to provide transportation for donated goods to a central warehouse or a rendezvous point?',
    helper: 'Even one or two people with a truck or van is useful to know about.',
  },
  {
    key: 'distributionPoint', kind: 'bool',
    question: 'Is your church prepared to serve as a distribution point for supplies during an incident?',
    helper: 'Somewhere affected people could come to receive supplies.',
  },
  {
    key: 'distributionPointCoordinatorName', kind: 'text', showIf: a => a.distributionPoint === true,
    extraKeys: [
      { key: 'distributionPointCoordinatorPhone', placeholder: 'Phone', type: 'tel' },
      { key: 'distributionPointCoordinatorEmail', placeholder: 'Email', type: 'email' },
    ],
    question: 'Who at your church would coordinate this?',
    helper: 'Name and the best way to reach them.',
  },
  {
    key: 'emergencyContactName', kind: 'text',
    extraKeys: [{ key: 'emergencyContactPhone', placeholder: 'Phone', type: 'tel' }],
    question: "Who should coordination reach first if your church's building is affected?",
    helper: "Doesn't have to be the pastor — whoever holds a key or knows the building.",
  },
  {
    key: 'notes', kind: 'text',
    question: "Anything else we should know about your church's disaster preparedness?",
    helper: 'Optional — anything not covered above.',
  },
];

const PREP_LABELS = {
  backupPower: 'Backup power', emergencySupplies: 'Emergency supplies on-site',
  shelterAvailable: 'Shelter capacity', hasCommunicationPlan: 'Communication plan',
  donationDropoff: 'Donation drop-off point', transportationAvailable: 'Transportation for donated goods',
  distributionPoint: 'Distribution point (POD)', emergencyContactName: 'On-site emergency contact',
  notes: 'Notes',
};

function prepHasAnyAnswer(a) {
  return PREP_STEPS.some(s => a[s.key] !== null && a[s.key] !== undefined && a[s.key] !== '');
}

export async function renderPreparedness(container, churchName) {
  if (!(lastActive.moduleEnabled || lastActive.canManage)) return;
  if (!canManageChurchPreparedness(churchName)) return;
  const section = document.createElement('div');
  section.className = 'detail-section';
  section.innerHTML = `<p class="item-sub">Loading…</p>`;
  container.appendChild(section);

  const res = await fetch(`/api/disaster/preparedness?church=${encodeURIComponent(churchName)}`, { cache: 'no-store' });
  const answers = res.ok ? await res.json() : {};

  if (prepHasAnyAnswer(answers)) {
    renderPrepSummary(section, churchName, answers);
  } else {
    renderPrepIntro(section, churchName);
  }
}

function renderPrepIntro(section, churchName) {
  section.innerHTML = `
    <div class="detail-label">Disaster Preparedness</div>
    <p class="item-sub">How is your church prepared to respond during a disaster or public emergency incident?</p>
    <div class="detail-cta-row">
      <button id="dis-prep-start" class="support-btn">Get Started</button>
    </div>
  `;
  section.querySelector('#dis-prep-start').addEventListener('click', () => renderPrepWizard(section, churchName, {}, 0));
}

function renderPrepSummary(section, churchName, answers) {
  const rows = PREP_STEPS.filter(s => !s.showIf).map(s => {
    const val = answers[s.key];
    if (val === null || val === undefined || val === '') return '';
    let display = s.kind === 'bool' ? (val ? 'Yes' : 'No') : esc(val);
    if (s.key === 'shelterAvailable' && val && answers.shelterCapacityCount) display += ` — capacity: ~${esc(answers.shelterCapacityCount)} people`;
    if (s.kind === 'bool' && val && s.notesKey && answers[s.notesKey]) display += ` — ${esc(answers[s.notesKey])}`;
    if (s.key === 'hasCommunicationPlan' && val) {
      const methods = [];
      if (answers.commMethodPhoneTree) methods.push('Phone tree');
      if (answers.commMethodGroupText) methods.push('Group text');
      if (answers.commMethodApp) methods.push('App');
      if (answers.commMethodOther) methods.push(`Other${answers.commMethodOtherDetail ? ` (${esc(answers.commMethodOtherDetail)})` : ''}`);
      if (methods.length) display += ` — ${methods.join(', ')}`;
    }
    if (s.key === 'donationDropoff' && val && answers.donationDropoffCoordinatorName) {
      display += ` — coordinator: ${esc(answers.donationDropoffCoordinatorName)}`;
      const contact = answers.donationDropoffCoordinatorPhone || answers.donationDropoffCoordinatorEmail;
      if (contact) display += ` (${esc(contact)})`;
    }
    if (s.key === 'distributionPoint' && val && answers.distributionPointCoordinatorName) {
      display += ` — coordinator: ${esc(answers.distributionPointCoordinatorName)}`;
      const contact = answers.distributionPointCoordinatorPhone || answers.distributionPointCoordinatorEmail;
      if (contact) display += ` (${esc(contact)})`;
    }
    if (s.key === 'emergencyContactName' && answers.emergencyContactPhone) display += ` — ${esc(answers.emergencyContactPhone)}`;
    return `
      <div class="admin-activity-row">
        <div class="admin-activity-info">
          <div class="item-name">${esc(PREP_LABELS[s.key] ?? s.key)}</div>
          <div class="item-sub">${display}</div>
        </div>
      </div>`;
  }).join('');

  section.innerHTML = `
    <div class="detail-label">Disaster Preparedness</div>
    ${rows}
    <div class="detail-cta-row">
      <button id="dis-prep-edit" class="support-btn">Edit Answers</button>
    </div>
    <div id="dis-county-wrap"></div>
  `;
  section.querySelector('#dis-prep-edit').addEventListener('click', () => renderPrepWizard(section, churchName, answers, 0));
  // Once the wizard's been started, fold county-level response coverage
  // into the same card rather than showing it as its own separate section.
  renderCountyReadiness(section.querySelector('#dis-county-wrap'), churchName);
}

function nextPrepStepIndex(answers, fromIndex) {
  for (let i = fromIndex; i < PREP_STEPS.length; i++) {
    const step = PREP_STEPS[i];
    if (!step.showIf || step.showIf(answers)) return i;
  }
  return PREP_STEPS.length;
}

async function savePrepField(churchName, fields) {
  await fetch('/api/disaster/preparedness', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ churchName, ...fields }),
  }).catch(() => {});
}

// ── Preparedness wizard modal ────────────────────────────────────────────────
let prepModalCtx = null;
let prepOverlayWired = false;

function ensurePrepOverlayWired() {
  if (prepOverlayWired) return;
  prepOverlayWired = true;
  const overlay = document.getElementById('dis-prep-overlay');
  overlay.addEventListener('click', e => {
    if (e.target === overlay && prepModalCtx) closePrepModal();
  });
}

function closePrepModal() {
  document.getElementById('dis-prep-overlay').classList.add('hidden');
  if (!prepModalCtx) return;
  const { section, churchName, answers } = prepModalCtx;
  prepModalCtx = null;
  if (prepHasAnyAnswer(answers)) renderPrepSummary(section, churchName, answers);
  else renderPrepIntro(section, churchName);
}

function renderPrepWizard(section, churchName, answers, stepIndex) {
  const idx = nextPrepStepIndex(answers, stepIndex);
  if (idx >= PREP_STEPS.length) {
    document.getElementById('dis-prep-overlay').classList.add('hidden');
    prepModalCtx = null;
    renderPrepSummary(section, churchName, answers);
    return;
  }

  ensurePrepOverlayWired();
  prepModalCtx = { section, churchName, answers };
  const overlay = document.getElementById('dis-prep-overlay');
  const modal = document.getElementById('dis-prep-modal-body');
  overlay.classList.remove('hidden');

  const step = PREP_STEPS[idx];
  const total = PREP_STEPS.filter(s => !s.showIf || s.showIf(answers)).length;
  const position = PREP_STEPS.slice(0, idx + 1).filter(s => !s.showIf || s.showIf(answers)).length;

  const boolInputs = step.kind === 'bool' ? `
    <div class="admin-add-row dis-prep-bool-row">
      <label><input type="radio" name="dis-prep-bool" value="yes" ${answers[step.key] === true ? 'checked' : ''}> Yes</label>
      <label><input type="radio" name="dis-prep-bool" value="no" ${answers[step.key] === false ? 'checked' : ''}> No</label>
    </div>
    ${step.notesKey ? `<div class="admin-add-row"><textarea id="dis-prep-notes" class="search-input" placeholder="Details (optional)" rows="2">${esc(answers[step.notesKey] || '')}</textarea></div>` : ''}
  ` : step.kind === 'number' ? `
    <div class="admin-add-row">
      <input type="number" id="dis-prep-number" class="search-input" inputmode="numeric" min="0" step="1" placeholder="Number of people" value="${answers[step.key] ?? ''}">
    </div>
  ` : step.kind === 'checklist' ? `
    <div class="admin-add-row dis-prep-checklist">
      ${step.options.map(opt => `<label><input type="checkbox" class="dis-prep-check" value="${opt.key}" ${answers[opt.key] ? 'checked' : ''}> ${esc(opt.label)}</label>`).join('')}
    </div>
  ` : `
    <div class="admin-add-row">
      <textarea id="dis-prep-text" class="search-input" placeholder="Your answer" rows="2">${esc(answers[step.key] || '')}</textarea>
    </div>
    ${(step.extraKeys || []).map((ek, i) => `<div class="admin-add-row"><input type="${ek.type || 'text'}" id="dis-prep-extra-${i}" class="search-input" placeholder="${esc(ek.placeholder)}" value="${esc(answers[ek.key] || '')}"></div>`).join('')}
  `;

  modal.innerHTML = `
    <button type="button" id="dis-prep-close" class="modal-close-btn" aria-label="Close">&times;</button>
    <div class="detail-label">Disaster Preparedness <span class="item-sub">(${position} of ${total})</span></div>
    <p class="dis-prep-question">${esc(step.question)}</p>
    <p class="dis-prep-helper">${esc(step.helper)}</p>
    ${boolInputs}
    <div class="admin-add-row">
      <button id="dis-prep-skip" class="support-btn support-btn-alt" style="flex:1">Skip</button>
      <button id="dis-prep-next" class="support-btn" style="flex:1">Next</button>
    </div>
  `;

  const advance = (updatedAnswers) => renderPrepWizard(section, churchName, updatedAnswers, idx + 1);

  modal.querySelector('#dis-prep-close').addEventListener('click', closePrepModal);

  modal.querySelector('#dis-prep-skip').addEventListener('click', async () => {
    const fields = {};
    if (step.kind === 'checklist') {
      step.options.forEach(opt => { fields[opt.key] = null; });
    } else {
      fields[step.key] = null;
      if (step.notesKey) fields[step.notesKey] = null;
      (step.extraKeys || []).forEach(ek => { fields[ek.key] = null; });
    }
    await savePrepField(churchName, fields);
    advance({ ...answers, ...fields });
  });

  modal.querySelector('#dis-prep-next').addEventListener('click', async () => {
    const fields = {};
    if (step.kind === 'bool') {
      const checked = modal.querySelector('input[name="dis-prep-bool"]:checked')?.value;
      fields[step.key] = checked === 'yes' ? true : checked === 'no' ? false : null;
      if (step.notesKey) fields[step.notesKey] = modal.querySelector('#dis-prep-notes')?.value.trim() || null;
    } else if (step.kind === 'number') {
      const raw = modal.querySelector('#dis-prep-number')?.value.trim();
      fields[step.key] = raw ? parseInt(raw, 10) : null;
    } else if (step.kind === 'checklist') {
      const checked = new Set([...modal.querySelectorAll('.dis-prep-check:checked')].map(el => el.value));
      step.options.forEach(opt => { fields[opt.key] = checked.has(opt.key); });
    } else {
      fields[step.key] = modal.querySelector('#dis-prep-text')?.value.trim() || null;
      (step.extraKeys || []).forEach((ek, i) => {
        fields[ek.key] = modal.querySelector(`#dis-prep-extra-${i}`)?.value.trim() || null;
      });
    }
    await savePrepField(churchName, fields);
    advance({ ...answers, ...fields });
  });
}
