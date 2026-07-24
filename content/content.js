console.log("Content Script loaded", Math.random());

let generatedPlaylistUrl = "";
let isGenerating = false;

function checkMix() {
  const url = new URL(location.href);
  const listId = url.searchParams.get("list");

  const isMix = listId && (listId.startsWith("RD") || listId.startsWith("RDO"));

  chrome.storage.sync.get(
    { showYoutubeButton: true, autoCopyPlaylist: false },
    ({ showYoutubeButton, autoCopyPlaylist }) => {
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
    const result = await generatePlaylist();

    generatedPlaylistUrl = result.url;

    console.log(result);

    await chrome.runtime.sendMessage({
      type: "SAVE_HISTORY",
      data: {
        title: result.title || `${result.totalSongs} Songs Playlist`,
        url: result.url,
        totalSongs: result.totalSongs,
        playbackTime: result.playbackTime,
        createdAt: Date.now(),
      },
    });

    showCopyPopup(result);
  } catch (err) {
    console.error(err);
  } finally {
    isGenerating = false;
    setButtonLoading(false);
  }
}

function showCopyPopup(data) {
  document.getElementById("yt-copy-popup")?.remove();

  const popup = document.createElement("div");

  popup.id = "yt-copy-popup";

  popup.innerHTML = `
    <div class="copy-popup-header">

      <div class="copy-popup-success">
        ✓ Playlist Generated
      </div>

      <button class="copy-popup-close" title="Close">
        ✕
      </button>

    </div>

    <div class="copy-popup-card">

      <div class="copy-popup-row">
        <span>🎵 Songs</span>
        <span>${data.totalSongs}</span>
      </div>

      <div class="copy-popup-row">
        <span>⏱ Playback</span>
        <span>${data.playbackTime}</span>
      </div>

      <button class="view-playlist-btn">
        ▶ View Playlist
      </button>

    </div>

    <button class="copy-popup-btn">
      Copy Playlist URL
    </button>

    <button class="secondary-btn" id="ytm-qr-btn">
      <img src="${chrome.runtime.getURL("icons/qr-code.svg")}" />
      Show QR Code
    </button>

    <div id="ytm-qr-modal" class="qr-modal hidden">
      <div class="qr-content">
        <button id="ytm-close-qr">✕</button>

        <div id="ytm-qr-container"></div>

        <p>Scan to open playlist</p>

        <button id="ytm-download-qr" class="action-btn">
          Download QR
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  const button = popup.querySelector(".copy-popup-btn");

  const viewButton = popup.querySelector(".view-playlist-btn");

  const closeButton = popup.querySelector(".copy-popup-close");

  const qrBtn = popup.querySelector("#ytm-qr-btn");
  const qrModal = popup.querySelector("#ytm-qr-modal");
  const qrContainer = popup.querySelector("#ytm-qr-container");
  const closeQr = popup.querySelector("#ytm-close-qr");
  const downloadQr = popup.querySelector("#ytm-download-qr");

  closeButton.onclick = () => {
    popup.remove();
  };

  viewButton.onclick = () => {
    window.open(data.url, "_blank");
  };

  qrBtn.addEventListener("click", () => {
    qrContainer.innerHTML = "";

    new QRCode(qrContainer, {
      text: data.url,
      width: 220,
      height: 220,
    });

    qrModal.classList.remove("hidden");
  });

  closeQr.addEventListener("click", () => {
    qrModal.classList.add("hidden");
  });

  qrModal.addEventListener("click", (e) => {
    if (e.target === qrModal) {
      qrModal.classList.add("hidden");
    }
  });

  downloadQr.addEventListener("click", () => {
    const canvas = qrContainer.querySelector("canvas");

    if (canvas) {
      const link = document.createElement("a");
      link.download = "playlist-qr.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
      return;
    }

    const img = qrContainer.querySelector("img");

    if (img) {
      const link = document.createElement("a");
      link.download = "playlist-qr.png";
      link.href = img.src;
      link.click();
    }
  });

  button.onclick = async () => {
    try {
      await navigator.clipboard.writeText(data.url);

      button.textContent = "✓ Link Copied";
      button.disabled = true;
      button.classList.add("copied");

      setTimeout(() => {
        popup.remove();
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
  const videos = document.querySelectorAll("ytd-playlist-panel-video-renderer");

  const playlist = [];

  videos.forEach((video) => {
    const link = video.querySelector("a#wc-endpoint");

    if (!link) return;

    const href = link.getAttribute("href");

    if (!href) return;

    const url = new URL(href, location.origin);

    const id = url.searchParams.get("v");

    const duration =
      video.querySelector("#time-status")?.textContent.trim() ??
      video
        .querySelector("span.ytd-thumbnail-overlay-time-status-renderer")
        ?.textContent.trim() ??
      "";

    if (id && !playlist.some((v) => v.id === id)) {
      playlist.push({
        id,
        duration,
      });
    }
  });

  return playlist;
}

function durationToSeconds(duration) {
  if (!duration) return 0;

  const parts = duration.split(":").map(Number);

  if (parts.length === 2) {
    const [m, s] = parts;

    return m * 60 + s;
  }

  if (parts.length === 3) {
    const [h, m, s] = parts;

    return h * 3600 + m * 60 + s;
  }

  return 0;
}

function getPlaylistStats(playlist) {
  const totalSongs = playlist.length;

  const totalSeconds = playlist.reduce(
    (sum, video) => sum + durationToSeconds(video.duration),
    0,
  );

  console.log("Playlist Stats:", { totalSongs, totalSeconds });

  return {
    totalSongs,
    totalSeconds,
  };
}

function formatPlayback(seconds) {
  const h = Math.floor(seconds / 3600);

  const m = Math.floor((seconds % 3600) / 60);

  if (h === 0) {
    return `${m} min`;
  }

  return `${h} hr ${m} min`;
}

function generatePlaylist() {
  const playlist = getVideoIds();

  const stats = getPlaylistStats(playlist);

  console.log("Playlist Stats:", stats);
  console.log("Playback:", formatPlayback(stats.totalSeconds));

  const videoIds = playlist.map((video) => video.id);

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

        resolve({
          url: response.url,
          totalSongs: stats.totalSongs,
          playbackTime: formatPlayback(stats.totalSeconds),
        });
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
      .then((result) => {
        sendResponse({
          success: true,
          ...result,
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
