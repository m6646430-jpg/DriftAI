const fs = require('fs');

const W = 1080, H = 1080;

// Shared defs: brand gradient + dark bg
const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1020"/>
      <stop offset="1" stop-color="#161b36"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#60a5fa"/>
      <stop offset="1" stop-color="#a78bfa"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.30" r="0.7">
      <stop offset="0" stop-color="#6d8bff" stop-opacity="0.30"/>
      <stop offset="1" stop-color="#6d8bff" stop-opacity="0"/>
    </radialGradient>
  </defs>`;

const F = "Inter, 'Helvetica Neue', Arial, sans-serif";

// Small DriftAI logo lockup at top
function logo(y = 90) {
  return `
  <g transform="translate(80 ${y})">
    <rect x="0" y="-34" width="60" height="60" rx="16" fill="url(#accent)"/>
    <text x="30" y="12" text-anchor="middle" font-family="${F}" font-size="40" font-weight="800" fill="#0b1020">D</text>
    <text x="82" y="10" font-family="${F}" font-size="40" font-weight="800">
      <tspan fill="#ffffff">Drift</tspan><tspan fill="url(#accent)">AI</tspan>
    </text>
  </g>`;
}

function base(inner) {
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${defs}
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="540" cy="330" r="520" fill="url(#glow)"/>
  ${logo()}
  ${inner}
</svg>`;
}

// helper: a pricing/list row
function row(y, label, price) {
  return `
    <g transform="translate(80 ${y})">
      <rect x="0" y="0" width="920" height="96" rx="20" fill="#ffffff" opacity="0.05"/>
      <text x="34" y="60" font-family="${F}" font-size="40" font-weight="700" fill="#eef2ff">${label}</text>
      <text x="886" y="60" text-anchor="end" font-family="${F}" font-size="42" font-weight="800" fill="url(#accent)">${price}</text>
    </g>`;
}

const cards = {};

/* ---------- /pricing ---------- */
cards['card-pricing'] = base(`
  <text x="80" y="250" font-family="${F}" font-size="72" font-weight="900" fill="#ffffff">Our Pricing <tspan fill="url(#accent)">(USD)</tspan></text>
  ${row(320, 'Resume Only', '$79.99')}
  ${row(432, 'Resume + Cover Letter', '$99.99')}
  ${row(544, 'Complete (with LinkedIn)', '$149.99')}
  ${row(656, 'Let Us Apply · 30/day', '$150/mo')}
  ${row(768, 'Community', '$9.99/mo')}
  <text x="540" y="960" text-anchor="middle" font-family="${F}" font-size="38" font-weight="600" fill="rgba(255,255,255,0.55)">driftai.info</text>
`);

/* ---------- /resume ---------- */
cards['card-resume'] = base(`
  <text x="80" y="250" font-family="${F}" font-size="70" font-weight="900" fill="#ffffff">Expert Resume<tspan x="80" dy="84">Writing</tspan></text>
  <g font-family="${F}" font-size="44" font-weight="600" fill="#dbe2ff">
    <text x="80" y="480">✅ Written by a real human expert</text>
    <text x="80" y="570">✅ ATS-optimized for your role</text>
    <text x="80" y="660">✅ Delivered in 48 hours</text>
    <text x="80" y="750">✅ Free revision included</text>
  </g>
  <g transform="translate(80 850)">
    <rect x="0" y="0" width="920" height="110" rx="24" fill="url(#accent)"/>
    <text x="460" y="72" text-anchor="middle" font-family="${F}" font-size="46" font-weight="800" fill="#0b1020">From $79.99 · driftai.info</text>
  </g>
`);

