import { searchPastors } from './search.js';

let allPastors = [];
let sortMode = 'last'; // 'last' | 'first'
let searchQuery = '';

export function initPastorsView(pastors) {
  allPastors = pastors;
}

export function renderPastorsView(container, onSelect) {
  container.innerHTML = `
    <div class="list-header">
      <input type="search" id="pastor-search" class="search-input" placeholder="Search pastors, churches, city…" autocomplete="off" value="${escHtml(searchQuery)}">
      <div class="sort-toggle">
        <button class="sort-btn ${sortMode === 'first' ? 'active' : ''}" data-sort="first">First</button>
        <button class="sort-btn ${sortMode === 'last' ? 'active' : ''}" data-sort="last">Last</button>
      </div>
    </div>
    <div id="pastor-list" class="item-list"></div>
  `;

  const searchEl = container.querySelector('#pastor-search');
  const listEl = container.querySelector('#pastor-list');

  searchEl.addEventListener('input', e => {
    searchQuery = e.target.value;
    renderList(listEl, onSelect);
  });

  container.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sortMode = btn.dataset.sort;
      container.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === sortMode));
      renderList(listEl, onSelect);
    });
  });

  renderList(listEl, onSelect);
  // Focus search on tab switch
  searchEl.focus();
}

function renderList(listEl, onSelect) {
  const filtered = searchPastors(allPastors, searchQuery);
  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'last') {
      return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
    }
    return a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName);
  });

  if (sorted.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No pastors found</div>';
    return;
  }

  listEl.innerHTML = sorted.map(p => {
    const name = sortMode === 'last'
      ? `${p.lastName}, ${p.firstName}`
      : p.displayName;
    const church = p.churches && p.churches.length ? p.churches[0] : '';
    return `
      <div class="list-item" data-id="${p.id}">
        <div class="item-name">${escHtml(name)}</div>
        <div class="item-sub">${escHtml(church)}</div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.list-item').forEach(el => {
    el.addEventListener('click', () => onSelect(el.dataset.id));
  });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
