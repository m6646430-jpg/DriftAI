const form = document.getElementById('profileForm');
const FIELDS = ['firstName', 'lastName', 'email', 'phone', 'linkedin', 'github', 'website', 'city', 'targetRole', 'targetCountry', 'skills', 'workAuthorized', 'needsSponsorship'];

// Load saved profile into the form
chrome.storage.local.get('driftai_profile').then(({ driftai_profile }) => {
  if (!driftai_profile) return;
  FIELDS.forEach(k => { if (form[k] != null && driftai_profile[k] != null) form[k].value = driftai_profile[k]; });
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const profile = {};
  FIELDS.forEach(k => { profile[k] = (form[k]?.value || '').trim(); });
  await chrome.storage.local.set({ driftai_profile: profile });
  document.getElementById('saved').textContent = '✓ Saved! Now open a job application and click "Fill this application".';
});
