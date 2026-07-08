// ===== DRIFTAI AUTH =====
// Works in two modes:
//   1. DEMO mode (default) — stores the account in the browser (localStorage) so
//      you can test the full signup/login/member flow locally with NO backend.
//   2. SUPABASE mode — real accounts in a database. Fill the two values below
//      (from your Supabase project → Settings → API). The anon key is PUBLIC by
//      design and safe in frontend code; security is enforced by Row Level
//      Security in Supabase, not by hiding this key.
const SUPABASE_URL = 'YOUR_SUPABASE_URL';        // e.g. https://abcd.supabase.co
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const AUTH_CONFIGURED = !SUPABASE_URL.includes('YOUR_') && !SUPABASE_ANON_KEY.includes('YOUR_');
const DEMO_KEY = 'driftai_demo_user';

let _sb = null;
function sbClient() {
  if (!AUTH_CONFIGURED) return null;
  if (!_sb && window.supabase) _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _sb;
}

// ---- SIGN UP ----
async function authSignUp({ name, email, password }) {
  if (AUTH_CONFIGURED) {
    const sb = sbClient();
    const { data, error } = await sb.auth.signUp({
      email, password, options: { data: { full_name: name } },
    });
    if (error) throw new Error(error.message);
    return data.user;
  }
  // DEMO mode
  await _delay(600);
  const existing = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null');
  if (existing && existing.email === email) throw new Error('An account with this email already exists.');
  const user = { name, email, password, created: new Date().toISOString() };
  localStorage.setItem(DEMO_KEY, JSON.stringify(user));
  localStorage.setItem('driftai_session', '1');
  return user;
}

// ---- LOG IN ----
async function authLogIn({ email, password }) {
  if (AUTH_CONFIGURED) {
    const sb = sbClient();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data.user;
  }
  // DEMO mode
  await _delay(600);
  const user = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null');
  if (!user || user.email !== email || user.password !== password) {
    throw new Error('Wrong email or password.');
  }
  localStorage.setItem('driftai_session', '1');
  return user;
}

// ---- LOG OUT ----
async function authLogOut() {
  if (AUTH_CONFIGURED) { await sbClient().auth.signOut(); }
  localStorage.removeItem('driftai_session');
  window.location.href = 'index.html';
}

// ---- CURRENT USER ----
async function authCurrentUser() {
  if (AUTH_CONFIGURED) {
    const { data } = await sbClient().auth.getUser();
    if (!data.user) return null;
    return { name: data.user.user_metadata?.full_name || 'Member', email: data.user.email };
  }
  // DEMO mode
  if (localStorage.getItem('driftai_session') !== '1') return null;
  return JSON.parse(localStorage.getItem(DEMO_KEY) || 'null');
}

// ---- ROUTE GUARD (for member-only pages) ----
async function requireAuth(redirect = 'account.html') {
  const user = await authCurrentUser();
  if (!user) { window.location.href = redirect; return null; }
  return user;
}

// ---- NAV STATE (show Log In vs My Account) ----
async function refreshAuthNav() {
  const user = await authCurrentUser();
  document.querySelectorAll('[data-auth="in"]').forEach(el => el.style.display = user ? '' : 'none');
  document.querySelectorAll('[data-auth="out"]').forEach(el => el.style.display = user ? 'none' : '');
}

function _delay(ms) { return new Promise(r => setTimeout(r, ms)); }

document.addEventListener('DOMContentLoaded', refreshAuthNav);
