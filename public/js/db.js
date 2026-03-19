const DB_NAME = 'pastor-directory';
const DB_VERSION = 1;
const STORE_NAME = 'pastors';
const META_STORE = 'meta';

let db = null;

export async function openDB() {
  if (db) return db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        d.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains(META_STORE)) {
        d.createObjectStore(META_STORE);
      }
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror = e => reject(e.target.error);
  });
}

export async function savePastors(pastors) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    pastors.forEach(p => store.put(p));
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

export async function getPastors() {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

export async function getStoredVersion() {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).get('version');
    req.onsuccess = e => resolve(e.target.result || null);
    req.onerror = e => reject(e.target.error);
  });
}

export async function saveVersion(version) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).put(version, 'version');
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}
