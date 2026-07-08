#!/usr/bin/env node
/**
 * DriftAI — ATS Job Fetcher (FREE, exact posting links, no API key)
 *
 * Pulls REAL live job postings directly from companies' public ATS feeds:
 *   - Greenhouse  https://boards-api.greenhouse.io/v1/boards/{slug}/jobs
 *   - Lever       https://api.lever.co/v0/postings/{slug}?mode=json
 *   - Ashby       https://api.ashbyhq.com/posting-api/job-board/{slug}
 *
 * Every job link is the EXACT posting URL (with a job id) — never a
 * hallucinated or careers-homepage link. This is how curated boards like
 * drivetube provide real links. No key, no cost.
 *
 * We track a curated list of visa-friendly companies (COMPANIES below).
 * Add/remove slugs to grow the board.
 */

const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'data', 'jobs.json');

// Curated visa-friendly companies. {ats, slug, name}
const COMPANIES = [
  { ats: 'greenhouse', slug: 'stripe', name: 'Stripe' },
  { ats: 'greenhouse', slug: 'airbnb', name: 'Airbnb' },
  { ats: 'greenhouse', slug: 'coinbase', name: 'Coinbase' },
  { ats: 'greenhouse', slug: 'databricks', name: 'Databricks' },
  { ats: 'greenhouse', slug: 'dropbox', name: 'Dropbox' },
  { ats: 'greenhouse', slug: 'pinterest', name: 'Pinterest' },
  { ats: 'greenhouse', slug: 'reddit', name: 'Reddit' },
  { ats: 'greenhouse', slug: 'cloudflare', name: 'Cloudflare' },
  { ats: 'greenhouse', slug: 'gitlab', name: 'GitLab' },
  { ats: 'greenhouse', slug: 'robinhood', name: 'Robinhood' },
  { ats: 'greenhouse', slug: 'doordash', name: 'DoorDash' },
  { ats: 'greenhouse', slug: 'instacart', name: 'Instacart' },
  { ats: 'greenhouse', slug: 'wealthsimple', name: 'Wealthsimple' },
  { ats: 'greenhouse', slug: 'gusto', name: 'Gusto' },
  { ats: 'greenhouse', slug: 'brex', name: 'Brex' },
  { ats: 'greenhouse', slug: 'affirm', name: 'Affirm' },
  { ats: 'greenhouse', slug: 'asana', name: 'Asana' },
  { ats: 'lever', slug: 'plaid', name: 'Plaid' },
  { ats: 'ashby', slug: 'ramp', name: 'Ramp' },
  { ats: 'ashby', slug: 'deel', name: 'Deel' },
];

// Only keep jobs in the markets we serve.
const COUNTRY_RULES = [
  { code: 'CA', re: /\b(canada|toronto|vancouver|montreal|ottawa|calgary|waterloo|ontario|quebec|british columbia|alberta|,\s?on\b|,\s?bc\b|,\s?qc\b|,\s?ab\b)\b/i },
  { code: 'UK', re: /\b(united kingdom|london|manchester|england|scotland|,\s?uk\b)\b/i },
  { code: 'AU', re: /\b(australia|sydney|melbourne|brisbane|perth)\b/i },
  { code: 'NZ', re: /\b(new zealand|auckland|wellington)\b/i },
  { code: 'IN', re: /\b(india|bengaluru|bangalore|mumbai|hyderabad|pune|delhi|gurgaon|chennai)\b/i },
  { code: 'EU', re: /\b(germany|france|spain|netherlands|ireland|dublin|berlin|paris|amsterdam|poland|portugal|lisbon|madrid)\b/i },
  { code: 'US', re: /\b(united states|remote\s*-?\s*us|,\s?(ny|ca|wa|tx|il|ma|co|ga|fl|nj|pa|va|nc|az|or|mn|mi|oh)\b|new york|san francisco|seattle|austin|boston|chicago|los angeles|denver|atlanta)\b/i },
];

const TARGET = new Set(['US', 'CA', 'UK', 'AU', 'NZ', 'IN', 'EU']);

