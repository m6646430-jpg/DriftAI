#!/usr/bin/env node
/**
 * DriftAI — Daily Job Fetcher
 * Pulls fresh Canada + USA jobs from the Adzuna free API and writes data/jobs.json.
 *
 * SETUP (one time):
 *   1. Get a free API key at https://developer.adzuna.com/  (250 calls/month free)
 *   2. Set env vars before running:
 *        export ADZUNA_APP_ID=your_app_id
 *        export ADZUNA_APP_KEY=your_app_key
 *   3. Run: node scripts/fetch-jobs.js
 *
 * If keys are missing or a request fails, the existing data/jobs.json is left
 * untouched so the site never breaks.
 *
 * Requires Node 18+ (uses built-in fetch). You have Node 24 — good.
 */

const fs = require('fs');
const path = require('path');
const { enhanceJobs } = require('./ai-enhance');

const APP_ID = process.env.ADZUNA_APP_ID;
const APP_KEY = process.env.ADZUNA_APP_KEY;
const OUT = path.join(__dirname, '..', 'data', 'jobs.json');

// What to pull. Each entry = one API call. Keep total low to respect the free tier.
const QUERIES = [
  { country: 'ca', category: 'Tech', what: 'software engineer' },
  { country: 'ca', category: 'Data', what: 'data analyst' },
  { country: 'ca', category: 'Finance', what: 'financial analyst' },
  { country: 'us', category: 'Tech', what: 'software engineer' },
  { country: 'us', category: 'Data', what: 'data analyst' },
  { country: 'us', category: 'Marketing', what: 'marketing manager' },
];

const RESULTS_PER_QUERY = 8;

const LOGOS = { Tech: '💻', Data: '📊', Finance: '🏦', Marketing: '📱' };

// Companies known to sponsor work visas — tag these so job-seekers can filter.
const SPONSOR_HINTS = ['google', 'amazon', 'microsoft', 'meta', 'apple', 'shopify',
  'stripe', 'netflix', 'salesforce', 'ibm', 'oracle', 'deloitte', 'rbc', 'td', 'cibc', 'scotiabank'];

function money(min, max) {
  if (!min && !max) return null;
  const f = n => '$' + Math.round(n).toLocaleString();
  if (min && max) return `${f(min)} – ${f(max)}`;
  return f(min || max);
}

function ago(iso) {
  if (!iso) return 'Recently';
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diff / 3.6e6);
  if (hrs < 1) return 'Just now';
  if (hrs < 24) return `Posted ${hrs} hrs ago`;
  const d = Math.floor(hrs / 24);
  return `Posted ${d} day${d > 1 ? 's' : ''} ago`;
}

function sponsorTag(company, country) {
  const c = (company || '').toLowerCase();
  if (!SPONSOR_HINTS.some(h => c.includes(h))) return null;
  return country === 'ca' ? 'PGWP · LMIA friendly' : 'H-1B friendly';
}

async function fetchQuery(q) {
  const url = `https://api.adzuna.com/v1/api/jobs/${q.country}/search/1`
    + `?app_id=${APP_ID}&app_key=${APP_KEY}`
    + `&results_per_page=${RESULTS_PER_QUERY}`
    + `&what=${encodeURIComponent(q.what)}`
    + `&max_days_old=3&sort_by=date&content-type=application/json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Adzuna ${q.country}/${q.what} -> ${res.status}`);
  const data = await res.json();
  return (data.results || []).map(r => ({
    id: String(r.id),
    role: r.title.replace(/<\/?[^>]+>/g, '').trim(),
    company: (r.company && r.company.display_name) || 'Company',
    location: (r.location && r.location.display_name) || '',
    country: q.country.toUpperCase(),
    category: q.category,
    salary: money(r.salary_min, r.salary_max),
    remote: /remote/i.test(r.title + ' ' + (r.description || '')) ? 'Remote' : 'On-site / Hybrid',
    sponsor: sponsorTag(r.company && r.company.display_name, q.country),
    posted: ago(r.created),
    url: r.redirect_url,
    logo: LOGOS[q.category] || '💼',
  }));
}

async function main() {
  if (!APP_ID || !APP_KEY) {
    console.log('⚠  ADZUNA_APP_ID / ADZUNA_APP_KEY not set. Keeping existing data/jobs.json.');
    console.log('   Get a free key at https://developer.adzuna.com/ then set the env vars.');
    process.exit(0);
  }

  const all = [];
  const seen = new Set();
  for (const q of QUERIES) {
    try {
      const jobs = await fetchQuery(q);
      for (const j of jobs) {
        const key = (j.role + j.company).toLowerCase();
        if (!seen.has(key) && j.role) { seen.add(key); all.push(j); }
      }
      console.log(`✓ ${q.country.toUpperCase()} ${q.what}: ${jobs.length} jobs`);
    } catch (e) {
      console.error(`✗ ${e.message}`);
    }
  }

  if (!all.length) {
    console.log('No jobs returned — keeping existing data/jobs.json unchanged.');
    process.exit(0);
  }

  // Hybrid step: AI curates + tags the real jobs (facts/links preserved).
  const curated = await enhanceJobs(all, 15);

  const payload = {
    updated: new Date().toISOString(),
    source: process.env.OPENROUTER_API_KEY ? 'adzuna+ai' : 'adzuna',
    jobs: curated,
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`\n✅ Wrote ${payload.jobs.length} jobs to data/jobs.json at ${payload.updated}`);
}

main();
