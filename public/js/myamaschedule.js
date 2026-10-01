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

// Lets a pastor pick which AMA they participate in (near a boundary, living
// closer to another AMA, or serving churches in more than one). Saved as a
// personal preference on the server — never passed on to their successor.
function renderPreferenceCard(myPastor, amaGroups) {
  const fromChurches = myPastor.amaGroupFromChurches ?? [];
  const isPref = !!myPastor.amaGroupIsPreference;
  const current = isPref ? myPastor.amaGroup?.[0] : null;
  const churchLabel = fromChurches.length ? fromChurches.join(' & ') : 'none assigned';

  return `
    <div class="meetings-section ama-pref-card">
      <div class="meetings-header">AMA I Participate In</div>
      <div style="padding:8px 16px 14px;">
        <select id="ama-pref-select" class="search-input" style="width:100%;font-size:16px;">
          <option value="" ${!isPref ? 'selected' : ''}>My churches' AMA (${esc(churchLabel)})</option>
          ${amaGroups.map(g => `<option value="${esc(g.id)}" ${current === g.name ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}
        </select>
        <div style="font-size:13px;color:var(--text-sub);margin-top:8px;">
          Your churches are assigned to ${esc(churchLabel)}. If you take part in a different AMA, choose it here — this is just for you and won't carry over to the next pastor at your churches. Choosing is optional. When you choose, the conference office is notified so they can keep you updated on any schedule changes affecting the AMA you choose.
        </div>
        <div id="ama-pref-save-wrap" class="hidden" style="margin-top:10px;">
          <textarea id="ama-pref-note" class="search-input" rows="2" maxlength="1000" placeholder="Reason (optional) — e.g. I live closer to this AMA" style="width:100%;font-size:16px;resize:vertical;"></textarea>
          <button id="ama-pref-save" class="action-btn action-email" style="width:100%;margin-top:8px;">Save</button>
        </div>
        <div id="ama-pref-status" style="font-size:13px;margin-top:6px;"></div>
      </div>
    </div>
  `;
}

export function renderMyAmaScheduleView(container, myPastor, amaGroups = [], onPreferenceSaved) {
  const groups = myPastor?.amaGroup?.length ? myPastor.amaGroup : [];

  container.innerHTML = `
    <div class="list-header">
      <div class="view-title">My AMA Schedule</div>
    </div>
    ${myPastor && amaGroups.length ? renderPreferenceCard(myPastor, amaGroups) : ''}
    ${groups.length
      ? groups.map(renderGroupSection).join('')
      : '<div class="empty-state">You\'re not currently assigned to an AMA group. Contact the conference office if this looks wrong.</div>'
    }
  `;

  const select = container.querySelector('#ama-pref-select');
  if (select) {
    const saveWrap = container.querySelector('#ama-pref-save-wrap');
    const noteEl   = container.querySelector('#ama-pref-note');
    const saveBtn  = container.querySelector('#ama-pref-save');
    const status   = container.querySelector('#ama-pref-status');
    const initial  = select.value;

    // Changing the dropdown only reveals the optional note + Save — nothing is
    // saved (or emailed) until the pastor confirms.
    select.addEventListener('change', () => {
      saveWrap.classList.toggle('hidden', select.value === initial);
      status.textContent = '';
    });

    saveBtn.addEventListener('click', async () => {
      select.disabled = saveBtn.disabled = noteEl.disabled = true;
      status.style.color = 'var(--text-sub)';
      status.textContent = 'Saving…';
      try {
        const res = await fetch('/api/ama-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId: select.value || null, note: noteEl.value }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Save failed');
        status.textContent = 'Saved';
        await onPreferenceSaved?.();
      } catch (err) {
        select.disabled = saveBtn.disabled = noteEl.disabled = false;
        status.style.color = 'var(--red)';
        status.textContent = navigator.onLine ? `Couldn't save: ${err.message}` : "You're offline — try again when connected.";
      }
    });
  }

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
