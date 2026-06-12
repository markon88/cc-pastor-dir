// ── Feature flag — set to false to disable the entire module ─────────────────
export const AMA_MEETINGS_ENABLED = true;

// Schedule data read from the 2026 AMA Schedule image.
// VERIFY: dates/types against the official schedule before publishing.
// Group names must match ama_groups.name values in D1.
// Types: 'local' | 'ministerial' | 'administration' | 'holiday'
const SCHEDULE = [
  // ── Blue Ridge ────────────────────────────────────────────────────────────
  { id: 'br-0226', group: 'Blue Ridge', date: '2026-02-26', type: 'local' },
  { id: 'br-0310', group: 'Blue Ridge', date: '2026-03-10', type: 'administration' }, // verify type
  { id: 'br-0423', group: 'Blue Ridge', date: '2026-04-23', type: 'local' },
  { id: 'br-0506', group: 'Blue Ridge', date: '2026-05-06', type: 'administration' },
  { id: 'br-0805', group: 'Blue Ridge', date: '2026-08-05', type: 'ministerial' },
  { id: 'br-0924', group: 'Blue Ridge', date: '2026-09-24', type: 'local' },
  { id: 'br-1022', group: 'Blue Ridge', date: '2026-10-22', type: 'local' },
  { id: 'br-1119', group: 'Blue Ridge', date: '2026-11-19', type: 'local' },

  // ── North Central ─────────────────────────────────────────────────────────
  { id: 'nc-0218', group: 'North Central', date: '2026-02-18', type: 'ministerial' },
  { id: 'nc-0310', group: 'North Central', date: '2026-03-10', type: 'local' },
  { id: 'nc-0430', group: 'North Central', date: '2026-04-30', type: 'administration' },
  { id: 'nc-0609', group: 'North Central', date: '2026-06-09', type: 'local' },
  { id: 'nc-0811', group: 'North Central', date: '2026-08-11', type: 'local' },
  { id: 'nc-0903', group: 'North Central', date: '2026-09-03', type: 'ministerial' },
  { id: 'nc-1013', group: 'North Central', date: '2026-10-13', type: 'local' },
  { id: 'nc-1110', group: 'North Central', date: '2026-11-10', type: 'local' },

  // ── Central Piedmont ────────────────────────────────────────────────────────
  { id: 'np-0204', group: 'Central Piedmont', date: '2026-02-04', type: 'ministerial' },
  { id: 'np-0306', group: 'Central Piedmont', date: '2026-03-06', type: 'ministerial' }, // verify
  { id: 'np-0402', group: 'Central Piedmont', date: '2026-04-02', type: 'administration' },
  { id: 'np-0610', group: 'Central Piedmont', date: '2026-06-10', type: 'local' },
  { id: 'np-0826', group: 'Central Piedmont', date: '2026-08-26', type: 'ministerial' },
  { id: 'np-0909', group: 'Central Piedmont', date: '2026-09-09', type: 'local' },
  { id: 'np-1014', group: 'Central Piedmont', date: '2026-10-14', type: 'local' },
  { id: 'np-1111', group: 'Central Piedmont', date: '2026-11-11', type: 'local' },

  // ── Eastern Carolina ──────────────────────────────────────────────────────
  { id: 'ec-0203', group: 'Eastern Carolina', date: '2026-02-03', type: 'local' },
  { id: 'ec-0407', group: 'Eastern Carolina', date: '2026-04-07', type: 'local' },
  { id: 'ec-0520', group: 'Eastern Carolina', date: '2026-05-20', type: 'ministerial' },
  { id: 'ec-0827', group: 'Eastern Carolina', date: '2026-08-27', type: 'ministerial' },
  { id: 'ec-0915', group: 'Eastern Carolina', date: '2026-09-15', type: 'local' },
  { id: 'ec-1022', group: 'Eastern Carolina', date: '2026-10-22', type: 'local' },
  { id: 'ec-1103', group: 'Eastern Carolina', date: '2026-11-03', type: 'local' },
  { id: 'ec-1129', group: 'Eastern Carolina', date: '2026-11-29', type: 'holiday' },

  // ── Upstate ───────────────────────────────────────────────────────────────
  { id: 'up-0226', group: 'Upstate', date: '2026-02-26', type: 'administration' },
  { id: 'up-0402', group: 'Upstate', date: '2026-04-02', type: 'local' },
  { id: 'up-0507', group: 'Upstate', date: '2026-05-07', type: 'ministerial' },
  { id: 'up-0617', group: 'Upstate', date: '2026-06-17', type: 'local' },
  { id: 'up-0806', group: 'Upstate', date: '2026-08-06', type: 'local' },
  { id: 'up-1008', group: 'Upstate', date: '2026-10-08', type: 'ministerial' },
  { id: 'up-1105', group: 'Upstate', date: '2026-11-05', type: 'local' },

  // ── Palmetto ──────────────────────────────────────────────────────────────
  { id: 'pa-0211', group: 'Palmetto', date: '2026-02-11', type: 'ministerial' },
  { id: 'pa-0423', group: 'Palmetto', date: '2026-04-23', type: 'administration' },
  { id: 'pa-0819', group: 'Palmetto', date: '2026-08-19', type: 'local' },
  { id: 'pa-0916', group: 'Palmetto', date: '2026-09-16', type: 'local' },
  { id: 'pa-1018', group: 'Palmetto', date: '2026-10-18', type: 'local' },
  { id: 'pa-1118', group: 'Palmetto', date: '2026-11-18', type: 'local' },
  { id: 'pa-1214', group: 'Palmetto', date: '2026-12-14', type: 'holiday' },
];

