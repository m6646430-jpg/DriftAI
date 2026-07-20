// ===== DYNAMIC JOB BOARD =====
// Renders jobs from data/jobs.json. Updated daily by scripts/fetch-jobs.js.

// Feature flag: jobs now have exact posting links from public ATS feeds.
const SHOW_JOBS = true;

let ALL_JOBS = [];
let activeCountry = 'all';
let activeCat = 'all';
let activeSort = 'recent';
let activeSearch = '';
let latestOnly = false; // "🆕 Latest jobs" — only postings from the last 7 days
const LATEST_WINDOW_MS = 7 * 86400000;
let activeTech = 'all'; // filter by a specific technology (matched in title + JD)
const TECH_PATTERNS = {
  python: /\bpython\b/i,
  javascript: /\bjavascript\b/i,
  typescript: /\btypescript\b/i,
  react: /\breact\b/i,
  java: /\bjava\b/i,
  node: /\bnode\.?js\b|\bnodejs\b/i,
  aws: /\baws\b|\bamazon web services\b/i,
  sql: /\bsql\b|\bpostgres\b|\bmysql\b/i,
  kubernetes: /\bkubernetes\b|\bk8s\b/i,
  docker: /\bdocker\b/i,
  cpp: /c\+\+/i,
  rust: /\brust\b/i,
};
const PAGE_SIZE = 24;
let currentPage = 1;

function renderComingSoon() {
  const list = document.getElementById('jobboardList');
  const meta = document.getElementById('jobsMeta');
  if (meta) meta.innerHTML = '<span style="color:#fbbf24;">●</span> Job board launching soon';
  document.querySelectorAll('.jobboard-filter').forEach(b => { b.disabled = true; b.style.opacity = '0.4'; b.style.cursor = 'default'; });
  if (list) list.innerHTML = `
    <div style="text-align:center;padding:56px 24px;background:rgba(255,255,255,0.03);border:1px dashed rgba(251,191,36,0.35);border-radius:16px;">
      <div style="font-size:40px;margin-bottom:14px;">🚧</div>
      <div style="font-size:20px;font-weight:800;margin-bottom:8px;">Job Board launching very soon</div>
      <p style="color:rgba(255,255,255,0.55);max-width:440px;margin:0 auto 22px;font-size:14px;line-height:1.6;">
        We're verifying every listing so each Apply button takes you to the real,
        live job posting — no dead links, no ghost jobs. Check back shortly.
      </p>
      <a href="index.html#resume-score" class="btn btn-primary">Meanwhile — score your resume free →</a>
    </div>`;
}

async function loadJobs() {
  const list = document.getElementById('jobboardList');
  const meta = document.getElementById('jobsMeta');
  if (!SHOW_JOBS) return renderComingSoon();
  try {
    const res = await fetch('data/jobs.json?t=' + Date.now()); // cache-bust so daily updates show
    const data = await res.json();
    ALL_JOBS = data.jobs || [];
    pruneTechFilters(); // hide tech pills that have no matching jobs today
    if (meta) {
      const when = data.updated ? new Date(data.updated) : null;
      const stamp = when ? when.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      meta.innerHTML = `<span style="color:#34d399;">●</span> ${ALL_JOBS.length} live roles · Updated ${stamp}`;
    }
    render();
  } catch (e) {
    if (list) list.innerHTML = `<div style="text-align:center;color:rgba(255,255,255,0.4);padding:40px;">Couldn't load jobs right now. Please refresh.</div>`;
  }
}

// A job matches a tech if it's in the precomputed skills tags (from the full
// JD at build time) or the title mentions it — accurate regardless of how
// much of the JD we store.
function techMatch(j, tech) {
  if (Array.isArray(j.skills) && j.skills.includes(tech)) return true;
  const re = TECH_PATTERNS[tech];
  return re ? re.test(j.role || '') : false;
}

