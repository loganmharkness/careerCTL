const generateBtn     = document.getElementById('generate-btn');
const btnText         = generateBtn.querySelector('.btn-text');
const btnLoader       = generateBtn.querySelector('.btn-loader');
const errorMsg        = document.getElementById('error-msg');
const resumeFile      = document.getElementById('resume-file');
const fileNameDisplay = document.getElementById('file-name');
const copyBtn         = document.getElementById('copy-btn');

resumeFile.addEventListener('change', () => {
  fileNameDisplay.textContent = resumeFile.files[0]?.name ?? 'no file chosen';
});
document.getElementById('resume').addEventListener('input', e => {
  document.getElementById('resume-count').textContent = e.target.value.length + ' characters';
});
document.getElementById('job-description').addEventListener('input', e => {
  document.getElementById('jd-count').textContent = e.target.value.length + ' characters';
});

// Toggle buttons
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

generateBtn.addEventListener('click', async () => {
  clearError();
  const resume  = document.getElementById('resume').value.trim();
  const jd      = document.getElementById('job-description').value.trim();
  const hasFile = !!resumeFile.files[0];
  if (!resume && !hasFile) { showError('Please paste your resume or upload a PDF.'); return; }
  if (!jd)                 { showError('Please paste the job description.'); return; }

  const tone   = document.querySelector('#tone-toggle .cl-toggle-btn.active').dataset.value;
  const length = document.querySelector('#length-toggle .cl-toggle-btn.active').dataset.value;
  const extra  = document.getElementById('cl-instructions').value.trim();

  setLoading(true);
  document.getElementById('empty-state').hidden = true;
  document.getElementById('cl-results').hidden  = true;

  try {
    const form = new FormData();
    form.append('resume', resume);
    form.append('job_description', jd);
    form.append('tone', tone);
    form.append('length', length);
    form.append('extra_instructions', extra);
    if (resumeFile.files[0]) form.append('file', resumeFile.files[0]);

    const res  = await fetch('/cover-letter', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok || data.error) { showError(data.error || 'Something went wrong.'); document.getElementById('empty-state').hidden = false; return; }

    document.getElementById('cl-output').textContent = data.result;
    document.getElementById('cl-results').hidden = false;
    document.getElementById('resume-group').hidden = true;
    document.getElementById('jd-group').hidden = true;
  } catch (err) {
    showError('Failed to connect to the server. Is it running?');
    document.getElementById('empty-state').hidden = false;
    console.error(err);
  } finally {
    setLoading(false);
  }
});

copyBtn.addEventListener('click', function () {
  const text = document.getElementById('cl-output').textContent;
  navigator.clipboard.writeText(text);
  this.textContent = 'Copied!'; this.classList.add('copied');
  setTimeout(() => { this.textContent = 'Copy'; this.classList.remove('copied'); }, 2000);
});
