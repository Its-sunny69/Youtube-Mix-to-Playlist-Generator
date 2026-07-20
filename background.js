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