let translations = {};

export async function loadLanguage(lang = "en") {
  try {
    const response = await fetch(
      chrome.runtime.getURL(`./i18n/locales/${lang}.json`),
    );

    translations = await response.json();

    translatePage();
  } catch (err) {
    console.error(err);
  }
}

export function t(key) {
  return translations[key] ?? key;
}

export function translatePage(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;

    if (translations[key]) {
      element.textContent = translations[key];
    }
  });
}
