import { loadLanguage, t, translatePage } from "../i18n/index.js";
import { Icons } from "../icons/index.js";

let generatedPlaylistUrl = "";
let popupState = "generate";

const toggle = document.getElementById("show-youtube-btn");
const autoCopyToggle = document.getElementById("auto-copy-toggle");

document.addEventListener("DOMContentLoaded", async () => {
  const {
    showYoutubeButton = true,
    autoCopyPlaylist = false,
    popupTheme = "system",
    popupLanguage = "en",
  } = await chrome.storage.sync.get([
    "showYoutubeButton",
    "autoCopyPlaylist",
    "popupTheme",
    "popupLanguage",
  ]);

  toggle.checked = showYoutubeButton;
  autoCopyToggle.checked = autoCopyPlaylist;

  applyTheme(popupTheme);

  await loadLanguage(popupLanguage);

  updateLanguageSelection(popupLanguage);
});

toggle.addEventListener("change", async () => {
  await chrome.storage.sync.set({
    showYoutubeButton: toggle.checked,
  });

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  chrome.tabs.sendMessage(tab.id, {
    type: "TOGGLE_BUTTON",
    enabled: toggle.checked,
  });
});

autoCopyToggle.addEventListener("change", async () => {
  await chrome.storage.sync.set({
    autoCopyPlaylist: autoCopyToggle.checked,
  });
});

const convertBtn = document.getElementById("convert-btn");

convertBtn.addEventListener("click", async () => {
  if (popupState === "copy") {
    try {
      await navigator.clipboard.writeText(generatedPlaylistUrl);

      popupState = "copied";

      convertBtn.disabled = true;

      convertBtn.className = "btn-success";
      convertBtn.innerHTML = `
            <img src="../icons/tick-circle.svg">
            <span data-i18n="linkCopied">Link Copied</span>
        `;

      translatePage(convertBtn);

      setTimeout(() => {
        popupState = "generate";
        generatedPlaylistUrl = "";

        convertBtn.disabled = false;

        convertBtn.className = "action-btn btn-generate";
        convertBtn.innerHTML = `
        <img src="../icons/play.svg">
        <span data-i18n="convertPlaylist">Convert Playlist</span>
    `;

        translatePage(convertBtn);

        showDescription();
      }, 1500);
    } catch (err) {
      console.error("Clipboard error:", err);
    }

    return;
  }

  if (popupState !== "generate") return;

  popupState = "loading";

  convertBtn.disabled = true;

  convertBtn.className = "btn-loading";
  convertBtn.innerHTML = `
    <img src="../icons/loader-circle.svg" class="spin">
    <span data-i18n="generating">Generating...</span>
`;

  translatePage(convertBtn);

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  chrome.tabs.sendMessage(
    tab.id,
    {
      type: "GENERATE_PLAYLIST",
    },
    async (response) => {
      if (!response?.success) {
        popupState = "generate";

        convertBtn.disabled = false;

        convertBtn.className = "action-btn btn-generate";
        convertBtn.innerHTML = `
                    <img src="../icons/play.svg">
                    <span data-i18n="convertPlaylist">Convert Playlist</span>
                `;

        translatePage(convertBtn);

        return;
      }

      await chrome.runtime.sendMessage({
        type: "SAVE_HISTORY",
        data: {
          title:
            response.title || `${response.totalSongs} ${t("songsPlaylist")}`,
          url: response.url,
          totalSongs: response.totalSongs,
          playbackTime: response.playbackTime,
          createdAt: Date.now(),
        },
      });

      generatedPlaylistUrl = response.url;
      showDetails(response);

      const { autoCopyPlaylist = false } =
        await chrome.storage.sync.get("autoCopyPlaylist");

      if (autoCopyPlaylist) {
        await navigator.clipboard.writeText(response.url);

        popupState = "copied";

        convertBtn.disabled = true;

        convertBtn.className = "btn-success";
        convertBtn.innerHTML = `
        <img src="../icons/tick-circle.svg">
        <span data-i18n="copiedAutomatically">Copied Automatically</span>
    `;

        translatePage(convertBtn);

        setTimeout(() => {
          popupState = "generate";
          generatedPlaylistUrl = "";

          convertBtn.disabled = false;

          convertBtn.className = "action-btn btn-generate";
          convertBtn.innerHTML = `
            <img src="../icons/play.svg">
            <span data-i18n="convertPlaylist">Convert Playlist</span>
        `;

          translatePage(convertBtn);

          showDescription();
        }, 4000);

        return;
      }

      popupState = "copy";

      convertBtn.disabled = false;

      convertBtn.className = "btn-copy";
      convertBtn.innerHTML = `
                <img src="../icons/copy.svg">
                <span data-i18n="copyPlaylist">Copy Playlist URL</span>
            `;

      translatePage(convertBtn);
    },
  );
});

