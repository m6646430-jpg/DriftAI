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
  $('autoMode').checked = !!store.ds_auto_mode;

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
  $('applyAll').addEventListener('click', () => matches.slice(0, 5).forEach((m, i) => setTimeout(() => applyJob(m.job, m.match), i * 900)));
  $('clearDone').addEventListener('click', clearFinished);
})();

function wireSetup() { $('goProfile').addEventListener('click', e => { e.preventDefault(); chrome.runtime.openOptionsPage(); }); }

function renderMatches() {
  if (!matches.length) { $('matches').innerHTML = '<div class="empty">Couldn\'t load jobs. Check your connection and reopen.</div>'; return; }
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

function applyJob(job, match) {
  chrome.runtime.sendMessage({ type: 'apply-job', job: { id: job.id, url: job.url, role: job.role, company: job.company, match } });
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
