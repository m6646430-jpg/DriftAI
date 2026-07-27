// DriftAI — AI Apply Assistant (Netlify Function, Gemini)
// Reads the candidate's resume PDF + the job, and returns a full application
// package: tailored resume, cover letter, answered screening questions, and a
// short list of questions only the candidate can answer (asked when unsure).
// Runs server-side so GEMINI_API_KEY never reaches the browser. Resume not stored.

const MODEL = 'gemini-2.5-flash';
const ALLOWED_ORIGINS = /^https:\/\/(www\.)?driftai\.info$|^https:\/\/silver-macaron-6cb9ba\.netlify\.app$|^http:\/\/localhost(:\d+)?$/;

function buildPrompt(role, company, jd) {
  return `You are an expert job-application assistant. Using ONLY the candidate's real
experience from the attached resume (never invent employers, titles, degrees, or facts),
prepare a complete application for the role "${role}" at "${company}".

${jd ? `JOB DESCRIPTION:\n"""\n${jd}\n"""` : '(No job description provided — work from the role title.)'}

Return ONLY JSON in exactly this shape:
{
  "match_score": <integer 0-100: how well this candidate fits THIS role>,
  "summary": "<2-3 sentence professional summary tailored to this role>",
  "bullets": ["<4-6 tailored resume bullet points from their REAL experience, quantified where supported>"],
  "keywords": ["<8-12 skills/keywords this job screens for that should appear>"],
  "cover_letter": "<a concise, specific 150-220 word cover letter for this exact role — no fluff, based on their real background>",
  "answers": [
    {"q": "<a common application question this posting likely asks>", "a": "<a strong answer written from the resume, in first person>"}
  ],
  "needs_you": [
    {"q": "<a question that CANNOT be answered from the resume>", "why": "<one short reason, e.g. 'not in your resume'>"}
  ]
}
Rules:
- "answers": 3-5 questions you CAN answer from the resume (e.g. "Why are you a fit?", "Describe relevant experience", "Biggest achievement").
- "needs_you": 2-4 things only the candidate knows — e.g. expected salary, earliest start date, work authorization / visa status if not stated in the resume, willingness to relocate. Keep it short.
- Be honest: if their background is a different field, say so briefly in the summary; don't fake a fit.
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
  const { data, mime, role, company, jd } = p || {};
  if (!data || mime !== 'application/pdf') return Response.json({ error: 'a PDF resume is required' }, { status: 400 });
  if (data.length > 7_000_000) return Response.json({ error: 'file too large' }, { status: 413 });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [
          { inlineData: { mimeType: 'application/pdf', data } },
          { text: buildPrompt(String(role || 'this role').slice(0, 120), String(company || 'the company').slice(0, 120), String(jd || '').slice(0, 5000)) },
        ] }],
        generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) { console.error('assistant gemini', res.status, (await res.text()).slice(0, 200)); return Response.json({ error: 'busy' }, { status: 503 }); }
    const g = await res.json();
    const text = g?.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('') || '';
    let r;
    try { r = JSON.parse(text); } catch { const s = text.indexOf('{'), e = text.lastIndexOf('}'); r = JSON.parse(text.slice(s, e + 1)); }
    r.match_score = Math.max(0, Math.min(100, Math.round(Number(r.match_score) || 0)));
    ['bullets', 'keywords', 'answers', 'needs_you'].forEach(k => { if (!Array.isArray(r[k])) r[k] = []; });
    return Response.json(r, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('apply-assistant failed', e);
    return Response.json({ error: 'failed' }, { status: 500 });
  }
};
