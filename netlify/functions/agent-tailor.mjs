// DriftAI — Agent 1: Tailor Resume to a Job (text-based, for the Job Hunt pipeline)
// Input: the client's base resume TEXT + the target role/company + the job
// description. Output: a resume tailored to that specific posting.
// Server-side so GEMINI_API_KEY never reaches the browser.

const MODEL = 'gemini-2.5-flash';
const ALLOWED_ORIGINS = /^https:\/\/(www\.)?driftai\.info$|^https:\/\/silver-macaron-6cb9ba\.netlify\.app$|^http:\/\/localhost(:\d+)?$/;

function buildPrompt(role, company, jd, resume) {
  return `You are an expert resume writer and ATS specialist. Tailor the candidate's resume to
this specific job. Use ONLY their real experience — never invent employers, titles, or facts.

TARGET ROLE: ${role} at ${company}
JOB DESCRIPTION:
"""
${jd || '(not provided — tailor to the role title)'}
"""
CANDIDATE'S CURRENT RESUME:
"""
${resume}
"""

Return ONLY JSON in exactly this shape:
{
  "summary": "<2-3 sentence professional summary tailored to this exact role & JD>",
  "bullets": [
    {"text": "<a rewritten bullet from their REAL experience, reframed to this posting>",
     "relevance": <integer 0-100: how directly it supports THIS posting>,
     "why": "<3-8 words on why it's strong or weak here>"}
  ],
  "keywords": ["<8-12 skills/keywords THIS job screens for that should appear>"],
  "gap_note": "<one honest sentence on the biggest gap between the resume and this posting>"
}
Return 7-9 bullets ranked by "relevance", highest first, and SPREAD the scores honestly — a
bullet that matters mainly for a different kind of role should score low (20-50). Prefer
unique bullets; if two overlap, score the weaker one down. The weakest get cut when the
resume must fit one page.
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
  const { resume, role, company, jd } = p || {};
  if (!resume || String(resume).length < 30) return Response.json({ error: 'resume text required' }, { status: 400 });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(
          String(role || 'this role').slice(0, 120),
          String(company || 'the company').slice(0, 120),
          String(jd || '').slice(0, 5000),
          String(resume).slice(0, 8000),
        ) }] }],
        generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) return Response.json({ error: 'busy' }, { status: 503 });
    const g = await res.json();
    const text = g?.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('') || '';
    let r;
    try { r = JSON.parse(text); } catch { const s = text.indexOf('{'), e = text.lastIndexOf('}'); r = JSON.parse(text.slice(s, e + 1)); }
    if (!Array.isArray(r.bullets)) r.bullets = [];
    if (!Array.isArray(r.keywords)) r.keywords = [];
    // Normalise + rank so the weakest lines are the ones cut for space.
    r.bullets = r.bullets
      .map(b => typeof b === 'string'
        ? { text: b, relevance: 70, why: '' }
        : { text: String(b.text || ''), relevance: Math.max(0, Math.min(100, Math.round(Number(b.relevance) || 0))), why: String(b.why || '') })
      .filter(b => b.text)
      .sort((a, b) => b.relevance - a.relevance);
    return Response.json(r, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('agent-tailor failed', e);
    return Response.json({ error: 'failed' }, { status: 500 });
  }
};
