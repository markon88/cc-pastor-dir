import { checkForUpdates } from './app.js';

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderSupportView(container, user) {
  const accountSection = user ? `
    <div class="support-section">
      <div class="support-section-title">Your Account</div>
      <p class="support-section-desc">Signed in as <strong>${esc(user.email)}</strong></p>
      <button id="logout-btn" class="support-btn support-btn-alt">Sign Out</button>
    </div>
  ` : '';

  container.innerHTML = `
    <div class="list-header">
      <div class="view-title">Support</div>
    </div>
    <div class="support-body">

      ${accountSection}

      <p class="support-tagline">A pastor who got left out built something to bring people together.</p>

      <div class="support-section">
        <div class="support-section-title">App Version</div>
        <p class="support-section-desc">Current version: <strong id="app-version">…</strong>. If the directory looks out of date, tap below to pull the latest version.</p>
        <button id="update-app-btn" class="support-btn">Check for Updates</button>
        <a href="/changelog.html" class="support-btn support-btn-alt">What's New</a>
      </div>

      <div class="support-section">
        <div class="support-section-title">Contact the Developer</div>
        <a href="mailto:hellopastormark@gmail.com" class="support-btn">Email Pastor Mark</a>
        <a href="sms:+13368480793" class="support-btn support-btn-alt">Text Pastor Mark</a>
      </div>

      <div class="support-section">
        <div class="support-section-title">Update Your Directory Info</div>
        <p class="support-section-desc">Wrong number? New church? Just ask.</p>
        <a href="mailto:pastorbentley@gmail.com?cc=hellopastormark@gmail.com&subject=Directory%20Update%20Request" class="support-btn">Request an Update</a>
      </div>

      <div class="support-section">
        <div class="support-section-title">Buy Me Some Thai Food</div>
        <p class="support-section-desc">If this app has saved you a phone call or two, I'm not going to stop you.</p>
        <a href="https://buy.stripe.com/9B64gz8NIbca9hO5gk2kw02" class="support-btn support-btn-thai">Buy Me Some Thai Food</a>
      </div>

      <div class="support-section support-story">
        <div class="support-section-title">How This Got Started</div>
        <p>It started with an email I never got.</p>
        <p>My AMA had a meeting. Tony thought he'd added me. He had — just the other Mark. Turns out there are two of us in the group.</p>
        <p>No big deal. I tracked down the address the night before and showed up just fine. But on the drive home, a different problem nagged at me: I didn't actually know everyone in my own AMA group. If I'd tried to email them myself, I couldn't have done it.</p>
        <p>All the information existed. It just wasn't anywhere useful.</p>
        <p>So I built this. Names, churches, addresses, phone numbers — and yes, a button that emails your entire AMA group with one tap.</p>
        <p>Tony, this one's for you.</p>
      </div>

    </div>
  `;

  document.getElementById('update-app-btn').addEventListener('click', checkForAppUpdate);

  if (user) {
    document.getElementById('logout-btn').addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      window.location.reload();
    });
  }

  // Read the active cache name from the browser to get the true installed version
  caches.keys().then(keys => {
    const key = keys.find(k => k.startsWith('pastor-dir-'));
    document.getElementById('app-version').textContent = key ? key.replace('pastor-dir-v', '') : 'unknown';
  }).catch(() => {
    document.getElementById('app-version').textContent = 'unknown';
  });
}

async function checkForAppUpdate(e) {
  const btn = e.currentTarget;
  btn.textContent = 'Checking…';
  btn.disabled = true;

  // Data check (pastor/church directory content) — independent of app code version.
  const dataUpdated = await checkForUpdates().catch(() => false);

  if (!('serviceWorker' in navigator)) {
    btn.textContent = dataUpdated ? 'Directory data updated ✓' : 'Not supported in this browser';
    return;
  }

  const reg = await navigator.serviceWorker.getRegistration('/').catch(() => null);
  if (!reg) {
    // No registration — unregister any stale workers and reload fresh
    await navigator.serviceWorker.getRegistrations()
      .then(regs => Promise.all(regs.map(r => r.unregister())))
      .catch(() => {});
    window.location.reload();
    return;
  }

  let updateFound = false;
  const onUpdateFound = () => { updateFound = true; };
  reg.addEventListener('updatefound', onUpdateFound);

  let updateError = false;
  try {
    await reg.update();
  } catch {
    updateError = true;
  }

  reg.removeEventListener('updatefound', onUpdateFound);

  if (updateError) {
    // SW registration is in a bad state — unregister it so the browser
    // does a clean install on next load, picking up the new version.
    btn.textContent = 'Resetting… reloading';
    await reg.unregister().catch(() => {});
    window.location.reload();
    return;
  }

  if (updateFound) {
    // New SW is installing — controllerchange in app.js will reload when it activates
    btn.textContent = 'Updating… app will reload';
  } else {
    btn.textContent = dataUpdated ? 'Directory data updated ✓' : 'Already up to date ✓';
    setTimeout(() => { btn.textContent = 'Check for Updates'; btn.disabled = false; }, 3000);
  }
}
