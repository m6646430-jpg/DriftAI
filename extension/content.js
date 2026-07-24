// DriftAI Auto-Apply — content script
// Detects Greenhouse / Lever / Ashby application forms and fills them from the
// user's saved profile. It NEVER submits — the user reviews, attaches the
// resume, and clicks Submit themselves (legal, user-initiated).

(() => {
  const HOST = location.hostname;
  const ATS =
    /greenhouse\.io/.test(HOST) ? 'greenhouse' :
    /lever\.co/.test(HOST) ? 'lever' :
    /ashbyhq\.com/.test(HOST) ? 'ashby' : null;
  if (!ATS) return;

  // ---- React-safe value setter ----
  function setValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // ---- Build a searchable "meaning" string for a field ----
  function fieldText(el) {
    const parts = [];
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) parts.push(l.innerText);
    }
    const wrap = el.closest('label');
    if (wrap) parts.push(wrap.innerText);
    const lb = el.getAttribute('aria-labelledby');
    if (lb) lb.split(/\s+/).forEach(id => { const n = document.getElementById(id); if (n) parts.push(n.innerText); });
    ['placeholder', 'name', 'id', 'aria-label', 'autocomplete', 'data-qa'].forEach(a => {
      const v = el.getAttribute(a); if (v) parts.push(v);
    });
    return parts.join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && !el.disabled && !el.readOnly;
  }

  // ---- Field definitions: which profile value fills which field ----
  // Order matters — more specific first so "first name" wins over "name".
  const FIELDS = [
    { key: 'firstName', re: /given.?name|first.?name|^fname$/ },
    { key: 'lastName', re: /family.?name|last.?name|surname|^lname$/ },
    { key: 'email', re: /e.?mail/ },
    { key: 'phone', re: /phone|mobile|telephone|\btel\b/ },
    { key: 'linkedin', re: /linkedin/ },
    { key: 'github', re: /github/ },
    { key: 'website', re: /portfolio|personal.?(site|website)|website|other.?url|your.?site/ },
    { key: 'city', re: /\bcity\b|current.?location|where.*located|location \(city/ },
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
      return ['text', 'email', 'tel', 'url', 'search', 'textarea', ''].includes(t) || el.tagName === 'TEXTAREA';
    }).filter(isVisible);

    const used = new Set();
    let filled = 0;
    for (const def of FIELDS) {
      const val = values[def.key];
      if (!val) continue;
      for (const el of inputs) {
        if (used.has(el)) continue;
        if (el.value && el.value.trim()) continue; // never overwrite what's already there
        if (def.re.test(fieldText(el))) {
          setValue(el, val);
          used.add(el); filled++;
          break;
        }
      }
    }

    // Basic work-authorization / sponsorship selects (yes/no)
    filled += fillYesNo(/authoriz|eligible to work|legally.*work|right to work/, profile.workAuthorized);
    filled += fillYesNo(/sponsor|visa.*support|require.*sponsor/, profile.needsSponsorship);

    return filled;
  }

  function fillYesNo(labelRe, yesNo) {
    if (yesNo !== 'yes' && yesNo !== 'no') return 0;
    const want = yesNo === 'yes';
    let n = 0;
    for (const sel of document.querySelectorAll('select')) {
      if (!isVisible(sel) || sel.value) continue;
      if (labelRe.test(fieldText(sel))) {
        const opt = [...sel.options].find(o => (want ? /^yes/i : /^no/i).test(o.textContent.trim()));
        if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); n++; }
      }
    }
    return n;
  }

  // ---- Floating panel ----
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

    box.querySelector('#da-fill').addEventListener('click', async () => {
      const { driftai_profile } = await chrome.storage.local.get('driftai_profile');
      const status = box.querySelector('#da-status');
      if (!driftai_profile || !driftai_profile.email) {
        status.innerHTML = '⚠️ Set up your profile first (Edit my profile).';
        return;
      }
      const n = fill(driftai_profile);
      status.innerHTML = n ? `✓ Filled ${n} field${n === 1 ? '' : 's'}. Review & attach resume.` : 'No matching fields found on this page.';
    });
    box.querySelector('#da-edit').addEventListener('click', e => {
      e.preventDefault();
      // Content scripts can't open the options page directly — ask the worker.
      chrome.runtime.sendMessage({ type: 'open-options' });
    });
  }

  // Show the panel once an application form is present (email field is the tell).
  function maybeShow() {
    const hasForm = document.querySelector('input[type="email"], input[name*="email" i], input[id*="email" i]');
    if (hasForm) panel();
  }
  maybeShow();
  // ATS forms (esp. Ashby/React) can render late — watch for it.
  const obs = new MutationObserver(() => maybeShow());
  obs.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => obs.disconnect(), 15000);
})();
