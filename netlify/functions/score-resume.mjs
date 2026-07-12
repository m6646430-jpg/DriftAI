// DriftAI — Free Resume Score (Netlify Function)
// Receives a PDF (base64) and scores it with Gemini. Runs on Netlify's servers
// so GEMINI_API_KEY never reaches the browser. The resume is sent to Gemini for
// scoring and NOT stored anywhere.

const MODEL = 'gemini-2.5-flash';

const PROMPT = `You are an expert resume reviewer and ATS (applicant tracking system) specialist.
Analyze the attached resume PDF and score it honestly. Return ONLY JSON in exactly this shape:
{
  "overall": <integer 0-100>,
  "verdict": "<short honest phrase, max 8 words>",
  "categories": [
    {"name": "ATS Compatibility", "score": <0-100>},
    {"name": "Impact & Metrics", "score": <0-100>},
    {"name": "Keyword Match", "score": <0-100>},
    {"name": "Formatting & Clarity", "score": <0-100>}
  ],
  "tips": ["<tip1>", "<tip2>", "<tip3>"]
}
Scoring guidance:
- ATS Compatibility: is the layout machine-readable? Single column, standard section headings,
  no photos/tables/text-boxes/multi-column that break text extraction.
- Impact & Metrics: are achievements quantified with numbers/results, not just duties?
- Keyword Match: does it use strong role-relevant skills and action verbs?
- Formatting & Clarity: consistent, clean, scannable, appropriate length.
Each tip must be specific and actionable, max 22 words.
IMPORTANT — be deterministic: apply this rubric strictly and consistently so the SAME
resume always receives the SAME scores. Do not vary scores between runs. Prefer round,
stable numbers. Output ONLY the JSON, nothing else.`;

// Only our own pages may call this — blocks scripts hammering the endpoint
// to burn the Gemini quota. (Origin can be spoofed by non-browser clients,
// but this stops the easy drive-by abuse; browsers always send it honestly.)
const ALLOWED_ORIGINS = /^https:\/\/(www\.)?driftai\.info$|^https:\/\/silver-macaron-6cb9ba\.netlify\.app$|^http:\/\/localhost(:\d+)?$/;

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  const origin = req.headers.get('origin') || '';
  if (!ALLOWED_ORIGINS.test(origin)) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: 'not configured' }, { status: 500 });

  let payload;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: 'bad request' }, { status: 400 });
  }

  const { data, mime } = payload || {};
  if (!data || mime !== 'application/pdf') {
    return Response.json({ error: 'a PDF is required' }, { status: 400 });
  }
  // ~5 MB cap (base64 is ~1.33x the binary size)
  if (data.length > 7_000_000) {
    return Response.json({ error: 'file too large' }, { status: 413 });
  }

  try {
    // Key goes in a header, not the URL — URLs can end up in request logs.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType: 'application/pdf', data } },
            { text: PROMPT },
          ],
        }],
        generationConfig: { temperature: 0, topP: 1, seed: 42, responseMimeType: 'application/json' },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('Gemini error', res.status, txt.slice(0, 200));
      return Response.json({ error: 'scoring busy' }, { status: 503 });
    }

    const g = await res.json();
    const text = g?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      const s = text.indexOf('{'), e = text.lastIndexOf('}');
      result = JSON.parse(text.slice(s, e + 1));
    }

    // Basic shape guard so the frontend always gets something sane.
    result.overall = Math.max(0, Math.min(100, Math.round(Number(result.overall) || 0)));
    if (!Array.isArray(result.categories)) result.categories = [];
    if (!Array.isArray(result.tips)) result.tips = [];

    return Response.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('score-resume failed', e);
    return Response.json({ error: 'scoring failed' }, { status: 500 });
  }
};
