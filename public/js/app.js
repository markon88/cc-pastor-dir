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
const offlineBanner = document.getElementById('offline-banner');

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
    await saveVersion(DATA_VERSION).catch(() => {});
  }

  initPastorsView(pastors);
  buildChurchList(pastors);
  initAmaView(AMA_GROUPS, pastors);

  setupTabs();
  renderTab('pastors');
  checkForUpdates();
  setupOfflineDetection();
}

// ── Version check ─────────────────────────────────────────────────────────────
async function checkForUpdates() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('/api/data-version', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return;
    const { version } = await res.json();
    const stored = await getStoredVersion();
    if (stored && version !== stored) {
      showUpdateBanner();
    } else if (!stored) {
      await saveVersion(DATA_VERSION);
    }
  } catch {
    // Offline or timeout — fail silently
  }
}

function showUpdateBanner() {
  updateBanner.hidden = false;
  updateBanner.querySelector('#reload-btn').addEventListener('click', async () => {
    // Re-seed from embedded data (new deploy will have updated data.js)
    await savePastors(PASTORS_DATA).catch(() => {});
    await saveVersion(DATA_VERSION).catch(() => {});
    location.reload();
  });
  updateBanner.querySelector('#dismiss-btn').addEventListener('click', () => {
    updateBanner.hidden = true;
  });
}

// ── Offline detection ─────────────────────────────────────────────────────────
function setupOfflineDetection() {
  const update = () => { offlineBanner.hidden = navigator.onLine; };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
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
  renderPastorDetail(mainContent, pastor, goBack);
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
