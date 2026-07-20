console.log("Popup loaded");

let generatedPlaylistUrl = "";
let popupState = "generate";

const toggle = document.getElementById("show-youtube-btn");

document.addEventListener("DOMContentLoaded", async () => {
  const { showYoutubeButton = true } =
    await chrome.storage.sync.get("showYoutubeButton");

  toggle.checked = showYoutubeButton;
});

toggle.addEventListener("change", async () => {
  console.log("Toggle changed:", toggle.checked);

  await chrome.storage.sync.set({
    showYoutubeButton: toggle.checked,
  });

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  console.log("Sending toggle message");

  chrome.tabs.sendMessage(tab.id, {
    type: "TOGGLE_BUTTON",
    enabled: toggle.checked,
  });
});

const convertBtn = document.getElementById("convert-btn");

convertBtn.addEventListener("click", async () => {
  // Copy State
  if (popupState === "copy") {
    console.log("Copy button clicked");
    console.log("URL:", generatedPlaylistUrl);

    try {
      await navigator.clipboard.writeText(generatedPlaylistUrl);

      console.log("Copied successfully");

      popupState = "copied";

      convertBtn.disabled = true;

      convertBtn.className = "button-success";
      convertBtn.innerHTML = `
            <img src="../icons/tick-circle.svg">
            Link Copied
        `;

      setTimeout(() => {
        popupState = "generate";
        generatedPlaylistUrl = "";

        convertBtn.disabled = false;

        convertBtn.className = "action-btn btn-generate";
        convertBtn.innerHTML = `
        <img src="../icons/play.svg">
        Convert Playlist
    `;
      }, 1500);
    } catch (err) {
      console.error("Clipboard error:", err);
    }

    return;

    return;
  }

  if (popupState !== "generate") return;

  popupState = "loading";

  convertBtn.disabled = true;

  convertBtn.className = "btn-loading";
  convertBtn.innerHTML = `
    <img src="../icons/loader-circle.svg" class="spin">
    Generating...
`;

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  chrome.tabs.sendMessage(
    tab.id,
    {
      type: "GENERATE_PLAYLIST",
    },
    (response) => {
      if (!response?.success) {
        popupState = "generate";

        convertBtn.disabled = false;

        convertBtn.className = "action-btn btn-generate";
        convertBtn.innerHTML = `
                    <img src="../icons/play.svg">
                    Convert Playlist
                `;

        return;
      }

      generatedPlaylistUrl = response.url;

      popupState = "copy";

      convertBtn.disabled = false;

      convertBtn.className = "btn-copy";
      convertBtn.innerHTML = `
                <img src="../icons/tick-circle.svg">
                Copy Playlist URL
            `;
    },
  );
});

document
  .getElementById("close-popup")
  .addEventListener("click", () => window.close());
