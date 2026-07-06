/**
 * DriftAI — AI Job Enhancer (hybrid step)
 *
 * Takes REAL jobs from the Adzuna API and uses an OpenRouter free model to:
 *   - pick the most attractive roles for CA/US international job seekers
 *   - write a short punchy "why apply" blurb
 *   - confirm the category + a visa-sponsorship tag
 *
 * CRITICAL: the AI only adds judgement fields (blurb, category, visa, score).
 * It never edits facts — company, location, salary, and the apply URL are
 * copied straight from Adzuna, so links can never be hallucinated.
 *
 * Reuses the same OPENROUTER_API_KEY + free models as your stock-digest.
 * If the key is missing or the call fails, jobs pass through unchanged.
 */

const URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.JOBS_AI_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free';
const FALLBACK = process.env.JOBS_AI_FALLBACK || 'nvidia/nemotron-3-super-120b-a12b:free';

const SYSTEM = `You are a job-board curator for DriftAI, a service helping international
job seekers get hired in Canada and the USA. You will receive a JSON array of REAL job
postings. Return ONLY a JSON array (no prose) where each item has:
  "i": the original index (integer),
  "blurb": a punchy one-line reason to apply (max 90 chars, no emojis),
  "category": one of "Tech","Data","Finance","Marketing","Other",
  "visa": a short visa-sponsorship tag if the employer is likely to sponsor
          (e.g. "H-1B friendly","PGWP · LMIA friendly") or null if unlikely,
  "score": 0-100 how attractive this role is to an ambitious international
           applicant (salary, brand, growth, sponsorship potential).
Do not invent or change any facts. Only judge what you are given.`;

async function callModel(model, userPayload, key) {
  const r = await fetch(URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://driftai.club',
      'X-Title': 'driftai-jobs',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userPayload },
      ],
    }),
  });
  if (!r.ok) throw new Error(`${model} -> HTTP ${r.status}: ${(await r.text()).slice(0, 120)}`);
  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${model} -> empty response`);
  return content;
}

function parseJsonArray(text) {
  // Models sometimes wrap JSON in ```json fences or add stray text.
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('no JSON array in response');
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * @param {Array} jobs  real jobs from Adzuna
 * @param {number} limit  how many to keep after ranking
 * @returns {Promise<Array>} enhanced + ranked jobs (facts preserved)
 */
async function enhanceJobs(jobs, limit = 15) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.log('ℹ  OPENROUTER_API_KEY not set — skipping AI curation, using jobs as-is.');
    return jobs.slice(0, limit);
  }
  if (!jobs.length) return jobs;

  // Send only what the AI needs to judge — never the URL (so it can't alter it).
  const compact = jobs.map((j, i) => ({
    i,
    role: j.role,
    company: j.company,
    location: j.location,
    country: j.country,
    salary: j.salary,
  }));
  const userPayload = `Curate these ${jobs.length} real jobs:\n${JSON.stringify(compact)}`;

  let verdicts = null;
  for (const model of [MODEL, FALLBACK]) {
    for (const delay of [0, 10000]) {
      if (delay) await new Promise(res => setTimeout(res, delay));
      try {
        const text = await callModel(model, userPayload, key);
        verdicts = parseJsonArray(text);
        console.log(`✓ AI curation via ${model}`);
        break;
      } catch (e) {
        console.error(`✗ ${e.message}`);
      }
    }
    if (verdicts) break;
  }

  if (!verdicts) {
    console.log('ℹ  AI curation failed — falling back to raw jobs (facts intact).');
    return jobs.slice(0, limit);
  }

  // Merge AI judgement onto the REAL job objects by index. Facts stay untouched.
  const byIndex = new Map(verdicts.map(v => [v.i, v]));
  const enhanced = jobs.map((j, i) => {
    const v = byIndex.get(i) || {};
    return {
      ...j, // url, salary, company, location, country, posted — all preserved
      category: ['Tech', 'Data', 'Finance', 'Marketing', 'Other'].includes(v.category) ? v.category : j.category,
      sponsor: v.visa || j.sponsor || null,
      blurb: typeof v.blurb === 'string' ? v.blurb.slice(0, 90) : null,
      _score: typeof v.score === 'number' ? v.score : 50,
    };
  });

  enhanced.sort((a, b) => b._score - a._score);
  return enhanced.slice(0, limit).map(({ _score, ...j }) => j); // drop internal score
}

module.exports = { enhanceJobs };
