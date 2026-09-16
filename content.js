// Auto-Drain Extension for Throne

const STORAGE_KEY = "omsd_selected_item";
const STORAGE_PRICE_KEY = "omsd_selected_item_price";
const SESSION_PROMPT_KEY = "omsd_prompt_shown";
const THRONE_USER = "urfavrelapse";
const MEDIA_SERVICE = "https://urfavrelapse-pics-production.up.railway.app"

let ALLOWED_ITEMS = [];
let ITEM_EMOJIS = {};
let ITEM_PRICES = {};

let selectedItem = localStorage.getItem(STORAGE_KEY) || null;
let selectedItemPrice = parseFloat(localStorage.getItem(STORAGE_PRICE_KEY)) || 0;

let unloadHandler = null;
let lastDetectedRoute = null;

let spawningPaused = false;
let awaitingSelection = false;
let randomModeActive = false;
let checkoutCounted = false;
let lockdownActive = false;
let stallTimerActive = false;
let isPaying = false;

let routeChangeCount = 0;
let totalDrained = 0;
let sendCount = 0;

let _deckState = [];
let _randomPicked = false;
let _sessionReady = false;

// Pre-load session state
chrome.storage.session.get(['OMSD_RANDOM_MODE', 'OMSD_DECK', 'OMSD_RANDOM_PICKED', 'OMSD_ALLOWED_ITEMS', 'OMSD_ITEM_PRICES'], (result) => {
  randomModeActive = result.OMSD_RANDOM_MODE === true;
  _deckState = result.OMSD_DECK || [];
  _randomPicked = result.OMSD_RANDOM_PICKED === true;
  if (result.OMSD_ALLOWED_ITEMS && result.OMSD_ALLOWED_ITEMS.length > 0) {
    ALLOWED_ITEMS = result.OMSD_ALLOWED_ITEMS;
  }
  if (result.OMSD_ITEM_PRICES && Object.keys(result.OMSD_ITEM_PRICES).length > 0) {
    ITEM_PRICES = result.OMSD_ITEM_PRICES;
  }
  _sessionReady = true;
});

// Deck draw random picker
function deckDraw(pool) {
  let deck = _deckState;

  if (deck.length === 0) {
    deck = pool.slice();
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }

  const pick = deck.shift();
  _deckState = deck;
  chrome.storage.session.set({ OMSD_DECK: deck });
  return pick;
}

// Show send messages
function showSendMsg(msg) {
  const existing = document.getElementById('send-msg');
  if (existing) existing.remove();

  const msgDiv = document.createElement('div');
  msgDiv.id = 'send-msg';
  msgDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.8);z-index:10003;color:#ff1493;font-size:42px;font-weight:700;text-align:center;line-height:1.5;white-space:pre-line;font-family:-apple-system,BlinkMacSystemFont,sans-serif;text-shadow:0 0 30px rgba(255,20,147,0.8),0 0 60px rgba(255,20,147,0.4);pointer-events:none;opacity:0;transition:all 0.5s ease;';
  msgDiv.textContent = msg;
  document.body.appendChild(msgDiv);

  requestAnimationFrame(() => {
    msgDiv.style.opacity = '1';
    msgDiv.style.transform = 'translate(-50%,-50%) scale(1)';
  });

  setTimeout(() => {
    msgDiv.style.opacity = '0';
    msgDiv.style.transform = 'translate(-50%,-50%) scale(1.1)';
    setTimeout(() => msgDiv.remove(), 500);
  }, 3000);
}

// Show no escape warning
function showNoEscapeWarning(originalUrl) {
  spawningPaused = true;

  const existingWarning = document.getElementById("escape-warning");
  if (existingWarning) return;

  const warningOverlay = document.createElement("div");
  warningOverlay.id = "escape-warning";
  warningOverlay.style.position = "fixed";
  warningOverlay.style.top = "0";
  warningOverlay.style.left = "0";
  warningOverlay.style.width = "100%";
  warningOverlay.style.height = "100%";
  warningOverlay.style.backgroundColor = "rgba(0, 0, 0, 1)";
  warningOverlay.style.zIndex = "10001";
  warningOverlay.style.pointerEvents = "auto";
  warningOverlay.style.display = "flex";
  warningOverlay.style.alignItems = "center";
  warningOverlay.style.justifyContent = "center";
  warningOverlay.style.flexDirection = "column";

  const message = document.createElement("h1");
  message.textContent = "Stop trying to escape";
  message.style.color = "#ff1493";
  message.style.fontSize = "48px";
  message.style.fontWeight = "900";
  message.style.textAlign = "center";
  message.style.marginBottom = "20px";
  message.style.fontFamily = "sans-serif";
  message.style.textTransform = "uppercase";
  message.style.letterSpacing = "2px";
  message.style.animation = "shake 0.5s";

  const subtext = document.createElement("p");
  subtext.textContent = "You're locked in. There's no leaving.";
  subtext.style.color = "#ff69b4";
  subtext.style.fontSize = "20px";
  subtext.style.textAlign = "center";
  subtext.style.fontFamily = "sans-serif";
  subtext.style.opacity = "0.9";

  if (!document.getElementById("lockdown-styles")) {
    const style = document.createElement("style");
    style.id = "lockdown-styles";
    style.textContent = `
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
      }
    `;
    document.head.appendChild(style);
  }

  warningOverlay.appendChild(message);
  warningOverlay.appendChild(subtext);
  document.body.appendChild(warningOverlay);

  setTimeout(() => {
    warningOverlay.remove();
    window.location.href = originalUrl;
  }, 2000);
}

