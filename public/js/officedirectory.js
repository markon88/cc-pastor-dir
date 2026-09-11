// Static data — no eAdventist feed exists for conference office staff or the
// holiday schedule, so this is transcribed from the conference's own PDF/DOCX
// mailings and updated by hand when a new one comes in.
// Source: "Personnel List 9.3.26.pdf" (Laura Andrews, HR) and
// "2027 Holidays - Pastors.12-Month Teachers.NPR.docx" (Laura Andrews, HR).
const PERSONNEL_UPDATED = 'September 3, 2026';

const OFFICE_PERSONNEL = [
  { ext: '',     name: 'Aalborg, Bryan',            dept: 'Assist. Director: Generous Living',                                                              home: '',               cell: '828-777-6729' },
  { ext: '5734', name: 'Alvarez, Paola',            dept: 'Assist. Treasurer',                                                                               home: '704-509-4429',  cell: '704-877-4411' },
  { ext: '5704', name: 'Anderson, Rick',            dept: 'Superintendent: Education',                                                                       home: '',               cell: '704-574-5792' },
  { ext: '5737', name: 'Andrews, Laura',            dept: 'Assist. Director: HR',                                                                             home: '',               cell: '980-867-3825' },
  { ext: '5713', name: 'Arana, Vanessa',            dept: 'Secretary: Youth, Club, Young Adults, Public Campus, Prison Ministries',                           home: '',               cell: '704-406-7039' },
  { ext: '',     name: 'Barker, Larry',             dept: 'Director: Prison Ministries',                                                                      home: '',               cell: '843-568-5932' },
  { ext: '',     name: 'Bates, Eric',               dept: 'Director: Family Ministries',                                                                      home: '828-595-9860',  cell: '334-803-2411' },
  { ext: '',     name: 'Baumgarten, Tim',           dept: 'Assist. Director: Church Revitalization',                                                          home: '',               cell: '803-347-7633' },
  { ext: '5728', name: 'Bentley, Darryl',           dept: 'Assoc. Director: Ministerial',                                                                     home: '',               cell: '248-767-2730' },
  { ext: '5743', name: 'Bentley, Ginger',           dept: 'Admin. Secretary to the President',                                                                home: '',               cell: '989-948-3521' },
  { ext: '5707', name: 'Brooks, Tank',              dept: 'Maintenance, Facilities Coordinator',                                                              home: '',               cell: '704-826-5101' },
  { ext: '5723', name: 'Carpenter, Becky',          dept: 'Director: Communication',                                                                          home: '704-289-5608',  cell: '704-219-4660' },
  { ext: '5731', name: 'Case, Adam',                dept: 'Director: Ministerial',                                                                            home: '',               cell: '920-246-3353' },
  { ext: '5742', name: 'Cauley, Brad',              dept: 'VP of Administration/Executive Secretary; Director: Medical/Dental Recruitment',                   home: '',               cell: '704-774-2800' },
  { ext: '5711', name: 'Cazarine, Cris',            dept: 'Director: Church Planting, Church Revitalization, Young Adults',                                   home: '',               cell: '754-242-3459' },
  { ext: '',     name: 'Flores, Yudith',            dept: "Assist. Director: Children's Ministries for Hispanic Churches",                                   home: '',               cell: '630-715-8042' },
  { ext: '5721', name: 'Garcia, Narcedalia',        dept: 'Secretary: Hispanic Ministries, Church Planting, Church Revitalization; Assistant Conference Clerk', home: '',              cell: '704-779-5664' },
  { ext: '5710', name: 'Gentry, Chana',             dept: "Director: Children's Ministries, Adventist Possibility Ministries",                                home: '',               cell: '980-297-2327' },
  { ext: '5727', name: 'Gerosa, Michele',           dept: 'Secretary: Ministerial, Evangelism',                                                               home: '',               cell: '347-276-9264' },
  { ext: '5723', name: 'Gomes, Henri',              dept: 'Assoc. Director: Communication',                                                                   home: '',               cell: '804-874-9989' },
  { ext: '5714', name: 'Gonzalez, Hector',          dept: 'Director: Youth, Club Ministries',                                                                 home: '',               cell: '828-280-2305' },
  { ext: '1000', name: 'Gonzalez, Lorraine',        dept: 'Receptionist; Secretary: Publishing, Community Services, Disaster Response, Singles Ministries',   home: '',               cell: '828-551-0419' },
  { ext: '',     name: 'Graham, David',             dept: 'Director: Community Services, Disaster Response, Generous Living',                                home: '',               cell: '704-962-6386' },
  { ext: '',     name: 'Grissom, Beth',             dept: "Director: Prayer Ministries, Women's Ministries",                                                  home: '',               cell: '704-408-9350' },
  { ext: '',     name: 'Guenin, Remy',              dept: 'Field Representative: Planned Giving & Trust Services',                                            home: '',               cell: '828-707-0164' },
  { ext: '5703', name: 'Guilfuchi, Yesenia (Jess)', dept: 'Secretary: Education',                                                                              home: '',               cell: '702-635-5610' },
  { ext: '5709', name: 'Haylock, Gwen',             dept: "Secretary: Children's, Sabbath School, Men's, Family, Women's, Prayer, Health Ministries",          home: '',               cell: '704-293-0785' },
  { ext: '5725', name: 'Herod, Courtney',           dept: 'Assoc. Director: Communication',                                                                   home: '704-940-0510',  cell: '423-313-1986' },
  { ext: '5703', name: 'Hodgins, Courtnie',         dept: 'Secretary: Education',                                                                             home: '',               cell: '704-738-7794' },
  { ext: '5748', name: 'Horn, Jeff',                dept: 'Undertreasurer',                                                                                   home: '',               cell: '989-295-3492' },
  { ext: '',     name: 'Hutchinson, Deborah',       dept: 'Assoc. Executive Secretary',                                                                       home: '',               cell: '205-574-0135' },
  { ext: '5722', name: 'Jaeger, Victor',            dept: 'Director: Hispanic Ministries, Church Revitalization; Assoc. Director: Ministerial',               home: '',               cell: '469-475-0777' },
  { ext: '',     name: 'LaPorte, Tony',             dept: "Director: Men's Ministries",                                                                       home: '843-771-9108',  cell: '314-703-8356' },
  { ext: '5708', name: 'Louis, Carole',             dept: 'Director: Ministerial Spouses Association',                                                        home: '704-910-3750',  cell: '704-773-7291' },
  { ext: '5744', name: 'Louis, Leslie',             dept: 'President; Director: ASI, Religious Liberty',                                                       home: '704-910-3750',  cell: '704-773-7261' },
  { ext: '',     name: 'Marsden, Carol',            dept: 'Conference Auditor',                                                                               home: '',               cell: '864-999-1967' },
  { ext: '5732', name: 'McFeeters, Kristina',       dept: 'Secretary: Human Resources; Conference Clerk',                                                     home: '',               cell: '606-310-3717' },
  { ext: '5752', name: 'Morrison, Lance',           dept: 'Director: Publishing',                                                                             home: '',               cell: '704-453-9375' },
  { ext: '5747', name: 'Munoz, Irma',               dept: 'Admin. Secretary: Treasury Department',                                                            home: '',               cell: '704-705-0389' },
  { ext: '5712', name: 'Newlove, John',             dept: 'Assoc. Director: Youth, Club Ministries',                                                          home: '',               cell: '704-207-6363' },
  { ext: '',     name: 'Paulino, Janet',            dept: "Secretary: Women's Ministry Assistant for Hispanic Churches",                                      home: '',               cell: '919-455-6459' },
  { ext: '',     name: 'Perozo, Cesar',             dept: 'Director: Adult Sabbath School',                                                                   home: '',               cell: '781-454-7321' },
  { ext: '',     name: 'Pieretti, Joe',             dept: 'Assist. Director: Church Revitalization',                                                          home: '',               cell: '919-525-5138' },
  { ext: '5729', name: 'Prieto, Angela',            dept: 'Assistant to HR; Loss Control Specialist',                                                         home: '',               cell: '980-208-7807' },
  { ext: '5741', name: 'Quinto, Tayde',             dept: 'Admin. Secretary: Secretariat Department',                                                         home: '',               cell: '828-461-7610' },
  { ext: '',     name: 'Reyes, Karla',              dept: 'Conference Auditor',                                                                               home: '',               cell: '843-696-8923' },
  { ext: '',     name: 'Richardson, Dexter',        dept: 'Director: Health Ministries',                                                                      home: '',               cell: '919-323-1963' },
  { ext: '5738', name: 'Roberts, Ellen',            dept: 'Assoc. Director: HR; Sterling Volunteers Coordinator',                                             home: '',               cell: '586-850-9762' },
  { ext: '5719', name: 'Robinson, Carlton',         dept: 'Director: Planned Giving & Trust Services',                                                        home: '',               cell: '803-237-4665' },
  { ext: '5720', name: 'Robinson, Ingrid',          dept: "Assist. Director: Planned Giving & Trust Services; Secretary: Generous Living",                     home: '',               cell: '803-240-3526' },
  { ext: '',     name: 'Rojas, Eli',                dept: 'Director: Singles Ministries',                                                                     home: '',               cell: '828-974-1499' },
  { ext: '5746', name: 'Russell, Rick',             dept: 'VP of Finance/Treasurer; Director: Property Development',                                          home: '',               cell: '704-641-8345' },
  { ext: '5715', name: 'Sandoval, Elias',           dept: 'Director: Information Services',                                                                   home: '704-941-4244',  cell: '704-806-3918' },
  { ext: '5733', name: 'Sandoval, Norma',           dept: 'Assoc. Treasurer',                                                                                 home: '',               cell: '704-307-1060' },
  { ext: '5702', name: 'Simonds, Cara',             dept: 'Assoc. Superintendent: Education',                                                                 home: '',               cell: '336-529-9099' },
  { ext: '5735', name: 'Sorrells, Rebecca',         dept: 'Assist. Treasurer',                                                                                home: '',               cell: '704-560-6942' },
  { ext: '',     name: 'Vail, Steve',               dept: 'Director: Evangelism and Discipleship; Assoc. Director: Ministerial; Evangelist, Personal Ministries Director', home: '', cell: '734-646-7781' },
  { ext: '5740', name: 'Watson, Chanelle',          dept: 'Director: HR',                                                                                     home: '',               cell: '720-775-4556' },
  { ext: '',     name: 'Weeks, Jeremiah',           dept: 'Director: ShareHim',                                                                               home: 'info@sharehim.org', cell: '678-752-8000' },
  { ext: '5726', name: 'Williams, Haskell',         dept: 'Assoc. Director: Ministerial',                                                                      home: '',               cell: '407-383-7250' },
];

