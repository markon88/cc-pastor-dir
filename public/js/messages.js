// Messages tab — role-gated bulk email to pastors + uploaded contact lists,
// sent as Resend Broadcasts (see functions/_lib/messages.js).
//
// Views: Messages (drafts + history) · Lists · Compose (one draft) · List
// detail. Everything is rendered into the main content container.

let container = null;
let role = null;          // 'sender' | 'editor'
let view = 'messages';    // top-level segment: 'messages' | 'lists'

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr.replace(' ', 'T') + 'Z').toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

async function api(path, opts = {}) {
  const res = await fetch(`/api/messages${path}`, {
    cache: 'no-store',
    ...opts,
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const STATUS_LABEL = {
  draft: 'Draft',
  importing: 'Sending…',
  sending: 'Sending…',
  sent: 'Sent',
  failed: 'Failed',
};

export function renderMessagesView(el, messagesRole) {
  container = el;
  role = messagesRole;
  renderTop();
}

// ── Top level ────────────────────────────────────────────────────────────────
function renderTop() {
  container.innerHTML = `
    <div class="list-header">
      <div class="view-title">Messages</div>
      <div class="sort-toggle">
        <button type="button" class="sort-btn ${view === 'messages' ? 'active' : ''}" data-msg-view="messages">Messages</button>
        <button type="button" class="sort-btn ${view === 'lists' ? 'active' : ''}" data-msg-view="lists">Lists</button>
      </div>
    </div>
    <div class="support-body" id="msg-body"><p class="support-section-desc">Loading…</p></div>
  `;
  container.querySelectorAll('[data-msg-view]').forEach(b => b.addEventListener('click', () => {
    view = b.dataset.msgView;
    renderTop();
  }));
  if (view === 'messages') loadMessages();
  else loadLists();
}

async function loadMessages() {
  const body = document.getElementById('msg-body');
  let data;
  try {
    data = await api('/campaigns');
  } catch (err) {
    body.innerHTML = `<p class="support-section-desc" style="color:var(--red)">${esc(err.message)}</p>`;
    return;
  }
  const drafts = data.campaigns.filter(c => c.status === 'draft' || c.status === 'failed');
  const sent = data.campaigns.filter(c => !(c.status === 'draft' || c.status === 'failed'));

  const row = c => `
    <div class="list-item" data-campaign="${c.id}">
      <div class="item-name">${esc(c.subject || '(no subject)')}</div>
      <div class="item-sub">
        <span class="msg-status msg-status-${esc(c.status)}">${STATUS_LABEL[c.status] ?? esc(c.status)}</span>
        ${c.status === 'sent' || c.status === 'importing' || c.status === 'sending'
          ? `${c.recipient_count ?? 0} recipients · ${esc(fmtDate(c.sent_at || c.updated_at))} · by ${esc(c.sent_by ?? '')}`
          : `Last edited ${esc(fmtDate(c.updated_at))} by ${esc(c.updated_by ?? '')}`}
      </div>
    </div>`;

  body.innerHTML = `
    <div class="detail-cta-row"><button type="button" class="support-btn" id="msg-new">New Message</button></div>
    ${role === 'editor' ? '<p class="support-section-desc">You can write and save drafts. Someone with send permission will review and send them.</p>' : ''}
    <div class="support-section" style="gap:0;">
      <div class="support-section-title">Drafts</div>
      ${drafts.length ? drafts.map(row).join('') : '<p class="support-section-desc" style="margin-top:6px;">No drafts.</p>'}
    </div>
    <div class="support-section" style="gap:0;">
      <div class="support-section-title">Sent</div>
      ${sent.length ? sent.map(row).join('') : '<p class="support-section-desc" style="margin-top:6px;">Nothing sent yet.</p>'}
    </div>
  `;

  document.getElementById('msg-new').addEventListener('click', async () => {
    const btn = document.getElementById('msg-new');
    btn.disabled = true;
    try {
      const { id } = await api('/campaigns', {
        method: 'POST',
        body: { from_name: data.defaults.from_name ?? '', reply_to: data.defaults.reply_to ?? '', audience: [] },
      });
      openCompose(id);
    } catch (err) {
      btn.disabled = false;
      alert(err.message);
    }
  });
  body.querySelectorAll('[data-campaign]').forEach(el =>
    el.addEventListener('click', () => openCompose(Number(el.dataset.campaign))));
}

// ── Compose ──────────────────────────────────────────────────────────────────
async function openCompose(id) {
  container.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" id="msg-back">← Back</button>
      <h2 class="detail-title">Message</h2>
    </div>
    <div class="support-body" id="msg-compose"><p class="support-section-desc">Loading…</p></div>
  `;
  document.getElementById('msg-back').addEventListener('click', () => { view = 'messages'; renderTop(); });

  let c, lists;
  try {
    [c, lists] = await Promise.all([api(`/campaigns/${id}`), api('/lists')]);
  } catch (err) {
    document.getElementById('msg-compose').innerHTML = `<p class="support-section-desc" style="color:var(--red)">${esc(err.message)}</p>`;
    return;
  }

  const editable = c.status === 'draft' || c.status === 'failed';
  if (!editable) return renderSentMessage(c, lists);

  const audienceOptions = [
    { value: 'pastors', label: 'All active pastors', count: lists.pastorCount },
    ...lists.lists.map(l => ({ value: l.id, label: l.name, count: l.contact_count })),
  ];

  const wrap = document.getElementById('msg-compose');
  wrap.innerHTML = `
    ${c.status === 'failed' ? `<div class="msg-error-box">The last send attempt failed: ${esc(c.error ?? 'unknown error')}. Fix anything needed and try again.</div>` : ''}

    <div class="support-section">
      <div class="support-section-title">To</div>
      <div class="msg-audience">
        ${audienceOptions.map(o => `
          <label class="msg-check">
            <input type="checkbox" value="${o.value}" ${c.audience.includes(o.value) ? 'checked' : ''}>
            <span>${esc(o.label)} <span class="item-sub">(${o.count})</span></span>
          </label>`).join('')}
      </div>
      <p class="support-section-desc" style="margin-top:0;">Someone on more than one list gets one copy. Manage lists on the Lists tab.</p>
    </div>

    <div class="support-section">
      <div class="support-section-title">From</div>
      <input type="text" id="msg-from" class="search-input" placeholder="e.g. Jane Smith, Department Director" value="${esc(c.from_name ?? '')}">
      <p class="support-section-desc" style="margin-top:0;">Shown as the sender name. The address is messages@mail.churchtoolbox.app.</p>
      <input type="email" id="msg-replyto" class="search-input" placeholder="Replies go to (email)" value="${esc(c.reply_to ?? '')}">
    </div>

    <div class="support-section">
      <div class="support-section-title">Subject</div>
      <input type="text" id="msg-subject" class="search-input" maxlength="200" value="${esc(c.subject)}">
    </div>

    <div class="support-section">
      <div class="support-section-title">Message</div>
      <div class="msg-merge-row">
        <span class="item-sub">Insert:</span>
        <button type="button" class="msg-chip" data-merge="first_name">First name</button>
        <button type="button" class="msg-chip" data-merge="last_name">Last name</button>
        <button type="button" class="msg-chip" data-merge="organization">Church / School</button>
      </div>
      <textarea id="msg-body-input" class="feedback-textarea msg-textarea" rows="14" placeholder="Dear {{first_name}},&#10;&#10;…">${esc(c.body)}</textarea>
      <p class="support-section-desc" style="margin-top:-8px;">Leave a blank line between paragraphs. Wrap text in **double asterisks** for bold. Links are clickable automatically. An unsubscribe link is added at the bottom.</p>
    </div>

    <p id="msg-save-state" class="support-section-desc" style="min-height:1em;"></p>

    <div class="msg-actions">
      <button type="button" class="support-btn support-btn-alt" id="msg-preview">Preview</button>
      <button type="button" class="support-btn support-btn-alt" id="msg-test">Send Test to Me</button>
    </div>
    ${role === 'sender' ? '<div class="detail-cta-row"><button type="button" class="support-btn" id="msg-send">Send…</button></div>' : ''}
    <div class="detail-cta-row"><button type="button" class="admin-delete-btn" id="msg-delete" style="width:100%;padding:12px;">Delete Draft</button></div>

    <div id="msg-preview-area"></div>
  `;

  const $ = s => document.getElementById(s);
  const textarea = $('msg-body-input');
  const saveState = $('msg-save-state');

  const collect = () => ({
    subject: $('msg-subject').value,
    body: textarea.value,
    from_name: $('msg-from').value,
    reply_to: $('msg-replyto').value,
    audience: [...wrap.querySelectorAll('.msg-audience input:checked')].map(i => i.value === 'pastors' ? 'pastors' : Number(i.value)),
  });

  let saveTimer = null;
  let lastSaved = JSON.stringify(collect());
  const save = async () => {
    clearTimeout(saveTimer);
    const payload = collect();
    const snapshot = JSON.stringify(payload);
    if (snapshot === lastSaved) return true;
    saveState.textContent = 'Saving…';
    try {
      await api(`/campaigns/${id}`, { method: 'PUT', body: payload });
      lastSaved = snapshot;
      saveState.textContent = 'Draft saved.';
      return true;
    } catch (err) {
      saveState.textContent = `Couldn't save: ${err.message}`;
      return false;
    }
  };
  const scheduleSave = () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 1200); };
  wrap.addEventListener('input', scheduleSave);
  wrap.addEventListener('change', scheduleSave);
  $('msg-back').addEventListener('click', () => { save(); }, { capture: true });

  wrap.querySelectorAll('[data-merge]').forEach(b => b.addEventListener('click', () => {
    const tag = `{{${b.dataset.merge}}}`;
    const { selectionStart: s, selectionEnd: e, value } = textarea;
    textarea.value = value.slice(0, s) + tag + value.slice(e);
    textarea.focus();
    textarea.setSelectionRange(s + tag.length, s + tag.length);
    scheduleSave();
  }));

  $('msg-preview').addEventListener('click', async () => {
    if (!(await save())) return;
    showPreview(id, $('msg-preview-area'));
  });

  $('msg-test').addEventListener('click', async () => {
    const btn = $('msg-test');
    if (!(await save())) return;
    btn.disabled = true;
    try {
      const r = await api(`/campaigns/${id}/test`, { method: 'POST' });
      alert(`Test sent to ${r.to}${r.sampleName ? `, filled in as ${r.sampleName}` : ''}.`);
    } catch (err) {
      alert(`Test failed: ${err.message}`);
    }
    btn.disabled = false;
  });

  $('msg-delete').addEventListener('click', async () => {
    if (!confirm('Delete this draft?')) return;
    try {
      await api(`/campaigns/${id}`, { method: 'DELETE' });
      view = 'messages';
      renderTop();
    } catch (err) {
      alert(err.message);
    }
  });

  $('msg-send')?.addEventListener('click', async () => {
    if (!(await save())) return;
    const p = collect();
    if (!p.subject.trim() || !p.body.trim()) return alert('Add a subject and a message first.');
    if (!p.audience.length) return alert('Choose at least one list under “To”.');
    let preview;
    try {
      preview = await api(`/campaigns/${id}/preview`);
    } catch (err) {
      return alert(err.message);
    }
    if (!preview.recipientCount) return alert('None of the selected lists has anyone with a valid email address.');
    if (!confirm(`Send “${p.subject}” to ${preview.recipientCount} people now?\n\nThis can't be undone.`)) return;

    const btn = $('msg-send');
    btn.disabled = true;
    btn.textContent = 'Uploading recipients…';
    try {
      await api(`/campaigns/${id}/send`, { method: 'POST' });
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Send…';
      return alert(`Couldn't send: ${err.message}`);
    }
    pollStatus(id, btn);
  });
}

