import { renderAmaMeetings, getMeetingsForGroup, downloadGroupIcs } from './ama-meetings.js';

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
        <div class="view-title">AMA</div>
      </div>
      <div class="empty-state" style="margin-top:48px;">
        <p>AMA group assignments coming soon.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="list-header">
      <div class="view-title">AMA</div>
      <div class="sort-toggle">
        <button class="sort-btn active" data-panel="groups">Groups</button>
        <button class="sort-btn" data-panel="schedule">Schedule</button>
      </div>
    </div>
    <div id="ama-groups-panel">
      <div id="ama-list" class="item-list"></div>
    </div>
    <div id="ama-schedule-panel" class="hidden">
      <div id="ama-meetings-slot"></div>
    </div>
  `;

  // Tab switching
  const tabs = container.querySelectorAll('.sort-btn[data-panel]');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const showSchedule = btn.dataset.panel === 'schedule';
      container.querySelector('#ama-groups-panel').classList.toggle('hidden', showSchedule);
      container.querySelector('#ama-schedule-panel').classList.toggle('hidden', !showSchedule);
    });
  });

  // Populate groups
  const listEl = container.querySelector('#ama-list');
  listEl.innerHTML = allGroups.map(g => {
    const count = g.pastorIds.length;
    const leader = g.leaderId ? allPastors.find(p => p.id === g.leaderId) : null;
    const sub = leader
      ? `${count} pastor${count !== 1 ? 's' : ''} · Leader: ${escHtml(leader.displayName)}`
      : `${count} pastor${count !== 1 ? 's' : ''}`;
    return `
      <div class="list-item" data-id="${g.id}">
        <div class="item-name">${escHtml(g.name)}</div>
        <div class="item-sub">${sub}</div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.list-item').forEach(el => {
    el.addEventListener('click', () => onSelectGroup(el.dataset.id));
  });

  // Populate schedule (rendered into hidden panel — ready when user taps)
  renderAmaMeetings(container.querySelector('#ama-meetings-slot'));
}

export function renderAmaGroupDetail(container, groupId, onSelectPastor, onBack) {
  const group = allGroups.find(g => g.id === groupId);
  if (!group) { container.innerHTML = '<div class="empty-state">Group not found</div>'; return; }

  const pastors = group.pastorIds
    .map(id => allPastors.find(p => p.id === id))
    .filter(Boolean)
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  const emails = pastors.filter(p => p.email).map(p => p.email);

  const meetings = getMeetingsForGroup(group.name);

  const MEETING_TYPE_LABELS = { ministerial: 'Ministerial', administration: 'Administration', holiday: 'Holiday Meal', local: 'Local' };
  const MEETING_REQUIRED_TYPES = new Set(['ministerial', 'administration']);

  const meetingRows = meetings.length
    ? meetings.map(m => {
        const required = MEETING_REQUIRED_TYPES.has(m.type);
        const [y, mo, d] = m.date.split('-').map(Number);
        const dateStr = new Date(y, mo - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `
          <div class="meeting-item">
            <div class="meeting-date">${escHtml(dateStr)}</div>
            <div class="meeting-info">
              <span class="meeting-badge meeting-badge-${m.type}">${escHtml(MEETING_TYPE_LABELS[m.type])}${required ? ' ★' : ''}</span>
            </div>
            <button class="meeting-cal-btn" data-id="${escHtml(m.id)}" aria-label="Add to calendar">+ Cal</button>
          </div>
        `;
      }).join('')
    : '<div style="padding:24px 16px;color:var(--text-sub);text-align:center;">No upcoming meetings scheduled</div>';

  container.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" id="ama-back">← Back</button>
      <h2 class="detail-title">${escHtml(group.name)}</h2>
    </div>
    <div class="group-actions">
      ${emails.length ? `<a href="mailto:${emails.join(',')}" class="action-btn action-email">Group Email</a>` : ''}
    </div>
    <div class="sort-toggle" style="padding:10px 16px;border-bottom:1px solid var(--border);">
      <button class="sort-btn active" data-tab="members">Members</button>
      <button class="sort-btn" data-tab="schedule">Schedule</button>
    </div>
    <div id="group-members-panel">
      <div class="item-list" id="ama-pastor-list">
        ${pastors.map(p => `
          <div class="list-item" data-id="${p.id}">
            <div class="item-name">
              ${escHtml(p.displayName)}
              ${p.id === group.leaderId ? '<span class="tag" style="margin-left:6px">Leader</span>' : ''}
            </div>
            <div class="item-sub">${escHtml((p.churches || [])[0] || '')}</div>
          </div>
        `).join('')}
      </div>
    </div>
    <div id="group-schedule-panel" class="hidden">
      ${meetings.length ? `
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);">
          <button id="add-all-cal-btn" class="action-btn action-email" style="width:100%;">+ Add All ${meetings.length} Meeting${meetings.length !== 1 ? 's' : ''} to Calendar</button>
        </div>
      ` : ''}
      <div class="meetings-section">
        <div class="meetings-list">${meetingRows}</div>
      </div>
    </div>
  `;

  container.querySelector('#ama-back').addEventListener('click', onBack);

  container.querySelectorAll('#ama-pastor-list .list-item').forEach(el => {
    el.addEventListener('click', () => onSelectPastor(el.dataset.id));
  });

  // Tab switching
  const tabs = container.querySelectorAll('.sort-btn[data-tab]');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const showSchedule = btn.dataset.tab === 'schedule';
      container.querySelector('#group-members-panel').classList.toggle('hidden', showSchedule);
      container.querySelector('#group-schedule-panel').classList.toggle('hidden', !showSchedule);
    });
  });

  // Per-meeting calendar buttons
  container.querySelectorAll('.meeting-cal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = meetings.find(x => x.id === btn.dataset.id);
      if (m) downloadGroupIcs(group.name, [m]);
    });
  });

  // Add all to calendar
  const addAllBtn = container.querySelector('#add-all-cal-btn');
  if (addAllBtn) {
    addAllBtn.addEventListener('click', () => downloadGroupIcs(group.name, meetings));
  }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
