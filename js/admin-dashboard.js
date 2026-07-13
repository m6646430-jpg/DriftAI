// ===== DriftAI Admin Dashboard — Job Hunt agent pipeline =====
// Milestone 1: add clients, run the 2 agents (tailor + QA) over matched jobs,
// review the prepared queue, and mark applications submitted.
//
// Storage: localStorage in demo mode (works fully on localhost, no setup) so
// you can test the whole flow before deploying. Swap to Supabase later.
// Agents: real Gemini functions in production; mocks on localhost.
(function () {
  const $ = id => document.getElementById(id);
  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = u => /^https?:\/\//i.test(u || '') ? esc(u) : '#';

  // ---------- storage (localStorage demo) ----------
  const KEY_C = 'ds_admin_clients', KEY_A = 'ds_admin_apps';
  const load = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
  const persist = () => { localStorage.setItem(KEY_C, JSON.stringify(clients)); localStorage.setItem(KEY_A, JSON.stringify(apps)); };
  let clients = load(KEY_C), apps = load(KEY_A);
  const uid = () => Math.random().toString(36).slice(2, 8) + clients.length + apps.length;

  // ---------- jobs (from the live board) ----------
  let JOBS = [];
  fetch('data/jobs.json').then(r => r.json()).then(d => { JOBS = d.jobs || []; renderStats(); }).catch(() => {});

  // ---------- agents ----------
  async function tailorAgent(resume, job) {
    if (isLocal) return mockTailor(resume, job);
    const res = await fetch('/.netlify/functions/agent-tailor', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume, role: job.role, company: job.company, jd: job.jd }),
    });
    if (!res.ok) throw new Error('tailor ' + res.status);
    return res.json();
  }
  async function qaAgent(tailoredText, job) {
    if (isLocal) return mockQa(tailoredText, job);
    const res = await fetch('/.netlify/functions/agent-qa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tailored: tailoredText, role: job.role, jd: job.jd }),
    });
    if (!res.ok) throw new Error('qa ' + res.status);
    return res.json();
  }

  // ---------- mocks (localhost only) ----------
  function mockTailor(resume, job) {
    return {
      summary: `Professional targeting ${job.role} at ${job.company}, with directly relevant experience reframed to this posting.`,
      bullets: [
        `Delivered results relevant to ${job.role}, quantified where the resume supports it.`,
        `Applied core skills this posting screens for.`,
        `Reframed real achievements to match the job description.`,
        `Highlighted ${job.category || 'domain'} experience for ${job.company}.`,
      ],
      keywords: ['ATS', 'Communication', 'Ownership', job.category || 'Skills', 'Metrics', 'Collaboration'],
      gap_note: '[DEMO] Real AI tailoring runs on the deployed site.',
    };
  }
  function mockQa(tailoredText, job) {
    // deterministic pseudo-score from job id so the demo looks varied but stable
    const seed = (job.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const score = 55 + (seed % 41); // 55..95
    const verdict = score >= 78 ? 'READY' : score >= 65 ? 'NEEDS_WORK' : 'SKIP';
    return {
      match_score: score,
      verdict,
      issues: verdict === 'READY' ? [] : ['[DEMO] Add one more quantified bullet matching the JD.'],
      reason: `[DEMO] Match ${score}/100 for ${job.role}.`,
    };
  }

  // ---------- prepare flow (the daily agent run, on demand) ----------
  let running = false;
  async function prepare(client, n) {
    if (running) return;
    running = true;
    const btn = $('prepBtn'); if (btn) { btn.disabled = true; }
    const prog = $('prepProgress');
    try {
      const already = new Set(apps.filter(a => a.clientId === client.id).map(a => a.jobId));
      let pool = JOBS.filter(j => !already.has(j.id));
      if (client.country && client.country !== 'any') {
        const byCountry = pool.filter(j => j.country === client.country);
        if (byCountry.length >= 3) pool = byCountry;
      }
      if (client.category && client.category !== 'any') {
        const byCat = pool.filter(j => j.category === client.category);
        if (byCat.length >= 3) pool = byCat;
      }
      const picks = pool.slice(0, n);
      if (!picks.length) { alert('No new matching jobs to prepare for this client right now.'); return; }

      let done = 0;
      for (const job of picks) {
        if (prog) prog.textContent = `Preparing ${done + 1} of ${picks.length} — ${job.role} @ ${job.company}…`;
        const t = await tailorAgent(client.resume, job);
        const tailoredText = (t.summary || '') + '\n' + (t.bullets || []).join('\n');
        const qa = await qaAgent(tailoredText, job);
        apps.unshift({
          id: uid(), clientId: client.id, clientName: client.name,
          jobId: job.id, role: job.role, company: job.company, url: job.url, country: job.country,
          tailor: t, qa, status: 'prepared', createdAt: new Date().toISOString(),
        });
        done++;
        persist();
        render();
      }
      if (prog) prog.textContent = `✅ Prepared ${done} application${done === 1 ? '' : 's'} for ${client.name}.`;
      switchTab('queue');
    } catch (e) {
      if (prog) prog.textContent = '⚠️ Something went wrong preparing applications. ' + (isLocal ? '' : 'Check the function logs.');
    } finally {
      running = false;
      if (btn) btn.disabled = false;
      render();
    }
  }

  // ---------- client management ----------
  function addClient(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const resume = (f.get('resume') || '').trim();
    if (resume.length < 30) { alert('Paste the client\'s resume text (at least a few lines).'); return; }
    clients.unshift({
      id: uid(), name: f.get('name') || 'Client', email: f.get('email') || '',
      country: f.get('country') || 'any', category: f.get('category') || 'any',
      resume, createdAt: new Date().toISOString(),
    });
    persist();
    e.target.reset();
    render();
  }
  function deleteClient(id) {
    if (!confirm('Remove this client and their prepared applications?')) return;
    clients = clients.filter(c => c.id !== id);
    apps = apps.filter(a => a.clientId !== id);
    persist(); render();
  }
  function setStatus(appId, status) {
    const a = apps.find(x => x.id === appId); if (a) { a.status = status; persist(); render(); }
  }

  // ---------- rendering ----------
  let activeTab = 'clients';
  function switchTab(t) { activeTab = t; render(); }

  function renderStats() {
    const s = $('statBar'); if (!s) return;
    const prepared = apps.filter(a => a.status === 'prepared').length;
    const applied = apps.filter(a => a.status === 'applied').length;
    s.innerHTML = `
      <div class="astat"><b>${clients.length}</b><span>Clients</span></div>
      <div class="astat"><b>${JOBS.length}</b><span>Jobs available</span></div>
      <div class="astat"><b>${prepared}</b><span>Ready to submit</span></div>
      <div class="astat"><b>${applied}</b><span>Applied</span></div>`;
  }

  function badge(qa) {
    const v = qa.verdict, s = qa.match_score;
    const cls = v === 'READY' ? 'ok' : v === 'SKIP' ? 'bad' : 'warn';
    return `<span class="qa-badge ${cls}">${esc(v)} · ${s}/100</span>`;
  }

  function render() {
    renderStats();
    // tabs
    ['clients', 'queue'].forEach(t => {
      const el = $('tab-' + t); if (el) el.classList.toggle('active', activeTab === t);
    });
    $('view-clients').style.display = activeTab === 'clients' ? '' : 'none';
    $('view-queue').style.display = activeTab === 'queue' ? '' : 'none';

    // clients list
    $('clientList').innerHTML = clients.length ? clients.map(c => `
      <div class="admin-card">
        <div class="ac-head">
          <div><strong>${esc(c.name)}</strong><span class="ac-sub">${esc(c.email || '')} · ${esc(c.country)} · ${esc(c.category)}</span></div>
          <button class="ac-del" data-del="${esc(c.id)}">✕</button>
        </div>
        <div class="ac-actions">
          <button class="btn btn-primary" data-prep="${esc(c.id)}">✨ Prepare 5 applications</button>
          <span class="ac-count">${apps.filter(a => a.clientId === c.id).length} prepared</span>
        </div>
      </div>`).join('') : '<p class="admin-empty">No clients yet. Add one above to start.</p>';

    // queue
    const q = apps.slice(0, 100);
    $('queueList').innerHTML = q.length ? q.map(a => `
      <div class="admin-card app-card status-${esc(a.status)}">
        <div class="ac-head">
          <div>
            <strong>${esc(a.role)}</strong>
            <span class="ac-sub">${esc(a.company)} · ${esc(a.clientName)} · ${esc(a.country)}</span>
          </div>
          ${badge(a.qa)}
        </div>
        <details class="app-detail">
          <summary>View tailored resume + QA</summary>
          <div class="app-body">
            <p class="app-summary">${esc(a.tailor.summary || '')}</p>
            <ul>${(a.tailor.bullets || []).map(b => `<li>${esc(b)}</li>`).join('')}</ul>
            <div class="app-kw">${(a.tailor.keywords || []).map(k => `<span>${esc(k)}</span>`).join('')}</div>
            <p class="app-qa"><strong>QA:</strong> ${esc(a.qa.reason || '')}</p>
            ${(a.qa.issues || []).length ? `<ul class="app-issues">${a.qa.issues.map(i => `<li>⚠️ ${esc(i)}</li>`).join('')}</ul>` : ''}
          </div>
        </details>
        <div class="ac-actions">
          <a href="${safeUrl(a.url)}" target="_blank" rel="noopener" class="btn btn-outline">↗ Open job to apply</a>
          ${a.status === 'applied'
            ? '<span class="app-done">✅ Applied</span>'
            : `<button class="btn btn-green" data-applied="${esc(a.id)}">Mark applied</button>
               <button class="btn btn-ghost" data-skip="${esc(a.id)}">Skip</button>`}
        </div>
      </div>`).join('') : '<p class="admin-empty">No applications prepared yet. Go to Clients → Prepare.</p>';
  }

  // ---------- events (delegated) ----------
  document.addEventListener('click', e => {
    const prep = e.target.closest('[data-prep]');
    if (prep) { const c = clients.find(x => x.id === prep.dataset.prep); if (c) prepare(c, 5); return; }
    const del = e.target.closest('[data-del]');
    if (del) { deleteClient(del.dataset.del); return; }
    const ap = e.target.closest('[data-applied]');
    if (ap) { setStatus(ap.dataset.applied, 'applied'); return; }
    const sk = e.target.closest('[data-skip]');
    if (sk) { setStatus(sk.dataset.skip, 'skipped'); return; }
    const tb = e.target.closest('[data-tab]');
    if (tb) { switchTab(tb.dataset.tab); return; }
  });
  const cf = $('clientForm'); if (cf) cf.addEventListener('submit', addClient);

  render();
})();