async function pollStatus(id, btn) {
  for (let i = 0; i < 90; i++) {           // ~3 minutes
    await new Promise(r => setTimeout(r, 2000));
    let s;
    try { s = await api(`/campaigns/${id}/status`); } catch { continue; }
    if (s.status === 'sent') {
      alert(`Sent to ${s.recipientCount} people.`);
      view = 'messages';
      return renderTop();
    }
    if (s.status === 'failed') {
      alert(`Sending failed: ${s.error ?? 'unknown error'}`);
      return openCompose(id);
    }
    if (btn) btn.textContent = 'Sending…';
  }
  alert('Still working on it — check the Sent list in a few minutes.');
  view = 'messages';
  renderTop();
}

async function showPreview(id, area, asEmail) {
  area.innerHTML = '<p class="support-section-desc">Loading preview…</p>';
  let p;
  try {
    p = await api(`/campaigns/${id}/preview${asEmail ? `?as=${encodeURIComponent(asEmail)}` : ''}`);
  } catch (err) {
    area.innerHTML = `<p class="support-section-desc" style="color:var(--red)">${esc(err.message)}</p>`;
    return;
  }
  area.innerHTML = `
    <div class="support-section">
      <div class="support-section-title">Preview — ${p.recipientCount} recipient${p.recipientCount === 1 ? '' : 's'}</div>
      ${p.recipients.length ? `
        <select class="search-input" id="msg-preview-as">
          ${p.recipients.map(r => `<option value="${esc(r.email)}" ${r.email === p.sample.email ? 'selected' : ''}>${esc(r.name || r.email)}${r.organization ? ` — ${esc(r.organization)}` : ''}</option>`).join('')}
        </select>` : '<p class="support-section-desc">No recipients selected yet — showing sample data.</p>'}
      <div class="item-sub"><strong>Subject:</strong> ${esc(p.subject)}</div>
      <iframe class="msg-preview-frame" title="Email preview" sandbox=""></iframe>
    </div>
  `;
  area.querySelector('iframe').srcdoc = p.html;
  area.querySelector('#msg-preview-as')?.addEventListener('change', e => showPreview(id, area, e.target.value));
  area.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderSentMessage(c, lists) {
  const names = c.audience.map(a => a === 'pastors' ? 'All active pastors'
    : (lists.lists.find(l => l.id === a)?.name ?? '(deleted list)'));
  const wrap = document.getElementById('msg-compose');
  wrap.innerHTML = `
    <div class="support-section">
      <div class="item-name">${esc(c.subject)}</div>
      <div class="item-sub"><span class="msg-status msg-status-${esc(c.status)}">${STATUS_LABEL[c.status] ?? esc(c.status)}</span>
        ${c.recipient_count ?? 0} recipients · ${esc(fmtDate(c.sent_at || c.updated_at))} · by ${esc(c.sent_by ?? '')}</div>
      <div class="item-sub"><strong>To:</strong> ${esc(names.join(', '))}</div>
      <div class="item-sub"><strong>From:</strong> ${esc(c.from_name ?? '')}${c.reply_to ? ` · replies to ${esc(c.reply_to)}` : ''}</div>
    </div>
    <div class="detail-cta-row"><button type="button" class="support-btn support-btn-alt" id="msg-duplicate">Use as a New Draft</button></div>
    <div id="msg-preview-area"></div>
  `;
  showPreview(c.id, document.getElementById('msg-preview-area'));
  document.getElementById('msg-duplicate').addEventListener('click', async () => {
    try {
      const { id } = await api('/campaigns', {
        method: 'POST',
        body: { subject: c.subject, body: c.body, from_name: c.from_name, reply_to: c.reply_to, audience: c.audience },
      });
      openCompose(id);
    } catch (err) {
      alert(err.message);
    }
  });
}

// ── Lists ────────────────────────────────────────────────────────────────────
async function loadLists() {
  const body = document.getElementById('msg-body');
  let data;
  try {
    data = await api('/lists');
  } catch (err) {
    body.innerHTML = `<p class="support-section-desc" style="color:var(--red)">${esc(err.message)}</p>`;
    return;
  }
  body.innerHTML = `
    <div class="support-section">
      <div class="support-section-title">New list</div>
      <div class="admin-add-row">
        <input type="text" id="msg-list-name" class="search-input" placeholder="e.g. Teachers, ACS Directors">
        <button type="button" class="support-btn" id="msg-list-add">Create</button>
      </div>
    </div>
    <div class="support-section" style="gap:0;">
      <div class="support-section-title">Lists</div>
      <div class="list-item" style="cursor:default;">
        <div class="item-name">All active pastors</div>
        <div class="item-sub">${data.pastorCount} people · Kept up to date automatically from the directory</div>
      </div>
      ${data.lists.map(l => `
        <div class="list-item" data-list="${l.id}">
          <div class="item-name">${esc(l.name)}</div>
          <div class="item-sub">${l.contact_count} ${l.contact_count === 1 ? 'person' : 'people'}</div>
        </div>`).join('')}
    </div>
  `;
  const add = async () => {
    const name = document.getElementById('msg-list-name').value.trim();
    if (!name) return;
    try {
      const { id } = await api('/lists', { method: 'POST', body: { name } });
      openList(id);
    } catch (err) {
      alert(err.message);
    }
  };
  document.getElementById('msg-list-add').addEventListener('click', add);
  document.getElementById('msg-list-name').addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  body.querySelectorAll('[data-list]').forEach(el => el.addEventListener('click', () => openList(Number(el.dataset.list))));
}

async function openList(id) {
  container.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" id="msg-back">← Back</button>
      <h2 class="detail-title" id="msg-list-title">List</h2>
    </div>
    <div class="support-body" id="msg-list"><p class="support-section-desc">Loading…</p></div>
  `;
  document.getElementById('msg-back').addEventListener('click', () => { view = 'lists'; renderTop(); });

  let list;
  try {
    list = await api(`/lists/${id}`);
  } catch (err) {
    document.getElementById('msg-list').innerHTML = `<p class="support-section-desc" style="color:var(--red)">${esc(err.message)}</p>`;
    return;
  }
  document.getElementById('msg-list-title').textContent = list.name;

  const wrap = document.getElementById('msg-list');
  wrap.innerHTML = `
    <div class="support-section">
      <div class="support-section-title">Add one person</div>
      <div class="admin-add-row">
        <input type="text" id="mc-first" class="search-input" placeholder="First name">
        <input type="text" id="mc-last" class="search-input" placeholder="Last name">
      </div>
      <input type="email" id="mc-email" class="search-input" placeholder="Email">
      <div class="admin-add-row">
        <input type="text" id="mc-org" class="search-input" placeholder="Church or school (optional)">
        <button type="button" class="support-btn" id="mc-add">Add</button>
      </div>
    </div>

    <div class="support-section">
      <div class="support-section-title">Upload a spreadsheet (CSV)</div>
      <p class="support-section-desc">Save the spreadsheet as CSV with a header row. Recognized columns: <strong>Email</strong> (required), <strong>First Name</strong>, <strong>Last Name</strong>, and <strong>Church</strong>, <strong>School</strong>, or <strong>Organization</strong>. People already on the list are updated, not duplicated.</p>
      <input type="file" id="mc-file" accept=".csv,text/csv" class="search-input">
      <label class="msg-check"><input type="checkbox" id="mc-replace"> <span>Replace the whole list with this file (removes anyone not in it)</span></label>
      <div class="detail-cta-row"><button type="button" class="support-btn support-btn-alt" id="mc-upload">Upload</button></div>
      <p id="mc-upload-result" class="support-section-desc"></p>
    </div>

    <div class="support-section" style="gap:0;">
      <div class="support-section-title">${list.contacts.length} ${list.contacts.length === 1 ? 'person' : 'people'}</div>
      ${list.contacts.length ? `<input type="search" id="mc-filter" class="search-input" placeholder="Filter…" style="margin:8px 0;">` : ''}
      <div id="mc-rows">
        ${list.contacts.map(c => `
          <div class="admin-email-row" data-row="${esc(`${c.first_name} ${c.last_name} ${c.email} ${c.organization}`.toLowerCase())}">
            <div class="admin-email-info">
              <div class="item-name">${esc(`${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.email)}</div>
              <div class="item-sub">${esc(c.email)}${c.organization ? ` · ${esc(c.organization)}` : ''}</div>
            </div>
            <div class="admin-email-actions"><button type="button" class="admin-delete-btn" data-remove="${c.id}">Remove</button></div>
          </div>`).join('')}
      </div>
    </div>

    <div class="support-section">
      <div class="support-section-title">List settings</div>
      <div class="admin-add-row">
        <input type="text" id="mc-rename" class="search-input" value="${esc(list.name)}">
        <button type="button" class="support-btn support-btn-alt" id="mc-rename-btn">Rename</button>
      </div>
      <div class="detail-cta-row"><button type="button" class="admin-delete-btn" id="mc-delete" style="width:100%;padding:12px;">Delete This List</button></div>
    </div>
  `;

  const $ = s => document.getElementById(s);

  $('mc-add').addEventListener('click', async () => {
    const contact = { first_name: $('mc-first').value, last_name: $('mc-last').value, email: $('mc-email').value, organization: $('mc-org').value };
    if (!contact.email.includes('@')) return alert('Enter an email address.');
    try {
      const r = await api(`/lists/${id}/contacts`, { method: 'POST', body: { contacts: [contact] } });
      if (!r.saved) return alert('That email address doesn’t look valid.');
      openList(id);
    } catch (err) {
      alert(err.message);
    }
  });

  $('mc-upload').addEventListener('click', async () => {
    const file = $('mc-file').files[0];
    const out = $('mc-upload-result');
    if (!file) return alert('Choose a CSV file first.');
    let contacts;
    try {
      contacts = parseContactsCsv(await file.text());
    } catch (err) {
      out.textContent = err.message;
      out.style.color = 'var(--red)';
      return;
    }
    const replace = $('mc-replace').checked;
    if (replace && !confirm(`Replace all ${list.contacts.length} people on “${list.name}” with the ${contacts.length} rows in this file?`)) return;
    try {
      const r = await api(`/lists/${id}/contacts`, { method: 'POST', body: { contacts, replace } });
      await openList(id);
      const result = document.getElementById('mc-upload-result');
      result.style.color = '';
      result.textContent = `Saved ${r.saved} ${r.saved === 1 ? 'person' : 'people'}.` +
        (r.skipped.length ? ` Skipped ${r.skipped.length} row${r.skipped.length === 1 ? '' : 's'} without a valid email${r.skipped.filter(Boolean).length ? `: ${r.skipped.filter(Boolean).slice(0, 10).join(', ')}` : ''}.` : '');
    } catch (err) {
      out.textContent = err.message;
      out.style.color = 'var(--red)';
    }
  });

  $('mc-filter')?.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    wrap.querySelectorAll('[data-row]').forEach(r => { r.style.display = !q || r.dataset.row.includes(q) ? '' : 'none'; });
  });

  wrap.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', async () => {
    b.disabled = true;
    try {
      await api(`/lists/${id}/contacts?contactId=${b.dataset.remove}`, { method: 'DELETE' });
      b.closest('.admin-email-row').remove();
    } catch (err) {
      b.disabled = false;
      alert(err.message);
    }
  }));

  $('mc-rename-btn').addEventListener('click', async () => {
    try {
      await api(`/lists/${id}`, { method: 'PATCH', body: { name: $('mc-rename').value } });
      openList(id);
    } catch (err) {
      alert(err.message);
    }
  });

  $('mc-delete').addEventListener('click', async () => {
    if (!confirm(`Delete “${list.name}” and its ${list.contacts.length} people? Messages already sent aren't affected.`)) return;
    try {
      await api(`/lists/${id}`, { method: 'DELETE' });
      view = 'lists';
      renderTop();
    } catch (err) {
      alert(err.message);
    }
  });
}

// ── CSV parsing ──────────────────────────────────────────────────────────────
// Handles quoted fields, embedded commas/quotes/newlines, and a BOM. Header
// names are matched loosely ("First Name", "first_name", "FirstName").
function parseCsvRows(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

const HEADER_MAP = {
  email: 'email', emailaddress: 'email', 'e-mail': 'email',
  firstname: 'first_name', first: 'first_name', givenname: 'first_name',
  lastname: 'last_name', last: 'last_name', surname: 'last_name', familyname: 'last_name',
  organization: 'organization', organisation: 'organization', church: 'organization',
  school: 'organization', churchname: 'organization', schoolname: 'organization',
};

function parseContactsCsv(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) throw new Error('The file needs a header row and at least one person.');
  const keys = rows[0].map(h => HEADER_MAP[h.trim().toLowerCase().replace(/[\s_]/g, '')] ?? null);
  if (!keys.includes('email')) throw new Error('Couldn’t find an “Email” column in the header row.');
  return rows.slice(1).map(r => {
    const c = {};
    keys.forEach((k, i) => { if (k && !c[k]) c[k] = (r[i] ?? '').trim(); });
    return c;
  });
}
