// DriftAI — saved application answers ("answer once, reuse forever").
// Syncs across devices via Supabase when the student is logged in; falls back
// to localStorage for guests / offline. Write-through cache keeps reads instant.
// Public API: DriftProfile.{recall, remember, all, forget}
//
// Supabase table required (run once in the SQL editor — see LAUNCH.md):
//   create table apply_answers (
//     user_id uuid not null references auth.users on delete cascade default auth.uid(),
//     qkey text not null, question text, answer text,
//     updated_at timestamptz default now(),
//     primary key (user_id, qkey));
//   alter table apply_answers enable row level security;
//   create policy "own answers" on apply_answers for all
//     using (user_id = auth.uid()) with check (user_id = auth.uid());
window.DriftProfile = (function () {
  const norm = q => String(q || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const STOP = new Set(('what which your you this that the a an of are is do does will would have has had for and with from when where how many much long able currently ' +
    'role position job company now future or any please tell us we they their my me i in on to at be been require need').split(' '));
  const keywords = s => norm(s).split(' ').filter(w => w.length > 2 && !STOP.has(w));

  let cache = null, cacheKey = 'ds_answers_guest';

  // Logged-in Supabase context, or null (guest / demo / not configured).
  async function ctx() {
    try {
      if (typeof AUTH_CONFIGURED !== 'undefined' && AUTH_CONFIGURED && typeof sbClient === 'function') {
        const c = sbClient();
        if (c) { const { data } = await c.auth.getUser(); if (data && data.user) return { sb: c, uid: data.user.id, email: data.user.email }; }
      }
    } catch {}
    return null;
  }
  const readLocal = k => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch { return {}; } };
  const writeLocal = () => localStorage.setItem(cacheKey, JSON.stringify(cache));

  // Load answers into the cache: pull from Supabase if logged in, else local.
  async function ensureCache(force) {
    if (cache && !force) return cache;
    const c = await ctx();
    if (c) {
      cacheKey = 'ds_answers_' + c.email;
      try {
        const { data, error } = await c.sb.from('apply_answers').select('qkey,question,answer,updated_at');
        if (!error && Array.isArray(data)) {
          cache = {};
          data.forEach(r => { cache[r.qkey] = { q: r.question, a: r.answer, ts: Date.parse(r.updated_at) || Date.now() }; });
          writeLocal();
          return cache;
        }
      } catch {}
      cache = readLocal(cacheKey); // Supabase unreachable → use last local copy
      return cache;
    }
    cacheKey = 'ds_answers_guest';
    cache = readLocal(cacheKey);
    return cache;
  }

  async function remember(question, answer) {
    if (!answer || !String(answer).trim()) return;
    await ensureCache();
    const k = norm(question), a = String(answer).trim();
    cache[k] = { q: question, a, ts: Date.now() };
    writeLocal();
    const c = await ctx();
    if (c) { try { await c.sb.from('apply_answers').upsert({ user_id: c.uid, qkey: k, question, answer: a }, { onConflict: 'user_id,qkey' }); } catch {} }
  }

  async function recall(question) {
    await ensureCache();
    const n = norm(question);
    if (cache[n]) return cache[n].a;
    const qw = keywords(question);
    if (!qw.length) return null;
    let best = null, score = 0;
    for (const k in cache) {
      const kw = keywords(cache[k].q);
      const hit = qw.filter(w => kw.includes(w)).length;
      if (hit > score) { score = hit; best = cache[k]; }
    }
    return (score >= 2 || (score >= 1 && score / qw.length >= 0.5)) ? best.a : null;
  }

  async function all() { await ensureCache(true); return Object.entries(cache).map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.ts - a.ts); }

  async function forget(key) {
    await ensureCache();
    delete cache[key]; writeLocal();
    const c = await ctx();
    if (c) { try { await c.sb.from('apply_answers').delete().eq('user_id', c.uid).eq('qkey', key); } catch {} }
  }

  return { remember, recall, all, forget };
})();
