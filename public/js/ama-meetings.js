// ── Feature flag — set to false to disable the entire module ─────────────────
export const AMA_MEETINGS_ENABLED = true;

// Schedule data is served via /api/data (auth-protected) and passed in via initSchedule().
// Group names must match ama_groups.name values in D1.
// Types: 'local' | 'ministerial' | 'administration' | 'holiday'
let SCHEDULE = [];
export function initSchedule(data) { SCHEDULE = data ?? []; }

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

// ── Group schedule helpers ────────────────────────────────────────────────────

export function getMeetingsForGroup(groupName) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return SCHEDULE
    .filter(m => m.group === groupName && parseLocalDate(m.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function downloadGroupIcs(groupName, meetings) {
  const events = meetings.map(m => {
    const dt = m.date.replace(/-/g, '');
    const next = parseLocalDate(m.date);
    next.setDate(next.getDate() + 1);
    const dtEnd = [
      next.getFullYear(),
      String(next.getMonth() + 1).padStart(2, '0'),
      String(next.getDate()).padStart(2, '0'),
    ].join('');
    const required = REQUIRED_TYPES.has(m.type) ? ' (Required)' : '';
    return [
      'BEGIN:VEVENT',
      `UID:${m.id}@carolinasda.org`,
      `DTSTART;VALUE=DATE:${dt}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:AMA Meeting – ${m.group}${required}`,
      `DESCRIPTION:${TYPE_LABELS[m.type]} AMA Meeting`,
      'END:VEVENT',
    ].join('\r\n');
  });

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CC Pastors//AMA Schedule//EN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `AMA-${groupName.replace(/\s+/g, '-')}-schedule.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Banner notification ───────────────────────────────────────────────────────

export function checkAmaBanner(bannersEl, currentUser, pastors) {
  if (!AMA_MEETINGS_ENABLED || !bannersEl || !currentUser?.email) return;

  const lookupEmail = (currentUser.directoryEmail ?? currentUser.email).toLowerCase();
  const pastor = pastors.find(p => p.email?.toLowerCase() === lookupEmail);
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