// Hide any technology pill that has zero matching jobs in the current data,
// so students never click a tech and hit an empty board.
function pruneTechFilters() {
  document.querySelectorAll('[data-tech]').forEach(btn => {
    const t = btn.dataset.tech;
    if (t === 'all') return;
    btn.style.display = ALL_JOBS.some(j => techMatch(j, t)) ? '' : 'none';
  });
}

function render() {
  const list = document.getElementById('jobboardList');
  if (!list) return;
  const q = activeSearch.trim().toLowerCase();
  // "Latest" is measured from the newest posting in the data (not the wall
  // clock) so it always shows the freshest week even if the board is a
  // little stale between rebuilds.
  const newestMs = latestOnly
    ? ALL_JOBS.reduce((m, j) => Math.max(m, j.postedAt ? Date.parse(j.postedAt) : 0), 0)
    : 0;
  const jobs = ALL_JOBS.filter(j => {
    const countryOk = activeCountry === 'all' || j.country === activeCountry;
    let catOk = true;
    if (activeCat === 'sponsor') catOk = !!j.sponsor;
    else if (activeCat !== 'all') catOk = j.category === activeCat;
    const searchOk = !q ||
      (j.role && j.role.toLowerCase().includes(q)) ||
      (j.company && j.company.toLowerCase().includes(q)) ||
      (j.location && j.location.toLowerCase().includes(q));
    const latestOk = !latestOnly || (j.postedAt && (newestMs - Date.parse(j.postedAt)) <= LATEST_WINDOW_MS);
    const techOk = activeTech === 'all' || techMatch(j, activeTech);
    return countryOk && catOk && searchOk && latestOk && techOk;
  });

  // Sort
  if (activeSort === 'recent') {
    jobs.sort((a, b) => {
      const ta = a.postedAt ? Date.parse(a.postedAt) : 0;
      const tb = b.postedAt ? Date.parse(b.postedAt) : 0;
      return tb - ta; // newest first
    });
  } else if (activeSort === 'company') {
    jobs.sort((a, b) => a.company.localeCompare(b.company));
  } else if (activeSort === 'role') {
    jobs.sort((a, b) => a.role.localeCompare(b.role));
  }

  if (!jobs.length) {
    list.innerHTML = `<div style="text-align:center;color:rgba(255,255,255,0.4);padding:40px;grid-column:1/-1;">No roles match this filter yet — check back tomorrow, we update daily.</div>`;
    renderPagebars(0, 1);
    return;
  }

  // Pagination
  const total = jobs.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageJobs = jobs.slice(start, start + PAGE_SIZE);
  renderPagebars(total, totalPages);

  const FLAGS = { US: '🇺🇸', CA: '🇨🇦', UK: '🇬🇧', EU: '🇪🇺', IN: '🇮🇳', AU: '🇦🇺', NZ: '🇳🇿' };
  list.innerHTML = pageJobs.map(j => {
    const flag = FLAGS[j.country] || '🌐';
    const letter = esc((j.company || '?').trim().charAt(0).toUpperCase());
    const level = levelOf(j.role);
    const isRemote = /remote/i.test(j.remote || '');
    const tags = [];
    if (j.sponsor) tags.push(`<span class="jbc-tag visa">🛂 ${esc(j.sponsor)}</span>`);
    if (j.salary) tags.push(`<span class="jbc-tag pay">${esc(j.salary)}</span>`);
    if (isRemote) tags.push(`<span class="jbc-tag remote">🌐 Remote</span>`);
    if (level) tags.push(`<span class="jbc-tag">${esc(level)}</span>`);
    if (j.source) tags.push(`<span class="jbc-tag">${esc(j.source)}</span>`);
    return `
    <div class="jobboard-card">
      <div class="jbc-head">
        <div class="jbc-logo">${letter}</div>
        <div class="jbc-co">
          <div class="jbc-company">${esc(j.company)}</div>
          <div class="jbc-posted">${esc(j.posted || 'Recently')} · ${flag} ${esc(j.country)}</div>
        </div>
      </div>
      <div class="jbc-title">${esc(j.role)}</div>
      <div class="jbc-loc">📍 ${esc((j.location || '—').split(/\s*[;/]\s*/)[0].slice(0, 40))}</div>
      <div class="jbc-tags">${tags.join('')}</div>
      <div class="jbc-actions">
        <a href="${safeUrl(j.url)}" class="jbc-apply" target="_blank" rel="noopener">↗ Apply</a>
        <button class="jbc-tailor jb-tailor" data-jobid="${esc(j.id)}">✨ Tailor Resume</button>
      </div>
    </div>`;
  }).join('');
}

