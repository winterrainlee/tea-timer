// Shared v1 storage boundary. Keep raw user data separate from runtime defaults.
const TeaPreferences = (() => {
  "use strict";
  const KEY = "teaTimer.preferences.v1";
  const TEA_IDS = Object.freeze(["green", "white", "oolong", "nong", "black", "sheng", "shou"]);
  const VESSEL_IDS = Object.freeze(["teapot", "eastern-pot", "gaiwan", "mug", "piaoyibei"]);
  const ALIASES = Object.freeze({ nong: "dark-oolong", sheng: "sheng-puer", shou: "shou-puer" });
  const DEFAULT_TAGS = Object.freeze(["단맛", "꽃향", "과일", "곡물", "구운맛", "견과", "풀", "나무", "흙", "연기", "떫음", "부드러움", "맑음", "묵직함"]);
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const isDelta = value => Number.isInteger(value) && Math.abs(value) <= 115;
  const isTags = value => Array.isArray(value) && value.every(tag => typeof tag === "string");
  function canonicalTea(id) {
    if (TEA_IDS.includes(id)) return id;
    return Object.keys(ALIASES).find(key => ALIASES[key] === id) || "oolong";
  }
  function runtimeValues(raw) {
    const source = isObject(raw.secDeltaByTea) ? raw.secDeltaByTea : {};
    const secDeltaByTea = {};
    TEA_IDS.forEach(id => {
      const value = isDelta(source[id]) ? source[id] : (own(ALIASES, id) ? source[ALIASES[id]] : undefined);
      if (isDelta(value)) secDeltaByTea[id] = value;
    });
    return {
      lastTeaId: canonicalTea(raw.lastTeaId),
      lastVesselId: VESSEL_IDS.includes(raw.lastVesselId) ? raw.lastVesselId : "gaiwan",
      muted: typeof raw.muted === "boolean" ? raw.muted : false,
      secDeltaByTea,
      customTags: isTags(raw.customTags) ? [...raw.customTags] : [...DEFAULT_TAGS],
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
    function read() {
      const { raw, writable, reason } = readRaw();
      return { values: runtimeValues(raw), writable, reason };
    }
    function validPatch(changes) {
      if (!isObject(changes)) return false;
      return Object.entries(changes).every(([key, value]) => {
        if (key === "lastTeaId") return TEA_IDS.includes(value);
        if (key === "lastVesselId") return VESSEL_IDS.includes(value);
        if (key === "muted") return typeof value === "boolean";
        if (key === "customTags") return isTags(value);
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
    function reset() {
      try { getStorage().removeItem(KEY); return { ok: true, reason: null }; }
      catch { return { ok: false, reason: "storage" }; }
    }
    return { read, patch, reset };
  }
  return Object.freeze({ KEY, TEA_IDS, VESSEL_IDS, DEFAULT_TAGS, createStore });
})();

if (typeof module !== "undefined" && module.exports) module.exports = TeaPreferences;
