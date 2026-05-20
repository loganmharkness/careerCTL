const prepBtn   = document.getElementById('prep-btn');
const btnText   = prepBtn.querySelector('.btn-text');
const btnLoader = prepBtn.querySelector('.btn-loader');
const errorMsg  = document.getElementById('error-msg');

document.getElementById('job-description').addEventListener('input', e => {
  document.getElementById('jd-count').textContent = e.target.value.length + ' characters';
});
document.getElementById('resume').addEventListener('input', e => {
  document.getElementById('resume-count').textContent = e.target.value.length + ' characters';
});

function setLoading(on) {
  prepBtn.disabled        = on;
  btnText.style.display   = on ? 'none' : 'inline';
  btnLoader.style.display = on ? 'flex' : 'none';
}
function showError(msg) { errorMsg.textContent = msg; errorMsg.hidden = false; }
function clearError()   { errorMsg.hidden = true; errorMsg.textContent = ''; }
function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); prepBtn.click(); }
});

prepBtn.addEventListener('click', async () => {
  clearError();
  const jd     = document.getElementById('job-description').value.trim();
  const resume = document.getElementById('resume').value.trim();
  if (!jd) { showError('Please paste a job description.'); return; }

  setLoading(true);
  document.getElementById('empty-state').hidden = true;
  document.getElementById('ip-results').hidden  = true;

  try {
    const form = new FormData();
    form.append('job_description', jd);
    form.append('resume', resume);

    const res  = await fetch('/interview-prep', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok || data.error) {
      showError(data.error || 'Something went wrong.');
      document.getElementById('empty-state').hidden = false;
      return;
    }

    const parsed = JSON.parse(data.result.replace(/```json|```/g, '').trim());
    renderResults(parsed);
  } catch (err) {
    showError('Failed to connect to the server. Is it running?');
    document.getElementById('empty-state').hidden = false;
    console.error(err);
  } finally {
    setLoading(false);
  }
});

function renderResults(d) {
  renderList(document.getElementById('technical-list'),  d.technical  ?? []);
  renderList(document.getElementById('behavioral-list'), d.behavioral ?? []);
  document.getElementById('ip-results').hidden = false;
}

function renderList(container, questions) {
  container.innerHTML = '';
  questions.forEach((q, i) => {
    const card = document.createElement('div');
    card.className = 'ip-question-card';
    card.innerHTML = `
      <div class="ip-q-header">
        <span class="ip-q-num">0${i + 1}</span>
        <p class="ip-q-text">${escHtml(q.question)}</p>
      </div>
      <div class="ip-q-body">
        <div class="ip-framework">
          <span class="ip-framework-label">Answer framework</span>
          <p class="ip-framework-text">${escHtml(q.framework)}</p>
        </div>
        <p class="ip-why-asked"><span class="ip-why-label">Why asked</span> ${escHtml(q.why_asked)}</p>
      </div>
    `;
    container.appendChild(card);
  });
}
