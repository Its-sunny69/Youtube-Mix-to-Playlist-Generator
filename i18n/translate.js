let translations = {};

async function loadLanguage(lang = "en") {
  try {
    const response = await fetch(
      chrome.runtime.getURL(`i18n/locales/${lang}.json`),
    );

    translations = await response.json();
  } catch (err) {
    console.error(err);

    if (lang !== "en") {
      return loadLanguage("en");
    }
  }
}

function t(key) {
  return translations[key] ?? key;
}

function translatePage(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;

    if (translations[key]) {
      element.textContent = translations[key];
    }
  });
}
