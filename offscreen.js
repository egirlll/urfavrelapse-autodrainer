let audio = null;

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'playAudio') {
    if (audio) return;
    audio = new Audio(chrome.runtime.getURL('audio/background.mp3'));
    audio.loop = true;
    audio.volume = 0.6;
    audio.play().catch(() => {});
  }
});