// Escape everything that comes from external ATS feeds before it hits
// innerHTML — a compromised feed must never be able to run script here.
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Only allow real http(s) links — blocks javascript:/data: URLs from feeds.
function safeUrl(u) {
  return /^https?:\/\//i.test(u || '') ? esc(u) : 'jobhunt.html';
}

// Render the "Showing X–Y of Z · Page N of M · Prev/Next" bars (top + bottom).
function renderPagebars(total, totalPages) {
  const a = total ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const b = Math.min(currentPage * PAGE_SIZE, total);
  const html = `
    <div class="jbp-count">Showing <strong>${a}-${b}</strong> of <strong>${total}</strong> jobs</div>
    <div class="jbp-nav">
      <span class="jbp-page">Page ${currentPage} of ${totalPages}</span>
      <button class="jbp-btn" data-page="prev" ${currentPage <= 1 ? 'disabled' : ''}>‹ Prev</button>
      <button class="jbp-btn" data-page="next" ${currentPage >= totalPages ? 'disabled' : ''}>Next ›</button>
    </div>`;
  ['jobsPageTop', 'jobsPageBottom'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = html; });
}

function goToPage(dir) {
  currentPage += dir === 'next' ? 1 : -1;
  if (currentPage < 1) currentPage = 1;
  render();
  document.querySelector('.jobboard-filters')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Derive experience level from the job title (honest heuristic).
function levelOf(role) {
  const t = (role || '').toLowerCase();
  if (/\b(intern|internship|co-?op)\b/.test(t)) return 'internship';
  if (/\b(junior|jr\.?|entry|graduate|new grad|apprentice)\b/.test(t)) return 'entry level';
  if (/\b(senior|sr\.?|staff|principal|lead|director|head|vp|chief|manager)\b/.test(t)) return 'senior level';
  return 'mid level';
}

// ===== FILTER WIRING =====
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-country]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-country]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCountry = btn.dataset.country;
      currentPage = 1;
      render();
    });
  });
  document.querySelectorAll('[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-cat]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCat = btn.dataset.cat;
      currentPage = 1;
      render();
    });
  });
  document.querySelectorAll('[data-tech]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-tech]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTech = btn.dataset.tech;
      currentPage = 1;
      render();
    });
  });
  // Pagination buttons (delegated, top + bottom bars)
  document.addEventListener('click', e => {
    const b = e.target.closest('.jbp-btn');
    if (b && !b.disabled) goToPage(b.dataset.page);
  });
  const sortEl = document.getElementById('jobSort');
  if (sortEl) sortEl.addEventListener('change', () => { activeSort = sortEl.value; currentPage = 1; render(); });
  const latestEl = document.getElementById('latestToggle');
  if (latestEl) latestEl.addEventListener('click', () => {
    latestOnly = !latestOnly;
    latestEl.classList.toggle('active', latestOnly);
    if (latestOnly) { activeSort = 'recent'; if (sortEl) sortEl.value = 'recent'; } // newest first when showing latest
    currentPage = 1;
    render();
  });
  const searchEl = document.getElementById('jobSearch');
  const clearEl = document.getElementById('jobSearchClear');
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      activeSearch = searchEl.value;
      if (clearEl) clearEl.style.display = activeSearch ? 'flex' : 'none';
      currentPage = 1;
      render();
    });
  }
  if (clearEl) clearEl.addEventListener('click', () => {
    searchEl.value = ''; activeSearch = ''; clearEl.style.display = 'none'; currentPage = 1; render(); searchEl.focus();
  });
  loadJobs();
});