document
  .getElementById("close-popup")
  .addEventListener("click", () => window.close());

const descriptionView = document.getElementById("description-view");
const detailsView = document.getElementById("details-view");

const songsCount = document.getElementById("songs-count");
const playbackTime = document.getElementById("playback-time");

function showDetails(response) {
  songsCount.textContent = response.totalSongs;
  playbackTime.textContent = response.playbackTime;

  descriptionView.classList.remove("active");
  detailsView.classList.add("active");

  const viewButton = document.getElementById("view-playlist-btn");

  viewButton.onclick = () => {
    window.open(generatedPlaylistUrl, "_blank");
  };
}

function showDescription() {
  detailsView.classList.remove("active");
  descriptionView.classList.add("active");
}

const historyView = document.getElementById("history-view");
const historyList = document.getElementById("history-list");
const historyBtn = document.getElementById("history-btn");
const backHistory = document.getElementById("back-history");
const clearHistoryBtn = document.getElementById("clear-history");

historyBtn.addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({
    type: "GET_HISTORY",
  });

  const history = response.history;

  renderHistory(history);
  showView(historyView);
});

backHistory.addEventListener("click", () => {
  showView(mainView);
});

clearHistoryBtn.addEventListener("click", async () => {
  const confirmed = confirm(t("confirmDeleteHistory"));

  if (!confirmed) return;

  await chrome.runtime.sendMessage({
    type: "CLEAR_HISTORY",
  });

  const response = await chrome.runtime.sendMessage({
    type: "GET_HISTORY",
  });

  const history = response.history;

  renderHistory(history);

  showView(historyView);
});

function renderHistory(history) {
  clearHistoryBtn.disabled = history.length === 0;

  if (!history.length) {
    historyList.innerHTML = `
            <div class="history-empty">
                <span data-i18n="noHistory">No playlist history yet.</span>
            </div>
        `;

    translatePage(historyList);
    return;
  }

  historyList.innerHTML = history
    .map(
      (item) => `
        <div class="history-card">
          <div class="history-title">
            ${item.title}
          </div>

          <div class="history-meta">
            ${item.totalSongs} <span data-i18n="songs">Songs</span> • ${item.playbackTime}
          </div>

          <div class="history-timestamp">
            <span class="history-date">
              ${formatDate(item.createdAt)}
            </span>
          </div>

          <div class="history-actions">
            <button class="history-copy" data-url="${item.url}">
              <span data-icon="copyFilled"></span>

              <span class="history-copy-text" data-i18n="copy">Copy</span>
            </button>

            <button class="history-view" data-url="${item.url}">
              <span data-icon="playFilled2"></span>

              <span data-i18n="view">View</span>
            </button>
          </div>
        </div>
    `,
    )
    .join("");

  translatePage(historyList);

  renderIcons(historyList);

  bindHistoryActions();
}

function bindHistoryActions() {
  document.querySelectorAll(".history-copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.url);

        if (btn.dataset.timeoutId) {
          clearTimeout(Number(btn.dataset.timeoutId));
        }

        btn.classList.add("copied");
        btn.querySelector(".history-copy-text").textContent = t("copied");

        const timeoutId = setTimeout(() => {
          btn.classList.remove("copied");
          btn.querySelector(".history-copy-text").textContent = t("copy");
          delete btn.dataset.timeoutId;
        }, 1500);

        btn.dataset.timeoutId = timeoutId;
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    });
  });

  document.querySelectorAll(".history-view").forEach((btn) => {
    btn.onclick = () => {
      window.open(btn.dataset.url, "_blank");
    };
  });
}

