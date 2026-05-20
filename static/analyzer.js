const analyzeBtn      = document.getElementById('analyze-btn');
const btnText         = analyzeBtn.querySelector('.btn-text');
const btnLoader       = analyzeBtn.querySelector('.btn-loader');
const errorMsg        = document.getElementById('error-msg');
const resultsPanel    = document.getElementById('results');
const resumeFile      = document.getElementById('resume-file');
const fileNameDisplay = document.getElementById('file-name');
const RING            = 2 * Math.PI * 52;

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
  analyzeBtn.disabled     = on;
  btnText.style.display   = on ? 'none' : 'inline';
  btnLoader.style.display = on ? 'flex' : 'none';
}
function showError(msg) { errorMsg.textContent = msg; errorMsg.hidden = false; }
function clearError()   { errorMsg.hidden = true; errorMsg.textContent = ''; }
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function makeTag(text, cls) {
  const s = document.createElement('span'); s.className = `tag ${cls}`; s.textContent = text; return s;
}
function animateScore(score) {
  const start = performance.now();
  const run = now => {
    const t = Math.min((now - start) / 900, 1);
    document.getElementById('score-num').textContent = Math.round(t * score) + '%';
    if (t < 1) requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
  setTimeout(() => { document.getElementById('ring-fill').style.strokeDashoffset = RING * (1 - score / 100); }, 30);
  const color = score >= 75 ? 'var(--green)' : score >= 50 ? 'var(--accent)' : 'var(--red)';
  document.getElementById('ring-fill').style.stroke = color;
  document.getElementById('score-num').style.color  = color;
}

analyzeBtn.addEventListener('click', async () => {
  clearError();
  const resume  = document.getElementById('resume').value.trim();
  const jd      = document.getElementById('job-description').value.trim();
  const hasFile = !!resumeFile.files[0];
  if (!resume && !hasFile) { showError('Please paste your resume or upload a PDF.'); return; }
  if (!jd)                 { showError('Please paste the job description.'); return; }

  setLoading(true);
  resultsPanel.hidden = true;

  try {
    const form = new FormData();
    form.append('resume', resume);
    form.append('job_description', jd);
    if (resumeFile.files[0]) form.append('file', resumeFile.files[0]);

    const res  = await fetch('/analyze', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok || data.error) { showError(data.error || 'Something went wrong.'); return; }

    const parsed = JSON.parse(data.result.replace(/```json|```/g, '').trim());
    renderResults(parsed);
  } catch (err) {
    showError('Failed to connect to the server. Is it running?');
    console.error(err);
  } finally {
    setLoading(false);
  }
});

function renderResults(d) {
  animateScore(d.match_score ?? 0);
  document.getElementById('summary-text').textContent = d.summary ?? '';

  const sen = d.seniority ?? {};
  document.getElementById('seniority-jd-val').textContent    = sen.jd_level     ?? '—';
  document.getElementById('seniority-resume-val').textContent = sen.resume_level ?? '—';
  document.getElementById('seniority-verdict').textContent    = sen.verdict      ?? '';
  const match = sen.jd_level === sen.resume_level;
  ['seniority-jd', 'seniority-resume'].forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('pill--match', 'pill--mismatch');
    el.classList.add(match ? 'pill--match' : 'pill--mismatch');
  });

  const mt = document.getElementById('matched-tags'); mt.innerHTML = '';
  const ms = document.getElementById('missing-tags'); ms.innerHTML = '';
  (d.matched_keywords ?? []).forEach(k => mt.appendChild(makeTag(k, 'tag-match')));
  (d.missing_keywords ?? []).forEach(k => ms.appendChild(makeTag(k, 'tag-miss')));

  const gl = document.getElementById('gap-list'); gl.innerHTML = '';
  (d.skill_gaps ?? []).forEach(({ skill, importance = 'medium', suggestion }) => {
    const item = document.createElement('div'); item.className = 'gap-item';
    item.innerHTML = `<span class="importance importance--${importance}">${importance}</span>
      <div class="gap-text"><strong>${escHtml(skill)}</strong><span>${escHtml(suggestion)}</span></div>`;
    gl.appendChild(item);
  });

  const sl = document.getElementById('strengths-list'); sl.innerHTML = '';
  (d.strengths ?? []).forEach(s => { const li = document.createElement('li'); li.textContent = s; sl.appendChild(li); });

  const ql = document.getElementById('quickwins-list'); ql.innerHTML = '';
  (d.quick_wins ?? []).forEach(q => { const li = document.createElement('li'); li.textContent = q; ql.appendChild(li); });

  resultsPanel.hidden = false;
  resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
