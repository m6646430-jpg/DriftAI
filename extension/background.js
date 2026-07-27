// DriftAI Auto-Apply — background service worker
// Orchestrates "apply" (open each job's application tab) and turns the content
// script's fill reports into a live status tracker. No server involved.

const TABJOB = 'ds_tab_job';       // { [tabId]: jobId }
const STATUS = 'ds_apply_status';  // { [jobId]: { status, note, url, role, company, ts } }

async function get(key) { return (await chrome.storage.local.get(key))[key] || {}; }
async function setStatus(jobId, patch) {
  const s = await get(STATUS);
  s[jobId] = { ...(s[jobId] || {}), ...patch, ts: Date.now() };
  await chrome.storage.local.set({ [STATUS]: s });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === 'open-options') { chrome.runtime.openOptionsPage(); return; }

    // Content script reports what happened on an application page
    if (msg?.type === 'fill-report' && sender.tab) {
      const map = await get(TABJOB);
      const jobId = map[sender.tab.id];
      if (jobId) await setStatus(jobId, { status: msg.status, note: msg.note });
      return;
    }
  })();
  return true; // keep the channel open for async sendResponse
});

// Clean up the tab→job map when a tab closes
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const map = await get(TABJOB);
  if (map[tabId] != null) { delete map[tabId]; await chrome.storage.local.set({ [TABJOB]: map }); }
});