function detectCountry(loc) {
  for (const r of COUNTRY_RULES) if (r.re.test(loc || '')) return r.code;
  return null;
}

const CAT_RULES = [
  { c: 'Data', re: /\b(data|machine learning|ml|ai|analytics|scientist|analyst)\b/i },
  { c: 'Finance', re: /\b(finance|financial|accounting|fp&a|controller|treasury|audit)\b/i },
  { c: 'Marketing', re: /\b(marketing|growth|brand|content|seo|social|demand gen)\b/i },
  { c: 'Tech', re: /\b(engineer|developer|software|devops|infrastructure|security|platform|backend|frontend|full ?stack|mobile|ios|android)\b/i },
];
const LOGOS = { Tech: '💻', Data: '📊', Finance: '🏦', Marketing: '📱', Other: '💼' };
function detectCategory(title) {
  for (const r of CAT_RULES) if (r.re.test(title)) return r.c;
  return 'Other';
}

function ago(iso) {
  if (!iso) return 'Recently';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return 'Posted today';
  if (d === 1) return 'Posted yesterday';
  return `Posted ${d} days ago`;
}

async function fetchGreenhouse(co) {
  const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${co.slug}/jobs`);
  if (!r.ok) throw new Error(`${co.slug} ${r.status}`);
  const d = await r.json();
  return (d.jobs || []).map(j => ({
    title: j.title, location: j.location?.name || '', url: j.absolute_url, updated: j.updated_at,
  }));
}
async function fetchLever(co) {
  const r = await fetch(`https://api.lever.co/v0/postings/${co.slug}?mode=json`);
  if (!r.ok) throw new Error(`${co.slug} ${r.status}`);
  const d = await r.json();
  return (d || []).map(j => ({
    title: j.text, location: j.categories?.location || '', url: j.hostedUrl, updated: j.createdAt ? new Date(j.createdAt).toISOString() : null,
  }));
}
async function fetchAshby(co) {
  const r = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${co.slug}`);
  if (!r.ok) throw new Error(`${co.slug} ${r.status}`);
  const d = await r.json();
  return (d.jobs || []).map(j => ({
    title: j.title, location: j.location || '', url: j.jobUrl || j.applyUrl, updated: j.publishedAt || null,
  }));
}
const FETCHERS = { greenhouse: fetchGreenhouse, lever: fetchLever, ashby: fetchAshby };

async function main() {
  const all = [];
  const seen = new Set();
  for (const co of COMPANIES) {
    try {
      const raw = await FETCHERS[co.ats](co);
      let kept = 0;
      for (const j of raw) {
        if (!j.title || !j.url) continue;
        const country = detectCountry(j.location);
        if (!country || !TARGET.has(country)) continue;
        const category = detectCategory(j.title);
        if (category === 'Other') continue; // keep the board focused on our 4 fields
        const key = (j.title + co.name).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        all.push({
          id: 'a' + all.length,
          role: j.title.slice(0, 90),
          company: co.name,
          location: j.location.slice(0, 60),
          country,
          category,
          salary: null,
          remote: /remote/i.test(j.location) ? 'Remote' : 'On-site / Hybrid',
          sponsor: country === 'US' ? 'H-1B friendly' : country === 'CA' ? 'PGWP · LMIA friendly' : null,
          posted: ago(j.updated),
          url: j.url, // EXACT posting link
          logo: LOGOS[category],
        });
        kept++;
        if (kept >= 6) break; // cap per company for variety
      }
      console.log(`✓ ${co.name} (${co.ats}): ${kept} kept`);
    } catch (e) {
      console.error(`✗ ${co.name}: ${e.message}`);
    }
  }

  if (!all.length) { console.log('No jobs — keeping existing data/jobs.json.'); process.exit(0); }

  // newest-ish first, cap board size
  const payload = { updated: new Date().toISOString(), source: 'ats', jobs: all.slice(0, 40) };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`\n✅ Wrote ${payload.jobs.length} jobs with EXACT posting links to data/jobs.json`);
}

main();
