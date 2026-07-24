console.log("Background Started");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "CONVERT_MIX") return;

  (async () => {
    try {
      const response = await fetch(message.url, {
        redirect: "follow",
      });

      sendResponse({
        success: true,
        url: response.url,
      });
    } catch (err) {
      sendResponse({
        success: false,
        error: err.message,
      });
    }
  })();

  return true;
});

const HISTORY_KEY = "playlist_history";
const MAX_HISTORY = 5;

async function saveHistory(item) {
  const { [HISTORY_KEY]: history = [] } =
    await chrome.storage.local.get(HISTORY_KEY);

  history.unshift(item);

  await chrome.storage.local.set({
    [HISTORY_KEY]: history.slice(0, MAX_HISTORY),
  });
}

async function getHistory() {
  const { [HISTORY_KEY]: history = [] } =
    await chrome.storage.local.get(HISTORY_KEY);

  return history;
}

async function clearHistory() {
  await chrome.storage.local.set({
    [HISTORY_KEY]: [],
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case "SAVE_HISTORY":
        await saveHistory(message.data);
        sendResponse({ success: true });
        break;

      case "GET_HISTORY":
        sendResponse({
          success: true,
          history: await getHistory(),
        });
        break;

      case "CLEAR_HISTORY":
        await clearHistory();
        sendResponse({ success: true });
        break;
    }
  })();

  return true;
});
