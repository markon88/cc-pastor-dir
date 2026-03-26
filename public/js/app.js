import { PASTORS_DATA, AMA_GROUPS, DATA_VERSION } from './data.js';
import { savePastors, getPastors, getStoredVersion, saveVersion } from './db.js';
import { initPastorsView, renderPastorsView } from './pastors.js';
import { buildChurchList, renderChurchesView, getChurchByName } from './churches.js';
import { initAmaView, renderAmaView, renderAmaGroupDetail } from './ama.js';
import { renderPastorDetail, renderChurchDetail } from './detail.js';

// ── State ────────────────────────────────────────────────────────────────────
let activeTab = 'pastors';
let pastors = [];
let detailStack = []; // { type, id } — navigation history

// ── DOM ───────────────────────────────────────────────────────────────────────
const mainContent = document.getElementById('main-content');
const tabs = document.querySelectorAll('.tab-btn');
const updateBanner = document.getElementById('update-banner');

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function init() {
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // Load data — prefer IndexedDB, fall back to embedded
  try {
    const stored = await getPastors();
    if (stored && stored.length > 0) {
      pastors = stored;
    } else {
      throw new Error('empty');
    }
  } catch {
    pastors = PASTORS_DATA;
    await savePastors(pastors).catch(() => {});
  }
  // Always ensure version is stored so update check has a baseline
  const currentVersion = await getStoredVersion().catch(() => null);
  if (!currentVersion) await saveVersion(DATA_VERSION).catch(() => {});

  initPastorsView(pastors);
  buildChurchList(pastors);
  initAmaView(AMA_GROUPS, pastors);

  setupTabs();
  renderTab('pastors');
  checkForUpdates();
}

// ── Version check ─────────────────────────────────────────────────────────────
async function checkForUpdates() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('/api/data-version', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return; // offline or error — fail silently
    const { version } = await res.json();
    const stored = await getStoredVersion();
    if (stored && version !== stored) {
      showUpdateBanner(version);
    }
  } catch {
    // Offline or timeout — fail silently
  }
}

function showUpdateBanner(newVersion) {
  updateBanner.style.display = 'flex';
  document.getElementById('reload-btn').addEventListener('click', async () => {
    await savePastors(PASTORS_DATA).catch(() => {});
    await saveVersion(newVersion).catch(() => {});
    location.reload();
  }, { once: true });
  document.getElementById('dismiss-btn').addEventListener('click', () => {
    updateBanner.style.display = 'none';
  }, { once: true });
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
  }
}

// ── Detail navigation ─────────────────────────────────────────────────────────
function showPastorDetail(id) {
  const pastor = pastors.find(p => p.id === id);
  detailStack.push({ type: 'pastor', id });
  renderPastorDetail(mainContent, pastor, goBack, name => showChurchDetail(name));
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
  detailStack.pop(); // renderXxx will re-push
  if (prev.type === 'pastor') showPastorDetail(prev.id);
  else if (prev.type === 'church') showChurchDetail(prev.name);
  else if (prev.type === 'ama-group') showAmaGroupDetail(prev.id);
}

// ── Start ─────────────────────────────────────────────────────────────────────
init();
