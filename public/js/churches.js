import { searchChurches } from './search.js';

let allChurches = [];
let searchQuery = '';

export function buildChurchList(pastors, churchAddresses = {}) {
  // Build pastor lookup by church name
  const pastorsByChurch = new Map();
  pastors.forEach(p => {
    (p.churches || []).forEach(name => {
      if (!pastorsByChurch.has(name)) pastorsByChurch.set(name, []);
      pastorsByChurch.get(name).push(p);
    });
  });

  // Start from the full church list, not just pastor assignments
  allChurches = Object.keys(churchAddresses)
    .map(name => ({
      name,
      pastors:    pastorsByChurch.get(name) || [],
      address:    churchAddresses[name] || null,
      membership: churchAddresses[name]?.membership ?? null,
    }))
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
}

function renderList(listEl, onSelect) {
  const filtered = searchChurches(allChurches, searchQuery);

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No churches found</div>';
    return;
  }

  listEl.innerHTML = filtered.map(c => {
    const pastorNames = c.pastors.length ? c.pastors.map(p => p.displayName).join(', ') : 'Vacant';
    const location = c.address ? `${c.address.city}, ${c.address.state}` : '';
    const membershipLine = c.membership != null
      ? `<div class="item-sub">Membership: ${c.membership}</div>`
      : '';
    return `
      <div class="list-item" data-name="${escHtml(c.name)}">
        <div class="item-name">${escHtml(c.name)}</div>
        <div class="item-sub">${location ? `<span class="item-location">${escHtml(location)}</span> · ` : ''}${escHtml(pastorNames)}</div>
        ${membershipLine}
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
