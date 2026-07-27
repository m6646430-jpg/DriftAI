// DriftAI — AI Apply Assistant
// Reads the job (from the board via sessionStorage, or entered manually) + the
// candidate's resume, and prepares the full application. Asks the user only the
// things the AI couldn't infer from the resume.
(function () {
  const $ = id => document.getElementById(id);
  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---- job context ----
  let job = null;
  try { job = JSON.parse(sessionStorage.getItem('ds_apply_job') || 'null'); } catch {}
  if (job && job.role) {
    $('jobKnown').style.display = '';
    $('jobRole').textContent = job.role;
    $('jobCompany').textContent = job.company || '';
    const link = $('jobLink'); link.href = /^https?:\/\//.test(job.url || '') ? job.url : '#';
    $('aaOpen') && ($('aaOpen').href = link.href);
  } else {
    $('jobManual').style.display = '';
  }

  function currentJob() {
    if (job && job.role) return job;
    return { role: $('mRole').value.trim(), company: $('mCompany').value.trim(), jd: $('mJd').value.trim(), url: '' };
  }

  // ---- resume upload ----
  let file = null;
  const drop = $('aaDrop'), input = $('aaFile');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.borderColor = 'rgba(167,139,250,0.8)'; });
  drop.addEventListener('dragleave', () => drop.style.borderColor = '');
  drop.addEventListener('drop', e => { e.preventDefault(); drop.style.borderColor = ''; if (e.dataTransfer.files[0]) pick(e.dataTransfer.files[0]); });
  input.addEventListener('change', () => { if (input.files[0]) pick(input.files[0]); });
  function pick(f) {
    if (f.type !== 'application/pdf') return err('Please upload a PDF.');
    if (f.size > 5 * 1024 * 1024) return err('File too large — max 5 MB.');
    file = f; $('aaDropText').textContent = '✓ ' + f.name;
    $('aaGo').disabled = false; $('aaError').style.display = 'none';
  }
  function err(m) { const e = $('aaError'); e.textContent = m; e.style.display = 'block'; }
  function toBase64(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(f); }); }

  // ---- generate ----
  $('aaGo').addEventListener('click', async () => {
    if (!file) return;
    const j = currentJob();
    if (!j.role) return err('Tell us the role you\'re applying to first.');
    $('aaGo').style.display = 'none'; $('aaDrop').style.display = 'none'; $('aaError').style.display = 'none';
    $('aaLoading').style.display = 'block';
    try {
      let result;
      if (isLocal) { await new Promise(r => setTimeout(r, 1500)); result = mock(j); }
      else {
        const data = await toBase64(file);
        const res = await fetch('/.netlify/functions/apply-assistant', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, mime: file.type, role: j.role, company: j.company, jd: j.jd || '' }),
        });
        if (!res.ok) throw new Error('assistant ' + res.status);
        result = await res.json();
      }
      render(result, j);
    } catch (e) {
      $('aaLoading').style.display = 'none'; $('aaDrop').style.display = ''; $('aaGo').style.display = '';
      err('Sorry — the assistant is busy right now. Please try again in a moment.');
    }
  });

  let DATA = null, JOB = null;
  function render(r, j) {
    DATA = r; JOB = j;
    $('aaLoading').style.display = 'none';
    $('aaResult').style.display = 'block';
    $('aaMatch').textContent = (r.match_score || 0) + '%';
    $('aaSummary').textContent = r.summary || '';
    $('aaBullets').innerHTML = (r.bullets || []).map(b => `<li>${esc(b)}</li>`).join('');
    $('aaKeywords').innerHTML = (r.keywords || []).map(k => `<span>${esc(k)}</span>`).join('');
    $('aaCover').textContent = r.cover_letter || '';
    $('aaAnswers').innerHTML = (r.answers || []).map(qa => `<div class="aa-qa"><div class="q">${esc(qa.q)}</div><div class="a">${esc(qa.a)}</div></div>`).join('') || '<p style="color:rgba(255,255,255,0.4);">No standard questions detected.</p>';
    const needs = r.needs_you || [];
    $('aaNeedBox').style.display = needs.length ? '' : 'none';
    $('aaNeeds').innerHTML = needs.map((n, i) => `<label>${esc(n.q)} <span class="why">(${esc(n.why || '')})</span></label><input data-need="${i}" placeholder="Your answer" />`).join('');
    if (j.url && /^https?:\/\//.test(j.url)) $('aaOpen').href = j.url; else $('aaOpen').style.display = 'none';
  }

  // ---- copy ----
  function block(kind) {
    if (!DATA) return '';
    if (kind === 'resume') return `TAILORED SUMMARY\n${DATA.summary}\n\nKEY ACHIEVEMENTS\n${(DATA.bullets || []).map(b => '• ' + b).join('\n')}\n\nKEYWORDS: ${(DATA.keywords || []).join(', ')}`;
    if (kind === 'cover') return DATA.cover_letter || '';
    if (kind === 'answers') return (DATA.answers || []).map(qa => `Q: ${qa.q}\nA: ${qa.a}`).join('\n\n');
    return '';
  }
  document.querySelectorAll('.aa-copy').forEach(b => b.addEventListener('click', () => copy(block(b.dataset.copy), b)));
  $('aaCopyAll').addEventListener('click', (e) => {
    const yours = [...document.querySelectorAll('[data-need]')].map((inp, i) => {
      const q = (DATA.needs_you[i] || {}).q || '';
      return inp.value.trim() ? `Q: ${q}\nA: ${inp.value.trim()}` : null;
    }).filter(Boolean).join('\n\n');
    const all = `APPLICATION FOR: ${JOB.role}${JOB.company ? ' @ ' + JOB.company : ''}\n\n=== TAILORED RESUME ===\n${block('resume')}\n\n=== COVER LETTER ===\n${block('cover')}\n\n=== ANSWERS ===\n${block('answers')}${yours ? '\n\n=== YOUR DETAILS ===\n' + yours : ''}`;
    copy(all, e.target);
  });
  function copy(text, btn) {
    navigator.clipboard.writeText(text).then(() => { const o = btn.textContent; btn.textContent = '✓ Copied'; setTimeout(() => btn.textContent = o, 1500); }).catch(() => {});
  }

  $('aaAgain').addEventListener('click', () => location.reload());

  // ---- localhost mock ----
  function mock(j) {
    return {
      match_score: 88,
      summary: `[DEMO] Results-driven professional targeting ${j.role}${j.company ? ' at ' + j.company : ''}, with directly relevant experience. Real AI output appears on the live site.`,
      bullets: ['Led a project that improved a key metric by 30%.', 'Owned a system used by thousands of users.', 'Collaborated cross-functionally to ship on time.', 'Mentored teammates and raised delivery quality.'],
      keywords: ['Communication', 'Ownership', 'Problem-solving', 'Collaboration', 'Metrics', 'Leadership'],
      cover_letter: `Dear Hiring Team,\n\n[DEMO cover letter] I'm excited to apply for the ${j.role} role${j.company ? ' at ' + j.company : ''}. My background lines up closely with what you're looking for, and I'd bring immediate value. On the live site this is written from your real resume.\n\nBest,\nYour name`,
      answers: [
        { q: 'Why are you a good fit for this role?', a: '[DEMO] Based on your resume, the AI writes a strong, specific answer here.' },
        { q: 'Describe your most relevant experience.', a: '[DEMO] Pulled from your actual background.' },
      ],
      needs_you: [
        { q: 'What is your expected salary?', why: 'not in your resume' },
        { q: 'What is your earliest start date?', why: 'only you know this' },
        { q: 'Do you require visa sponsorship?', why: 'not stated in your resume' },
      ],
    };
  }
})();