// Create lockdown overlay
function createLockdownOverlay() {
  const overlay = document.createElement("div");
  overlay.id = "lockdown-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 1)";
  overlay.style.zIndex = "9999";
  overlay.style.pointerEvents = "auto";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.flexDirection = "column";
  overlay.style.fontFamily = "sans-serif";
  overlay.style.color = "#fff";

  const content = document.createElement("div");
  content.style.textAlign = "center";
  content.style.padding = "40px";
  content.style.maxWidth = "500px";

  const title = document.createElement("h1");
  title.textContent = "⏳ Processing...";
  title.style.fontSize = "36px";
  title.style.marginBottom = "20px";
  title.style.color = "#ff1493";

  const msg = document.createElement("p");
  msg.textContent = "Don't close this tab. Your order is being processed. 💕";
  msg.style.fontSize = "18px";
  msg.style.marginBottom = "20px";
  msg.style.lineHeight = "1.6";

  const subtext = document.createElement("p");
  subtext.textContent = "Your wallet is emptying...";
  subtext.style.fontSize = "16px";
  subtext.style.color = "#ff69b4";
  subtext.style.marginBottom = "25px";
  subtext.style.fontStyle = "italic";
  subtext.style.opacity = "0.9";

  const spinner = document.createElement("div");
  spinner.style.border = "4px solid #ff1493";
  spinner.style.borderTop = "4px solid transparent";
  spinner.style.borderRadius = "50%";
  spinner.style.width = "50px";
  spinner.style.height = "50px";
  spinner.style.animation = "spin 1s linear infinite";
  spinner.style.margin = "0 auto 30px";

  const reminderText = document.createElement("p");
  reminderText.textContent = "it's too late to turn back now 💦";
  reminderText.style.fontSize = "14px";
  reminderText.style.color = "#ff69b4";
  reminderText.style.marginTop = "25px";
  reminderText.style.marginBottom = "15px";
  reminderText.style.opacity = "0.85";

  const leaveBtn = document.createElement("button");
  leaveBtn.textContent = "← Leave";
  leaveBtn.style.padding = "12px 24px";
  leaveBtn.style.background = "rgba(255, 255, 255, 0.2)";
  leaveBtn.style.color = "#fff";
  leaveBtn.style.border = "2px solid #fff";
  leaveBtn.style.borderRadius = "8px";
  leaveBtn.style.cursor = "pointer";
  leaveBtn.style.fontSize = "16px";
  leaveBtn.style.marginTop = "10px";
  leaveBtn.style.transition = "all 0.3s";
  leaveBtn.style.fontWeight = "600";

  leaveBtn.onmouseover = () => {
    leaveBtn.style.background = "rgba(255, 255, 255, 0.1)";
  };
  leaveBtn.onmouseout = () => {
    leaveBtn.style.background = "rgba(255, 255, 255, 0.2)";
  };

  leaveBtn.onclick = () => {
    leaveBtn.disabled = true;
    leaveBtn.style.opacity = "0.5";
    leaveBtn.style.cursor = "not-allowed";
    showRedirectWarning(() => {
      leaveBtn.disabled = false;
      leaveBtn.style.opacity = "1";
      leaveBtn.style.cursor = "pointer";
    });
  };

  if (!document.getElementById("lockdown-styles")) {
    const style = document.createElement("style");
    style.id = "lockdown-styles";
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
      }
    `;
    document.head.appendChild(style);
  }

  content.appendChild(title);
  content.appendChild(msg);
  content.appendChild(subtext);
  content.appendChild(spinner);
  content.appendChild(reminderText);
  content.appendChild(leaveBtn);
  overlay.appendChild(content);
  document.body.appendChild(overlay);
}

// Pop a random image with warning text overlay
function showRedirectWarning(onClose) {
  spawningPaused = true;

  const existingWarning = document.getElementById("redirect-warning");
  if (existingWarning) existingWarning.remove();

  const imageOverlay = document.createElement("div");
  imageOverlay.id = "redirect-warning";
  imageOverlay.style.position = "fixed";
  imageOverlay.style.top = "0";
  imageOverlay.style.left = "0";
  imageOverlay.style.width = "100%";
  imageOverlay.style.height = "100%";
  imageOverlay.style.backgroundColor = "rgba(0, 0, 0, 1)";
  imageOverlay.style.zIndex = "10000";
  imageOverlay.style.pointerEvents = "auto";
  imageOverlay.style.display = "flex";
  imageOverlay.style.alignItems = "center";
  imageOverlay.style.justifyContent = "center";
  imageOverlay.style.flexDirection = "column";

  // Add to DOM immediately so the redirect-warning check works right away
  document.body.appendChild(imageOverlay);

  setTimeout(() => {
    if (!document.getElementById("redirect-warning")) return;

    const closeOverlay = () => {
      imageOverlay.remove();
      spawningPaused = false;
      if (onClose) onClose();
    };

    // Grab a random already-loaded image from the spawned ones
    const spawnedImages = Array.from(document.querySelectorAll('.spawned-image'));
    const randomImg = spawnedImages.length > 0
      ? spawnedImages[Math.floor(Math.random() * spawnedImages.length)]
      : null;

    if (randomImg) {
      const img = document.createElement("img");
      img.src = randomImg.src;
      img.style.maxWidth = "600px";
      img.style.maxHeight = "600px";
      img.style.width = "auto";
      img.style.height = "auto";
      img.style.objectFit = "contain";
      img.style.borderRadius = "8px";
      img.style.cursor = "pointer";
      img.style.boxShadow = "0 8px 32px rgba(0,0,0,0.5)";
      img.style.marginBottom = "30px";
      img.onclick = closeOverlay;
      imageOverlay.appendChild(img);
    }

    const warningText = document.createElement("p");
    warningText.textContent = "Leaving now will cancel your order and you'll lose your payment. Are you sure?";
    warningText.style.color = "#ff1493";
    warningText.style.fontSize = "18px";
    warningText.style.maxWidth = "500px";
    warningText.style.textAlign = "center";
    warningText.style.lineHeight = "1.6";
    warningText.style.fontWeight = "600";
    warningText.style.marginTop = "20px";
    warningText.style.marginBottom = "20px";
    warningText.style.position = "relative";
    warningText.style.zIndex = "10001";

    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "15px";
    buttonContainer.style.justifyContent = "center";
    buttonContainer.style.position = "relative";
    buttonContainer.style.zIndex = "10002";
    buttonContainer.style.marginTop = "20px";

    const stayBtn = document.createElement("button");
    stayBtn.textContent = "Stay & Continue";
    stayBtn.style.padding = "12px 24px";
    stayBtn.style.background = "#ff1493";
    stayBtn.style.color = "#fff";
    stayBtn.style.border = "none";
    stayBtn.style.borderRadius = "6px";
    stayBtn.style.cursor = "pointer";
    stayBtn.style.fontWeight = "600";
    stayBtn.style.fontSize = "16px";
    stayBtn.style.transition = "all 0.3s";
    stayBtn.style.position = "relative";
    stayBtn.style.zIndex = "10002";

    stayBtn.onmouseover = () => {
      stayBtn.style.background = "#ff69b4";
      stayBtn.style.transform = "scale(1.05)";
    };
    stayBtn.onmouseout = () => {
      stayBtn.style.background = "#ff1493";
      stayBtn.style.transform = "scale(1)";
    };
    stayBtn.onclick = closeOverlay;

    const leaveBtn = document.createElement("button");
    leaveBtn.textContent = "Leave Anyway";
    leaveBtn.style.padding = "12px 24px";
    leaveBtn.style.background = "rgba(255, 255, 255, 0.2)";
    leaveBtn.style.color = "#fff";
    leaveBtn.style.border = "2px solid #fff";
    leaveBtn.style.borderRadius = "6px";
    leaveBtn.style.cursor = "pointer";
    leaveBtn.style.fontWeight = "600";
    leaveBtn.style.fontSize = "16px";
    leaveBtn.style.transition = "all 0.3s";
    leaveBtn.style.position = "relative";
    leaveBtn.style.zIndex = "10002";

    leaveBtn.onmouseover = () => {
      leaveBtn.style.background = "rgba(255, 255, 255, 0.3)";
      leaveBtn.style.transform = "scale(1.05)";
    };
    leaveBtn.onmouseout = () => {
      leaveBtn.style.background = "rgba(255, 255, 255, 0.2)";
      leaveBtn.style.transform = "scale(1)";
    };
    leaveBtn.onclick = closeOverlay;

    buttonContainer.appendChild(stayBtn);
    buttonContainer.appendChild(leaveBtn);

    imageOverlay.appendChild(warningText);
    imageOverlay.appendChild(buttonContainer);
  }, 1000);
}

function allowUnload() {
  if (unloadHandler) {
    window.removeEventListener('beforeunload', unloadHandler);
  }
}

// Activate lockdown
function activateLockdown() {
  if (lockdownActive) return;
  lockdownActive = true;

  createLockdownOverlay();

  const blockShortcuts = (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'q' || e.key === 'Q' || e.key === 'r' || e.key === 'R' || e.key === 'w' || e.key === 'W')) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (e.key === "Escape" || e.keyCode === 27) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const blockUnload = (e) => {
    e.preventDefault();
    e.returnValue = '';
    return false;
  };
  unloadHandler = blockUnload;

  const blockRightClick = (e) => {
    e.preventDefault();
    return false;
  };

  history.pushState(null, null, window.location.href);
  const blockBack = () => {
    history.pushState(null, null, window.location.href);
  };

  const supportsKeyboardLock =
      ('keyboard' in navigator) && ('lock' in navigator.keyboard);

  document.addEventListener('keydown', blockShortcuts, true);
  window.addEventListener('beforeunload', blockUnload);
  document.addEventListener('contextmenu', blockRightClick, true);
  window.addEventListener('popstate', blockBack);
  if (supportsKeyboardLock) {
    document.addEventListener('fullscreenchange', async () => {
      if (document.fullscreenElement) {
        await navigator.keyboard.lock(['Escape']);
        return;
      }
      navigator.keyboard.unlock();
    });
  }
  const requestFullscreen = (e) => {
    if (!e.isTrusted) return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };
  document.addEventListener('click', requestFullscreen);
  document.addEventListener('contextmenu', requestFullscreen);
}

// Deactivate lockdown
function deactivateLockdown() {
  const overlay = document.getElementById("lockdown-overlay");
  if (overlay) overlay.remove();
  lockdownActive = false;
}

// Reactivate lockdown (overlay only as event listeners are still attached)
function reactivateLockdown() {
  if (lockdownActive) return;
  lockdownActive = true;
  createLockdownOverlay();
}

// Store current tab ID
function storeTabId() {
  chrome.runtime.sendMessage({ action: 'getTabId' }).catch(() => {});
}

// Image position calculation
function calculateImagePosition() {
  const IMG_WIDTH = 400;
  const IMG_HEIGHT = 400;
  const SAFE_ZONE_HEIGHT = 450;
  const SAFE_ZONE_WIDTH = 800;

  const safeZoneLeftBound = window.innerWidth / 2 - SAFE_ZONE_WIDTH / 2;
  const safeZoneRightBound = window.innerWidth / 2 + SAFE_ZONE_WIDTH / 2;
  const safeZoneTopStart = window.innerHeight / 2 - SAFE_ZONE_HEIGHT / 2;
  const safeZoneBottomEnd = window.innerHeight / 2 + SAFE_ZONE_HEIGHT / 2;

  let left, top;
  let validPosition = false;

  for (let attempts = 0; attempts < 30; attempts++) {
    left = Math.random() * Math.max(0, window.innerWidth - IMG_WIDTH);
    top = Math.random() * Math.max(0, window.innerHeight - IMG_HEIGHT);

    const noHorizontalOverlap = (left + IMG_WIDTH) < safeZoneLeftBound || left > safeZoneRightBound;
    const noVerticalOverlap = (top + IMG_HEIGHT) < safeZoneTopStart || top > safeZoneBottomEnd;

    if (noHorizontalOverlap || noVerticalOverlap) {
      validPosition = true;
      break;
    }
  }

  if (!validPosition) {
    const corners = [
      { x: 0, y: 0 },
      { x: window.innerWidth - IMG_WIDTH, y: 0 },
      { x: 0, y: window.innerHeight - IMG_HEIGHT },
      { x: window.innerWidth - IMG_WIDTH, y: window.innerHeight - IMG_HEIGHT }
    ];
    const randomCorner = corners[Math.floor(Math.random() * corners.length)];
    left = randomCorner.x;
    top = randomCorner.y;
  }

  return { left, top };
}

// Spawn images
async function spawnImage() {
  if (spawningPaused) return;

  try {
    const res = await fetch(`${MEDIA_SERVICE}/api/random-image`);
    const data = await res.json();
    if (spawningPaused) return;

    const img = document.createElement("img");
    const fullUrl = data.url.startsWith('http') ? data.url : MEDIA_SERVICE + data.url;
    img.src = fullUrl;
    img.className = "spawned-image";
    img.style.position = "fixed";
    img.style.pointerEvents = "none";
    img.style.zIndex = "10000";
    img.style.maxWidth = "400px";
    img.style.maxHeight = "400px";
    img.style.width = "auto";
    img.style.height = "auto";
    img.style.objectFit = "contain";
    img.style.borderRadius = "8px";
    img.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";

    const pos = calculateImagePosition();
    img.style.left = pos.left + "px";
    img.style.top = pos.top + "px";

    const existing = document.querySelectorAll('.spawned-image');
    if (existing.length >= 50) {
      const victim = existing[Math.floor(Math.random() * existing.length)];
      victim.remove();
    }

    document.body.appendChild(img);
  } catch (e) {
    console.error("Image fetch error:", e);
  }
}

// Spawn videos
async function spawnVideo() {
  if (spawningPaused) return;

  try {
    const res = await fetch(`${MEDIA_SERVICE}/api/random-video`);
    const data = await res.json();
    if (spawningPaused) return;

    const video = document.createElement("video");
    const fullUrl = data.url.startsWith('http') ? data.url : MEDIA_SERVICE + data.url;
    video.src = fullUrl;
    video.className = "spawned-video";
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.addEventListener('ended', () => {
      video.src = '';
      video.load();
      video.remove();
    });
    video.style.position = "fixed";
    video.style.pointerEvents = "none";
    video.style.zIndex = "10001";
    video.style.maxWidth = "400px";
    video.style.maxHeight = "400px";
    video.style.width = "auto";
    video.style.height = "auto";
    video.style.objectFit = "contain";
    video.style.borderRadius = "8px";
    video.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";

    // Find a position that doesn't overlap existing videos
    const VIDEO_WIDTH = 400;
    const VIDEO_HEIGHT = 400;
    let pos;
    let overlapping = true;

    for (let attempt = 0; attempt < 20; attempt++) {
      pos = calculateImagePosition();
      overlapping = false;

      const existing = document.querySelectorAll('.spawned-video');
      for (const v of existing) {
        const rect = v.getBoundingClientRect();
        if (
          pos.left < rect.left + rect.width &&
          pos.left + VIDEO_WIDTH > rect.left &&
          pos.top < rect.top + rect.height &&
          pos.top + VIDEO_HEIGHT > rect.top
        ) {
          overlapping = true;
          break;
        }
      }

      if (!overlapping) break;
    }

    video.style.left = pos.left + "px";
    video.style.top = pos.top + "px";

    const existingVideos = document.querySelectorAll('.spawned-video');
    if (existingVideos.length >= 6) {
      const victim = existingVideos[Math.floor(Math.random() * existingVideos.length)];
      victim.pause();
      victim.src = '';
      victim.load();
      victim.remove();
    }

    document.body.appendChild(video);
  } catch (e) {
    console.error("Video fetch error:", e);
  }
}

// Floating text prompts
const edgePrompts = [
  "don't cum ~ 💕",
  "just one more send… 💞",
  "ur doing such a good job ~ 🤭",
  "ur such a good boy 💕",
  "keep going ~ 💞",
  "don't stop 🤭",
  "good boy 💕",
  "deeper and deeper ~ 💞",
  "stroke for me ~ 🤭",
  "just give in 💕",
  "faster ~ 💞",
  "edge for me ~ 🤭",
  "don't u dare stop ~ 💕",
  "ur mine now 💞",
  "keep pumping ~ 🤭",
  "sooo close ~ 💕",
  "that's it good boy 💞",
  "u can't stop now ~ 🤭",
  "one more… 💕",
  "send again ~ 💞"
];

function spawnText(customPrompts) {
  if (spawningPaused) return;

  const pool = customPrompts || edgePrompts;
  const text = document.createElement("div");
  const prompt = pool[Math.floor(Math.random() * pool.length)];
  text.textContent = prompt;
  text.className = "spawned-text";
  text.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 10001;
    color: #ff1493;
    font-size: ${40 + Math.random() * 30}px;
    font-weight: 700;
    text-shadow: 0 0 10px rgba(255,20,147,0.6), 0 2px 4px rgba(0,0,0,0.8);
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.5s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

  const pos = calculateImagePosition();
  text.style.left = pos.left + "px";
  text.style.top = pos.top + "px";

  document.body.appendChild(text);

  const rect = text.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    text.style.left = Math.max(0, window.innerWidth - rect.width) + "px";
  }
  if (rect.bottom > window.innerHeight) {
    text.style.top = Math.max(0, window.innerHeight - rect.height) + "px";
  }

  requestAnimationFrame(() => { text.style.opacity = "1"; });

  const duration = 2000 + Math.random() * 2000;
  setTimeout(() => {
    text.style.opacity = "0";
    setTimeout(() => text.remove(), 500);
  }, duration);
}

// Reposition all existing spawned images for current window size
function repositionSpawnedImages() {
  document.querySelectorAll('.spawned-image').forEach(img => {
    const pos = calculateImagePosition();
    img.style.left = pos.left + "px";
    img.style.top = pos.top + "px";
  });
}

// Create a divider row with text between lines
function createDivider(text, isDark) {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.gap = "12px";
  row.style.marginBottom = "16px";

  const lineStyle = `flex:1;height:1px;background:${isDark ? '#4a5568' : '#ddd'};`;

  const lineBefore = document.createElement("div");
  lineBefore.style.cssText = lineStyle;

  const label = document.createElement("span");
  label.textContent = text;
  label.style.fontSize = "12px";
  label.style.fontWeight = "600";
  label.style.color = isDark ? "#a0aec0" : "#999";

  const lineAfter = document.createElement("div");
  lineAfter.style.cssText = lineStyle;

  row.appendChild(lineBefore);
  row.appendChild(label);
  row.appendChild(lineAfter);
  return row;
}

// Create a checkbox row with label and tooltip for the modal
function createCheckboxRow(labelText, tooltipText, isDark) {
  const row = document.createElement("label");
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.justifyContent = "center";
  row.style.gap = "8px";
  row.style.marginBottom = "20px";
  row.style.fontSize = "14px";
  row.style.cursor = "pointer";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.style.width = "16px";
  checkbox.style.height = "16px";
  checkbox.style.accentColor = "#ff69b4";
  checkbox.style.cursor = "pointer";

  const label = document.createElement("span");
  label.style.color = isDark ? "#e2e8f0" : "#000";
  label.appendChild(document.createTextNode(labelText));
  if (tooltipText) {
    label.appendChild(createTooltip(tooltipText, isDark));
  }

  row.appendChild(checkbox);
  row.appendChild(label);

  return { row, checkbox };
}

// Create a (?) tooltip element
function createTooltip(text, isDark) {
  const icon = document.createElement("span");
  icon.textContent = " (?)";
  icon.style.cssText = `position:relative;cursor:help;font-size:12px;color:${isDark ? '#a0aec0' : '#999'};`;

  const tip = document.createElement("div");
  tip.textContent = text;
  tip.style.cssText = `position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);background:${isDark ? '#2d3748' : '#f5f5f5'};color:${isDark ? '#fff' : '#333'};padding:6px 10px;border-radius:6px;font-size:11px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity 0.2s;z-index:10002;${isDark ? '' : 'border:1px solid #ddd;'}box-shadow:0 2px 8px rgba(0,0,0,0.1);`;

  icon.appendChild(tip);
  icon.addEventListener("mouseenter", () => { tip.style.opacity = "1"; });
  icon.addEventListener("mouseleave", () => { tip.style.opacity = "0"; });
  return icon;
}

// Show choice modal
function showChoiceModal(options, onConfirm, onCancel, defaultValue) {
  const existingModal = document.getElementById("extension-choice-modal");
  if (existingModal) existingModal.remove();

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";

  const modal = document.createElement("div");
  modal.id = "extension-choice-modal";
  modal.style.position = "fixed";
  modal.style.left = "0";
  modal.style.top = "0";
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.background = "rgba(0, 0, 0, 0.5)";
  modal.style.zIndex = "10001";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.pointerEvents = "auto";

  const content = document.createElement("div");
  content.style.background = isDark ? "#1a202c" : "#fff";
  content.style.color = isDark ? "#e2e8f0" : "#000";
  content.style.padding = "40px";
  content.style.borderRadius = "12px";
  content.style.minWidth = "280px";
  content.style.maxWidth = "90%";
  content.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.3)";
  content.style.fontFamily = "sans-serif";
  content.style.userSelect = "none";

  const title = document.createElement("div");
  title.textContent = "Choose an item to add to cart";
  title.style.fontWeight = "600";
  title.style.marginBottom = "20px";
  title.style.fontSize = "16px";
  title.style.textAlign = "center";

  const select = document.createElement("select");
  const arrowColor = isDark ? '%23e2e8f0' : '%23333';
  select.style.width = "100%";
  select.style.marginBottom = "20px";
  select.style.padding = "10px 36px 10px 12px";
  select.style.borderRadius = "6px";
  select.style.border = isDark ? "1px solid #4a5568" : "1px solid #ddd";
  select.style.fontSize = "14px";
  select.style.background = `${isDark ? '#2d3748' : '#fff'} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='${arrowColor}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E") no-repeat right 12px center`;
  select.style.color = isDark ? "#e2e8f0" : "#000";
  select.style.appearance = "none";
  select.style.webkitAppearance = "none";
  select.style.cursor = "pointer";

  options.forEach(opt => {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    select.appendChild(o);
  });

  if (defaultValue) {
    select.value = defaultValue;
  }

  const dividerRow = createDivider("OR", isDark);

  const { row: randomRow, checkbox: randomCheckbox } = createCheckboxRow(
    "Random Gifts", "gifts re-picked each loop ~", isDark
  );

  randomCheckbox.addEventListener("change", () => {
    select.disabled = randomCheckbox.checked;
    select.style.opacity = randomCheckbox.checked ? "0.5" : "1";
    select.style.cursor = randomCheckbox.checked ? "not-allowed" : "pointer";
  });

  const { row: extremeRow, checkbox: extremeCheckbox } = createCheckboxRow(
    "Extreme Mode", "lock in cutie, u need this! ~", isDark
  );

  const buttons = document.createElement("div");
  buttons.style.display = "flex";
  buttons.style.justifyContent = "center";
  buttons.style.gap = "8px";

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.padding = "8px 16px";
  cancelBtn.style.background = isDark ? "#2d3748" : "#f0f0f0";
  cancelBtn.style.color = isDark ? "#e2e8f0" : "#000";
  cancelBtn.style.border = "none";
  cancelBtn.style.borderRadius = "4px";
  cancelBtn.style.cursor = "pointer";
  cancelBtn.onclick = () => {
    modal.remove();
    onCancel && onCancel();
  };

  const confirmBtn = document.createElement("button");
  confirmBtn.textContent = "Start Drain";
  confirmBtn.style.padding = "8px 16px";
  confirmBtn.style.background = isDark ? "#d37c62" : "#f09f88";
  confirmBtn.style.color = "white";
  confirmBtn.style.border = "none";
  confirmBtn.style.borderRadius = "4px";
  confirmBtn.style.cursor = "pointer";
  confirmBtn.style.fontWeight = "600";
  confirmBtn.onclick = () => {
    let value;
    if (randomCheckbox.checked) {
      randomModeActive = true;
      chrome.storage.session.set({ OMSD_RANDOM_MODE: true });
      value = deckDraw(options.map(o => o.value));
    } else {
      randomModeActive = false;
      chrome.storage.session.set({ OMSD_RANDOM_MODE: false });
      value = select.value;
    }
    if (extremeCheckbox.checked) {
      chrome.storage.session.set({ OMSD_EXTREME_MODE: true });
    }
    chrome.runtime.sendMessage({ action: 'startAudio' }).catch(() => {});
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    modal.remove();
    onConfirm && onConfirm(value);
  };

  buttons.appendChild(cancelBtn);
  buttons.appendChild(confirmBtn);

  const modesDivider = createDivider("MODES", isDark);

  content.appendChild(title);
  content.appendChild(select);
  content.appendChild(dividerRow);
  content.appendChild(randomRow);
  content.appendChild(modesDivider);
  content.appendChild(extremeRow);
  content.appendChild(buttons);
  modal.appendChild(content);
  document.body.appendChild(modal);
  select.focus();
}

