let allGroups = [];
let allPastors = [];

export function initAmaView(groups, pastors) {
  allGroups = groups;
  allPastors = pastors;
}

export function renderAmaView(container, onSelectGroup) {
  if (allGroups.length === 0) {
    container.innerHTML = `
      <div class="list-header">
        <div class="view-title">AMA Groups</div>
      </div>
      <div class="empty-state" style="margin-top:48px;">
        <p>AMA group assignments coming soon.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="list-header">
      <div class="view-title">AMA Groups</div>
    </div>
    <div id="ama-list" class="item-list"></div>
  `;

  const listEl = container.querySelector('#ama-list');
  listEl.innerHTML = allGroups.map(g => {
    const count = g.pastorIds.length;
    return `
      <div class="list-item" data-id="${g.id}">
        <div class="item-name">${escHtml(g.name)}</div>
        <div class="item-sub">${count} pastor${count !== 1 ? 's' : ''}</div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.list-item').forEach(el => {
    el.addEventListener('click', () => onSelectGroup(el.dataset.id));
  });
}

export function renderAmaGroupDetail(container, groupId, onSelectPastor, onBack) {
  const group = allGroups.find(g => g.id === groupId);
  if (!group) { container.innerHTML = '<div class="empty-state">Group not found</div>'; return; }

  const pastors = group.pastorIds
    .map(id => allPastors.find(p => p.id === id))
    .filter(Boolean)
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  const emails = pastors.filter(p => p.email).map(p => p.email);
  const mobiles = pastors
    .map(p => p.phones.find(ph => ph.mobile))
    .filter(Boolean)
    .map(ph => ph.number);

  container.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" id="ama-back">← Back</button>
      <h2 class="detail-title">${escHtml(group.name)}</h2>
    </div>
    <div class="group-actions">
      ${emails.length ? `<a href="mailto:${emails.join(',')}" class="action-btn action-email">Group Email</a>` : ''}
      ${mobiles.length ? `<a href="sms:${mobiles.map(m=>'+1'+m).join('&')}" class="action-btn action-text">Group Text</a>` : ''}
    </div>
    <div class="item-list" id="ama-pastor-list">
      ${pastors.map(p => `
        <div class="list-item" data-id="${p.id}">
          <div class="item-name">${escHtml(p.displayName)}</div>
          <div class="item-sub">${escHtml((p.churches || [])[0] || '')}</div>
        </div>
      `).join('')}
    </div>
  `;

  container.querySelector('#ama-back').addEventListener('click', onBack);
  container.querySelectorAll('#ama-pastor-list .list-item').forEach(el => {
    el.addEventListener('click', () => onSelectPastor(el.dataset.id));
  });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
