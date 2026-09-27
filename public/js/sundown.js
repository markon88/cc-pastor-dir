import { getChurchByName } from './churches.js';

// ── Sundown Calendar ─────────────────────────────────────────────────────────
// On-demand, one-page-per-church PDF of every Sabbath in a year: Friday
// sundown (Sabbath begins), Sabbath sundown (Sabbath ends), and that week's
// conference offering. Sunset is computed here from each church's lat/long
// (NOAA solar calculator algorithm, standard -0.833° refraction-corrected
// horizon); offerings and coordinates come from /api/sundown/data.

// Every church in the directory is in NC/SC, so one fixed zone — Intl
// handles the Daylight Saving Time switch for us.
const TIME_ZONE = 'America/New_York';

const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;

function solarParams(t) {
  const l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const c = Math.sin(rad(m)) * (1.914602 - t * (0.004817 + 0.000014 * t))
          + Math.sin(rad(2 * m)) * (0.019993 - 0.000101 * t)
          + Math.sin(rad(3 * m)) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const lambda = l0 + c - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  const obliquity = 23 + (26 + seconds / 60) / 60 + 0.00256 * Math.cos(rad(omega));
  const declination = deg(Math.asin(Math.sin(rad(obliquity)) * Math.sin(rad(lambda))));

  const y = Math.tan(rad(obliquity) / 2) ** 2;
  const eqTime = 4 * deg(
    y * Math.sin(2 * rad(l0))
    - 2 * e * Math.sin(rad(m))
    + 4 * e * y * Math.sin(rad(m)) * Math.cos(2 * rad(l0))
    - 0.5 * y * y * Math.sin(4 * rad(l0))
    - 1.25 * e * e * Math.sin(2 * rad(m))
  );
  return { declination, eqTime };
}

// Minutes after 00:00 UTC on the given calendar date (may exceed 1440 —
// east-coast sunsets land after midnight UTC).
function sunsetMinutesUTC(jd, lat, lng) {
  const { declination, eqTime } = solarParams((jd - 2451545) / 36525);
  const hourAngle = Math.acos(
    Math.cos(rad(90.833)) / (Math.cos(rad(lat)) * Math.cos(rad(declination)))
    - Math.tan(rad(lat)) * Math.tan(rad(declination))
  );
  return 720 - 4 * (lng - deg(hourAngle)) - eqTime;
}

// `date` is a JS Date at UTC midnight of the calendar day. Returns the
// sunset instant.
export function sunset(date, lat, lng) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  // Second pass re-evaluates the sun's position at the first-pass sunset time.
  const refined = sunsetMinutesUTC(jd + sunsetMinutesUTC(jd, lat, lng) / 1440, lat, lng);
  return new Date(date.getTime() + Math.round(refined) * 60000);
}

