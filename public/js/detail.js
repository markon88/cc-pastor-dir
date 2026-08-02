import { generateVCard } from './contacts.js';

export function renderPastorDetail(container, pastor, onBack, onSelectChurch, onSelectAmaGroup) {
  if (!pastor) { container.innerHTML = '<div class="empty-state">Pastor not found</div>'; return; }

  const addr = pastor.address || {};
  const hasAddr = addr.street || addr.city;
  const addrDisplay = hasAddr
    ? `${addr.street ? addr.street + '<br>' : ''}${addr.city}${addr.city && addr.state ? ', ' : ''}${addr.state} ${addr.zip}`
    : '';

  // eAdventist sometimes stores the same number twice (e.g. a "family phone"
  // fallback that happens to match the cell), occasionally with different
  // formatting (dashes vs none) — collapse duplicates by digits only,
  // preferring the mobile-flagged copy so the "mobile" tag still shows.
  const phonesByDigits = new Map();
  for (const p of pastor.phones) {
    const digits = p.number.replace(/\D/g, '');
    const existing = phonesByDigits.get(digits);
    if (!existing || (p.mobile && !existing.mobile)) phonesByDigits.set(digits, p);
  }
  const allPhones = [...phonesByDigits.values()];
  const mobile = allPhones.find(p => p.mobile);

  container.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" id="detail-back">← Back</button>
    </div>
    <div class="detail-body">
      <h2 class="detail-name">${escHtml(pastor.displayName)}</h2>

      ${pastor.churches && pastor.churches.length ? `
        <div class="detail-section">
          <div class="detail-label">Church${pastor.churches.length > 1 ? 'es' : ''}</div>
          ${pastor.churches.map(c => `<div class="detail-value church-link" data-name="${escHtml(c)}" style="cursor:pointer;color:var(--primary);">${escHtml(c)}</div>`).join('')}
        </div>
      ` : ''}

      ${hasAddr ? `
        <div class="detail-section">
          <div class="detail-label">Address</div>
          <div class="detail-value" id="pastor-addr" style="cursor:pointer;">${addrDisplay}
            <div class="church-directions-hint">Tap for directions</div>
          </div>
        </div>
      ` : ''}

      ${allPhones.length ? `
        <div class="detail-section">
          <div class="detail-label">Phone${allPhones.length > 1 ? 's' : ''}</div>
          ${allPhones.map(ph => `<div class="detail-value"><a href="tel:+1${ph.number}" class="phone-link">${formatPhone(ph.number)}</a>${ph.mobile ? ' <span class="tag">mobile</span>' : ''}</div>`).join('')}
        </div>
      ` : ''}

      ${pastor.email ? `
        <div class="detail-section">
          <div class="detail-label">Email</div>
          <div class="detail-value"><a href="mailto:${escHtml(pastor.email)}" class="email-link">${escHtml(pastor.email)}</a></div>
        </div>
      ` : ''}

      ${pastor.birthday ? `
        <div class="detail-section">
          <div class="detail-label">Birthday</div>
          <div class="detail-value">${escHtml(pastor.birthday)}</div>
        </div>
      ` : ''}

      ${pastor.amaGroup && pastor.amaGroup.length ? `
        <div class="detail-section">
          <div class="detail-label">AMA Group</div>
          ${pastor.amaGroup.map(g => `<div class="detail-value ama-group-link" data-group="${escHtml(g)}" style="cursor:pointer;color:var(--primary);">${escHtml(g)}</div>`).join('')}
        </div>
      ` : ''}
    </div>

    <div class="action-bar">
      ${mobile ? `<a href="tel:+1${mobile.number}" class="action-btn action-call">Call</a>` : ''}
      ${mobile ? `<a href="sms:+1${mobile.number}" class="action-btn action-text">Text</a>` : ''}
      ${pastor.email ? `<a href="mailto:${escHtml(pastor.email)}" class="action-btn action-email">Email</a>` : ''}
      <button class="action-btn action-contact" id="add-contact-btn">+ Contact</button>
    </div>
  `;

  container.querySelector('#detail-back').addEventListener('click', onBack);
  container.querySelector('#add-contact-btn').addEventListener('click', () => generateVCard(pastor));
  if (hasAddr) {
    container.querySelector('#pastor-addr').addEventListener('click', () => openMaps(addr));
  }
  if (onSelectChurch) {
    container.querySelectorAll('.church-link').forEach(el => {
      el.addEventListener('click', () => onSelectChurch(el.dataset.name));
    });
  }
  if (onSelectAmaGroup) {
    container.querySelectorAll('.ama-group-link').forEach(el => {
      el.addEventListener('click', () => onSelectAmaGroup(el.dataset.group));
    });
  }
}

export function renderChurchDetail(container, church, onSelectPastor, onBack, onSelectVolunteer) {
  if (!church) { container.innerHTML = '<div class="empty-state">Church not found</div>'; return; }

  const addr = church.address;
  let addrHtml = '';
  if (addr) {
    addrHtml = `
      <div class="detail-section">
        <div class="detail-label">Address</div>
        <div class="church-address-link" id="church-addr" style="cursor:pointer;">
          <div class="church-address-street">${escHtml(addr.street)}</div>
          <div class="church-address-city">${escHtml(addr.city)}, ${escHtml(addr.state)} ${escHtml(addr.zip)}</div>
          ${addr.county ? `<div class="church-address-county">${escHtml(addr.county)} County</div>` : ''}
          <div class="church-directions-hint">Tap for directions</div>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" id="church-detail-back">← Back</button>
    </div>
    <div class="detail-body">
      <h2 class="detail-name">${escHtml(church.name)}</h2>
      ${addrHtml}
      ${church.membership != null ? `
        <div class="detail-section">
          <div class="detail-label">Membership</div>
          <div class="detail-value">${church.membership}</div>
        </div>
      ` : ''}
      <div class="detail-section">
        <div class="detail-label">Pastor${church.pastors.length > 1 ? 's' : ''}</div>
        ${church.pastors.length
          ? church.pastors.map(p => `
              <div class="detail-value pastor-link" data-id="${p.id}" style="cursor:pointer;color:var(--primary);">
                ${escHtml(p.displayName)}
              </div>
            `).join('')
          : '<div class="detail-value" style="color:var(--text-secondary)">Vacant</div>'
        }
      </div>
      ${church.volunteers && church.volunteers.length ? `
        <div class="detail-section">
          <div class="detail-label">VLP / VLL (per eAdventist, unverified)</div>
          ${church.volunteers.map(v => `
            <div class="detail-value volunteer-link" data-id="${escHtml(v.id)}" style="cursor:pointer;color:var(--primary);">${escHtml(v.displayName)} <span class="tag tag-volunteer">${escHtml(v.officeName)}</span></div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;

  container.querySelector('#church-detail-back').addEventListener('click', onBack);
  if (addr) {
    container.querySelector('#church-addr').addEventListener('click', () => openMaps(addr));
  }
  container.querySelectorAll('.pastor-link').forEach(el => {
    el.addEventListener('click', () => onSelectPastor(el.dataset.id));
  });
  if (onSelectVolunteer) {
    container.querySelectorAll('.volunteer-link').forEach(el => {
      el.addEventListener('click', () => onSelectVolunteer(el.dataset.id));
    });
  }
}

export function renderVolunteerDetail(container, volunteer, onBack, onSelectChurch) {
  if (!volunteer) { container.innerHTML = '<div class="empty-state">Volunteer not found</div>'; return; }

  container.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" id="volunteer-detail-back">← Back</button>
    </div>
    <div class="detail-body">
      <h2 class="detail-name">${escHtml(volunteer.displayName)}</h2>

      <div class="detail-section">
        <div class="detail-label">Role (per eAdventist, unverified)</div>
        <div class="detail-value"><span class="tag tag-volunteer">${escHtml(volunteer.officeName)}</span></div>
      </div>

      <div class="detail-section">
        <div class="detail-label">Church</div>
        <div class="detail-value church-link" data-name="${escHtml(volunteer.church)}" style="cursor:pointer;color:var(--primary);">${escHtml(volunteer.church)}</div>
      </div>

      ${volunteer.phone ? `
        <div class="detail-section">
          <div class="detail-label">Phone</div>
          <div class="detail-value"><a href="tel:+1${volunteer.phone}" class="phone-link">${formatPhone(volunteer.phone)}</a></div>
        </div>
      ` : ''}

      ${volunteer.email ? `
        <div class="detail-section">
          <div class="detail-label">Email</div>
          <div class="detail-value"><a href="mailto:${escHtml(volunteer.email)}" class="email-link">${escHtml(volunteer.email)}</a></div>
        </div>
      ` : ''}

      <div class="banner banner-update volunteer-disclaimer">
        This reflects data currently on file with eAdventist, for verification purposes only — it is not confirmed.
        Please consult the local pastor and conference leadership to confirm current actual status. Corrections must
        be made by the conference clerk (Kristina McFeeters).
      </div>
    </div>

    <div class="action-bar">
      ${volunteer.phone ? `<a href="tel:+1${volunteer.phone}" class="action-btn action-call">Call</a>` : ''}
      ${volunteer.phone ? `<a href="sms:+1${volunteer.phone}" class="action-btn action-text">Text</a>` : ''}
      ${volunteer.email ? `<a href="mailto:${escHtml(volunteer.email)}" class="action-btn action-email">Email</a>` : ''}
    </div>
  `;

  container.querySelector('#volunteer-detail-back').addEventListener('click', onBack);
  if (onSelectChurch) {
    container.querySelector('.church-link').addEventListener('click', () => onSelectChurch(volunteer.church));
  }
}

function openMaps(addr) {
  const query = encodeURIComponent(`${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`);
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  window.location.href = isIOS ? `maps://?daddr=${query}` : `geo:0,0?q=${query}`;
}

function formatPhone(num) {
  if (!num || num.length !== 10) return num;
  return `(${num.slice(0,3)}) ${num.slice(3,6)}-${num.slice(6)}`;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
