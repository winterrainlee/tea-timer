// Shared v1 storage boundary. Keep raw user data separate from runtime defaults.
const TeaPreferences = (() => {
  "use strict";
  const tags = typeof TeaTags !== "undefined"
    ? TeaTags
    : (typeof require === "function" ? require("./tags.js") : null);
  const KEY = "teaTimer.preferences.v1";
  const TEA_IDS = Object.freeze(["green", "white", "oolong", "nong", "black", "sheng", "shou"]);
  const VESSEL_IDS = Object.freeze(["teapot", "eastern-pot", "gaiwan", "mug", "piaoyibei"]);
  const ALIASES = Object.freeze({ nong: "dark-oolong", sheng: "sheng-puer", shou: "shou-puer" });
  // Derive the Korean fallback from the shared registry; retain a standalone fallback for script loading.
  const DEFAULT_TAGS = Object.freeze(tags
    ? tags.DEFAULT_IDS.map(id => Object.fromEntries(tags.BUILTIN_ITEMS)[id] || id)
    : ["식물향", "꽃향", "달콤한 향", "과일향", "구운 향", "감칠맛", "단맛", "짠맛", "신맛", "쓴맛", "깔끔함", "텁텁함", "떫음", "묵직함", "여운"]);
  const LOCALES = Object.freeze(["ko", "zh-TW"]);
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const isDelta = value => Number.isInteger(value) && Math.abs(value) <= 115;
  const isTags = value => Array.isArray(value) && value.every(tag => typeof tag === "string");
  function localeChanged(oldValue, newValue) {
    const storedLocale = text => {
      try {
        const raw = JSON.parse(text);
        return isObject(raw) && raw.version === 1 && LOCALES.includes(raw.locale) ? raw.locale : "ko";
      } catch { return "ko"; }
    };
    return storedLocale(oldValue) !== storedLocale(newValue);
  }
  function canonicalTea(id) {
    if (TEA_IDS.includes(id)) return id;
    return Object.keys(ALIASES).find(key => ALIASES[key] === id) || "oolong";
  }
  function storedLocale(raw) {
    return LOCALES.includes(raw.locale) ? raw.locale : "ko";
  }
  function runtimeValues(raw, defaultLocale) {
    const source = isObject(raw.secDeltaByTea) ? raw.secDeltaByTea : {};
    const secDeltaByTea = {};
    TEA_IDS.forEach(id => {
      const value = isDelta(source[id]) ? source[id] : (own(ALIASES, id) ? source[ALIASES[id]] : undefined);
      if (isDelta(value)) secDeltaByTea[id] = value;
    });
    const hasTagItems = own(raw, "tagItems");
    const validTagItems = hasTagItems && tags && tags.isValidItems(raw.tagItems);
    const tagItems = validTagItems ? tags.resolve(raw.tagItems)
      : isTags(raw.customTags) ? raw.customTags.map(text => ({ kind: "custom", text }))
      : tags ? tags.defaults(LOCALES.includes(defaultLocale) ? defaultLocale : storedLocale(raw)) : [];
    return {
      lastTeaId: canonicalTea(raw.lastTeaId),
      lastVesselId: VESSEL_IDS.includes(raw.lastVesselId) ? raw.lastVesselId : "gaiwan",
      muted: typeof raw.muted === "boolean" ? raw.muted : false,
      secDeltaByTea,
      customTags: isTags(raw.customTags) ? [...raw.customTags] : [...DEFAULT_TAGS],
      locale: storedLocale(raw),
      tagItems,
      tagItemsProtected: hasTagItems && !validTagItems,
    };
  }
  function createStore(getStorage = () => localStorage) {
    function readRaw() {
      let text;
      try { text = getStorage().getItem(KEY); }
      catch { return { raw: {}, writable: false, reason: "storage" }; }
      if (text === null) return { raw: { version: 1 }, writable: true, reason: null };
      try {
        const raw = JSON.parse(text);
        if (isObject(raw) && raw.version === 1) return { raw, writable: true, reason: null };
      } catch { /* Malformed or future payloads are never implicitly reset. */ }
      return { raw: {}, writable: false, reason: "protected" };
    }
    function read(defaultLocale) {
      const { raw, writable, reason } = readRaw();
      return { values: runtimeValues(raw, defaultLocale), writable, reason };
    }
    function validPatch(changes) {
      if (!isObject(changes)) return false;
      return Object.entries(changes).every(([key, value]) => {
        if (key === "lastTeaId") return TEA_IDS.includes(value);
        if (key === "lastVesselId") return VESSEL_IDS.includes(value);
        if (key === "muted") return typeof value === "boolean";
        if (key === "customTags") return isTags(value);
        if (key === "locale") return LOCALES.includes(value);
        if (key === "tagItems") return tags && tags.isValidItems(value);
        if (key === "secDeltaByTea") return isObject(value) && Object.entries(value).every(
          ([id, delta]) => TEA_IDS.includes(id) && (delta === null || isDelta(delta))
        );
        return false;
      });
    }
    function patch(changes) {
      if (!validPatch(changes)) return { ok: false, reason: "invalid" };
      // Read at the moment of the edit, never save a page-load snapshot.
      const { raw, writable, reason } = readRaw();
      if (!writable) return { ok: false, reason };
      if ((own(changes, "tagItems") || own(changes, "customTags"))
        && own(raw, "tagItems") && (!tags || !tags.isValidItems(raw.tagItems))) {
        return { ok: false, reason: "protected" };
      }
      const next = { ...raw };
      if (isObject(raw.secDeltaByTea)) {
        next.secDeltaByTea = { ...raw.secDeltaByTea };
        Object.entries(ALIASES).forEach(([id, alias]) => {
          if (!own(next.secDeltaByTea, id) && isDelta(next.secDeltaByTea[alias])) {
            next.secDeltaByTea[id] = next.secDeltaByTea[alias];
          }
        });
      }
      Object.entries(changes).forEach(([key, value]) => {
        if (key === "tagItems") { next[key] = tags.resolve(value); return; }
        if (key !== "secDeltaByTea") { next[key] = value; return; }
        if (!isObject(next.secDeltaByTea)) next.secDeltaByTea = {};
        Object.entries(value).forEach(([id, delta]) => {
          if (delta === null) {
            delete next.secDeltaByTea[id];
            if (ALIASES[id]) delete next.secDeltaByTea[ALIASES[id]];
          } else next.secDeltaByTea[id] = delta;
        });
      });
      try { getStorage().setItem(KEY, JSON.stringify(next)); return { ok: true, reason: null }; }
      catch { return { ok: false, reason: "storage" }; }
    }
    function restoreTags(items) {
      if (items !== undefined && (!tags || !tags.isValidItems(items))) return { ok: false, reason: "invalid" };
      const { raw, writable, reason } = readRaw();
      if (!writable) return { ok: false, reason };
      if (items === undefined) items = tags ? tags.defaults(storedLocale(raw)) : [];
      if (!tags || !tags.isValidItems(items)) return { ok: false, reason: "invalid" };
      const next = { ...raw, tagItems: tags.resolve(items) };
      try { getStorage().setItem(KEY, JSON.stringify(next)); return { ok: true, reason: null }; }
      catch { return { ok: false, reason: "storage" }; }
    }
    function addTag(item, defaultLocale) {
      // Input shaping (trimming, marker removal, and length limits) belongs to the UI.
      // This boundary only accepts a nonempty custom string and stores it verbatim.
      if (!isObject(item) || item.kind !== "custom" || typeof item.text !== "string" || item.text.length === 0) {
        return { ok: false, reason: "invalid" };
      }
      const { raw, writable, reason } = readRaw();
      if (!writable) return { ok: false, reason };
      // A present but invalid canonical list may be a newer schema. Do not replace it
      // with the legacy fallback merely to append a tag.
      if (own(raw, "tagItems") && (!tags || !tags.isValidItems(raw.tagItems))) {
        return { ok: false, reason: "protected" };
      }
      if (!tags) return { ok: false, reason: "protected" };
      const storedItems = own(raw, "tagItems")
        ? raw.tagItems
        : isTags(raw.customTags)
          ? raw.customTags.map(text => ({ kind: "custom", text }))
          : tags.defaults(LOCALES.includes(defaultLocale) ? defaultLocale : storedLocale(raw));
      const items = tags.resolve(storedItems);
      const identity = tags.key(item);
      if (items.some(existing => tags.key(existing) === identity)) {
        return { ok: true, reason: null, added: false, items };
      }
      // Preserve forward-compatible metadata on existing raw items. `items` above is
      // still the normalized projection the caller uses at runtime.
      const nextStoredItems = [...storedItems, tags.normalize(item)];
      const nextItems = tags.resolve(nextStoredItems);
      const next = { ...raw, tagItems: nextStoredItems };
      try {
        getStorage().setItem(KEY, JSON.stringify(next));
        return { ok: true, reason: null, added: true, items: nextItems };
      } catch { return { ok: false, reason: "storage" }; }
    }
    function reset() {
      try { getStorage().removeItem(KEY); return { ok: true, reason: null }; }
      catch { return { ok: false, reason: "storage" }; }
    }
    return { read, patch, restoreTags, addTag, reset };
  }
  return Object.freeze({ KEY, TEA_IDS, VESSEL_IDS, DEFAULT_TAGS, LOCALES, localeChanged, createStore });
})();

if (typeof module !== "undefined" && module.exports) module.exports = TeaPreferences;
