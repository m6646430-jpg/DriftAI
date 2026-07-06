// ===== DRIFTAI ADMIN DASHBOARD =====
// Reads data/dashboard.json + data/jobs.json. Edit those files to update.
const money = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MARKET_FLAG = { CA: '🇨🇦', US: '🇺🇸', UK: '🇬🇧', IN: '🇮🇳', AU: '🇦🇺', NZ: '🇳🇿' };

async function loadDashboard() {
  const [d, j] = await Promise.all([
    fetch('data/dashboard.json?t=' + Date.now()).then(r => r.json()),
    fetch('data/jobs.json?t=' + Date.now()).then(r => r.json()).catch(() => ({ jobs: [], updated: null })),
  ]);

  // ---- REVENUE ----
  const collected = d.orders.reduce((s, o) => s + o.amount, 0);
  const pct = Math.min(100, (collected / d.revenueGoal) * 100);
  document.getElementById('revNum').textContent = money(collected);
  document.getElementById('revGoal').textContent = `of ${money(d.revenueGoal)} goal · ${d.periodLabel}`;
  document.getElementById('revBar').style.width = pct + '%';
  document.getElementById('revPct').textContent = pct.toFixed(1) + '%';

  // ---- TOP STATS ----
  const delivered = d.orders.filter(o => o.status === 'Delivered').length;
  document.getElementById('statOrders').textContent = d.orders.length;
  document.getElementById('statDelivered').textContent = delivered;
  document.getElementById('statJobs').textContent = (j.jobs || []).length;
  const remaining = Math.max(0, d.revenueGoal - collected);
  document.getElementById('statRemaining').textContent = money(remaining);

  // ---- PIPELINE (Kanban) ----
  const cols = { New: 'colNew', Writing: 'colWriting', Delivered: 'colDelivered' };
  Object.values(cols).forEach(id => document.getElementById(id).innerHTML = '');
  const counts = { New: 0, Writing: 0, Delivered: 0 };
  d.orders.forEach(o => {
    const colId = cols[o.status] || 'colNew';
    counts[o.status in counts ? o.status : 'New']++;
    const card = document.createElement('div');
    card.className = 'kan-card';
    card.innerHTML = `
      <div class="kan-top"><span class="kan-client">${MARKET_FLAG[o.market] || '🌐'} ${o.client}</span><span class="kan-amt">${money(o.amount)}</span></div>
      <div class="kan-product">${o.product}</div>
      <div class="kan-date">${o.id} · ${o.date}</div>`;
    document.getElementById(colId).appendChild(card);
  });
  document.getElementById('cntNew').textContent = counts.New;
  document.getElementById('cntWriting').textContent = counts.Writing;
  document.getElementById('cntDelivered').textContent = counts.Delivered;

  // ---- MARKET BREAKDOWN ----
  const markets = {};
  d.orders.forEach(o => { markets[o.market] = (markets[o.market] || 0) + o.amount; });
  document.getElementById('marketList').innerHTML = Object.entries(markets)
    .sort((a, b) => b[1] - a[1])
    .map(([m, amt]) => `
      <div class="market-row">
        <span>${MARKET_FLAG[m] || '🌐'} ${m}</span>
        <span class="market-amt">${money(amt)}</span>
      </div>`).join('');

  // ---- CONTENT CHECKLIST ----
  const doneCount = d.content.filter(c => c.done).length;
  document.getElementById('contentProgress').textContent = `${doneCount} / ${d.content.length} reels filmed`;
  document.getElementById('contentList').innerHTML = d.content.map(c => `
    <label class="content-item ${c.done ? 'done' : ''}">
      <input type="checkbox" ${c.done ? 'checked' : ''} onchange="toggleReel(${c.reel}, this.checked)">
      <span class="ci-reel">#${c.reel}</span>
      <span class="ci-title">${c.title}</span>
      <span class="ci-day">${c.day}</span>
    </label>`).join('');

  // ---- JOBS FRESHNESS ----
  const when = j.updated ? new Date(j.updated) : null;
  document.getElementById('jobsUpdated').textContent = when
    ? 'Job board last updated ' + when.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Job board: no data yet';

  window.__DASH = d; // keep for local checkbox toggles
}

// Checkbox toggles are session-only (static site). Persist by editing data/dashboard.json.
function toggleReel(reel, checked) {
  const d = window.__DASH;
  const item = d.content.find(c => c.reel === reel);
  if (item) item.done = checked;
  const doneCount = d.content.filter(c => c.done).length;
  document.getElementById('contentProgress').textContent = `${doneCount} / ${d.content.length} reels filmed`;
  event.target.closest('.content-item').classList.toggle('done', checked);
}

loadDashboard();
