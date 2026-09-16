const tabsAPI = typeof chrome !== 'undefined' && chrome.tabs ? chrome.tabs : browser.tabs;
const THRONE_USER = "relapsebaitt";

// Allow content scripts to access session storage
chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });

// *** State ***

let activeTabId = null;
let offscreenCreated = false;
let openingTab = false;

// *** Offscreen Audio ***

async function ensureOffscreen() {
  if (offscreenCreated) return;
  const exists = await chrome.offscreen.hasDocument().catch(() => false);
  if (exists) {
    offscreenCreated = true;
    return;
  }
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Play drain audio'
  }).catch(() => {});
  offscreenCreated = true;
}

async function playAudio() {
  await ensureOffscreen();
  chrome.runtime.sendMessage({ action: 'playAudio' }).catch(() => {});
}

// *** Tab Management ***

function openDrainTab() {
  if (openingTab || activeTabId) return;
  openingTab = true;

  tabsAPI.create({ url: `https://throne.com/${THRONE_USER}` }, (tab) => {
    openingTab = false;
    if (!tab) return;
    activeTabId = tab.id;
    chrome.storage.local.set({ activeTabId: tab.id });
  });
}

tabsAPI.onRemoved.addListener((tabId) => {
  chrome.storage.local.get(['activeTabId'], (localResult) => {
    const storedTabId = activeTabId || localResult.activeTabId;
    if (tabId !== storedTabId) return;
    activeTabId = null;

    chrome.storage.session.get(['OMSD_EXTREME_MODE'], (result) => {
      if (!result.OMSD_EXTREME_MODE) return;

      chrome.storage.session.set({ reopenedTab: true }, () => {
        chrome.storage.local.set({ activeTabId: null });
        setTimeout(openDrainTab, 1000);
      });
    });
  });
});

// *** Message Handling ***

chrome.runtime.onMessage.addListener((message, sender) => {
  switch (message.action) {
    case 'startAudio':
      playAudio();
      break;

    case 'getTabId':
      chrome.storage.local.set({ activeTabId: sender.tab?.id });
      activeTabId = sender.tab?.id;
      break;
  }
});
