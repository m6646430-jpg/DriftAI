// ===== DYNAMIC JOB BOARD =====
// Renders jobs from data/jobs.json. Updated daily by scripts/fetch-jobs.js.
let ALL_JOBS = [];
let activeCountry = 'all';
let activeCat = 'all';

async function loadJobs() {
  const list = document.getElementById('jobboardList');
  const meta = document.getElementById('jobsMeta');
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
  const jobs = ALL_JOBS.filter(j => {
    const countryOk = activeCountry === 'all' || j.country === activeCountry;
    let catOk = true;
    if (activeCat === 'sponsor') catOk = !!j.sponsor;
    else if (activeCat !== 'all') catOk = j.category === activeCat;
    return countryOk && catOk;
  });

  if (!jobs.length) {
    list.innerHTML = `<div style="text-align:center;color:rgba(255,255,255,0.4);padding:40px;">No roles match this filter yet — check back tomorrow, we update daily.</div>`;
    return;
  }

  list.innerHTML = jobs.map(j => {
    const flag = j.country === 'US' ? '🇺🇸' : j.country === 'CA' ? '🇨🇦' : '🌐';
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
  loadJobs();
});
