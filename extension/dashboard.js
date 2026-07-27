// DriftAI Auto-Apply — dashboard
// Fetches jobs from driftai.info, matches them to the saved profile, lets you
// open + auto-fill the best ones, and tracks status live. No server involved.

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUS_KEY = 'ds_apply_status';
let JOBS = [], profile = null, matches = [];

// ---- matching ----
function scoreMatch(p, job) {
  const skills = (p.skills || '').toLowerCase();
  let s = 0;
  if (!p.targetCountry || p.targetCountry === 'any' || p.targetCountry === job.country) s += 15;
  const js = job.skills || [];
  if (js.length && skills) { const hit = js.filter(k => skills.includes(k)).length; s += Math.round((hit / js.length) * 55); }
  else s += 18;
  const t = (p.targetRole || '').toLowerCase();
  if (t) { const w = t.split(/\W+/).filter(x => x.length > 3); s += w.some(x => (job.role || '').toLowerCase().includes(x)) ? 30 : 0; }
  else s += 15;
  return Math.max(0, Math.min(100, s));
}
const mClass = m => m >= 75 ? 'm-hi' : m >= 55 ? 'm-mid' : 'm-lo';
const stLabel = { opening: 'Opening…', filled: 'Filled — submit', 'needs-you': 'Needs you', submitted: 'Submitted', skipped: 'Skipped' };

// ---- boot ----
(async function init() {
  const store = await chrome.storage.local.get(['driftai_profile', 'ds_auto_mode']);
  profile = store.driftai_profile;
  if (!profile || !profile.email) { $('setup').style.display = 'block'; wireSetup(); return; }
  $('app').style.display = 'block';
  $('autoMode').checked = store.ds_auto_mode !== false; // default ON — the agent auto-fills

  try {
    const res = await fetch('https://driftai.info/data/jobs.json?t=' + Date.now());
    JOBS = (await res.json()).jobs || [];
  } catch { JOBS = []; }

  matches = JOBS.map(j => ({ job: j, match: scoreMatch(profile, j) })).sort((a, b) => b.match - a.match).slice(0, 12);
  renderMatches();
  renderTracker();
  chrome.storage.onChanged.addListener((ch) => { if (ch[STATUS_KEY]) renderTracker(); });

  $('autoMode').addEventListener('change', e => chrome.storage.local.set({ ds_auto_mode: e.target.checked }));
  $('editProfile').addEventListener('click', e => { e.preventDefault(); chrome.runtime.openOptionsPage(); });
  $('applyAll').addEventListener('click', applyBatch);
  $('clearDone').addEventListener('click', clearFinished);
})();

function wireSetup() { $('goProfile').addEventListener('click', e => { e.preventDefault(); chrome.runtime.openOptionsPage(); }); }

function renderMatches() {
  if (!matches.length) { $('matches').innerHTML = '<div class="empty">Couldn\'t load jobs. Check your connection and reopen.</div>'; return; }
  const strong = matches.filter(m => m.match >= 70).length;
  const head = document.querySelector('.sec-head h2');
  if (head) head.innerHTML = `Top matches for you <span style="font-weight:600;color:rgba(255,255,255,0.45);font-size:13px;">· ${matches.length} shown, ${strong} strong (70%+)</span>`;
  $('matches').innerHTML = matches.map((m, i) => `
    <div class="card">
      <span class="match ${mClass(m.match)}">🎯 ${m.match}%</span>
      <div class="co">${esc(m.job.company)} · ${esc(m.job.country)}</div>
      <div class="role">${esc(m.job.role)}</div>
      <div class="skills">${(m.job.skills || []).slice(0, 5).map(s => `<span>${esc(s)}</span>`).join('')}</div>
      <div class="row">
        <button class="btn small" data-skip="${i}">Pass</button>
        <button class="btn primary small" data-apply="${i}">Apply</button>
      </div>
    </div>`).join('');
  $('matches').querySelectorAll('[data-apply]').forEach(b => b.addEventListener('click', () => { const m = matches[+b.dataset.apply]; applyJob(m.job, m.match); }));
  $('matches').querySelectorAll('[data-skip]').forEach(b => b.addEventListener('click', () => markSkipped(matches[+b.dataset.skip].job, matches[+b.dataset.skip].match)));
}

