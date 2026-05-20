const loadBtn         = document.getElementById('load-btn');
const btnText         = loadBtn.querySelector('.btn-text');
const btnLoader       = loadBtn.querySelector('.btn-loader');
const errorMsg        = document.getElementById('error-msg');
const inputSection    = document.getElementById('input-section');
const rewriterSection = document.getElementById('rewriter-section');
const resumeFile      = document.getElementById('resume-file');
const fileNameDisplay = document.getElementById('file-name');

let missingKeywords = [];
let jobDescription  = '';

resumeFile.addEventListener('change', () => {
  fileNameDisplay.textContent = resumeFile.files[0]?.name ?? 'no file chosen';
});
document.getElementById('resume').addEventListener('input', e => {
  document.getElementById('resume-count').textContent = e.target.value.length + ' characters';
});
document.getElementById('job-description').addEventListener('input', e => {
  document.getElementById('jd-count').textContent = e.target.value.length + ' characters';
});

function setLoading(on) {
  loadBtn.disabled        = on;
  btnText.style.display   = on ? 'none' : 'inline';
  btnLoader.style.display = on ? 'flex' : 'none';
}
function showError(msg) { errorMsg.textContent = msg; errorMsg.hidden = false; }
function clearError()   { errorMsg.hidden = true; errorMsg.textContent = ''; }
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Load: run analyze to get missing keywords, then show bullets
loadBtn.addEventListener('click', async () => {
  clearError();
  const resume  = document.getElementById('resume').value.trim();
  const jd      = document.getElementById('job-description').value.trim();
  const hasFile = !!resumeFile.files[0];
  if (!resume && !hasFile) { showError('Please paste your resume or upload a PDF.'); return; }
  if (!jd)                 { showError('Please paste the job description.'); return; }

  setLoading(true);

  try {
    const form = new FormData();
    form.append('resume', resume);
    form.append('job_description', jd);
    if (resumeFile.files[0]) form.append('file', resumeFile.files[0]);

    const res  = await fetch('/analyze', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok || data.error) { showError(data.error || 'Something went wrong.'); return; }

    const parsed = JSON.parse(data.result.replace(/```json|```/g, '').trim());
    missingKeywords = parsed.missing_keywords ?? [];
    jobDescription  = jd;

    renderBullets(resume);
    rewriterSection.hidden = false;
    inputSection.hidden = true;
    rewriterSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    showError('Failed to connect to the server. Is it running?');
    console.error(err);
  } finally {
    setLoading(false);
  }
});

function renderBullets(text) {
  const container = document.getElementById('resume-bullets');
  container.innerHTML = '';
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 30);
  lines.forEach(line => {
    const div = document.createElement('div');
    div.className = 'resume-line';
    div.textContent = line;
    div.addEventListener('click', () => startRewrite(line));
    container.appendChild(div);
  });
}

async function startRewrite(bullet) {
  document.getElementById('original-bullet').textContent = bullet;
  document.getElementById('rewrite-list').innerHTML = '';
  document.getElementById('empty-state').hidden    = true;
  document.getElementById('rewrite-results').hidden = false;
  document.getElementById('rewrite-loading').style.display = 'flex';

  document.querySelectorAll('.resume-line').forEach(el =>
    el.classList.toggle('selected', el.textContent === bullet));

  try {
    const form = new FormData();
    form.append('bullet', bullet);
    form.append('missing_keywords', missingKeywords.join(', '));
    form.append('job_description', jobDescription);

    const res    = await fetch('/rewrite', { method: 'POST', body: form });
    const data   = await res.json();
    const parsed = JSON.parse(data.result.replace(/```json|```/g, '').trim());
    renderRewrites(parsed.rewrites ?? []);
  } catch (err) {
    document.getElementById('rewrite-list').innerHTML =
      '<p style="color:var(--red);font-size:0.78rem">Failed to get rewrites. Try again.</p>';
    console.error(err);
  } finally {
    document.getElementById('rewrite-loading').style.display = 'none';
  }
}

function renderRewrites(rewrites) {
  const list = document.getElementById('rewrite-list');
  list.innerHTML = '';
  rewrites.forEach(({ version, explanation }) => {
    const item = document.createElement('div');
    item.className = 'rewrite-item';
    item.innerHTML = `
      <p class="rewrite-version">${escHtml(version)}</p>
      <p class="rewrite-explanation">${escHtml(explanation)}</p>
      <button class="copy-btn">Copy</button>`;
    item.querySelector('.copy-btn').addEventListener('click', function () {
      navigator.clipboard.writeText(version);
      this.textContent = 'Copied!'; this.classList.add('copied');
      setTimeout(() => { this.textContent = 'Copy'; this.classList.remove('copied'); }, 2000);
    });
    list.appendChild(item);
  });
}
