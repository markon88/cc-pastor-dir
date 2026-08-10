import { savePastors, getPastors, getStoredVersion, saveVersion, saveAmaGroups, getAmaGroups, saveChurchAddresses, getChurchAddresses, saveAmaSchedule, getAmaSchedule, saveVolunteers, getVolunteers } from './db.js';
import { VERSION as APP_VERSION } from './version.js';
import { initPastorsView, renderPastorsView } from './pastors.js';
import { buildChurchList, renderChurchesView, getChurchByName } from './churches.js';
import { initAmaView, renderAmaView, renderAmaGroupDetail } from './ama.js';
import { initVolunteersView, renderVolunteersView, getVolunteerById } from './volunteers.js';
import { renderPastorDetail, renderChurchDetail, renderVolunteerDetail } from './detail.js';
import { renderSupportView } from './support.js';
import { renderAdminView } from './admin.js';
import { checkAmaBanner, initSchedule } from './ama-meetings.js';
import { initDisaster, checkDisasterActive, renderDisasterView } from './disaster.js';


// ── State ────────────────────────────────────────────────────────────────────
let activeTab = 'pastors';
let pastors = [];
let amaGroups = [];
let detailStack = [];
let currentUser = null;
let volunteersEnabled = true;

// ── DOM ───────────────────────────────────────────────────────────────────────
const mainContent = document.getElementById('main-content');
const tabs        = document.querySelectorAll('.tab-btn');
const loginScreen = document.getElementById('login-screen');
const appShell    = document.getElementById('app');

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function init() {
  // Auth check — must succeed before anything else renders
  const authRes = await fetch('/api/auth/session', {
    cache: 'no-store',
    headers: { 'X-App-Version': APP_VERSION },
  }).catch(() => null);
  if (!authRes || !authRes.ok) {
    showLoginScreen();
    return;
  }
  currentUser = await authRes.json();

  loginScreen.classList.add('hidden');
  appShell.classList.remove('hidden');

  if (currentUser.isAdmin) {
    document.querySelector('[data-tab="admin"]').style.display = 'flex';
  }
  await refreshVolunteersTab();

  // Register service worker and auto-reload when a new version takes over
  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('/sw.js', { type: 'module' }).catch(() => {});
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloading) {
        reloading = true;
        window.location.reload();
      }
    });
  }

  // Load directory data — IndexedDB first, then API
  const data = await loadDirectoryData();
  if (!data) {
    mainContent.innerHTML = '<div class="empty-state">Unable to load directory.<br>Please connect to the internet and try again.</div>';
    setupTabs();
    return;
  }

  pastors   = data.pastors;
  amaGroups = data.amaGroups;

  initSchedule(data.amaSchedule);
  checkAmaBanner(document.getElementById('banners'), currentUser, pastors);

  initPastorsView(pastors);
  buildChurchList(pastors, data.churchAddresses, volunteersEnabled ? (data.volunteers ?? []) : []);
  initAmaView(amaGroups, pastors);
  initVolunteersView(data.volunteers ?? []);
  initDisaster(pastors, currentUser);

  setupTabs();
  renderTab('pastors');
  checkForUpdates();
  refreshDisasterTab();

  // Re-poll periodically so tabs gated by an admin-toggleable module flag
  // appear/disappear live without requiring a reload.
  setInterval(refreshDisasterTab, 5 * 60_000);
  setInterval(refreshVolunteersTab, 5 * 60_000);

  // PWAs often resume an existing JS context instead of reloading when brought
  // back to the foreground, so the once-on-load check above isn't enough —
  // re-check whenever the app becomes visible again, with a short cooldown so
  // rapid tab-switching doesn't spam the data-version endpoint.
  let lastCheck = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastCheck < 60_000) return;
    lastCheck = Date.now();
    checkForUpdates();
    refreshDisasterTab();
    refreshVolunteersTab();
  });
}

async function refreshVolunteersTab() {
  const res = await fetch('/api/volunteers/module-status', { cache: 'no-store' }).catch(() => null);
  volunteersEnabled = res && res.ok ? (await res.json()).enabled : true;
  document.querySelector('[data-tab="volunteers"]').style.display = volunteersEnabled ? 'flex' : 'none';
}

async function refreshDisasterTab() {
  const { active, isSimulation, moduleEnabled, canManage } = await checkDisasterActive();
  const tabBtn = document.querySelector('[data-tab="disaster"]');
  // Whole module has a master on/off switch (Admin tab, DB-backed): while
  // off, only admins and standing disaster admins can see the tab at all
  // (to configure/test before go-live) — everyone else sees nothing,
  // active incident or not.
  tabBtn.style.display = (canManage || (moduleEnabled && active)) ? 'flex' : 'none';
  tabBtn.querySelector('span:last-child').textContent = active && isSimulation ? 'Disaster (SIM)' : 'Disaster';
  if (activeTab === 'disaster') renderTab('disaster');
}

