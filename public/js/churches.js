import { searchChurches } from './search.js';
import { CHURCH_ADDRESSES } from './church_data.js';

let allChurches = [];
let searchQuery = '';

export function buildChurchList(pastors) {
  const map = new Map();
  pastors.forEach(p => {
    (p.churches || []).forEach(name => {
      if (!map.has(name)) map.set(name, { name, pastors: [] });
      map.get(name).pastors.push(p);
    });
  });
  allChurches = Array.from(map.values())
    .map(c => ({ ...c, address: CHURCH_ADDRESSES[c.name] || null }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return allChurches;
}

export function renderChurchesView(container, onSelect) {
  container.innerHTML = `
    <div class="list-header">
      <input type="search" id="church-search" class="search-input" placeholder="Search churches or pastor names…" autocomplete="off" value="${escHtml(searchQuery)}">
    </div>
    <div id="church-list" class="item-list"></div>
  `;

  const searchEl = container.querySelector('#church-search');
  const listEl = container.querySelector('#church-list');

  searchEl.addEventListener('input', e => {
    searchQuery = e.target.value;
    renderList(listEl, onSelect);
  });

  renderList(listEl, onSelect);
  searchEl.focus();
}

function renderList(listEl, onSelect) {
  const filtered = searchChurches(allChurches, searchQuery);

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No churches found</div>';
    return;
  }

  listEl.innerHTML = filtered.map(c => {
    const pastorNames = c.pastors.map(p => p.displayName).join(', ');
    const location = c.address ? `${c.address.city}, ${c.address.state}` : '';
    return `
      <div class="list-item" data-name="${escHtml(c.name)}">
        <div class="item-name">${escHtml(c.name)}</div>
        <div class="item-sub">${location ? `<span class="item-location">${escHtml(location)}</span> · ` : ''}${escHtml(pastorNames)}</div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.list-item').forEach(el => {
    el.addEventListener('click', () => onSelect(el.dataset.name));
  });
}

export function getChurchByName(name) {
  return allChurches.find(c => c.name === name) || null;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