const fmtTime = d => d.toLocaleTimeString('en-US', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit' });
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function sabbathsOf(year) {
  const d = new Date(Date.UTC(year, 0, 1));
  d.setUTCDate(1 + ((6 - d.getUTCDay() + 7) % 7));
  const out = [];
  while (d.getUTCFullYear() === year) {
    out.push(new Date(d));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

const isoDate = d => d.toISOString().slice(0, 10);

// First date in `year` on which the Eastern UTC offset differs from the day
// before — i.e. when DST starts and ends — for the calendar footnote.
function dstChanges(year) {
  const offset = d => new Date(d.getTime() + 12 * 3600000)
    .toLocaleString('en-US', { timeZone: TIME_ZONE, timeZoneName: 'short' }).slice(-3);
  const out = [];
  const d = new Date(Date.UTC(year, 0, 1));
  let prev = offset(d);
  while (d.getUTCFullYear() === year) {
    d.setUTCDate(d.getUTCDate() + 1);
    const cur = offset(d);
    if (cur !== prev) out.push({ date: new Date(d), toDst: cur === 'EDT' });
    prev = cur;
  }
  return out;
}

// ── PDF drawing ──────────────────────────────────────────────────────────────
const PRIMARY = [26, 82, 118];     // --primary #1a5276
const PRIMARY_LIGHT = [214, 234, 248];
const TEXT = [26, 26, 46];
const SUB = [93, 109, 126];
const ZEBRA = [244, 246, 249];

// `pages`: [{ church, coords: {lat, lng, approx} }]. Exported with the
// jsPDF constructor injected so it can be exercised outside the browser.
export function buildSundownPdf(JsPDF, { year, offerings, pages }) {
  const doc = new JsPDF({ unit: 'pt', format: 'letter' });
  const W = 612, H = 792, M = 36;
  const hasOfferings = Object.keys(offerings).length > 0;
  const sabbaths = sabbathsOf(year);
  const dst = dstChanges(year);
  const shortDate = d => d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric' });

  pages.forEach(({ church, coords }, pageIndex) => {
    if (pageIndex > 0) doc.addPage();

    // Header band
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 0, W, 92, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    // jsPDF's align:'center' ignores charSpace, so center it by hand.
    const kicker = `${year} SUNDOWN CALENDAR${hasOfferings ? ' & OFFERING SCHEDULE' : ''}`;
    const kickerW = doc.getTextWidth(kicker) + (kicker.length - 1) * 1;
    doc.text(kicker, (W - kickerW) / 2, 30, { charSpace: 1 });
    doc.setFontSize(fitFont(doc, church.name, W - 2 * M, 22, 14));
    doc.text(church.name, W / 2, 58, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const addr = church.address;
    const addrLine = addr ? [addr.street, [addr.city, addr.state].filter(Boolean).join(', ')].filter(Boolean).join('  ·  ') : '';
    const pastorLine = church.pastors?.length ? `Pastor${church.pastors.length > 1 ? 's' : ''} ${church.pastors.map(p => p.displayName).join(' & ')}` : '';
    doc.text([addrLine, pastorLine].filter(Boolean).join('   |   '), W / 2, 77, { align: 'center' });

    // Explainer
    doc.setTextColor(...SUB);
    doc.setFontSize(9);
    doc.text('The Sabbath begins at sundown Friday and ends at sundown Saturday evening.', W / 2, 112, { align: 'center' });

    // Two columns: Jan–Jun | Jul–Dec
    const top = 126, gap = 18;
    const colW = (W - 2 * M - gap) / 2;
    const cols = hasOfferings
      ? [{ key: 'date', w: 28 }, { key: 'fri', w: 60 }, { key: 'sat', w: 60 }, { key: 'offering', w: colW - 148 }]
      : [{ key: 'date', w: 50 }, { key: 'fri', w: (colW - 50) / 2 }, { key: 'sat', w: (colW - 50) / 2 }];
    const headers = { date: ['Date', ''], fri: ['Sabbath Begins', 'Friday sundown'], sat: ['Sabbath Ends', 'Sabbath sundown'], offering: ['Offering', ''] };

    const rowH = 16.5, monthH = 17;
    [[0, 6], [6, 12]].forEach(([fromMonth, toMonth], colIndex) => {
      const x0 = M + colIndex * (colW + gap);
      let y = top;

      // Column headings
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...SUB);
      let x = x0;
      for (const c of cols) {
        const [l1, l2] = headers[c.key];
        const alignX = c.key === 'fri' || c.key === 'sat' ? x + c.w / 2 : x + 4;
        const align = c.key === 'fri' || c.key === 'sat' ? 'center' : 'left';
        doc.text(l1, alignX, y + 8, { align });
        if (l2) {
          doc.setFont('helvetica', 'normal');
          doc.text(l2, alignX, y + 17, { align });
          doc.setFont('helvetica', 'bold');
        }
        x += c.w;
      }
      y += 22;
      doc.setDrawColor(...PRIMARY);
      doc.setLineWidth(1);
      doc.line(x0, y, x0 + colW, y);

      for (let month = fromMonth; month < toMonth; month++) {
        doc.setFillColor(...PRIMARY_LIGHT);
        doc.rect(x0, y, colW, monthH, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...PRIMARY);
        doc.text(MONTHS[month].toUpperCase(), x0 + 4, y + 11.5, { charSpace: 0.8 });
        y += monthH;

        sabbaths.filter(s => s.getUTCMonth() === month).forEach((sab, i) => {
          if (i % 2 === 1) {
            doc.setFillColor(...ZEBRA);
            doc.rect(x0, y, colW, rowH, 'F');
          }
          const fri = new Date(sab.getTime() - 86400000);
          const offering = offerings[isoDate(sab)] ?? '';
          const cells = {
            date: String(sab.getUTCDate()),
            fri: fmtTime(sunset(fri, coords.lat, coords.lng)),
            sat: fmtTime(sunset(sab, coords.lat, coords.lng)),
            offering: offering || '—',
          };
          const baseline = y + 11.5;
          let cx = x0;
          for (const c of cols) {
            const text = cells[c.key];
            doc.setTextColor(...TEXT);
            if (c.key === 'date') {
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(9.5);
              doc.text(text, cx + 4, baseline);
            } else if (c.key === 'offering') {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(fitFont(doc, text, c.w - 6, 8.5, 6.5));
              if (!offering) doc.setTextColor(...SUB);
              doc.text(text, cx + 4, baseline);
            } else {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(9.5);
              doc.text(text, cx + c.w / 2, baseline, { align: 'center' });
            }
            cx += c.w;
          }
          y += rowH;
        });
      }
      doc.setDrawColor(...PRIMARY);
      doc.line(x0, y, x0 + colW, y);
    });

    // Footer notes
    let fy = H - 64;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...SUB);
    const notes = [];
    notes.push(`Sundown times calculated for ${addr?.city ? `${addr.city}, ${addr.state}` : 'this church'}${coords.approx ? ' (approximate church location)' : ''} and adjusted for Daylight Saving Time${dst.length === 2 ? ` (${shortDate(dst[0].date)} – ${shortDate(dst[1].date)})` : ''}.`);
    if (!hasOfferings) notes.push(`The ${year} conference offering schedule has not been published yet — regenerate once it is available.`);
    for (const n of notes) { doc.text(n, W / 2, fy, { align: 'center' }); fy += 11; }

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...PRIMARY);
    doc.text('"From even unto even, shall ye celebrate your sabbath."  — Leviticus 23:32', W / 2, H - 32, { align: 'center' });
  });

  return doc;
}

// Largest font size (stepping down from `max`) at which `text` fits `width`.
function fitFont(doc, text, width, max, min) {
  let size = max;
  while (size > min && doc.getStringUnitWidth(text) * size > width) size -= 0.5;
  return size;
}

// ── jsPDF loader ─────────────────────────────────────────────────────────────
// ~360 KB, so it's only fetched the first time someone generates a calendar
// rather than precached with the app shell.
let jsPdfPromise = null;
function loadJsPdf() {
  jsPdfPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/js/vendor/jspdf.umd.min.js';
    s.onload = () => resolve(window.jspdf.jsPDF);
    s.onerror = () => { jsPdfPromise = null; reject(new Error('Could not load PDF library')); };
    document.head.appendChild(s);
  });
  return jsPdfPromise;
}

