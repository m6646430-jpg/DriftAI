// ===== PAYMENT (Stripe Payment Links) =====
// Create one Stripe Payment Link per product at https://dashboard.stripe.com/payment-links
// then paste each generated URL below, replacing the placeholders.
//   community        -> Recurring, $9.99 USD/month
//   jobhunt          -> Recurring, $150 USD/month (Job Hunt Program)
//   resume_only       -> One-time, $79.99 USD
//   resume_rewrite    -> One-time, $99.99 USD (Resume + Cover Letter)
//   resume_complete   -> One-time, $149.99 USD (Complete Package)
// Any element with class="payment-link" and data-plan="community" (etc.) will redirect
// to the matching link automatically. data-plan defaults to "community" if omitted.
const STRIPE_LINKS = {
  community: 'https://buy.stripe.com/8x2aEXc408RXch660l4wM00',
  jobhunt: 'https://buy.stripe.com/7sY28rec82tzfti3Sd4wM01',
  resume_only: 'https://buy.stripe.com/6oU8wPaZWfgla8Y1K54wM02',
  resume_rewrite: 'https://buy.stripe.com/7sY4gz5FC6JPbd2ewR4wM03',
  resume_complete: 'https://buy.stripe.com/6oUdR91pmechgxm88t4wM04',
};

document.querySelectorAll('.payment-link').forEach(el => {
  const plan = el.dataset.plan || 'community';
  el.href = STRIPE_LINKS[plan] || '#';
  el.target = '_blank';
  el.rel = 'noopener';
});

// ===== GEO-AWARE PRICING (India → show ₹) =====
// We charge in USD (Stripe links are USD), but for visitors in India we lead
// with the rupee price so it feels local, and clearly note it's billed in USD.
// Detection uses the browser timezone — no API, no key, no network call.
(function localizePrices() {
  let inIndia = false;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    inIndia = /Kolkata|Calcutta/i.test(tz);
  } catch (e) { /* older browser — fall back to USD */ }

  document.querySelectorAll('.plan-price[data-inr]').forEach(priceEl => {
    const note = priceEl.parentElement.querySelector('.plan-inr');
    if (inIndia) {
      const inr = priceEl.dataset.inr, usd = priceEl.dataset.usd || '';
      priceEl.innerHTML = '₹' + inr + '<span> INR</span>';
      if (note) note.textContent = 'Billed as $' + usd + ' USD at checkout';
    } else if (note) {
      // Non-India visitors: keep USD only, hide the rupee line.
      note.style.display = 'none';
    }
  });
})();

// ===== MOBILE MENU =====
function toggleMenu() {
  document.getElementById('mobileMenu').classList.toggle('open');
}
document.querySelectorAll('.mobile-menu a').forEach(a =>
  a.addEventListener('click', () => document.getElementById('mobileMenu')?.classList.remove('open'))
);

// ===== TYPEWRITER =====
const phrases = ['Apply In One Tap', 'In Seconds With AI', 'Without Lifting a Finger', 'Across 50,000+ Jobs'];
let phraseIdx = 0, charIdx = 0, deleting = false;
const tw = document.getElementById('typewriter');

function typewrite() {
  if (!tw) return;
  const current = phrases[phraseIdx];
  if (!deleting) {
    tw.textContent = current.slice(0, ++charIdx);
    if (charIdx === current.length) { deleting = true; return setTimeout(typewrite, 2200); }
  } else {
    tw.textContent = current.slice(0, --charIdx);
    if (charIdx === 0) { deleting = false; phraseIdx = (phraseIdx + 1) % phrases.length; }
  }
  setTimeout(typewrite, deleting ? 45 : 95);
}
setTimeout(typewrite, 800);

// ===== FLOATING JOB CARDS =====
const jobCards = [
  { emoji: '🏦', company: 'RBC Royal Bank', role: 'Business Analyst', color: '#1a56db' },
  { emoji: '🛒', company: 'Amazon Canada', role: 'Software Engineer', color: '#f90' },
  { emoji: '🏪', company: 'Shopify', role: 'Product Manager', color: '#96bf48' },
  { emoji: '🏛️', company: 'TD Bank', role: 'Data Analyst', color: '#00b04f' },
  { emoji: '🔍', company: 'Google', role: 'UX Designer', color: '#4285f4' },
  { emoji: '💡', company: 'Deloitte', role: 'Consultant', color: '#86bc25' },
  { emoji: '📡', company: 'Rogers', role: 'Project Manager', color: '#e3221c' },
  { emoji: '🏦', company: 'CIBC', role: 'Financial Analyst', color: '#c41f3e' },
  { emoji: '🖥️', company: 'Microsoft', role: 'Cloud Engineer', color: '#0078d4' },
  { emoji: '📦', company: 'Walmart Canada', role: 'Supply Chain', color: '#007dc6' },
];

