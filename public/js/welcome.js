// Generic multi-step "tour" overlay. Used both for the full pastor
// onboarding walkthrough and for single-card "what's new" announcements —
// a one-step tour and an announcement card are the same UI. Which ids a
// given user has or hasn't seen is tracked in app.js against the
// server-reported `seenAnnouncements` list (DB-backed, see
// migrations/017_seen_announcements.sql), not here — this module only
// knows how to render whatever `steps` it's handed.

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }

export function buildOnboardingSteps(user, opts) {
  const firstName = (user?.name || '').split(' ')[0] || 'Pastor';
  const steps = [
    {
      icon: '👋',
      title: `Welcome, ${esc(firstName)}!`,
      body: `CC Pastors puts the whole Carolina Conference pastoral family in your pocket — every pastor, church, and AMA group, always up to date. Here's a quick look around.`,
    },
    {
      icon: '👤',
      title: 'Find any pastor, fast',
      body: `The <strong>Pastors</strong> tab lists everyone in the conference. Search by name or church, then tap a pastor to call, text, email, or get directions to their church in one tap.`,
    },
    {
      icon: '⛪',
      title: 'Churches, at a glance',
      body: `The <strong>Churches</strong> tab covers every congregation's address, service times, and contact info — handy for visiting or connecting a member.`,
    },
    {
      icon: '👥',
      title: 'Your AMA group',
      body: `The <strong>Groups</strong> tab shows every AMA group. Open yours and tap <strong>Group Email</strong> to message everyone in it at once — no more hunting down addresses.`,
    },
    {
      icon: '👤',
      title: 'Everything else, top right',
      body: `Tap the profile icon in the top corner for <strong>My AMA Schedule</strong>, the <strong>Conference Office</strong> directory, and to <strong>Report an Issue</strong> if anything looks off.`,
    },
  ];

  if (opts?.volunteersEnabled) {
    steps.push({
      icon: '🙋',
      title: 'VLP / VLL',
      body: `The <strong>VLP/VLL</strong> tab lists volunteer lay pastors and leaders serving alongside you.`,
    });
  }

  steps.push({
    icon: '✅',
    title: "You're all set",
    body: `That's the tour — you're ready to go. Connecting people to Jesus, one connection at a time.`,
  });

  return steps;
}

export function showTour(steps) {
  return new Promise(resolve => {
    const overlay = document.getElementById('welcome-overlay');
    const stepsEl = document.getElementById('welcome-steps');
    const dotsEl  = document.getElementById('welcome-dots');
    const skipBtn = document.getElementById('welcome-skip');
    const nextBtn = document.getElementById('welcome-next');
    let i = 0;

    function render() {
      const s = steps[i];
      stepsEl.innerHTML = `
        <div class="welcome-step-icon">${s.icon}</div>
        <div class="announcement-title">${s.title}</div>
        <p class="announcement-body">${s.body}</p>
      `;
      dotsEl.innerHTML = steps.length > 1
        ? steps.map((_, idx) => `<span class="welcome-dot${idx === i ? ' active' : ''}"></span>`).join('')
        : '';
      skipBtn.classList.toggle('hidden', i === steps.length - 1);
      nextBtn.textContent = i === steps.length - 1 ? 'Got it' : 'Next';
    }

    function finish() {
      overlay.classList.add('hidden');
      skipBtn.removeEventListener('click', finish);
      nextBtn.removeEventListener('click', onNext);
      resolve();
    }

    function onNext() {
      if (i === steps.length - 1) { finish(); return; }
      i++;
      render();
    }

    skipBtn.addEventListener('click', finish);
    nextBtn.addEventListener('click', onNext);

    render();
    overlay.classList.remove('hidden');
  });
}