async function generate(year, churchNames) {
  const [JsPDF, res] = await Promise.all([
    loadJsPdf(),
    fetch(`/api/sundown/data?year=${year}`, { cache: 'no-store' }),
  ]);
  if (!res.ok) throw new Error('Could not load sundown data');
  const data = await res.json();

  const pages = [];
  const skipped = [];
  for (const name of churchNames) {
    const church = getChurchByName(name);
    const coords = data.churches[name];
    if (church && coords) pages.push({ church, coords });
    else skipped.push(name);
  }
  if (!pages.length) throw new Error('No location on file for this church');

  const doc = buildSundownPdf(JsPDF, { year, offerings: data.offerings, pages });
  return { blob: doc.output('blob'), skipped, hasOfferings: Object.keys(data.offerings).length > 0 };
}

// ── UI ───────────────────────────────────────────────────────────────────────
// Appends a "Sundown Calendar" section to a detail page. Generating is a
// separate tap from Share/Download so the share sheet still has the user
// gesture it requires (it's lost across the network fetch on iOS).
export function renderSundownSection(parent, { churchNames, fileLabel, description }) {
  if (!churchNames?.length) return;
  const thisYear = new Date().getFullYear();
  const years = [thisYear, thisYear + 1];

  const section = document.createElement('div');
  section.className = 'detail-section sundown-section';
  section.innerHTML = `
    <div class="detail-label">Sundown Calendar</div>
    <div class="item-sub sundown-desc">${escHtml(description)}</div>
    <div class="sundown-years">
      ${years.map(y => `<button type="button" class="support-btn support-btn-alt" data-year="${y}">${y}</button>`).join('')}
    </div>
    <div class="sundown-result hidden">
      <div class="item-sub sundown-status"></div>
      <div class="sundown-years">
        <button type="button" class="support-btn sundown-share hidden">Share</button>
        <button type="button" class="support-btn sundown-download">Download PDF</button>
      </div>
    </div>
  `;
  parent.appendChild(section);

  const result = section.querySelector('.sundown-result');
  const status = section.querySelector('.sundown-status');
  const shareBtn = section.querySelector('.sundown-share');
  const downloadBtn = section.querySelector('.sundown-download');
  let file = null;

  section.querySelectorAll('[data-year]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const year = Number(btn.dataset.year);
      section.querySelectorAll('[data-year]').forEach(b => { b.disabled = true; });
      result.classList.remove('hidden');
      shareBtn.classList.add('hidden');
      downloadBtn.classList.add('hidden');
      status.textContent = `Generating ${year} calendar…`;
      try {
        const { blob, skipped, hasOfferings } = await generate(year, churchNames);
        file = new File([blob], `${year} Sundown Calendar - ${fileLabel}.pdf`, { type: 'application/pdf' });
        const notes = [`${year} calendar ready.`];
        if (!hasOfferings) notes.push(`The ${year} offering schedule isn't available yet, so only sundown times are included.`);
        if (skipped.length) notes.push(`Skipped (no location on file): ${skipped.join(', ')}.`);
        status.textContent = notes.join(' ');
        shareBtn.classList.toggle('hidden', !(navigator.canShare?.({ files: [file] }) && navigator.maxTouchPoints > 0));
        downloadBtn.classList.remove('hidden');
      } catch (err) {
        status.textContent = `${err.message}. Please try again.`;
      } finally {
        section.querySelectorAll('[data-year]').forEach(b => { b.disabled = false; });
      }
    });
  });

  shareBtn.addEventListener('click', () => {
    if (file) navigator.share({ files: [file], title: file.name.replace(/\.pdf$/, '') }).catch(() => {});
  });

  downloadBtn.addEventListener('click', () => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  });
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
