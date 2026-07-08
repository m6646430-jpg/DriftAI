// ===== DYNAMIC JOB BOARD =====
// Renders jobs from data/jobs.json. Updated daily by scripts/fetch-jobs.js.

// Feature flag: jobs now have exact posting links from public ATS feeds.
const SHOW_JOBS = true;

let ALL_JOBS = [];
let activeCountry = 'all';
let activeCat = 'all';
let activeSort = 'recent';
let activeSearch = '';

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

function render() {
  const list = document.getElementById('jobboardList');
  if (!list) return;
  const q = activeSearch.trim().toLowerCase();
  const jobs = ALL_JOBS.filter(j => {
    const countryOk = activeCountry === 'all' || j.country === activeCountry;
    let catOk = true;
    if (activeCat === 'sponsor') catOk = !!j.sponsor;
    else if (activeCat !== 'all') catOk = j.category === activeCat;
    const searchOk = !q ||
      (j.role && j.role.toLowerCase().includes(q)) ||
      (j.company && j.company.toLowerCase().includes(q)) ||
      (j.location && j.location.toLowerCase().includes(q));
    return countryOk && catOk && searchOk;
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
    list.innerHTML = `<div style="text-align:center;color:rgba(255,255,255,0.4);padding:40px;">No roles match this filter yet — check back tomorrow, we update daily.</div>`;
    return;
  }

  list.innerHTML = jobs.map(j => {
    const FLAGS = { US: '🇺🇸', CA: '🇨🇦', UK: '🇬🇧', EU: '🇪🇺', IN: '🇮🇳', AU: '🇦🇺', NZ: '🇳🇿' };
    const flag = FLAGS[j.country] || '🌐';
    const salary = j.salary ? `<span class="jb-tag salary">${j.salary}</span>` : '';
    const remote = j.remote ? `<span class="jb-tag">${j.remote}</span>` : '';
    const sponsor = j.sponsor ? `<span class="jb-tag sponsor">${j.sponsor}</span>` : '';
    return `
    <div class="jobboard-card">
      <div class="jb-logo">${j.logo || '💼'}</div>
      <div>
        <div class="jb-role">${j.role}</div>
        <div class="jb-company">${flag} ${j.company} · ${j.location}</div>
        ${j.blurb ? `<div class="jb-blurb">✦ ${j.blurb}</div>` : ''}
        <div class="jb-meta">${salary}${remote}${sponsor}</div>
      </div>
      <div class="jb-right">
        <div class="jb-posted">${j.posted || ''}</div>
        <a href="${j.url || 'jobhunt.html'}" class="jb-apply" target="_blank" rel="noopener">Apply →</a>
        <button class="jb-tailor" data-jobid="${j.id}">✨ Tailor Resume</button>
      </div>
    </div>`;
  }).join('');
}

// ===== FILTER WIRING =====
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-country]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-country]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCountry = btn.dataset.country;
      render();
    });
  });
  document.querySelectorAll('[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-cat]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCat = btn.dataset.cat;
      render();
    });
  });
  const sortEl = document.getElementById('jobSort');
  if (sortEl) sortEl.addEventListener('change', () => { activeSort = sortEl.value; render(); });
  const searchEl = document.getElementById('jobSearch');
  const clearEl = document.getElementById('jobSearchClear');
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      activeSearch = searchEl.value;
      if (clearEl) clearEl.style.display = activeSearch ? 'flex' : 'none';
      render();
    });
  }
  if (clearEl) clearEl.addEventListener('click', () => {
    searchEl.value = ''; activeSearch = ''; clearEl.style.display = 'none'; render(); searchEl.focus();
  });
  loadJobs();
});