const HOLIDAY_SCHEDULE_2027 = [
  { dates: 'January 4',           name: "New Year's Day",           days: '1 Day' },
  { dates: 'January 18',          name: 'Martin Luther King Jr. Day', days: '1 Day' },
  { dates: 'February 15',         name: "President's Day",          days: '1 Day' },
  { dates: 'June 7',              name: 'Memorial Day',             days: '1 Day' },
  { dates: 'July 5',              name: 'Independence Day',         days: '1 Day' },
  { dates: 'September 6',         name: 'Labor Day',                days: '1 Day' },
  { dates: 'November 25 & 26',    name: 'Admin Day/Thanksgiving',   days: '2 Days' },
  { dates: 'December 23 & 24',    name: 'Christmas',                days: '2 Days' },
];

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function telLink(number) {
  if (!number) return '';
  if (number.includes('@')) return `<a href="mailto:${esc(number)}">${esc(number)}</a>`;
  const digits = number.replace(/[^0-9]/g, '');
  return `<a href="tel:${digits}">${esc(number)}</a>`;
}

// A dept string can carry several roles ("Director: X; Assoc. Director: Y") and each
// role can itself cover several departments ("Director: X, Y, Z") — split on both so a
// person who wears multiple hats shows up under each department, grouped by the
// substance (e.g. "Education") rather than by their differently-worded job title.
function parseDepartments(deptStr) {
  const segments = deptStr.split(';').map(s => s.trim()).filter(Boolean);
  const depts = [];
  for (const seg of segments) {
    const colonIdx = seg.indexOf(':');
    if (colonIdx === -1) {
      depts.push(seg);
    } else {
      seg.slice(colonIdx + 1).split(',').map(s => s.trim()).filter(Boolean).forEach(d => depts.push(d));
    }
  }
  return [...new Set(depts)];
}