function showLoginScreen() {
  loginScreen.classList.remove('hidden');
  appShell.classList.add('hidden');
  const error = new URLSearchParams(location.search).get('error');
  if (error) {
    const msg = document.getElementById('login-error-msg');
    msg.textContent = error === 'not_allowed'
      ? 'Your email is not authorized to access this directory. Contact the conference office for access.'
      : 'Sign-in failed. Please try again.';
    msg.classList.remove('hidden');
    history.replaceState(null, '', location.pathname);
  }
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadDirectoryData() {
  // Try IndexedDB first — works offline after first authenticated load
  try {
    const [stored, storedAma, storedChurches, storedSchedule, storedVolunteers] = await Promise.all([
      getPastors(),
      getAmaGroups(),
      getChurchAddresses(),
      getAmaSchedule(),
      getVolunteers(),
    ]);
    if (stored?.length > 0 && storedAma && storedChurches && storedSchedule !== null) {
      return { pastors: stored, amaGroups: storedAma, churchAddresses: storedChurches, amaSchedule: storedSchedule, volunteers: storedVolunteers ?? [] };
    }
  } catch {
    // Fall through to API fetch
  }

  // Fetch from auth-protected API
  try {
    const res = await fetch('/api/data', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    await Promise.all([
      savePastors(data.pastors).catch(() => {}),
      saveAmaGroups(data.amaGroups).catch(() => {}),
      saveChurchAddresses(data.churchAddresses).catch(() => {}),
      saveAmaSchedule(data.amaSchedule ?? []).catch(() => {}),
      saveVolunteers(data.volunteers ?? []).catch(() => {}),
      saveVersion(data.version).catch(() => {}),
    ]);
    return data;
  } catch {
    return null;
  }
}

// ── Background data update ──────────────────────────────────────────────────
// Returns true if new data was found and applied, false otherwise (including
// on failure) — so callers (e.g. the Support page button) can report status.
export async function checkForUpdates() {
  try {
    const vRes = await fetch('/api/data-version', { cache: 'no-store' });
    if (!vRes.ok) return false;
    const { version: serverVersion } = await vRes.json();
    const stored = await getStoredVersion();
    if (serverVersion === stored) return false;

    const dataRes = await fetch('/api/data', { cache: 'no-store' });
    if (!dataRes.ok) return false;
    const data = await dataRes.json();
    await Promise.all([
      savePastors(data.pastors).catch(() => {}),
      saveAmaGroups(data.amaGroups).catch(() => {}),
      saveChurchAddresses(data.churchAddresses).catch(() => {}),
      saveAmaSchedule(data.amaSchedule ?? []).catch(() => {}),
      saveVolunteers(data.volunteers ?? []).catch(() => {}),
      saveVersion(serverVersion).catch(() => {}),
    ]);
    pastors   = data.pastors;
    amaGroups = data.amaGroups;
    initSchedule(data.amaSchedule);
    initPastorsView(pastors);
    buildChurchList(pastors, data.churchAddresses, volunteersEnabled ? (data.volunteers ?? []) : []);
    initAmaView(amaGroups, pastors);
    initVolunteersView(data.volunteers ?? []);
    if (detailStack.length === 0) renderTab(activeTab);
    return true;
  } catch {
    // Offline — fail silently
    return false;
  }
}

// ── Tab navigation ────────────────────────────────────────────────────────────
function setupTabs() {
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === activeTab && detailStack.length === 0) return;
      detailStack = [];
      setActiveTab(tab);
      renderTab(tab);
    });
  });
}

function setActiveTab(tab) {
  activeTab = tab;
  tabs.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
}

function renderTab(tab) {
  detailStack = [];
  if (tab === 'pastors') {
    renderPastorsView(mainContent, id => showPastorDetail(id));
  } else if (tab === 'churches') {
    renderChurchesView(mainContent, name => showChurchDetail(name));
  } else if (tab === 'groups') {
    renderAmaView(mainContent, id => showAmaGroupDetail(id));
  } else if (tab === 'volunteers') {
    renderVolunteersView(mainContent, id => showVolunteerDetail(id));
  } else if (tab === 'support') {
    renderSupportView(mainContent, currentUser);
  } else if (tab === 'admin') {
    renderAdminView(mainContent);
  } else if (tab === 'disaster') {
    renderDisasterView(mainContent);
  }
}

// ── Detail navigation ─────────────────────────────────────────────────────────
function showPastorDetail(id) {
  const pastor = pastors.find(p => p.id === id);
  detailStack.push({ type: 'pastor', id });
  renderPastorDetail(mainContent, pastor, goBack, name => showChurchDetail(name), name => {
    const group = amaGroups.find(g => g.name === name);
    if (group) showAmaGroupDetail(group.id);
  });
  mainContent.scrollTop = 0;
}

function showChurchDetail(name) {
  const church = getChurchByName(name);
  detailStack.push({ type: 'church', name });
  renderChurchDetail(mainContent, church, id => showPastorDetail(id), goBack, id => showVolunteerDetail(id));
  mainContent.scrollTop = 0;
}

function showVolunteerDetail(id) {
  const volunteer = getVolunteerById(id);
  detailStack.push({ type: 'volunteer', id });
  renderVolunteerDetail(mainContent, volunteer, goBack, name => showChurchDetail(name));
  mainContent.scrollTop = 0;
}

function showAmaGroupDetail(groupId) {
  detailStack.push({ type: 'ama-group', id: groupId });
  renderAmaGroupDetail(mainContent, groupId, id => showPastorDetail(id), goBack);
  mainContent.scrollTop = 0;
}

function goBack() {
  detailStack.pop();
  if (detailStack.length === 0) {
    renderTab(activeTab);
    return;
  }
  const prev = detailStack[detailStack.length - 1];
  detailStack.pop();
  if (prev.type === 'pastor') showPastorDetail(prev.id);
  else if (prev.type === 'church') showChurchDetail(prev.name);
  else if (prev.type === 'ama-group') showAmaGroupDetail(prev.id);
  else if (prev.type === 'volunteer') showVolunteerDetail(prev.id);
}

// ── Start ─────────────────────────────────────────────────────────────────────
init();
