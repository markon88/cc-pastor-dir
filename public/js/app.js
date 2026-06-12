import { savePastors, getPastors, getStoredVersion, saveVersion, saveAmaGroups, getAmaGroups, saveChurchAddresses, getChurchAddresses } from './db.js';
import { DATA_VERSION } from './data-version.js';
import { VERSION as APP_VERSION } from './version.js';
import { initPastorsView, renderPastorsView } from './pastors.js';
import { buildChurchList, renderChurchesView, getChurchByName } from './churches.js';
import { initAmaView, renderAmaView, renderAmaGroupDetail } from './ama.js';
import { renderPastorDetail, renderChurchDetail } from './detail.js';
import { renderSupportView } from './support.js';
import { renderAdminView } from './admin.js';


// ── State ────────────────────────────────────────────────────────────────────
let activeTab = 'pastors';
let pastors = [];
let amaGroups = [];
let detailStack = [];
let currentUser = null;

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

  initPastorsView(pastors);
  buildChurchList(pastors, data.churchAddresses);
  initAmaView(amaGroups, pastors);

  setupTabs();
  renderTab('pastors');
  checkForUpdates();
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
    const [stored, storedAma, storedChurches] = await Promise.all([
      getPastors(),
      getAmaGroups(),
      getChurchAddresses(),
    ]);
    if (stored?.length > 0 && storedAma && storedChurches) {
      return { pastors: stored, amaGroups: storedAma, churchAddresses: storedChurches };
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
      saveVersion(data.version).catch(() => {}),
    ]);
    return data;
  } catch {
    return null;
  }
}

// ── Silent background update ──────────────────────────────────────────────────
async function checkForUpdates() {
  try {
    const stored = await getStoredVersion();
    if (DATA_VERSION === stored) return;

    const dataRes = await fetch('/api/data', { cache: 'no-store' });
    if (!dataRes.ok) return;
    const data = await dataRes.json();
    await Promise.all([
      savePastors(data.pastors).catch(() => {}),
      saveAmaGroups(data.amaGroups).catch(() => {}),
      saveChurchAddresses(data.churchAddresses).catch(() => {}),
      saveVersion(DATA_VERSION).catch(() => {}),
    ]);
    pastors   = data.pastors;
    amaGroups = data.amaGroups;
    initPastorsView(pastors);
    buildChurchList(pastors, data.churchAddresses);
    initAmaView(amaGroups, pastors);
    if (detailStack.length === 0) renderTab(activeTab);
  } catch {
    // Offline — fail silently
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
  } else if (tab === 'support') {
    renderSupportView(mainContent, currentUser);
  } else if (tab === 'admin') {
    renderAdminView(mainContent);
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
}

function showChurchDetail(name) {
  const church = getChurchByName(name);
  detailStack.push({ type: 'church', name });
  renderChurchDetail(mainContent, church, id => showPastorDetail(id), goBack);
}

function showAmaGroupDetail(groupId) {
  detailStack.push({ type: 'ama-group', id: groupId });
  renderAmaGroupDetail(mainContent, groupId, id => showPastorDetail(id), goBack);
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
}

// ── Start ─────────────────────────────────────────────────────────────────────
init();
