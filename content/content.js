console.log("Content Script loaded", Math.random());

let generatedPlaylistUrl = "";
let isGenerating = false;

function checkMix() {
  const url = new URL(location.href);
  const listId = url.searchParams.get("list");

  const isMix = listId && (listId.startsWith("RD") || listId.startsWith("RDO"));

  chrome.storage.sync.get(
    { showYoutubeButton: true },
    ({ showYoutubeButton }) => {
      if (isMix && showYoutubeButton) {
        injectButton();
      } else {
        removeButton();
      }
    },
  );
}

checkMix();

document.addEventListener("yt-navigate-finish", checkMix);

function injectButton() {
  if (document.getElementById("yt-mix-generator-btn")) return;

  const header = document.querySelector("#header-top-row");

  if (!header) {
    setTimeout(injectButton, 300);
    return;
  }

  const button = document.createElement("button");
  button.id = "yt-mix-generator-btn";
  button.textContent = "Convert to Playlist";

  button.addEventListener("click", () => {
    console.log("Page button clicked");
    handleConvert();
  });

  header.appendChild(button);
}

function removeButton() {
  document.getElementById("yt-mix-generator-btn")?.remove();
}

async function handleConvert() {
  console.log("handleConvert() called");

  if (isGenerating) return;

  isGenerating = true;

  setButtonLoading(true);

  try {
    generatedPlaylistUrl = await generatePlaylist();

    showCopyPopup();
  } catch (err) {
    console.error(err);
  } finally {
    isGenerating = false;
    setButtonLoading(false);
  }
}

function showCopyPopup() {
  document.getElementById("yt-copy-popup")?.remove();

  const popup = document.createElement("div");

  popup.id = "yt-copy-popup";

  popup.innerHTML = `
      <div class="yt-popup-title">
          Playlist Generated
      </div>

      <button id="yt-copy-btn">
          Copy Playlist URL
      </button>
  `;

  document.body.appendChild(popup);

  document.getElementById("yt-copy-btn").onclick = async (e) => {
    const button = e.target;

    try {
      await navigator.clipboard.writeText(generatedPlaylistUrl);

      button.textContent = "✓ Link Copied";
      button.disabled = true;
      button.classList.add("copied");

      setTimeout(() => {
        document.getElementById("yt-copy-popup")?.remove();
      }, 1200);
    } catch {
      button.textContent = "Copy Failed";
    }
  };
}

function copyPlaylist() {
  navigator.clipboard.writeText(generatedPlaylistUrl);

  alert("Copied!");

  document.getElementById("yt-mix-popup")?.remove();
}

function getVideoIds() {
  const links = document.querySelectorAll(
    "ytd-playlist-panel-video-renderer a#wc-endpoint",
  );

  const ids = [];

  links.forEach((link) => {
    const href = link.getAttribute("href");

    if (!href) return;

    const url = new URL(href, location.origin);
    const videoId = url.searchParams.get("v");

    if (videoId && !ids.includes(videoId)) {
      ids.push(videoId);
    }
  });

  return ids;
}

function generatePlaylist() {
  const videoIds = getVideoIds();

  const playlistUrl = `https://www.youtube.com/watch_videos?video_ids=${videoIds.join(",")}`;

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "CONVERT_MIX",
        url: playlistUrl,
      },
      (response) => {
        if (!response?.success) {
          reject("Failed to generate playlist");
          return;
        }

        resolve(response.url);
      },
    );
  });
}

function setButtonLoading(loading) {
  const btn = document.getElementById("yt-mix-generator-btn");

  if (!btn) return;

  btn.disabled = loading;

  btn.innerHTML = loading
    ? `<span class="yt-spinner"></span> Generating...`
    : `Convert to Playlist`;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received:", message);

  if (message.type === "GENERATE_PLAYLIST") {
    console.log("Popup requested conversion");

    generatePlaylist()
      .then((url) => {
        sendResponse({
          success: true,
          url,
        });
      })
      .catch(() => {
        sendResponse({
          success: false,
        });
      });

    return true;
  }

  if (message.type === "TOGGLE_BUTTON") {
    console.log("Toggle message:", message.enabled);

    checkMix();
  }
});
