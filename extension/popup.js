/* global chrome */
'use strict';

const resultEl = document.getElementById('result');
const syncBtn = document.getElementById('syncBtn');

syncBtn.addEventListener('click', () => {
  resultEl.textContent = 'Syncing...';
  syncBtn.disabled = true;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.id) {
      resultEl.textContent = 'No active tab found.';
      syncBtn.disabled = false;
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: 'SYNC_NOW' }, (response) => {
      syncBtn.disabled = false;

      if (chrome.runtime.lastError) {
        // Content script not available on this tab (not claude.ai or not injected yet)
        resultEl.textContent = 'Open a Claude.ai conversation first.';
        return;
      }

      if (!response) {
        resultEl.textContent = 'Boa not running — start it on port 3333';
        return;
      }

      if (response.noChange) {
        resultEl.textContent = 'No new facts';
        return;
      }

      if (response.stored === 0 && !response.noChange) {
        // Post was attempted but nothing stored — Boa may be down
        resultEl.textContent = 'Boa not running — start it on port 3333';
        return;
      }

      resultEl.textContent = `Stored ${response.stored} fact${response.stored === 1 ? '' : 's'}`;
    });
  });
});
