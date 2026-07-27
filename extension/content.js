// DriftAI Auto-Apply — content script
// Fills Greenhouse/Lever/Ashby application forms from the saved profile, detects
// blockers (CAPTCHA, resume upload), and reports status to the dashboard.
// It NEVER submits — the human reviews, attaches the resume, and clicks Submit.

(() => {
  const HOST = location.hostname;
  const ATS =
    /greenhouse\.io/.test(HOST) ? 'greenhouse' :
    /lever\.co/.test(HOST) ? 'lever' :
    /ashbyhq\.com/.test(HOST) ? 'ashby' : null;
  if (!ATS) return;

  function setValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }
  function fieldText(el) {
    const parts = [];
    if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) parts.push(l.innerText); }
    const wrap = el.closest('label'); if (wrap) parts.push(wrap.innerText);
    const lb = el.getAttribute('aria-labelledby');
    if (lb) lb.split(/\s+/).forEach(id => { const n = document.getElementById(id); if (n) parts.push(n.innerText); });
    ['placeholder', 'name', 'id', 'aria-label', 'autocomplete', 'data-qa'].forEach(a => { const v = el.getAttribute(a); if (v) parts.push(v); });
    return parts.join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function isVisible(el) {
    const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && !el.disabled && !el.readOnly;
  }

  const FIELDS = [
    { key: 'firstName', re: /given.?name|first.?name|^fname$/ },
    { key: 'lastName', re: /family.?name|last.?name|surname|^lname$/ },
    { key: 'email', re: /e.?mail/ },
    { key: 'phone', re: /phone|mobile|telephone|\btel\b/ },
    { key: 'linkedin', re: /linkedin/ },
    { key: 'github', re: /github/ },
    { key: 'website', re: /portfolio|personal.?(site|website)|website|other.?url|your.?site/ },
    { key: 'city', re: /\bcity\b|current.?location|where.*located/ },
    { key: 'fullName', re: /full.?name|legal.?name|^name$|your.?name|candidate.?name/ },
  ];

  function fill(profile) {
    const full = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
    const values = {
      firstName: profile.firstName, lastName: profile.lastName, email: profile.email,
      phone: profile.phone, linkedin: profile.linkedin, github: profile.github,
      website: profile.website, city: profile.city, fullName: full || profile.fullName,
    };
    const inputs = [...document.querySelectorAll('input, textarea')].filter(el => {
      const t = (el.type || 'text').toLowerCase();
      return el.tagName === 'TEXTAREA' || ['text', 'email', 'tel', 'url', 'search', ''].includes(t);
    }).filter(isVisible);

    const used = new Set(); let filled = 0;
    for (const def of FIELDS) {
      const val = values[def.key]; if (!val) continue;
      for (const el of inputs) {
        if (used.has(el)) continue;
        if (el.value && el.value.trim()) continue;
        if (def.re.test(fieldText(el))) { setValue(el, val); used.add(el); filled++; break; }
      }
    }
    filled += fillYesNo(/authoriz|eligible to work|legally.*work|right to work/, profile.workAuthorized);
    filled += fillYesNo(/sponsor|visa.*support|require.*sponsor/, profile.needsSponsorship);

    return { filled, hasCaptcha: detectCaptcha(), hasFileUpload: detectFileUpload() };
  }
  function fillYesNo(labelRe, yesNo) {
    if (yesNo !== 'yes' && yesNo !== 'no') return 0;
    const want = yesNo === 'yes'; let n = 0;
    for (const sel of document.querySelectorAll('select')) {
      if (!isVisible(sel) || sel.value) continue;
      if (labelRe.test(fieldText(sel))) {
        const opt = [...sel.options].find(o => (want ? /^yes/i : /^no/i).test(o.textContent.trim()));
        if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); n++; }
      }
    }
    return n;
  }

  // ---- blocker detection (why an application "needs you") ----
  function detectCaptcha() {
    return !!(
      document.querySelector('.g-recaptcha, .h-captcha, [data-sitekey], iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[title*="captcha" i]') ||
      /captcha|are you human|verify you.?re human/i.test(document.body.innerText.slice(0, 4000))
    );
  }
  function detectFileUpload() {
    return [...document.querySelectorAll('input[type="file"]')].some(isVisible) ||
      /attach|upload.*(resume|cv)/i.test(document.body.innerText.slice(0, 4000));
  }

  function report(status, note) { try { chrome.runtime.sendMessage({ type: 'fill-report', status, note }); } catch {} }

  async function doFill(fromPanel) {
    const { driftai_profile } = await chrome.storage.local.get('driftai_profile');
    const status = document.querySelector('#driftai-panel #da-status');
    if (!driftai_profile || !driftai_profile.email) {
      if (status) status.innerHTML = '⚠️ Set up your profile first.';
      report('needs-you', 'No profile saved');
      return;
    }
    const r = fill(driftai_profile);
    // Decide the reported status
    if (r.hasCaptcha) {
      report('needs-you', `Filled ${r.filled} fields — CAPTCHA: solve + submit`);
      if (status) status.innerHTML = `⚠️ CAPTCHA here — I filled ${r.filled} fields; solve it, attach resume & submit.`;
    } else if (!r.filled) {
      report('needs-you', 'No matching fields — fill manually');
      if (status) status.innerHTML = 'No matching fields found — please fill manually.';
    } else {
      const note = r.hasFileUpload ? `Filled ${r.filled} — attach resume & submit` : `Filled ${r.filled} — review & submit`;
      report('filled', note);
      if (status) status.innerHTML = `✓ Filled ${r.filled} fields. ${r.hasFileUpload ? 'Attach your resume, then Submit.' : 'Review, then Submit.'}`;
    }
  }

  // ---- floating panel ----
  function panel() {
    if (document.getElementById('driftai-panel')) return;
    const box = document.createElement('div');
    box.id = 'driftai-panel';
    box.innerHTML = `
      <div class="da-head"><span class="da-logo">Drift<b>AI</b></span> Auto-Apply</div>
      <button id="da-fill" class="da-btn">⚡ Fill this application</button>
      <div id="da-status" class="da-status"></div>
      <div class="da-note">Then <b>attach your resume</b>, review, and hit Submit yourself.</div>
      <a id="da-edit" class="da-edit" href="#">Edit my profile →</a>`;
    document.body.appendChild(box);
    box.querySelector('#da-fill').addEventListener('click', () => doFill(true));
    box.querySelector('#da-edit').addEventListener('click', e => { e.preventDefault(); chrome.runtime.sendMessage({ type: 'open-options' }); });
  }

  // If the page is a job description (no form yet), click the site's own
  // "Apply" button to jump straight to the application form. (Clicks a real
  // button in your browser — no bypass.) Skips wasting time on the JD.
  let applyClicked = false;
  function clickApplyToReveal() {
    if (applyClicked) return;
    const cands = [...document.querySelectorAll('a, button, [role="button"]')].filter(el => {
      const t = (el.innerText || el.textContent || '').trim().toLowerCase();
      if (!t || t.length > 26) return false;
      return /^(apply|apply now|apply for this( job| role| position)?|apply to this job|application|i'?m interested|start application|submit application)$/.test(t)
        || (/\bapply\b/.test(t) && !/apply on|external|company (site|website)|elsewhere/i.test(t));
    }).filter(isVisible);
    // Prefer controls that stay on the same ATS (don't bounce to an external site).
    const btn = cands.find(el => el.tagName === 'BUTTON' || el.getAttribute('role') === 'button'
      || (el.tagName === 'A' && (!el.href || el.href.startsWith(location.origin))));
    if (btn) { applyClicked = true; btn.click(); }
  }

  let handled = false;
  async function maybeShow() {
    const hasForm = document.querySelector('input[type="email"], input[name*="email" i], input[id*="email" i]');
    if (hasForm) {
      if (handled) return;
      handled = true;
      panel();
      // Auto mode is ON by default — the agent fills the moment the form loads.
      const { ds_auto_mode } = await chrome.storage.local.get('ds_auto_mode');
      if (ds_auto_mode !== false) setTimeout(() => doFill(false), 700);
      return;
    }
    // No form yet → reveal it by clicking the page's Apply button (once).
    clickApplyToReveal();
  }
  maybeShow();
  const obs = new MutationObserver(() => maybeShow());
  obs.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => obs.disconnect(), 25000);
})();
