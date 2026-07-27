const status = document.getElementById('status');
chrome.storage.local.get('driftai_profile').then(({ driftai_profile }) => {
  if (driftai_profile && driftai_profile.email) {
    status.textContent = `✓ Profile ready — ${driftai_profile.firstName || ''} ${driftai_profile.lastName || ''}`.trim();
    status.className = 'status ok';
  } else {
    status.textContent = '⚠ No profile yet — set it up below.';
    status.className = 'status warn';
  }
});
document.getElementById('dash').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') }));
document.getElementById('edit').addEventListener('click', () => chrome.runtime.openOptionsPage());