const TYPE_LABELS = {
  ministerial:    'Ministerial',
  administration: 'Administration',
  holiday:        'Holiday Meal',
  local:          'Local',
};

const REQUIRED_TYPES = new Set(['ministerial', 'administration']);

// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function parseLocalDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(isoDate) {
  return parseLocalDate(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysUntil(isoDate) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((parseLocalDate(isoDate) - today) / 86_400_000);
}

function getUpcoming(withinDays) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + withinDays);
  return SCHEDULE
    .filter(m => { const d = parseLocalDate(m.date); return d >= today && d <= cutoff; })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── localStorage dismissal ────────────────────────────────────────────────────

const DISMISSED_KEY = 'ama:dismissed';

function getDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]')); }
  catch { return new Set(); }
}

function dismissMeeting(id) {
  const set = getDismissed();
  set.add(id);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
}

// ── .ics calendar download ────────────────────────────────────────────────────

function downloadIcs(meeting) {
  const dt = meeting.date.replace(/-/g, '');
  const next = parseLocalDate(meeting.date);
  next.setDate(next.getDate() + 1);
  const dtEnd = [
    next.getFullYear(),
    String(next.getMonth() + 1).padStart(2, '0'),
    String(next.getDate()).padStart(2, '0'),
  ].join('');

  const required = REQUIRED_TYPES.has(meeting.type) ? ' (Required)' : '';
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CC Pastors//AMA Schedule//EN',
    'BEGIN:VEVENT',
    `UID:${meeting.id}@carolinasda.org`,
    `DTSTART;VALUE=DATE:${dt}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:AMA Meeting – ${meeting.group}${required}`,
    `DESCRIPTION:${TYPE_LABELS[meeting.type]} AMA Meeting`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `AMA-${meeting.group.replace(/\s+/g, '-')}-${meeting.date}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Banner notification ───────────────────────────────────────────────────────

export function checkAmaBanner(bannersEl, currentUser, pastors) {
  if (!AMA_MEETINGS_ENABLED || !bannersEl || !currentUser?.email) return;

  const pastor = pastors.find(p => p.email?.toLowerCase() === currentUser.email.toLowerCase());
  if (!pastor?.amaGroup?.length) return;

  const myGroups = new Set(pastor.amaGroup);
  const dismissed = getDismissed();

  const meeting = SCHEDULE
    .filter(m => myGroups.has(m.group) && !dismissed.has(m.id))
    .filter(m => { const days = daysUntil(m.date); return days >= 0 && days <= 10; })
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  if (!meeting) return;

  const days = daysUntil(meeting.date);
  const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
  const required = REQUIRED_TYPES.has(meeting.type) ? ' · Required' : '';

  const banner = document.createElement('div');
  banner.className = 'banner banner-ama';
  banner.innerHTML = `
    <span class="banner-text">📅 Your ${escHtml(meeting.group)} AMA meets ${when} — ${escHtml(formatDate(meeting.date))}${escHtml(required)}</span>
    <div class="banner-actions">
      <button class="banner-btn banner-btn-cal" data-id="${escHtml(meeting.id)}">+ Cal</button>
      <button class="banner-btn banner-btn-dismiss" data-id="${escHtml(meeting.id)}">✕</button>
    </div>
  `;

  banner.querySelector('.banner-btn-cal').addEventListener('click', () => downloadIcs(meeting));
  banner.querySelector('.banner-btn-dismiss').addEventListener('click', () => {
    dismissMeeting(meeting.id);
    banner.remove();
  });

  bannersEl.appendChild(banner);
}

// ── Meetings list section ─────────────────────────────────────────────────────

export function renderAmaMeetings(slot) {
  if (!AMA_MEETINGS_ENABLED) return;

  const meetings = getUpcoming(120);
  if (!meetings.length) return;

  const rows = meetings.map(m => {
    const required = REQUIRED_TYPES.has(m.type);
    return `
      <div class="meeting-item">
        <div class="meeting-date">${escHtml(formatDate(m.date))}</div>
        <div class="meeting-info">
          <span class="meeting-group">${escHtml(m.group)}</span>
          <span class="meeting-badge meeting-badge-${m.type}">${escHtml(TYPE_LABELS[m.type])}${required ? ' ★' : ''}</span>
        </div>
        <button class="meeting-cal-btn" data-id="${escHtml(m.id)}" aria-label="Add to calendar">+ Cal</button>
      </div>
    `;
  }).join('');

  slot.innerHTML = `
    <div class="meetings-section">
      <div class="meetings-header">Upcoming AMA Meetings</div>
      <div class="meetings-list">${rows}</div>
    </div>
  `;

  slot.querySelectorAll('.meeting-cal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = SCHEDULE.find(x => x.id === btn.dataset.id);
      if (m) downloadIcs(m);
    });
  });
}
