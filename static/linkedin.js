const generateBtn     = document.getElementById('generate-btn');
const btnText         = generateBtn.querySelector('.btn-text');
const btnLoader       = generateBtn.querySelector('.btn-loader');
const errorMsg        = document.getElementById('error-msg');
const resumeFile      = document.getElementById('resume-file');
const fileNameDisplay = document.getElementById('file-name');

resumeFile.addEventListener('change', () => {
  fileNameDisplay.textContent = resumeFile.files[0]?.name ?? 'no file chosen';
});
document.getElementById('resume').addEventListener('input', e => {
  document.getElementById('resume-count').textContent = e.target.value.length + ' characters';
});

// Toggle buttons (handles both tone and focus toggles)
document.querySelectorAll('.cl-toggle').forEach(toggle => {
  toggle.querySelectorAll('.cl-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      toggle.querySelectorAll('.cl-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
});

function setLoading(on) {
  generateBtn.disabled    = on;
  btnText.style.display   = on ? 'none' : 'inline';
  btnLoader.style.display = on ? 'flex' : 'none';
}
function showError(msg) { errorMsg.textContent = msg; errorMsg.hidden = false; }
function clearError()   { errorMsg.hidden = true; errorMsg.textContent = ''; }
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

generateBtn.addEventListener('click', async () => {
  clearError();
  const resume  = document.getElementById('resume').value.trim();
  const hasFile = !!resumeFile.files[0];
  if (!resume && !hasFile) { showError('Please paste your resume or upload a PDF.'); return; }

  const tone  = document.querySelector('#tone-toggle .cl-toggle-btn.active').dataset.value;
  const focus = document.querySelector('#focus-toggle .cl-toggle-btn.active').dataset.value;

  setLoading(true);
  document.getElementById('empty-state').hidden = true;
  document.getElementById('li-results').hidden  = true;

  try {
    const form = new FormData();
    form.append('resume', resume);
    form.append('tone', tone);
    form.append('focus', focus);
    if (resumeFile.files[0]) form.append('file', resumeFile.files[0]);

    const res  = await fetch('/linkedin', { method: 'POST', body: form });
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
  const list = document.getElementById('summary-list');
  list.innerHTML = '';

  (d.summaries ?? []).forEach((s, i) => {
    const item = document.createElement('div');
    item.className = 'rewrite-item';
    item.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem">
        <span class="rewrite-explanation" style="margin:0">${escHtml(s.angle)}</span>
        <button class="copy-btn" data-index="${i}">Copy</button>
      </div>
      <p class="rewrite-version">${escHtml(s.version)}</p>
    `;
    list.appendChild(item);
  });

  // Wire copy buttons after rendering
  list.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const idx  = parseInt(this.dataset.index);
      const text = (d.summaries ?? [])[idx]?.version ?? '';
      navigator.clipboard.writeText(text);
      this.textContent = 'Copied!';
      this.classList.add('copied');
      setTimeout(() => { this.textContent = 'Copy'; this.classList.remove('copied'); }, 2000);
    });
  });

  document.getElementById('li-results').hidden = false;
}