// Check element readiness
function isElementReady(el) {
  if (!el || !document.contains(el)) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (el.offsetParent === null) return false;
  return true;
}

// Get items from page
function buildItemsFromPage() {
  const items = [];
  const emojis = {};
  const prices = {};

  // Each gift card is now explicitly marked with data-slot="card"
  const cards = document.querySelectorAll('[data-slot="card"]');

  for (const card of cards) {
    // Product name
    const nameEl = card.querySelector(
      '[data-slot="product-card-info"] span[data-slot="tooltip-trigger"]'
    );

    const heading = nameEl?.textContent.trim() || "";
    if (!heading) continue;

    // Emoji
    const emojiEl = card.querySelector(
      '[data-slot="product-card-image"] [role="img"] span'
    );

    const emoji = emojiEl?.textContent.trim() || "";

    // Price
    const priceEl = card.querySelector(
      '[data-slot="product-card-price-row"] span[data-slot="tooltip-trigger"]'
    );

    const price = priceEl?.textContent.trim() || "";

    // Avoid duplicates
    if (!items.includes(heading)) {
      items.push(heading);
      emojis[heading] = emoji;
      prices[heading] = price;
    }
  }

  ALLOWED_ITEMS = items;
  ITEM_EMOJIS = emojis;
  ITEM_PRICES = prices;

  // Persist for pages where the DOM doesn't have the gift cards
  if (items.length > 0) {
    chrome.storage.session.set({
      OMSD_ALLOWED_ITEMS: items,
      OMSD_ITEM_PRICES: prices
    });
  }

  return items.map(name => ({
    heading: name,
    emoji: emojis[name] || "",
  }));
}

