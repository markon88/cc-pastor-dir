// "Report an Issue" — bug reports, feature requests, and data-update requests,
// all funneled through one form (replaces the old mailto "Request an Update"
// link). Mirrors the feedback tool already built for the My People My Church app.
export function setupFeedbackModal(getCurrentPage) {
  const overlay       = document.getElementById('feedback-overlay');
  const formState      = document.getElementById('feedback-form-state');
  const successState   = document.getElementById('feedback-success-state');
  const messageEl      = document.getElementById('feedback-message');
  const urgentEl       = document.getElementById('feedback-urgent');
  const errorEl        = document.getElementById('feedback-error');
  const submitBtn      = document.getElementById('feedback-submit');
  const cancelBtn      = document.getElementById('feedback-cancel');
  const doneBtn        = document.getElementById('feedback-done');
  const typeBtns       = overlay.querySelectorAll('.feedback-type-toggle .sort-btn');

  let selectedType = 'bug';

  function reset() {
    selectedType = 'bug';
    typeBtns.forEach(b => b.classList.toggle('active', b.dataset.type === 'bug'));
    messageEl.value = '';
    urgentEl.checked = false;
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
    formState.classList.remove('hidden');
    successState.classList.add('hidden');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit';
  }

  function close() {
    overlay.classList.add('hidden');
  }

  function open() {
    reset();
    overlay.classList.remove('hidden');
    messageEl.focus();
  }

  typeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedType = btn.dataset.type;
      typeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  cancelBtn.addEventListener('click', close);
  doneBtn.addEventListener('click', close);

  submitBtn.addEventListener('click', async () => {
    const message = messageEl.value.trim();
    if (!message) {
      errorEl.textContent = 'Please describe the issue.';
      errorEl.classList.remove('hidden');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    errorEl.classList.add('hidden');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: selectedType, message, urgent: urgentEl.checked, page: getCurrentPage() }),
      });
      if (!res.ok) throw new Error('Failed to submit');
      formState.classList.add('hidden');
      successState.classList.remove('hidden');
    } catch {
      errorEl.textContent = 'Something went wrong — please try again.';
      errorEl.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
    }
  });

  return { open };
}
