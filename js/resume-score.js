// ===== FREE AI RESUME SCORE (Gemini) =====
// Uploads a PDF to a Netlify Function that scores it with Gemini.
// On localhost (static preview) the function isn't available, so a mock
// response is used to preview the UI.

// DriftAI business WhatsApp (international format, digits only).
const WHATSAPP_NUMBER = '16474953399';
const RING_CIRCUMFERENCE = 327;

const el = id => document.getElementById(id);
let selectedFile = null;

function initScoreTool() {
  const drop = el('scoreDrop');
  const input = el('resumeFile');
  const btn = el('scoreBtn');
  if (!drop || !input) return;

  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', e => {
    e.preventDefault(); drop.classList.remove('drag');
    if (e.dataTransfer.files[0]) pickFile(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', () => { if (input.files[0]) pickFile(input.files[0]); });
  btn.addEventListener('click', scoreResume);
  el('scoreAgain').addEventListener('click', resetTool);
}

function pickFile(file) {
  if (file.type !== 'application/pdf') return showError('Please upload a PDF file.');
  if (file.size > 5 * 1024 * 1024) return showError('File is too large — max 5 MB.');
  selectedFile = file;
  const fn = el('scoreFileName');
  fn.textContent = '✓ ' + file.name;
  fn.style.display = 'block';
  el('scoreBtn').disabled = false;
  el('scoreError').style.display = 'none';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]); // strip data: prefix
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// A stable SHA-256 fingerprint of the file's bytes. The SAME resume always
// hashes to the same key, so we can return the SAME score every time —
// no more "different score on re-upload". (crypto.subtle needs https/localhost.)
async function fileHash(file) {
  try {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return null; }
}
function cachedScore(hash) {
  if (!hash) return null;
  try { const v = localStorage.getItem('ds_score_' + hash); return v ? JSON.parse(v) : null; } catch { return null; }
}
function storeScore(hash, result) {
  if (!hash) return;
  try { localStorage.setItem('ds_score_' + hash, JSON.stringify(result)); } catch {}
}

// ===== THE "AI IS READING YOUR RESUME" EXPERIENCE =====
// Students should FEEL the analysis: we extract the real text from their PDF,
// stream it through a scanner window with staged status messages, and hold
// the final score until at least MIN_ANALYSIS_MS has passed.
const MIN_ANALYSIS_MS = 25000;

const SCAN_STAGES = [
  { at: 0.00, msg: 'Opening your document…' },
  { at: 0.08, msg: 'Extracting text and layout…' },
  { at: 0.22, msg: 'Reading work experience…' },
  { at: 0.38, msg: 'Checking ATS compatibility (Workday, Greenhouse, Lever)…' },
  { at: 0.52, msg: 'Analyzing impact — looking for numbers and results…' },
  { at: 0.66, msg: 'Matching keywords against 2026 job-market data…' },
  { at: 0.80, msg: 'Scoring formatting and clarity…' },
  { at: 0.92, msg: 'Finalizing your score…' },
];

let pdfjsPromise = null;
function loadPdfJs() {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return pdfjsPromise;
}

async function extractPdfText(file) {
  try {
    const pdfjs = await loadPdfJs();
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    let text = '';
    const pages = Math.min(doc.numPages, 4);
    for (let p = 1; p <= pages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      text += content.items.map(i => i.str).join(' ') + '\n';
    }
    return text.replace(/\s{3,}/g, '  ').trim();
  } catch {
    return ''; // fall back to generic scan lines
  }
}

const GENERIC_SCAN = 'Parsing document structure… reading sections: SUMMARY, EXPERIENCE, EDUCATION, SKILLS… evaluating bullet points for quantified results… cross-checking action verbs… measuring keyword density against target-role benchmarks… validating single-column ATS-safe layout… checking date formats and section headings… assessing readability and length…';

// Words worth highlighting green as the "AI" reads them
const HL_WORDS = /\b(managed|led|built|created|developed|designed|increased|reduced|improved|launched|delivered|achieved|analy[sz]ed|engineer(?:ed|ing)?|python|java|sql|excel|aws|react|marketing|sales|revenue|customers?|team|project|\d+%|\$[\d,]+|\d{4})\b/gi;

function startScanExperience(file) {
  const statusEl = el('scanStatus');
  const fillEl = el('scanFill');
  const pctEl = el('scanPercent');
  const textEl = el('scanText');
  const t0 = Date.now();
  let stageIdx = -1;
  let words = GENERIC_SCAN.split(' ');
  let wordIdx = 0;
  let shown = [];

  // Swap in the student's real resume text as soon as it's extracted
  extractPdfText(file).then(t => {
    if (t && t.length > 80) { words = t.split(/\s+/); wordIdx = 0; shown = []; textEl.innerHTML = ''; }
  });

  const timer = setInterval(() => {
    const p = Math.min((Date.now() - t0) / MIN_ANALYSIS_MS, 1);

    // progress bar eases toward 99% and only completes when the result renders
    const pct = Math.round(Math.min(p, 0.99) * 100);
    fillEl.style.width = pct + '%';
    pctEl.textContent = pct + '%';

    // staged status messages
    for (let i = SCAN_STAGES.length - 1; i >= 0; i--) {
      if (p >= SCAN_STAGES[i].at) { if (stageIdx !== i) { stageIdx = i; statusEl.textContent = SCAN_STAGES[i].msg; } break; }
    }

    // stream ~3 words per tick through the scan window (escaped — PDF text
    // must render as text, never as markup)
    for (let n = 0; n < 3 && wordIdx < words.length; n++) {
      const raw = words[wordIdx++];
      const w = String(raw).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      shown.push(HL_WORDS.test(raw) ? `<span class="hl">${w}</span>` : w);
      HL_WORDS.lastIndex = 0;
    }
    if (shown.length > 130) shown = shown.slice(shown.length - 130); // keep window scrolling
    textEl.innerHTML = shown.join(' ');
    if (wordIdx >= words.length) wordIdx = 0; // loop if resume is short

    if (p >= 1) clearInterval(timer);
  }, 180);

  return () => { clearInterval(timer); fillEl.style.width = '100%'; pctEl.textContent = '100%'; };
}

