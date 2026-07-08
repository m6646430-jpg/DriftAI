// ===== DRIFTAI AUTH =====
// Works in two modes:
//   1. DEMO mode (default) — stores the account in the browser (localStorage) so
//      you can test the full signup/login/member flow locally with NO backend.
//   2. SUPABASE mode — real accounts in a database. Fill the two values below
//      (from your Supabase project → Settings → API). The anon key is PUBLIC by
//      design and safe in frontend code; security is enforced by Row Level
//      Security in Supabase, not by hiding this key.
const SUPABASE_URL = 'https://nldrbixsorjxbdkakfoj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sZHJiaXhzb3JqeGJka2FrZm9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MzQ3MDIsImV4cCI6MjA5OTExMDcwMn0.DCyPGyn12G8bdwhg2DKSfH-riK12Fvh5ORibyKcnM7U';

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
    // If no session, Supabase requires email confirmation before login.
    return { user: data.user, needsConfirmation: !data.session };
  }
  // DEMO mode
  await _delay(600);
  const existing = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null');
  if (existing && existing.email === email) throw new Error('An account with this email already exists.');
  const user = { name, email, password, created: new Date().toISOString() };
  localStorage.setItem(DEMO_KEY, JSON.stringify(user));
  localStorage.setItem('driftai_session', '1');
  return { user, needsConfirmation: false };
}

// ---- SOCIAL LOGIN (Google / GitHub) ----
// Requires Supabase configured AND the provider enabled in your Supabase
// dashboard (Authentication -> Providers). Cannot work in demo mode.
async function authOAuth(provider) {
  if (!AUTH_CONFIGURED) {
    alert('Sign in with ' + provider + ' turns on once Supabase is connected (a quick, free setup). For now, please use email sign-up.');
    return;
  }
  const sb = sbClient();
  const { error } = await sb.auth.signInWithOAuth({
    provider, // 'google' or 'github'
    options: { redirectTo: window.location.origin + '/members.html' },
  });
  if (error) alert(error.message);
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
