// DriftAI — saved application answers ("answer once, reuse forever").
// Stores each answer keyed to the logged-in student (or 'guest' if not logged
// in), so the Apply Assistant can auto-fill it on every future application.
// localStorage today; swap the load/save internals to Supabase for cross-device
// (table suggestion in README/LAUNCH). Public API: DriftProfile.{recall,remember,all,forget}
window.DriftProfile = (function () {
  let keyPromise = null;
  const norm = q => String(q || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

  async function storeKey() {
    if (keyPromise) return keyPromise;
    keyPromise = (async () => {
      let who = 'guest';
      try { if (typeof authCurrentUser === 'function') { const u = await authCurrentUser(); if (u && u.email) who = u.email.toLowerCase(); } } catch {}
      return 'ds_answers_' + who;
    })();
    return keyPromise;
  }
  async function load() { const k = await storeKey(); try { return JSON.parse(localStorage.getItem(k)) || {}; } catch { return {}; } }
  async function save(map) { const k = await storeKey(); localStorage.setItem(k, JSON.stringify(map)); }

  // Save (or update) an answer to a question.
  async function remember(question, answer) {
    if (!answer || !String(answer).trim()) return;
    const m = await load();
    m[norm(question)] = { q: question, a: String(answer).trim(), ts: Date.now() };
    await save(m);
  }
  // Words too common to signal a match (so "start date" ≠ "expected salary").
  const STOP = new Set(('what which your you this that the a an of are is do does will would have has had for and with from when where how many much long able currently ' +
    'role position job company now future or any please tell us we they their my me i in on to at be been your\'re you\'re require need').split(' '));
  const keywords = s => norm(s).split(' ').filter(w => w.length > 2 && !STOP.has(w));

  // Find a saved answer for a question — exact key, else meaningful-keyword overlap.
  async function recall(question) {
    const m = await load();
    const n = norm(question);
    if (m[n]) return m[n].a;
    const qw = keywords(question);
    if (!qw.length) return null;
    let best = null, score = 0;
    for (const k in m) {
      const kw = keywords(m[k].q);
      const hit = qw.filter(w => kw.includes(w)).length;
      if (hit > score) { score = hit; best = m[k]; }
    }
    const ratio = score / qw.length;
    return (score >= 2 || (score >= 1 && ratio >= 0.5)) ? best.a : null;
  }
  async function all() { const m = await load(); return Object.entries(m).map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.ts - a.ts); }
  async function forget(key) { const m = await load(); delete m[key]; await save(m); }

  return { remember, recall, all, forget };
})();