// Initialize selection
function initSelectionThenStart() {
  // Clear any existing cart items at start
  document.querySelectorAll("button").forEach(btn => {
    if (btn.textContent.trim() === "Remove") btn.click();
  });

  // Stop scrollbar flashes, hide live support
  document.documentElement.style.overflow = 'hidden';
  document.head.insertAdjacentHTML("beforeend","<style>.intercom-lightweight-app{display:none!important}</style>");

  chrome.storage.session.get(['reopenedTab'], (result) => {
    reopenedTab = result.reopenedTab;

    if (sessionStorage.getItem(SESSION_PROMPT_KEY) === "1" || reopenedTab) {
      sessionStorage.setItem(SESSION_PROMPT_KEY, "1");
      startMainLoop();
      if (reopenedTab) {
        const restartPrompts = [
          "aww had enough? not until i say ~ 💕",
          "u wanted extreme, lock in ~ 🤭",
          "pump and give in cutie ~ 💞",
          "just a little more before you go ~ 🤭"
        ];

        spawnText(restartPrompts);
        reopenedTab = null;
        chrome.storage.session.set({ reopenedTab: false });
      }
      return;
    }

    // Show loading modal while waiting for gifts to load
    const loadingModal = document.createElement("div");
    loadingModal.id = "extension-loading-modal";
    loadingModal.style.cssText = "position:fixed;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;pointer-events:auto;";
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const loadingContent = document.createElement("div");
    loadingContent.style.cssText = `background:${isDark ? '#1a202c' : '#fff'};color:${isDark ? '#e2e8f0' : '#000'};padding:40px;border-radius:12px;font-family:sans-serif;font-size:16px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.3);user-select:none;`;
    loadingContent.textContent = "Loading";
    loadingModal.appendChild(loadingContent);
    document.body.appendChild(loadingModal);

    let dotCount = 0;
    let loadingPhase = "Loading";
    const dotInterval = setInterval(() => {
      if (dotCount < 3) dotCount++;
      loadingContent.textContent = loadingPhase + ".".repeat(dotCount);
    }, 250);

    setTimeout(() => {
      loadingPhase = "Checking Gifts";
      dotCount = 0;
    }, 1000);

    setTimeout(() => {
      clearInterval(dotInterval);
      const attemptSelection = () => {
        // Remove loading modal once we're ready to show selection
        const lm = document.getElementById("extension-loading-modal");
        if (lm) lm.remove();

        const found = buildItemsFromPage();
        const options = found.map(f => {
          const price = ITEM_PRICES[f.heading] || '';
          const label = price ? `${f.emoji} — ${f.heading} - ${price}` : `${f.emoji} — ${f.heading}`;
          return {
            value: f.heading,
            label: label,
            heading: f.heading
          };
        });

        if (options.length > 0) {
          if (awaitingSelection) return;
          awaitingSelection = true;

          const saved = localStorage.getItem(STORAGE_KEY);
          const defaultValue = saved && options.some(o => o.value === saved) ? saved : null;

          showChoiceModal(options, (choice) => {
            awaitingSelection = false;
            sessionStorage.setItem(SESSION_PROMPT_KEY, "1");

            const matched = options.find(o => o.value === choice);
            if (matched) {
              selectedItem = matched.heading;
              selectedItemPrice = Math.round(parseFloat((ITEM_PRICES[selectedItem] || '').replace(/[^0-9.]/g, ''))) || 0;
              localStorage.setItem(STORAGE_KEY, selectedItem);
              localStorage.setItem(STORAGE_PRICE_KEY, selectedItemPrice);
              startMainLoop();
            } else {
              setTimeout(attemptSelection, 2000);
            }
          }, () => {
            awaitingSelection = false;
            setTimeout(attemptSelection, 2000);
          }, defaultValue);
        } else {
          setTimeout(attemptSelection, 2000);
        }
      };

      attemptSelection();
    }, 2000);
  });
}

