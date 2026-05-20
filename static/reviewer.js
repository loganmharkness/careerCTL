const reviewBtn       = document.getElementById('review-btn');
const btnText         = reviewBtn.querySelector('.btn-text');
const btnLoader       = reviewBtn.querySelector('.btn-loader');
const errorMsg        = document.getElementById('error-msg');
const resultsPanel    = document.getElementById('results');
const resumeFile      = document.getElementById('resume-file');
const fileNameDisplay = document.getElementById('file-name');

resumeFile.addEventListener('change', () => {
  fileNameDisplay.textContent = resumeFile.files[0]?.name ?? 'no file chosen';
});
document.getElementById('resume').addEventListener('input', e => {
  document.getElementById('resume-count').textContent = e.target.value.length + ' characters';
});

function setLoading(on) {
  reviewBtn.disabled      = on;
  btnText.style.display   = on ? 'none' : 'inline';
  btnLoader.style.display = on ? 'flex' : 'none';
}
function showError(msg) { errorMsg.textContent = msg; errorMsg.hidden = false; }
function clearError()   { errorMsg.hidden = true; errorMsg.textContent = ''; }
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function animateBar(barId, valId, score) {
  document.getElementById(valId).textContent = score + '%';
  setTimeout(() => { document.getElementById(barId).style.width = score + '%'; }, 30);
}

reviewBtn.addEventListener('click', async () => {
  clearError();
  const resume  = document.getElementById('resume').value.trim();
  const hasFile = !!resumeFile.files[0];
  if (!resume && !hasFile) { showError('Please paste your resume or upload a PDF.'); return; }

  setLoading(true);
  resultsPanel.hidden = true;

  try {
    const form = new FormData();
    form.append('text', resume);
    if (resumeFile.files[0]) form.append('file', resumeFile.files[0]);

    const res  = await fetch('/review', { method: 'POST', body: form });
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
  document.getElementById('verdict-text').textContent = d.verdict ?? '';

  const s = d.scores ?? {};
  animateBar('clarity-bar',  'clarity-val',  s.clarity  ?? 0);
  animateBar('impact-bar',   'impact-val',   s.impact   ?? 0);
  animateBar('keywords-bar', 'keywords-val', s.keywords ?? 0);

  const sl = document.getElementById('strengths-list');
  sl.innerHTML = '';
  (d.strengths ?? []).forEach(s => { const li = document.createElement('li'); li.textContent = s; sl.appendChild(li); });

  const il = document.getElementById('improvements-list');
  il.innerHTML = '';
  (d.improvements ?? []).forEach(({ title, detail }) => {
    const item = document.createElement('div');
    item.className = 'gap-item';
    item.innerHTML = `<div class="gap-text"><strong>${escHtml(title)}</strong><span>${escHtml(detail)}</span></div>`;
    il.appendChild(item);
  });

  resultsPanel.hidden = false;
  resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