const PEOPLE = OFFICE_PERSONNEL.map(p => {
  const [last, first] = p.name.split(/,\s*/);
  return { ...p, last: last ?? p.name, first: first ?? '', departments: parseDepartments(p.dept) };
});

function personItemHtml(p) {
  return `
    <div class="list-item office-personnel-item">
      <div class="item-name">${esc(p.name)}${p.ext ? ` <span class="tag tag-ext">ext. ${esc(p.ext)}</span>` : ''}</div>
      <div class="item-sub">${esc(p.dept)}</div>
      <div class="item-sub office-personnel-phones">
        ${p.home ? `${telLink(p.home)} (office)` : ''}
        ${p.home && p.cell ? ' &middot; ' : ''}
        ${p.cell ? `${telLink(p.cell)} (cell)` : ''}
      </div>
    </div>
  `;
}

function renderPersonnelList(sortMode) {
  if (sortMode === 'department') {
    const groups = new Map();
    for (const p of PEOPLE) {
      for (const d of p.departments) {
        if (!groups.has(d)) groups.set(d, []);
        groups.get(d).push(p);
      }
    }
    const deptNames = [...groups.keys()].sort((a, b) => a.localeCompare(b));
    return deptNames.map(d => {
      const people = groups.get(d).slice().sort((a, b) => a.last.localeCompare(b.last) || a.first.localeCompare(b.first));
      return `
        <div class="office-dept-group">
          <div class="office-dept-heading">${esc(d)}</div>
          <div class="item-list office-personnel-list">${people.map(personItemHtml).join('')}</div>
        </div>
      `;
    }).join('');
  }

  const sorted = PEOPLE.slice().sort((a, b) => sortMode === 'first'
    ? a.first.localeCompare(b.first) || a.last.localeCompare(b.last)
    : a.last.localeCompare(b.last) || a.first.localeCompare(b.first));
  return `<div class="item-list office-personnel-list">${sorted.map(personItemHtml).join('')}</div>`;
}

