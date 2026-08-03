let generatedPlaylistUrl = "";
let isGenerating = false;
let currentLanguage = "en";

(async () => {
  const response = await chrome.runtime.sendMessage({
    type: "GET_LANGUAGE",
  });

  currentLanguage = response.language;

  await loadLanguage(currentLanguage);

  checkMix();
})();

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "sync" || !changes.popupLanguage) return;

  currentLanguage = changes.popupLanguage.newValue;

  await loadLanguage(currentLanguage);

  removeButton();
  injectButton();

  document.getElementById("yt-copy-popup")?.remove();
});

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
  button.textContent = t("convertPlaylist");

  button.addEventListener("click", () => {
    handleConvert();
  });

  header.appendChild(button);
}

function removeButton() {
  document.getElementById("yt-mix-generator-btn")?.remove();
}

async function handleConvert() {
  if (isGenerating) return;

  isGenerating = true;

  setButtonLoading(true);

  try {
    const result = await generatePlaylist();

    generatedPlaylistUrl = result.url;

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

async function showCopyPopup(data) {
  document.getElementById("yt-copy-popup")?.remove();

  const popup = document.createElement("div");

  popup.id = "yt-copy-popup";

  const { popupTheme = "system" } = await chrome.storage.sync.get("popupTheme");

  applyTheme(popup, popupTheme);

  popup.innerHTML = `
    <div class="copy-popup-header">

      <div class="copy-popup-title">
        ${t("playlistGenerated")}
      </div>

      <button class="copy-popup-close" title="Close">
        ✕
      </button>

    </div>

    <div class="copy-popup-card">

      <div class="card-details">
        <div class="copy-popup-row">
          <span class="card-details-label">
            <span data-icon="music"></span>

            ${t("songs")}
          </span>

          <span>${data.totalSongs}</span>
        </div>

        <div class="copy-popup-row">
          <span class="card-details-label">
            <span data-icon="clock"></span>

            ${t("playbackTime")}
          </span>

          <span>${data.playbackTime}</span>
        </div>
      </div>

      <div class="card-btn">
        <button class="view-playlist-btn">
          <span data-icon="playFilled"></span>

          ${t("viewPlaylist")}
        </button>

        <button id="ytm-qr-btn" class="show-qr-btn">
          <span data-icon="qrCode"></span>

          ${t("showQRCode")}
        </button>
      </div>

    </div>

    <button class="copy-popup-btn">
      <img src=${chrome.runtime.getURL("/icons/copy.svg")} class="card-btn-icon"/>
      
      ${t("copyPlaylist")}
    </button>

    <div id="ytm-qr-modal" class="qr-modal hidden">
      <div class="qr-content">
        <div class="qr-close">
          <button id="ytm-close-qr" class="copy-popup-close" title="Close QR">
            ✕
          </button>
        </div>

        <div class="qr-code-container">
          <div id="ytm-qr-container" class="qr-code"></div>

          <p>${t("scanToOpenPlaylist")}</p>
        </div>

        <button id="ytm-download-qr" class="download-qr-btn">
          <img src=${chrome.runtime.getURL("/icons/download.svg")} class="card-btn-icon"/>

          ${t("downloadQR")}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  renderIcons(popup);

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

      button.innerHTML = `
        <img src=${chrome.runtime.getURL("/icons/tick-circle.svg")} class="card-btn-icon"/>
        ${t("linkCopied")}
        `;
      button.disabled = true;
      button.classList.add("copied");

      setTimeout(() => {
        popup.remove();
      }, 1200);
    } catch {
      button.textContent = t("Copy Failed");
    }
  };
}

function applyTheme(element, theme) {
  element.classList.remove("light-theme");

  let actualTheme = theme;

  if (theme === "system") {
    actualTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  if (actualTheme === "light") {
    element.classList.add("light-theme");
  }
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
    ? `<span class="yt-spinner"></span> ${t("generating")}`
    : `${t("convertPlaylist")}`;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GENERATE_PLAYLIST") {
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
    checkMix();
  }
});

function renderIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    const icon = Icons[el.dataset.icon];

    if (icon) {
      el.innerHTML = icon;
    }
  });
}
