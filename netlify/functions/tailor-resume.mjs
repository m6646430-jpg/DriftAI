// DriftAI — Tailor Resume to a specific job (Netlify Function, Gemini)
// Reads the candidate's PDF resume + the target role/company and returns a
// tailored summary, rewritten bullet points, and keyword gaps for THAT job.
// Runs server-side so GEMINI_API_KEY never reaches the browser. Resume not stored.

const MODEL = 'gemini-2.5-flash';

function buildPrompt(role, company) {
  return `You are an expert resume writer and ATS specialist. The candidate is applying for the
role "${role}" at "${company}". Using ONLY their real experience from the attached resume
(never invent jobs, employers, or facts), tailor their resume to this specific role.

Return ONLY JSON in exactly this shape:
{
  "summary": "<a punchy 2-3 sentence professional summary tailored to this exact role>",
  "bullets": ["<4-6 rewritten resume bullet points that strengthen their fit for THIS role, quantified where their resume supports it>"],
  "keywords": ["<6-10 role-relevant skills/keywords this job likely screens for that they should make sure appear>"],
  "gap_note": "<one honest sentence on the biggest thing to improve for this role>"
}
Keep bullets concrete and based on their actual background. Output ONLY the JSON.`;
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: 'not configured' }, { status: 500 });

  let payload;
  try { payload = await req.json(); } catch { return Response.json({ error: 'bad request' }, { status: 400 }); }
  const { data, mime, role, company } = payload || {};
  if (!data || mime !== 'application/pdf') return Response.json({ error: 'a PDF is required' }, { status: 400 });
  if (data.length > 7_000_000) return Response.json({ error: 'file too large' }, { status: 413 });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [
          { inlineData: { mimeType: 'application/pdf', data } },
          { text: buildPrompt(String(role || 'this role').slice(0, 120), String(company || 'the company').slice(0, 120)) },
        ]}],
        generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) {
      console.error('Gemini tailor error', res.status, (await res.text()).slice(0, 200));
      return Response.json({ error: 'busy' }, { status: 503 });
    }
    const g = await res.json();
    const text = g?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    let result;
    try { result = JSON.parse(text); }
    catch { const s = text.indexOf('{'), e = text.lastIndexOf('}'); result = JSON.parse(text.slice(s, e + 1)); }
    if (!Array.isArray(result.bullets)) result.bullets = [];
    if (!Array.isArray(result.keywords)) result.keywords = [];
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('tailor-resume failed', e);
    return Response.json({ error: 'failed' }, { status: 500 });
  }
};