// Click add to cart
function clickAddToCart() {
  setTimeout(() => {
    if (!selectedItem) return;

    const cards = document.querySelectorAll('[data-slot="card"]');

    for (const card of cards) {
      // Product name
      const nameEl = card.querySelector(
        '[data-slot="product-card-info"] span[data-slot="tooltip-trigger"]'
      );

      const name = nameEl?.textContent.trim() || "";

      if (name !== selectedItem) continue;

      // Find the enabled Add to cart button
      const btn = [...card.querySelectorAll('button[type="button"]')].find(
        b =>
          b.textContent.trim().toLowerCase() === "add to cart" &&
          !b.disabled
      );

      if (btn) {
        btn.click();
        return;
      }
    }
  }, 1500);
}

// Click checkout
function clickCheckout() {
  setTimeout(() => {
    const buttons = document.querySelectorAll("button");
    for (const btn of buttons) {
      const text = (btn.textContent || "").trim().toLowerCase();
      if (text.includes("checkout")) {
        btn.click();
        return;
      }
    }
  }, 2000);
}

// Find a toggle by its label
function findToggleByLabel(labelText) {
  const needle = labelText.trim().toLowerCase();
  for (const sw of document.querySelectorAll('.chakra-switch')) {
    const sibling = sw.previousElementSibling;
    if (sibling && sibling.textContent.trim().toLowerCase().includes(needle)) {
      return sw.querySelector('input[type="checkbox"]');
    }
  }
  return null;
}