// One-click: open + auto-fill the top matches that aren't already in flight.
async function applyBatch() {
  const btn = $('applyAll');
  const status = (await chrome.storage.local.get(STATUS_KEY))[STATUS_KEY] || {};
  const batch = matches.filter(m => !status[m.job.id]).slice(0, 5);
  if (!batch.length) { btn.textContent = '✓ Top matches already applied'; setTimeout(() => btn.textContent = '⚡ Open + fill top 5', 3000); return; }
  btn.disabled = true;
  document.querySelector('table')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  for (let i = 0; i < batch.length; i++) {
    btn.textContent = `⚡ Applying… ${i + 1}/${batch.length}`;
    await applyJob(batch[i].job, batch[i].match, false); // background tabs
    await new Promise(r => setTimeout(r, 1400));
  }
  btn.textContent = `✅ Opened ${batch.length} — check the tracker`;
  setTimeout(() => { btn.disabled = false; btn.textContent = '⚡ Open + fill top 5'; }, 4000);
}

const TABJOB = 'ds_tab_job';
async function applyJob(job, match, active = true) {
  // Set the row to "opening", then open the application tab directly and
  // remember which tab is which job (so fill-reports update the right row).
  const s = (await chrome.storage.local.get(STATUS_KEY))[STATUS_KEY] || {};
  s[job.id] = { status: 'opening', note: 'Opening application…', role: job.role, company: job.company, match, ts: Date.now() };
  await chrome.storage.local.set({ [STATUS_KEY]: s });
  try {
    if (!/^https?:\/\//.test(job.url || '')) throw new Error('no url');
    const tab = await chrome.tabs.create({ url: job.url, active });
    const map = (await chrome.storage.local.get(TABJOB))[TABJOB] || {};
    map[tab.id] = job.id;
    await chrome.storage.local.set({ [TABJOB]: map });
  } catch (e) {
    s[job.id] = { ...s[job.id], status: 'needs-you', note: 'Couldn\'t open automatically — open the posting manually.' };
    await chrome.storage.local.set({ [STATUS_KEY]: s });
  }
}
async function markSkipped(job, match) {
  const s = (await chrome.storage.local.get(STATUS_KEY))[STATUS_KEY] || {};
  s[job.id] = { status: 'skipped', role: job.role, company: job.company, match, ts: Date.now() };
  chrome.storage.local.set({ [STATUS_KEY]: s });
}
async function setRowStatus(jobId, status) {
  const s = (await chrome.storage.local.get(STATUS_KEY))[STATUS_KEY] || {};
  if (s[jobId]) { s[jobId].status = status; s[jobId].ts = Date.now(); chrome.storage.local.set({ [STATUS_KEY]: s }); }
}
async function clearFinished() {
  const s = (await chrome.storage.local.get(STATUS_KEY))[STATUS_KEY] || {};
  for (const id in s) if (['submitted', 'skipped'].includes(s[id].status)) delete s[id];
  chrome.storage.local.set({ [STATUS_KEY]: s });
}

async function renderTracker() {
  const s = (await chrome.storage.local.get(STATUS_KEY))[STATUS_KEY] || {};
  const rows = Object.entries(s).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.ts - a.ts);
  $('trackerEmpty').style.display = rows.length ? 'none' : 'block';
  // match the current-match list so the tracker mirrors the job's match% column
  $('tracker').innerHTML = rows.map(r => {
    const canSubmit = r.status === 'filled' || r.status === 'needs-you';
    return `
    <tr>
      <td>${esc(r.role || '—')}<div style="font-size:11px;color:rgba(255,255,255,0.4);">${esc(r.note || '')}</div></td>
      <td>${esc(r.company || '')}</td>
      <td>${typeof r.match === 'number' ? `<span class="pill ${mClass(r.match)}">${r.match}%</span>` : '—'}</td>
      <td><span class="pill st-${esc(r.status)}">${esc(stLabel[r.status] || r.status)}</span></td>
      <td style="text-align:right;white-space:nowrap;">
        ${canSubmit ? `<button class="btn small" data-done="${esc(r.id)}">Mark submitted</button>` : ''}
      </td>
    </tr>`;
  }).join('');
  $('tracker').querySelectorAll('[data-done]').forEach(b => b.addEventListener('click', () => setRowStatus(b.dataset.done, 'submitted')));
}