/* ---------- /apply ---------- */
cards['card-apply'] = base(`
  <text x="80" y="250" font-family="${F}" font-size="72" font-weight="900" fill="#ffffff">Let Us <tspan fill="url(#accent)">Apply</tspan></text>
  <text x="80" y="330" font-family="${F}" font-size="40" font-weight="600" fill="rgba(255,255,255,0.6)">Done-for-you job applications</text>
  <g font-family="${F}" font-size="44" font-weight="600" fill="#dbe2ff">
    <text x="80" y="470">🎯 Tailored resume + cover letter per role</text>
    <text x="80" y="560">📤 Up to 30 applications / day</text>
    <text x="80" y="650">📞 1 strategy call included</text>
    <text x="80" y="740">🧑‍💼 You just show up to interviews</text>
  </g>
  <g transform="translate(80 850)">
    <rect x="0" y="0" width="920" height="110" rx="24" fill="url(#accent)"/>
    <text x="460" y="72" text-anchor="middle" font-family="${F}" font-size="48" font-weight="800" fill="#0b1020">$150 / month</text>
  </g>
`);

/* ---------- /score ---------- */
cards['card-score'] = base(`
  <text x="80" y="250" font-family="${F}" font-size="70" font-weight="900" fill="#ffffff">Free AI Resume<tspan x="80" dy="84">Score</tspan></text>
  <!-- score ring -->
  <g transform="translate(540 620)">
    <circle r="180" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="34"/>
    <circle r="180" fill="none" stroke="url(#accent)" stroke-width="34" stroke-linecap="round"
            stroke-dasharray="1131" stroke-dashoffset="192" transform="rotate(-90)"/>
    <text y="-10" text-anchor="middle" font-family="${F}" font-size="130" font-weight="900" fill="#ffffff">83</text>
    <text y="60" text-anchor="middle" font-family="${F}" font-size="42" font-weight="700" fill="rgba(255,255,255,0.5)">/ 100</text>
  </g>
  <text x="540" y="900" text-anchor="middle" font-family="${F}" font-size="44" font-weight="700" fill="#dbe2ff">No signup · results in seconds</text>
  <text x="540" y="965" text-anchor="middle" font-family="${F}" font-size="40" font-weight="800" fill="url(#accent)">driftai.info</text>
`);

/* ---------- /countries ---------- */
cards['card-countries'] = base(`
  <text x="80" y="250" font-family="${F}" font-size="66" font-weight="900" fill="#ffffff">We Help Job Seekers<tspan x="80" dy="82">In 7 Countries</tspan></text>
  <g font-family="${F}" font-size="150" text-anchor="middle">
    <text x="300" y="560">🇺🇸</text><text x="540" y="560">🇨🇦</text><text x="780" y="560">🇬🇧</text>
    <text x="420" y="740">🇪🇺</text><text x="660" y="740">🇮🇳</text>
    <text x="300" y="920">🇦🇺</text><text x="780" y="920">🇳🇿</text>
  </g>
  <text x="540" y="1010" text-anchor="middle" font-family="${F}" font-size="38" font-weight="700" fill="rgba(255,255,255,0.55)">USA · Canada · UK · Europe · India · Australia · NZ</text>
`);

/* ---------- /pay ---------- */
cards['card-pay'] = base(`
  <text x="80" y="250" font-family="${F}" font-size="72" font-weight="900" fill="#ffffff">Secure <tspan fill="url(#accent)">Payments</tspan></text>
  <g transform="translate(540 560)">
    <rect x="-260" y="-150" width="520" height="300" rx="40" fill="#ffffff" opacity="0.06"/>
    <text y="10" text-anchor="middle" font-family="${F}" font-size="130">🔒</text>
  </g>
  <g font-family="${F}" font-size="44" font-weight="600" fill="#dbe2ff">
    <text x="80" y="830">✅ Powered by Stripe</text>
    <text x="80" y="910">✅ All prices in USD</text>
    <text x="80" y="990">✅ Your card never touches our servers</text>
  </g>
`);

for (const [name, svg] of Object.entries(cards)) {
  fs.writeFileSync(`${name}.svg`, svg);
  console.log('wrote', name + '.svg');
}