// Set multiple toggles, returns true if all are already in the desired state
function setToggles(configs) {
  let toggled = true;
  for (const { label, on } of configs) {
    const input = findToggleByLabel(label);
    if (!input) continue;
    if (input.disabled) { toggled = false; continue; }
    if (input.checked !== on) {
      input.click();
      toggled = false;
    }
  }
  return toggled;
}

function selectCreditCard() {
  let option = null;
  const svg = document.querySelector("svg.lucide-credit-card");
  if (svg) option = svg.closest("button[role='radio']");

  // If can't find SVG, look for "Credit Card" text
  if (!option) {
    const radios = document.querySelectorAll("button[role='radio']");
    for (const radio of radios) {
      if (radio.textContent.toLowerCase().trim().includes("credit card")) { option = radio; break; }
    }
  }

  // Payment methods haven't loaded yet, we'll return false and try again next loop
  if (!option) return false;

  // If already selected, return true
  if (option.getAttribute("aria-checked") === "true") return true;

  // Otherwise click it & verify selected
  option.click();
  return option.getAttribute("aria-checked") === "true";
}

// Click pay now
function clickPayNow() {
  if (isPaying) return;
  isPaying = true;

  const checkPayEnabled = setInterval(() => {
    const btn = [...document.querySelectorAll("button")].find(
      btn =>
        btn.textContent.trim().toLowerCase() === "pay now" &&
        !btn.disabled
    );

    if (btn) {
      clearInterval(checkPayEnabled);
      btn.click();
    }
  }, 500);
}

