let allVolunteers = [];
let searchQuery = '';

export function initVolunteersView(volunteers) {
  allVolunteers = [...volunteers].sort((a, b) =>
    a.church.localeCompare(b.church) || a.displayName.localeCompare(b.displayName)
  );
}

export function getVolunteerById(id) {
  return allVolunteers.find(v => v.id === id) || null;
}

export function renderVolunteersView(container, onSelectVolunteer) {
  container.innerHTML = `
    <div class="list-header">
      <input type="search" id="volunteer-search" class="search-input" placeholder="Search VLPs/VLLs or churches…" autocomplete="off" value="${escHtml(searchQuery)}">
    </div>
    <div class="banner banner-update volunteer-disclaimer">
      This list reflects data currently on file with eAdventist, for verification purposes only — it is not confirmed.
      Please consult the local pastor and conference leadership to confirm current actual status. Corrections must be
      made by the conference clerk (Kristina McFeeters).
    </div>
    <div id="volunteer-list" class="item-list"></div>
  `;

  const searchEl = container.querySelector('#volunteer-search');
  const listEl = container.querySelector('#volunteer-list');

  searchEl.addEventListener('input', e => {
    searchQuery = e.target.value;
    renderList(listEl, onSelectVolunteer);
  });

  renderList(listEl, onSelectVolunteer);
}

function renderList(listEl, onSelectVolunteer) {
  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? allVolunteers.filter(v => `${v.displayName} ${v.church} ${v.officeName}`.toLowerCase().includes(q))
    : allVolunteers;

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No VLPs or VLLs found</div>';
    return;
  }

  listEl.innerHTML = filtered.map(v => `
    <div class="list-item" data-id="${escHtml(v.id)}">
      <div class="item-name">${escHtml(v.displayName)} <span class="tag tag-volunteer">${escHtml(v.officeName)}</span></div>
      <div class="item-sub">${escHtml(v.church)}</div>
    </div>
  `).join('');

  listEl.querySelectorAll('.list-item').forEach(el => {
    el.addEventListener('click', () => onSelectVolunteer(el.dataset.id));
  });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