export function renderOfficeDirectoryView(container) {
  container.innerHTML = `
    <div class="list-header">
      <div class="view-title">Conference Office</div>
    </div>
    <div class="office-address-block">
      <div>2701 East WT Harris Blvd, Charlotte, NC 28213</div>
      <div>PO Box 44270, Charlotte, NC 28215</div>
      <div>Phone: ${telLink('704-596-3200')} &middot; Fax: 704-596-5775</div>
    </div>
    <div class="sort-toggle office-directory-tabs">
      <button class="sort-btn active" data-tab="personnel">Office Directory</button>
      <button class="sort-btn" data-tab="holidays">Holiday Schedule</button>
    </div>
    <div class="support-body">
      <div class="banner banner-update office-directory-disclaimer">
        Transcribed by hand from the conference's personnel and holiday-schedule mailings — not synced automatically.
        If something's out of date, use the "Request an Update" link in Support.
      </div>

      <div id="office-personnel-panel" class="support-section">
        <div class="support-section-title">Office Personnel <span class="office-updated">Updated ${esc(PERSONNEL_UPDATED)}</span></div>
        <div class="sort-toggle sort-toggle-3 office-personnel-sort">
          <button class="sort-btn active" data-sort="last">Last Name</button>
          <button class="sort-btn" data-sort="first">First Name</button>
          <button class="sort-btn" data-sort="department">Department</button>
        </div>
        <div id="office-personnel-list">${renderPersonnelList('last')}</div>
      </div>

      <div id="office-holidays-panel" class="support-section hidden">
        <div class="support-section-title">2027 Office Holiday Schedule</div>
        <p class="support-section-desc">Applies to pastors, 12-month teachers, and Nosoca Pines Ranch staff.</p>
        <table class="office-holiday-table">
          <thead><tr><th>Date(s)</th><th>Holiday</th><th>Days</th></tr></thead>
          <tbody>
            ${HOLIDAY_SCHEDULE_2027.map(h => `
              <tr><td>${esc(h.dates)}</td><td>${esc(h.name)}</td><td>${esc(h.days)}</td></tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const tabs = container.querySelectorAll('.office-directory-tabs .sort-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const showHolidays = btn.dataset.tab === 'holidays';
      container.querySelector('#office-personnel-panel').classList.toggle('hidden', showHolidays);
      container.querySelector('#office-holidays-panel').classList.toggle('hidden', !showHolidays);
    });
  });

  const sortBtns = container.querySelectorAll('.office-personnel-sort .sort-btn');
  const listEl = container.querySelector('#office-personnel-list');
  sortBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sortBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      listEl.innerHTML = renderPersonnelList(btn.dataset.sort);
    });
  });
}