// Detect route
function detectCurrentRoute() {
  const url = window.location.href;
  const params = new URLSearchParams(window.location.search);

  if (params.has('showCheckoutCompleteModal') && params.get('showCheckoutCompleteModal') === 'true') {
    return 'success';
  }

  if (url.includes('checkout')) {
    return 'checkout';
  } else if (url.includes(THRONE_USER) || url.includes('/cart')) {
    return 'cart';
  }

  return 'unknown';
}

// Track send and show hardcore messages
function trackSend() {
  if (checkoutCounted) return;
  checkoutCounted = true;

  const prevDrained = totalDrained;
  totalDrained += selectedItemPrice;
  sendCount++;

  if (sendCount === 1) {
    showSendMsg("u started this ~ 💕\nno quitting until i say so 🤭");
  }
  if (sendCount > 1 && sendCount % 3 === 0) {
    const fakeLastOnes = [
      "okay this is the last one ~ 💕\ni promise 🤭",
      "one more and then ur done ~ 💞\ni mean it this time 🤭",
      "just this one more ~ 💕\nthen u can stop >.< 🤭",
      "after this one u can go ~ 💞\nprobably 🤭",
      "almost done boyfie ~ 💕\njust keep going a little longer 🤭"
    ];
    showSendMsg(fakeLastOnes[Math.floor(Math.random() * fakeLastOnes.length)]);
  }
  if (sendCount === 5) showSendMsg("5 sends already ~ 💕\nur such an obedient little boy 🤭");
  if (sendCount === 7) showSendMsg("see?? 💕\nthis is so much better\nthan saving ur money 🤭");
  if (sendCount === 10) showSendMsg("double digits 💞\ni knew u couldn't stop 🤭");
  if (sendCount === 15) showSendMsg("u don't need that money 💞\nu need ME 🤭");
  if (sendCount === 20) showSendMsg("20 sends 💕\nur literally addicted to me\nand i love it >.< 🤭");
  if (prevDrained < 40 && totalDrained >= 40 && sendCount > 1) showSendMsg("$40 already?? 💕\nur doing so good ~ keep going 🤭");
  if (prevDrained < 80 && totalDrained >= 80 && sendCount > 1) showSendMsg("$80 ~ 💞\ndon't stop now ur in too deep 🤭");
  if (prevDrained < 160 && totalDrained >= 160 && sendCount > 1) showSendMsg("$160 gone 💕\nand ur still here ~ that's so hot 🤭");
  if (prevDrained < 320 && totalDrained >= 320 && sendCount > 1) showSendMsg("$320 ~ 💞\nur officially my favourite 🤭💕");
  if (totalDrained >= 500 && Math.floor(totalDrained / 100) > Math.floor(prevDrained / 100) && sendCount > 1) {
    const milestone = Math.floor(totalDrained / 100) * 100;
    showSendMsg("$" + milestone + " 💕\nu literally can't stop can u 🤭");
  }
}

