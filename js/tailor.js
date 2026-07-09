// ===== TAILOR RESUME TO A JOB (Gemini) =====
// Opens from any job card's "✨ Tailor Resume" button. Uploads the resume to a
// Netlify function that tailors it to that role, then upsells the paid rewrite.
(function () {
  let current = null;      // { role, company }
  let selected = null;     // File

  const $ = id => document.getElementById(id);
  const modal = $('tailorModal');
  if (!modal) return;

  function open(job) {
    const role = job.role, company = job.company;
    current = { role, company, jd: job.jd || '', url: job.url || '', source: job.source || '' };
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
    if (job) open(job);
  });

  $('tailorClose').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  $('tailorAgain') && $('tailorAgain').addEventListener('click', () => open(current));

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
          body: JSON.stringify({ data, mime: selected.type, role: current.role, company: current.company, jd: current.jd }),
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

  // Local-only placeholder. The REAL tailoring (which reads your uploaded PDF and
  // this job's description via Gemini) runs on the deployed site, not localhost.
  // We derive keywords from the actual JD so it's obvious the JD is flowing through.
  function mock() {
    const jd = (current.jd || '').toLowerCase();
    const kwPool = ['leadership', 'strategy', 'analytics', 'stakeholder', 'budget', 'campaign',
      'growth', 'roadmap', 'sql', 'python', 'kubernetes', 'api', 'cloud', 'security', 'design',
      'marketing', 'brand', 'content', 'seo', 'cross-functional', 'metrics', 'b2b', 'saas'];
    let kws = kwPool.filter(k => jd.includes(k)).map(k => k[0].toUpperCase() + k.slice(1));
    if (kws.length < 5) kws = kws.concat(['Communication', 'Ownership', 'Data-driven', 'Collaboration', 'Execution']);
    kws = [...new Set(kws)].slice(0, 8);
    return {
      _demo: true,
      summary: '[LOCAL DEMO — the live site uses AI on your real resume] Professional targeting the ' +
        current.role + ' role at ' + current.company + ', with experience mapped to this posting' +
        (jd ? ' (job description was received: ' + (current.jd || '').length + ' chars).' : '.'),
      bullets: [
        'Reframed a real achievement to match "' + current.role + '" responsibilities from the JD.',
        'Highlighted results relevant to ' + current.company + ', quantified where the resume supports it.',
        'Surfaced transferable skills the posting asks for.',
        'Aligned wording to the keywords this job screens for.',
      ],
      keywords: kws,
      gap_note: 'This is a local preview. Deploy the site to see the AI tailor your actual uploaded resume to this job description.',
    };
  }
})();
