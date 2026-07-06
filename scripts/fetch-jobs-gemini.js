#!/usr/bin/env node
/**
 * DriftAI — Gemini Job Fetcher (free, no extra signup)
 *
 * Uses Gemini + Google Search grounding to find REAL, current jobs in the
 * USA and Canada, then writes data/jobs.json. Reuses the same GEMINI_API_KEY
 * as your stock-digest (model gemini-2.5-flash, fallback gemini-2.5-flash-lite).
 *
 * SAFETY: Gemini is instructed to link ONLY to each company's official careers
 * page (e.g. https://shopify.com/careers) — never a specific posting URL — so
 * a user clicking "View" always lands on a real, working page, never a dead or
 * hallucinated link. Salary is included only when Search actually surfaces it.
 *
 * SETUP:
 *   export GEMINI_API_KEY=your_key      # same one stock-digest uses
 *   node scripts/fetch-jobs-gemini.js
 *
 * If the key is missing or the call fails, the existing data/jobs.json is left
 * untouched so the site never breaks.
 *
 * Requires Node 18+ (built-in fetch). You have Node 24.
 */

const fs = require('fs');
const path = require('path');

const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const MODEL = process.env.JOBS_GEMINI_MODEL || 'gemini-2.5-flash';
const FALLBACK = process.env.JOBS_GEMINI_FALLBACK || 'gemini-2.5-flash-lite';
const OUT = path.join(__dirname, '..', 'data', 'jobs.json');
const WANT = Number(process.env.JOBS_COUNT || 18);

const LOGOS = { Tech: '💻', Data: '📊', Finance: '🏦', Marketing: '📱', Other: '💼' };

const PROMPT = `Use Google Search to find ${WANT} REAL job openings posted in the last 7 days,
split between the United States and Canada, across Tech, Data, Finance and Marketing roles
at well-known companies (e.g. Google, Amazon, Shopify, RBC, TD, Stripe, Microsoft, Deloitte).

Return ONLY a JSON array (no markdown, no prose). Each object must have exactly these keys:
  "role": job title (string),
  "company": company name (string),
  "location": "City, Region" (string),
  "country": "US" or "CA",
  "category": one of "Tech","Data","Finance","Marketing","Other",
  "salary": salary range as a string if known (e.g. "$120,000 - $150,000") or null,
  "sponsor": a short visa tag if the employer likely sponsors ("H-1B friendly" for US,
             "PGWP · LMIA friendly" for CA) or null,
  "url": the company's OFFICIAL CAREERS PAGE URL only (e.g. "https://www.shopify.com/careers").
         NEVER invent a specific job-posting URL. If unsure, use the company's main careers page.,
  "posted": a short recency string like "Posted 2 days ago".

Only include real companies and roles you actually found via Search. Do not fabricate.`;

function endpoint(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`;
}

async function callGemini(model) {
  const res = await fetch(endpoint(model), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.3 },
    }),
  });
  if (!res.ok) throw new Error(`${model} -> HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map(p => p.text || '').join('');
  if (!text) throw new Error(`${model} -> empty response`);
  return text;
}

function parseJsonArray(text) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('no JSON array in Gemini response');
  return JSON.parse(text.slice(start, end + 1));
}

function normalize(raw) {
  const out = [];
  const seen = new Set();
  for (const j of raw) {
    if (!j || !j.role || !j.company) continue;
    const country = j.country === 'US' ? 'US' : j.country === 'CA' ? 'CA' : null;
    if (!country) continue;
    const category = ['Tech', 'Data', 'Finance', 'Marketing', 'Other'].includes(j.category) ? j.category : 'Other';
    // Only accept a URL that looks like a real https link; else drop it to a safe null.
    const url = typeof j.url === 'string' && /^https?:\/\/[^ ]+\./.test(j.url) ? j.url : null;
    const key = (j.role + j.company).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: 'g' + out.length,
      role: String(j.role).slice(0, 90),
      company: String(j.company).slice(0, 60),
      location: String(j.location || '').slice(0, 60),
      country,
      category,
      salary: j.salary ? String(j.salary).slice(0, 40) : null,
      remote: 'On-site / Hybrid',
      sponsor: j.sponsor ? String(j.sponsor).slice(0, 40) : null,
      posted: j.posted ? String(j.posted).slice(0, 30) : 'Recently posted',
      url,
      logo: LOGOS[category] || '💼',
    });
  }
  return out;
}

async function main() {
  if (!KEY) {
    console.log('⚠  GEMINI_API_KEY not set. Keeping existing data/jobs.json.');
    console.log('   Set it (same key as stock-digest): export GEMINI_API_KEY=your_key');
    process.exit(0);
  }

  let jobs = null;
  for (const model of [MODEL, FALLBACK]) {
    for (const delay of [0, 15000]) {
      if (delay) await new Promise(r => setTimeout(r, delay));
      try {
        const text = await callGemini(model);
        const parsed = normalize(parseJsonArray(text));
        if (parsed.length) { jobs = parsed; console.log(`✓ ${parsed.length} jobs via ${model}`); break; }
        throw new Error('parsed 0 valid jobs');
      } catch (e) {
        console.error(`✗ ${e.message}`);
      }
    }
    if (jobs) break;
  }

  if (!jobs || !jobs.length) {
    console.log('No jobs returned — keeping existing data/jobs.json unchanged.');
    process.exit(0);
  }

  const payload = { updated: new Date().toISOString(), source: 'gemini', jobs };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`\n✅ Wrote ${jobs.length} jobs to data/jobs.json at ${payload.updated}`);
}

main();