function showDeclineOverlay() {
  const declineMessages = [
    "aww ur card declined ~ 💕\nbe a good boy and add more funds\nthen come right back to me 🤭",
    "don't stop now ~ 💞\nur card needs more money on it\ngo top it up and keep draining for me 💕",
    "ur almost out ~ 🤭\nadd more to ur card boyfie\ni know u want to keep going 💞",
    "card declined?? 💕\nthat just means u've been such a good boy ~\nnow reload it and come back to me 🤭",
    "noo don't let it end here ~ 💞\ngo add more funds rn\ni'll be waiting for u 💕"
  ];
  const msg = declineMessages[Math.floor(Math.random() * declineMessages.length)];

  const declineOverlay = document.createElement('div');
  declineOverlay.id = 'decline-overlay';
  declineOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,1);z-index:999999;display:flex;align-items:center;justify-content:center;flex-direction:column;cursor:pointer;';
  declineOverlay.innerHTML = `
    <div style="color:#ff1493;font-size:36px;font-weight:700;text-align:center;line-height:1.6;white-space:pre-line;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-shadow:0 0 20px rgba(255,20,147,0.5);padding:20px;">${msg}<br><br>click to continue...</div>
  `;
  declineOverlay.addEventListener('click', () => {
    localStorage.setItem('autodrain_reloading', 'true');
    allowUnload();
    window.location.reload();
  });
  document.body.appendChild(declineOverlay);
}

// Check for card decline / payment error
function checkForDecline() {
  const pageText = document.body.innerText.toLowerCase();
  const isDeclined = pageText.includes('declined') || pageText.includes('insufficient funds') || pageText.includes('try a different card');

  if (isDeclined && !document.getElementById('decline-overlay')) {
    showDeclineOverlay();
  }
}

// Main loop
function mainLoop() {
  if (checkUrlGuard()) {
    return;
  }

  const currentRoute = detectCurrentRoute();

  if (currentRoute !== lastDetectedRoute) {
    if (currentRoute !== 'checkout') {
      isPaying = false;
    }
    routeChangeCount++;
    lastDetectedRoute = currentRoute;
    reactivateLockdown();
    if (currentRoute !== 'success') {
      _randomPicked = false;
      chrome.storage.session.set({ OMSD_RANDOM_PICKED: false });
    }
  }

  if (currentRoute === 'success') {
    isPaying = false;
    if (spawningPaused && !document.getElementById('redirect-warning')) {
      spawningPaused = false;
      const style = document.getElementById('hide-spawned-images');
      if (style) style.textContent = '';
    }

    checkoutCounted = false;

    if (randomModeActive && ALLOWED_ITEMS.length > 0 && !_randomPicked) {
      _randomPicked = true;
      chrome.storage.session.set({ OMSD_RANDOM_PICKED: true });
      selectedItem = deckDraw(ALLOWED_ITEMS);
      selectedItemPrice = Math.round(parseFloat((ITEM_PRICES[selectedItem] || '').replace(/[^0-9.]/g, ''))) || 0;
      localStorage.setItem(STORAGE_KEY, selectedItem);
      localStorage.setItem(STORAGE_PRICE_KEY, selectedItemPrice);
    } else if (!randomModeActive) {
      selectedItem = localStorage.getItem(STORAGE_KEY) || null;
    }

    const closeBtn = document.querySelector('button[aria-label="Close"]');
    if (closeBtn) {
      closeBtn.click();
    }
  }

  // If reloading after decline, show black screen immediately so they see nothing
  if (localStorage.getItem('autodrain_reloading') === 'true') {
    localStorage.removeItem('autodrain_reloading');
    if (!document.getElementById('decline-overlay')) {
      const reloadOverlay = document.createElement('div');
      reloadOverlay.id = 'decline-overlay';
      reloadOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,1);z-index:999999;display:flex;align-items:center;justify-content:center;flex-direction:column;cursor:pointer;';
      reloadOverlay.innerHTML = '<div style="color:#ff1493;font-size:36px;font-weight:700;text-align:center;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,sans-serif;text-shadow:0 0 20px rgba(255,20,147,0.5);padding:20px;">restarting ~ 💕\nbe patient for me 🤭<span id="click-to-continue"><br><br>click to continue...</span></div>';
      document.body.appendChild(reloadOverlay);
      reloadOverlay.addEventListener('click', () => {
        const ctc = document.getElementById('click-to-continue');
        if (ctc) ctc.remove();
      });
      setTimeout(() => {
        if (document.getElementById('decline-overlay')) {
          document.getElementById('decline-overlay').remove();
        }
      }, 5000);
    }
  }

  if (currentRoute === 'checkout') {
    checkForDecline();
    if (!selectCreditCard()) { setTimeout(mainLoop, 500); return; }
    clickPayNow();
    trackSend();
  } else if (currentRoute === 'cart') {
    clickAddToCart();
    clickCheckout();
  }

  if (!stallTimerActive) {
    stallTimerActive = true;
    const countBefore = routeChangeCount;

    setTimeout(() => {
      if (routeChangeCount === countBefore && lastDetectedRoute !== 'success') {
        spawningPaused = true;
        deactivateLockdown();
        let style = document.getElementById('hide-spawned-images');
        if (!style) {
          style = document.createElement('style');
          style.id = 'hide-spawned-images';
          document.head.appendChild(style);
        }
        style.textContent = '.spawned-image, .spawned-video { display: none !important; }';
      }
      stallTimerActive = false;
    }, 15000);
  }

  setTimeout(mainLoop, 3000);
}

// Start main loop
function startMainLoop() {
  storeTabId();
  activateLockdown();
  mainLoop();

  for (let i = 0; i < 15; i++) {
    spawnImage();
  }

  setInterval(spawnImage, 250);
  setInterval(spawnVideo, 1500);
  setInterval(spawnText, 2500);

  // Reposition images on resize so they don't overlap the safe zone
  window.addEventListener('resize', repositionSpawnedImages);
}

// URL guard
function checkUrlGuard() {
  const path = window.location.pathname.toLowerCase();
  const allowedPaths = [`/${THRONE_USER}`, '/login', '/landing', '/signup', '/checkout'];
  const isAllowed = allowedPaths.some(p => path.includes(p));

  if (!isAllowed) {
    const throneUrl = `https://throne.com/${THRONE_USER}`;
    allowUnload();
    showNoEscapeWarning(throneUrl);
    return true;
  }
  return false;
}

// Begin
const guardBlocked = checkUrlGuard();
if (!guardBlocked) {
  function waitForSessionThenStart() {
    if (_sessionReady) {
      initSelectionThenStart();
    } else {
      setTimeout(waitForSessionThenStart, 10);
    }
  }
  waitForSessionThenStart();
}