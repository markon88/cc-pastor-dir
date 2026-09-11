import { getMeetingsForGroup, downloadGroupIcs } from './ama-meetings.js';

const TYPE_LABELS = {
  ministerial:    'Ministerial',
  administration: 'Administration',
  holiday:        'Holiday Meal',
  local:          'Local',
};
const REQUIRED_TYPES = new Set(['ministerial', 'administration']);

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderGroupSection(groupName) {
  const meetings = getMeetingsForGroup(groupName);

  const rows = meetings.length
    ? meetings.map(m => {
        const required = REQUIRED_TYPES.has(m.type);
        return `
          <div class="meeting-item">
            <div class="meeting-date">${esc(formatDate(m.date))}</div>
            <div class="meeting-info">
              <span class="meeting-badge meeting-badge-${m.type}">${esc(TYPE_LABELS[m.type])}${required ? ' ★' : ''}</span>
            </div>
            <button class="meeting-cal-btn" data-id="${esc(m.id)}" aria-label="Add to calendar">+ Cal</button>
          </div>
        `;
      }).join('')
    : '<div style="padding:16px;color:var(--text-sub);text-align:center;">No upcoming meetings scheduled</div>';

  return `
    <div class="meetings-section" data-group="${esc(groupName)}">
      <div class="meetings-header">${esc(groupName)}</div>
      ${meetings.length ? `
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);">
          <button class="add-all-cal-btn action-btn action-email" data-group="${esc(groupName)}" style="width:100%;">+ Add All ${meetings.length} Meeting${meetings.length !== 1 ? 's' : ''} to Calendar</button>
        </div>
      ` : ''}
      <div class="meetings-list">${rows}</div>
    </div>
  `;
}

export function renderMyAmaScheduleView(container, myPastor) {
  const groups = myPastor?.amaGroup?.length ? myPastor.amaGroup : [];

  container.innerHTML = `
    <div class="list-header">
      <div class="view-title">My AMA Schedule</div>
    </div>
    ${groups.length
      ? groups.map(renderGroupSection).join('')
      : '<div class="empty-state">You\'re not currently assigned to an AMA group. Contact the conference office if this looks wrong.</div>'
    }
  `;

  container.querySelectorAll('.meetings-section').forEach(section => {
    const groupName = section.dataset.group;
    const meetings = getMeetingsForGroup(groupName);

    section.querySelectorAll('.meeting-cal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = meetings.find(x => x.id === btn.dataset.id);
        if (m) downloadGroupIcs(groupName, [m]);
      });
    });

    const addAllBtn = section.querySelector('.add-all-cal-btn');
    if (addAllBtn) {
      addAllBtn.addEventListener('click', () => downloadGroupIcs(groupName, meetings));
    }
  });
}
