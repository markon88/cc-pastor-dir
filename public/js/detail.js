import { generateVCard } from './contacts.js';

export function renderPastorDetail(container, pastor, onBack) {
  if (!pastor) { container.innerHTML = '<div class="empty-state">Pastor not found</div>'; return; }

  const addr = pastor.address || {};
  const hasAddr = addr.street || addr.city;
  const addrDisplay = hasAddr
    ? `${addr.street ? addr.street + '<br>' : ''}${addr.city}${addr.city && addr.state ? ', ' : ''}${addr.state} ${addr.zip}`
    : '';

  const mobile = pastor.phones.find(p => p.mobile);
  const allPhones = pastor.phones;

  container.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" id="detail-back">← Back</button>
    </div>
    <div class="detail-body">
      <h2 class="detail-name">${escHtml(pastor.displayName)}</h2>

      ${pastor.churches && pastor.churches.length ? `
        <div class="detail-section">
          <div class="detail-label">Church${pastor.churches.length > 1 ? 'es' : ''}</div>
          ${pastor.churches.map(c => `<div class="detail-value">${escHtml(c)}</div>`).join('')}
        </div>
      ` : ''}

      ${hasAddr ? `
        <div class="detail-section">
          <div class="detail-label">Address</div>
          <div class="detail-value">${addrDisplay}</div>
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

      ${pastor.amaGroup ? `
        <div class="detail-section">
          <div class="detail-label">AMA Group</div>
          <div class="detail-value">${escHtml(pastor.amaGroup)}</div>
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
}

export function renderChurchDetail(container, church, onSelectPastor, onBack) {
  if (!church) { container.innerHTML = '<div class="empty-state">Church not found</div>'; return; }

  container.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" id="church-detail-back">← Back</button>
    </div>
    <div class="detail-body">
      <h2 class="detail-name">${escHtml(church.name)}</h2>
      <div class="detail-section">
        <div class="detail-label">Pastor${church.pastors.length > 1 ? 's' : ''}</div>
        ${church.pastors.map(p => `
          <div class="detail-value pastor-link" data-id="${p.id}" style="cursor:pointer;color:var(--primary);">
            ${escHtml(p.displayName)}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  container.querySelector('#church-detail-back').addEventListener('click', onBack);
  container.querySelectorAll('.pastor-link').forEach(el => {
    el.addEventListener('click', () => onSelectPastor(el.dataset.id));
  });
}

function formatPhone(num) {
  if (!num || num.length !== 10) return num;
  return `(${num.slice(0,3)}) ${num.slice(3,6)}-${num.slice(6)}`;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