async function scoreResume() {
  if (!selectedFile) return;
  el('scoreUpload').style.display = 'none';
  el('scoreError').style.display = 'none';
  el('scoreLoading').style.display = 'block';

  const finishScan = startScanExperience(selectedFile);
  const minWait = new Promise(r => setTimeout(r, MIN_ANALYSIS_MS));

  try {
    const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
    const scoring = (async () => {
      // Same resume → same score. Return the cached result if we've seen
      // these exact bytes before, so re-uploads never show a different number.
      const hash = await fileHash(selectedFile);
      const hit = cachedScore(hash);
      if (hit) return hit;

      let result;
      if (isLocal) {
        result = mockScore();
      } else {
        const data = await fileToBase64(selectedFile);
        const res = await fetch('/.netlify/functions/score-resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: selectedFile.name, mime: selectedFile.type, data }),
        });
        if (!res.ok) throw new Error('score failed ' + res.status);
        result = await res.json();
      }
      storeScore(hash, result);
      return result;
    })();

    // Real scoring runs in parallel with the scan — result held until 25s pass.
    const [result] = await Promise.all([scoring, minWait]);
    finishScan();
    await new Promise(r => setTimeout(r, 400)); // let the bar hit 100%
    renderResult(result);
  } catch (e) {
    finishScan();
    el('scoreLoading').style.display = 'none';
    el('scoreUpload').style.display = 'block';
    showError('Sorry — scoring is busy right now. Please try again in a moment.');
  }
}

function verdictFor(score) {
  if (score >= 85) return { t: '🎉 Strong — you’re in great shape', };
  if (score >= 70) return { t: '👍 Good — a few tweaks away from great' };
  if (score >= 55) return { t: '⚠️ Needs work — ATS may filter this out' };
  return { t: '🚨 At risk — likely auto-rejected by ATS' };
}

function renderResult(r) {
  el('scoreLoading').style.display = 'none';
  el('scoreResult').style.display = 'block';

  const overall = Math.max(0, Math.min(100, Math.round(r.overall || 0)));
  el('scoreVerdict').textContent = r.verdict || verdictFor(overall).t;

  // animate ring + number
  const ring = el('scoreRingFg');
  setTimeout(() => {
    ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - overall / 100));
  }, 60);
  animateNumber(el('scoreValue'), overall, 1400);

  // breakdown — escape AI output; a crafted PDF could prompt-inject HTML
  // into the model's response, and that must never run as script here.
  const escS = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cats = Array.isArray(r.categories) ? r.categories : [];
  el('scoreBreakdown').innerHTML = cats.map(c => {
    const score = Math.max(0, Math.min(100, Math.round(Number(c.score) || 0)));
    return `
    <div class="score-cat">
      <div class="score-cat-top"><span class="score-cat-name">${escS(c.name)}</span><span class="score-cat-val">${score}/100</span></div>
      <div class="score-cat-bar"><div class="score-cat-fill" data-w="${score}"></div></div>
    </div>`;
  }).join('');
  setTimeout(() => {
    document.querySelectorAll('.score-cat-fill').forEach(f => { f.style.width = f.dataset.w + '%'; });
  }, 60);

  // tips
  const tips = Array.isArray(r.tips) ? r.tips : [];
  el('scoreTips').innerHTML = tips.length
    ? `<h4>Top fixes to raise your score</h4><ul>${tips.map(t => `<li>${escS(t)}</li>`).join('')}</ul>`
    : '';

  // WhatsApp CTA
  const msg = encodeURIComponent(`Hi DriftAI! My resume scored ${overall}/100 on your free tool. I'd like help improving it.`);
  el('scoreWhatsApp').href = `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
}

function animateNumber(node, target, dur) {
  const start = Date.now();
  const timer = setInterval(() => {
    const p = Math.min((Date.now() - start) / dur, 1);
    node.textContent = Math.round((1 - Math.pow(1 - p, 3)) * target);
    if (p >= 1) clearInterval(timer);
  }, 40);
}

function resetTool() {
  selectedFile = null;
  el('resumeFile').value = '';
  el('scoreFileName').style.display = 'none';
  el('scoreBtn').disabled = true;
  el('scoreResult').style.display = 'none';
  el('scoreRingFg').style.strokeDashoffset = String(RING_CIRCUMFERENCE);
  el('scoreUpload').style.display = 'block';
}

function showError(msg) {
  const e = el('scoreError');
  e.textContent = msg;
  e.style.display = 'block';
}

function mockScore() {
  return {
    overall: 68,
    verdict: '⚠️ Needs work — ATS may filter this out',
    categories: [
      { name: 'ATS Compatibility', score: 62 },
      { name: 'Impact & Metrics', score: 55 },
      { name: 'Keyword Match', score: 71 },
      { name: 'Formatting & Clarity', score: 84 },
    ],
    tips: [
      'Add hard numbers to your bullet points (e.g. “grew sales 32%”) — most lines are duties, not results.',
      'Use standard section headings (Experience, Education, Skills) so ATS parses them correctly.',
      'Remove the profile photo and multi-column layout — they break ATS text extraction.',
    ],
  };
}

document.addEventListener('DOMContentLoaded', initScoreTool);