function formatDate(timestamp) {
  const date = new Date(timestamp);

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");

  const period = hours >= 12 ? "PM" : "AM";

  hours = hours % 12;
  hours = hours === 0 ? 12 : hours;

  return `${day}/${month}/${year} • ${hours}:${minutes} ${period}`;
}

const mainView = document.getElementById("main-view");
const settingsView = document.getElementById("settings-view");

const settingsBtn = document.getElementById("settings-btn");
const backSettings = document.getElementById("back-settings");

function showView(view) {
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));

  view.classList.add("active");
}

settingsBtn.addEventListener("click", () => {
  showView(settingsView);
});

backSettings.addEventListener("click", () => {
  showView(mainView);
});

const themeBtn = document.getElementById("theme-btn");
const themeOptions = document.getElementById("theme-options");
const themeArrow = document.getElementById("theme-arrow");

themeBtn.addEventListener("click", () => {
  themeOptions.classList.toggle("hidden");
});

function updateThemeSelection(selectedTheme) {
  document.querySelectorAll(".theme-option").forEach((option) => {
    const isSelected = option.dataset.theme === selectedTheme;

    option.querySelector(".theme-check").textContent =
      option.dataset.theme === selectedTheme ? "✓" : "";

    option.classList.toggle("selected", isSelected);
  });
}

document.querySelectorAll(".theme-option").forEach((option) => {
  option.addEventListener("click", async () => {
    const theme = option.dataset.theme;

    await chrome.storage.sync.set({
      popupTheme: theme,
    });

    applyTheme(theme);
  });
});

const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

mediaQuery.addEventListener("change", async () => {
  const { popupTheme } = await chrome.storage.sync.get("popupTheme");

  if (popupTheme === "system") {
    applyTheme("system");
  }
});

function applyTheme(theme) {
  document.body.classList.remove("light-theme");

  let actualTheme = theme;

  if (theme === "system") {
    actualTheme = mediaQuery.matches ? "dark" : "light";
  }

  if (actualTheme === "light") {
    document.body.classList.add("light-theme");
  }

  updateThemeSelection(theme);
}

const languageBtn = document.getElementById("language-btn");
const languageOptions = document.getElementById("language-options");

languageBtn.addEventListener("click", () => {
  languageOptions.classList.toggle("hidden");
});

function updateLanguageSelection(selectedLanguage) {
  document.querySelectorAll(".language-option").forEach((option) => {
    const selected = option.dataset.language === selectedLanguage;

    option.querySelector(".language-check").textContent = selected ? "✓" : "";

    option.classList.toggle("selected", selected);
  });
}

document.querySelectorAll(".language-option").forEach((option) => {
  option.addEventListener("click", async () => {
    const language = option.dataset.language;

    await chrome.storage.sync.set({
      popupLanguage: language,
    });

    await loadLanguage(language);

    updateLanguageSelection(language);
  });
});

const qrBtn = document.getElementById("qr-btn");
const qrModal = document.getElementById("qr-modal");
const closeQr = document.getElementById("close-qr");

const qrCanvas = document.getElementById("qr-canvas");
const downloadQr = document.getElementById("download-qr");
const qrContainer = document.getElementById("qr-container");

qrBtn.addEventListener("click", () => {
  qrContainer.innerHTML = "";

  new QRCode(qrContainer, {
    text: generatedPlaylistUrl,
    width: 220,
    height: 220,
  });

  qrModal.classList.remove("hidden");
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

closeQr.addEventListener("click", () => {
  qrModal.classList.add("hidden");
});

const rateExtension = document.getElementById("rate-extension");
const githubExtension = document.getElementById("github-extension");

rateExtension.addEventListener("click", () => {
  chrome.tabs.create({
    url: "https://www.example.com/",
  });
});

githubExtension.addEventListener("click", () => {
  chrome.tabs.create({
    url: "https://www.example.com/",
  });
});

function renderIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    const iconName = el.dataset.icon;

    if (Icons[iconName]) {
      el.innerHTML = Icons[iconName];
    }
  });
}

renderIcons();
