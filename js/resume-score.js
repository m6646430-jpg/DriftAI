// ===== FREE AI RESUME SCORE (Gemini) =====
// Uploads a PDF to a Netlify Function that scores it with Gemini.
// On localhost (static preview) the function isn't available, so a mock
// response is used to preview the UI.

// TODO: replace with your real WhatsApp number in international format (digits only, no +).
const WHATSAPP_NUMBER = '15555555555';
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

async function scoreResume() {
  if (!selectedFile) return;
  el('scoreUpload').style.display = 'none';
  el('scoreError').style.display = 'none';
  el('scoreLoading').style.display = 'block';

  try {
    let result;
    const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
    if (isLocal) {
      await new Promise(r => setTimeout(r, 1400)); // simulate latency
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
    renderResult(result);
  } catch (e) {
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

  // breakdown
  const cats = Array.isArray(r.categories) ? r.categories : [];
  el('scoreBreakdown').innerHTML = cats.map(c => `
    <div class="score-cat">
      <div class="score-cat-top"><span class="score-cat-name">${c.name}</span><span class="score-cat-val">${c.score}/100</span></div>
      <div class="score-cat-bar"><div class="score-cat-fill" data-w="${c.score}"></div></div>
    </div>`).join('');
  setTimeout(() => {
    document.querySelectorAll('.score-cat-fill').forEach(f => { f.style.width = f.dataset.w + '%'; });
  }, 60);

  // tips
  const tips = Array.isArray(r.tips) ? r.tips : [];
  el('scoreTips').innerHTML = tips.length
    ? `<h4>Top fixes to raise your score</h4><ul>${tips.map(t => `<li>${t}</li>`).join('')}</ul>`
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
