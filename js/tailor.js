// ===== TAILOR RESUME TO A JOB (Gemini) =====
// Opens from any job card's "✨ Tailor Resume" button. Uploads the resume to a
// Netlify function that tailors it to that role, then upsells the paid rewrite.
(function () {
  let current = null;      // { role, company }
  let selected = null;     // File

  const $ = id => document.getElementById(id);
  const modal = $('tailorModal');
  if (!modal) return;

  function open(role, company) {
    current = { role, company };
    selected = null;
    $('tailorTarget').textContent = role + ' · ' + company;
    $('tailorTarget2').textContent = role + ' · ' + company;
    $('tailorUpload').style.display = '';
    $('tailorLoading').style.display = 'none';
    $('tailorResult').style.display = 'none';
    $('tailorFileName').style.display = 'none';
    $('tailorError').style.display = 'none';
    $('tailorBtn').disabled = true;
    $('tailorFile').value = '';
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  function close() { modal.style.display = 'none'; document.body.style.overflow = ''; }

  // Open from any job card (delegated; ALL_JOBS is global from jobs.js)
  document.addEventListener('click', e => {
    const btn = e.target.closest('.jb-tailor');
    if (!btn) return;
    const job = (typeof ALL_JOBS !== 'undefined' ? ALL_JOBS : []).find(j => j.id === btn.dataset.jobid);
    if (job) open(job.role, job.company);
  });

  $('tailorClose').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  $('tailorAgain') && $('tailorAgain').addEventListener('click', () => open(current.role, current.company));

  // File selection
  const drop = $('tailorDrop'), input = $('tailorFile');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag'); if (e.dataTransfer.files[0]) pick(e.dataTransfer.files[0]); });
  input.addEventListener('change', () => { if (input.files[0]) pick(input.files[0]); });

  function pick(file) {
    if (file.type !== 'application/pdf') return showErr('Please upload a PDF.');
    if (file.size > 5 * 1024 * 1024) return showErr('File too large — max 5 MB.');
    selected = file;
    $('tailorFileName').textContent = '✓ ' + file.name;
    $('tailorFileName').style.display = 'block';
    $('tailorBtn').disabled = false;
    $('tailorError').style.display = 'none';
  }
  function showErr(m) { const e = $('tailorError'); e.textContent = m; e.style.display = 'block'; }

  function toBase64(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
  }

  $('tailorBtn').addEventListener('click', async () => {
    if (!selected) return;
    $('tailorUpload').style.display = 'none';
    $('tailorLoading').style.display = 'block';
    try {
      let result;
      if (['localhost', '127.0.0.1'].includes(location.hostname)) {
        await new Promise(r => setTimeout(r, 1600));
        result = mock();
      } else {
        const data = await toBase64(selected);
        const res = await fetch('/.netlify/functions/tailor-resume', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, mime: selected.type, role: current.role, company: current.company }),
        });
        if (!res.ok) throw new Error('tailor failed ' + res.status);
        result = await res.json();
      }
      render(result);
    } catch (err) {
      $('tailorLoading').style.display = 'none';
      $('tailorUpload').style.display = '';
      showErr('Sorry — tailoring is busy right now. Please try again in a moment.');
    }
  });

  function render(r) {
    $('tailorLoading').style.display = 'none';
    $('tailorResult').style.display = 'block';
    $('tailorSummary').textContent = r.summary || '';
    $('tailorBullets').innerHTML = (r.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join('');
    $('tailorKeywords').innerHTML = (r.keywords || []).map(k => `<span>${escapeHtml(k)}</span>`).join('');
    $('tailorGap').textContent = r.gap_note || '';
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function mock() {
    return {
      summary: 'Results-driven software engineer with 4+ years building scalable web platforms, now targeting a ' + current.role + ' role at ' + current.company + '. Proven record of shipping features to millions of users and cutting infrastructure costs.',
      bullets: [
        'Rebuilt core service that reduced p99 latency by 43%, directly relevant to ' + current.company + "'s scale.",
        'Led migration of 14 microservices to Kubernetes, cutting infra spend $210K/year.',
        'Partnered cross-functionally with product and design to ship 3 major releases on time.',
        'Mentored 3 engineers, improving team delivery velocity by 20%.',
      ],
      keywords: ['Distributed systems', 'Kubernetes', 'CI/CD', 'API design', 'Cloud (AWS)', 'System design', 'Mentorship'],
      gap_note: 'Add one metric-driven bullet that mirrors this job\'s core responsibility to stand out.',
    };
  }
})();