function spawnCard() {
  const container = document.getElementById('floatingCards');
  if (!container) return;
  const card = jobCards[Math.floor(Math.random() * jobCards.length)];
  const el = document.createElement('div');
  el.className = 'job-card-float';
  el.style.cssText = `left:${10 + Math.random() * 80}%;animation-duration:${9 + Math.random() * 8}s;animation-delay:${Math.random() * 2}s;`;
  el.innerHTML = `
    <div class="co-logo" style="background:${card.color}22;border:1px solid ${card.color}44;">${card.emoji}</div>
    <div>
      <div style="color:rgba(255,255,255,0.85);font-size:12px;font-weight:700;">${card.company}</div>
      <div style="color:rgba(255,255,255,0.45);font-size:11px;">${card.role}</div>
    </div>
    <div class="applied-tag">Now hiring</div>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 18000);
}
// Spawn cards periodically
for (let i = 0; i < 5; i++) setTimeout(spawnCard, i * 1800);
setInterval(spawnCard, 2200);

// ===== LIVE TICKER =====
const tickerData = [
  { company: 'Amazon', role: 'SWE II', location: 'Toronto' },
  { company: 'RBC', role: 'Data Analyst', location: 'Vancouver' },
  { company: 'Shopify', role: 'Product Manager', location: 'Ottawa' },
  { company: 'TD Bank', role: 'Business Analyst', location: 'Calgary' },
  { company: 'Google', role: 'UX Researcher', location: 'Waterloo' },
  { company: 'Deloitte', role: 'Consultant', location: 'Montreal' },
  { company: 'CIBC', role: 'Risk Analyst', location: 'Toronto' },
  { company: 'Scotiabank', role: 'Software Engineer', location: 'Halifax' },
  { company: 'Microsoft', role: 'Cloud Architect', location: 'Vancouver' },
  { company: 'Rogers', role: 'Project Manager', location: 'Toronto' },
];

function buildTicker() {
  const ticker = document.getElementById('ticker');
  if (!ticker) return;
  const items = [...tickerData, ...tickerData]; // duplicate for seamless loop
  ticker.innerHTML = items.map(t => `
    <span class="ticker-item">
      <span class="tick-status">🟢 Hiring</span>
      <span class="tick-co">${t.company}</span>
      <span style="color:rgba(255,255,255,0.3)">·</span>
      <span>${t.role}</span>
      <span style="color:rgba(255,255,255,0.3)">·</span>
      <span>${t.location}, CA</span>
      <span style="color:rgba(255,255,255,0.12);padding:0 8px;">|</span>
    </span>`).join('');
}
buildTicker();

// ===== ANIMATED COUNTERS =====
function animateCounter(el) {
  const target = parseInt(el.dataset.target);
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';
  const duration = 1800;
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const value = Math.round(ease * target);
    el.textContent = prefix + value.toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ===== COUNTER TRIGGER ON SCROLL =====
// Content is always visible (CSS animation handles reveal).
// We only need to fire counters when stats scroll into view.
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelectorAll('[data-target]').forEach(animateCounter);
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

const heroStats = document.querySelector('.hero-stats');
if (heroStats) counterObserver.observe(heroStats);

// ===== CONTACT FORM (Netlify Forms) =====
// Submissions are captured by Netlify and appear under Forms in the dashboard
// (enable email notifications there to get each lead in your inbox).
function submitForm(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  btn.textContent = 'Sending...';
  btn.disabled = true;

  fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(new FormData(form)).toString(),
  })
    .then(res => {
      if (!res.ok) throw new Error('submit failed ' + res.status);
      form.style.display = 'none';
      document.getElementById('formSuccess').style.display = 'block';
    })
    .catch(() => {
      btn.textContent = 'Submit — Get Started Today 🚀';
      btn.disabled = false;
      alert("Sorry, something went wrong sending your message. Please try again, or email support@driftai.info");
    });
}

// ===== SMOOTH SCROLL =====
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});

// ===== NAV SCROLL EFFECT =====
window.addEventListener('scroll', () => {
  const nav = document.querySelector('.nav');
  if (nav) nav.style.background = window.scrollY > 60
    ? 'rgba(6,6,20,0.95)' : 'rgba(6,6,20,0.8)';
}, { passive: true });
