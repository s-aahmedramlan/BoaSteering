// Keep service worker alive for alarms if needed in future
chrome.runtime.onInstalled.addListener(() => {
  console.log('[boa] extension installed');
});
