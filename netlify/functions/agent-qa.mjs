// DriftAI — Agent 2: QA-check a tailored resume before applying.
// Input: the tailored resume (summary + bullets) + the job description.
// Output: a match score, a list of issues, and a go / no-go verdict — so a
// human never submits a weak or mismatched application.

const MODEL = 'gemini-2.5-flash';
const ALLOWED_ORIGINS = /^https:\/\/(www\.)?driftai\.info$|^https:\/\/silver-macaron-6cb9ba\.netlify\.app$|^http:\/\/localhost(:\d+)?$/;

function buildPrompt(role, jd, tailored) {
  return `You are a strict hiring-side reviewer. Judge whether this TAILORED resume is ready to
submit for the role below. Be honest and critical — the goal is to catch weak or mismatched
applications BEFORE they are sent.

TARGET ROLE: ${role}
JOB DESCRIPTION:
"""
${jd || '(not provided)'}
"""
TAILORED RESUME:
"""
${tailored}
"""

Return ONLY JSON in exactly this shape:
{
  "match_score": <integer 0-100: how well this resume fits THIS job>,
  "verdict": "<one of: READY | NEEDS_WORK | SKIP>",
  "issues": ["<0-5 concrete problems: missing keywords, unquantified claims, field mismatch, gaps>"],
  "reason": "<one sentence summarizing the verdict>"
}
Rules: verdict is READY only if match_score >= 70 and there are no serious mismatches.
verdict is SKIP if the candidate's background is clearly the wrong field for this role.
Output ONLY the JSON.`;
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const origin = req.headers.get('origin') || '';
  if (!ALLOWED_ORIGINS.test(origin)) return Response.json({ error: 'forbidden' }, { status: 403 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: 'not configured' }, { status: 500 });

  let p;
  try { p = await req.json(); } catch { return Response.json({ error: 'bad request' }, { status: 400 }); }
  const { tailored, role, jd } = p || {};
  if (!tailored) return Response.json({ error: 'tailored resume required' }, { status: 400 });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(
          String(role || 'this role').slice(0, 120),
          String(jd || '').slice(0, 5000),
          String(tailored).slice(0, 6000),
        ) }] }],
        generationConfig: { temperature: 0, seed: 42, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) return Response.json({ error: 'busy' }, { status: 503 });
    const g = await res.json();
    const text = g?.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('') || '';
    let r;
    try { r = JSON.parse(text); } catch { const s = text.indexOf('{'), e = text.lastIndexOf('}'); r = JSON.parse(text.slice(s, e + 1)); }
    r.match_score = Math.max(0, Math.min(100, Math.round(Number(r.match_score) || 0)));
    if (!['READY', 'NEEDS_WORK', 'SKIP'].includes(r.verdict)) r.verdict = 'NEEDS_WORK';
    if (!Array.isArray(r.issues)) r.issues = [];
    return Response.json(r, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('agent-qa failed', e);
    return Response.json({ error: 'failed' }, { status: 500 });
  }
};
