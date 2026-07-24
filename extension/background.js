// Opens the profile/options page when the content-script panel asks for it.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'open-options') chrome.runtime.openOptionsPage();
});
