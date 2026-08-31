// Small shared translation boundary; locale updates never reload the document.
const TeaI18n = (() => {
  "use strict";
  const catalogs = Object.create(null);
  const listeners = new Set();
  const supported = Object.freeze(["ko", "zh-TW"]);
  const fontFamily = '"Gowun Batang", "Noto Serif TC", "Songti TC", "PMingLiU", "AppleMyungjo", serif';
  let locale = typeof TeaPreferences !== "undefined" ? TeaPreferences.createStore().read().values.locale || "ko" : "ko";
  const normalize = value => supported.includes(value) ? value : "ko";
  locale = normalize(locale);
  function register(language, entries) {
    if (!supported.includes(language)) throw new Error("Unsupported catalog locale");
    const catalog = catalogs[language] || (catalogs[language] = Object.create(null));
    for (const [key, value] of Object.entries(entries)) {
      if (typeof value !== "string") throw new Error(`Invalid translation: ${key}`);
      if (Object.hasOwn(catalog, key) && catalog[key] !== value) throw new Error(`Duplicate translation: ${key}`);
      catalog[key] = value;
    }
  }
  function translate(language, key, vars = {}) {
    const value = catalogs[normalize(language)]?.[key] ?? catalogs.ko?.[key] ?? key;
    return value.replace(/\{([A-Za-z0-9_]+)\}/g, (placeholder, name) => Object.hasOwn(vars, name) ? String(vars[name]) : placeholder);
  }
  const t = (key, vars) => translate(locale, key, vars);
  function apply(root = document) {
    const attributes = ["aria-label", "aria-description", "title", "placeholder"];
    const selector = ["[data-i18n]", ...attributes.map(attr => `[data-i18n-${attr}]`)].join(",");
    const elements = [...root.querySelectorAll(selector)];
    if (root.matches?.(selector)) elements.unshift(root);
    for (const el of elements) {
      if (el.dataset.i18n) el.textContent = t(el.dataset.i18n);
      for (const attr of attributes) {
        const key = el.getAttribute(`data-i18n-${attr}`);
        if (key) el.setAttribute(attr, t(key));
      }
    }
    if (root === document) document.documentElement.lang = locale;
  }
  function setLocale(value) {
    const next = normalize(value);
    if (next === locale) return false;
    locale = next;
    if (typeof document !== "undefined") document.documentElement.lang = locale;
    listeners.forEach(listener => listener(locale));
    return true;
  }
  function onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  async function prepareFonts(sample = "차 한 잔 阿里山 烏龍茶") {
    if (typeof document === "undefined" || !document.fonts) return false;
    let timer;
    try {
      return await Promise.race([
        Promise.all([document.fonts.load(`22px ${fontFamily}`, sample), document.fonts.load('16px "Space Mono"')]).then(() => true).catch(() => false),
        new Promise(resolve => { timer = setTimeout(() => resolve(false), 1200); }),
      ]);
    } finally { clearTimeout(timer); }
  }
  return Object.freeze({ t, translate, register, apply, getLocale: () => locale, setLocale, onChange, normalize, supported, fontFamily, prepareFonts });
})();
if (typeof module !== "undefined" && module.exports) module.exports = TeaI18n;
