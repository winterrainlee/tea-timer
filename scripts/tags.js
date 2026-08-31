// Stable tag identities stay separate from translated labels and user text.
const TeaTags = (() => {
  "use strict";

  const BUILTIN_ITEMS = Object.freeze([
    ["taste.sweet", "단맛"], ["aroma.floral", "꽃향"],
    ["taste.fruity", "과일"], ["taste.grain", "곡물"],
    ["taste.roasted", "구운맛"], ["taste.nutty", "견과"],
    ["aroma.grassy", "풀"], ["aroma.woody", "나무"],
    ["taste.earthy", "흙"], ["aroma.smoky", "연기"],
    ["taste.astringent", "떫음"], ["texture.smooth", "부드러움"],
    ["taste.clean", "맑음"], ["body.full", "묵직함"],
    ["aroma.plant", "식물향"], ["aroma.sweet", "달콤한 향"],
    ["aroma.fruity", "과일향"], ["aroma.roasted", "구운 향"],
    ["taste.umami", "감칠맛"], ["taste.salty", "짠맛"],
    ["taste.sour", "신맛"], ["taste.bitter", "쓴맛"],
    ["texture.clean", "깔끔함"], ["texture.coating", "텁텁함"],
    ["finish.lingering", "여운"],
  ]);
  // Keep every historical builtin readable while exposing the confirmed 15-item set by default.
  const BUILTIN_IDS = Object.freeze(BUILTIN_ITEMS.map(([id]) => id));
  const DEFAULT_IDS = Object.freeze([
    "aroma.plant", "aroma.floral", "aroma.sweet", "aroma.fruity", "aroma.roasted",
    "taste.umami", "taste.sweet", "taste.salty", "taste.sour", "taste.bitter",
    "texture.clean", "texture.coating", "taste.astringent", "body.full", "finish.lingering",
  ]);
  const DEFAULT_ITEMS = Object.freeze(DEFAULT_IDS.map(id => Object.freeze({ kind: "builtin", id })));
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

  function isValidItem(item) {
    if (!isObject(item)) return false;
    if (item.kind === "builtin") return typeof item.id === "string" && BUILTIN_IDS.includes(item.id);
    return item.kind === "custom" && typeof item.text === "string";
  }
  function isValidItems(items) {
    return Array.isArray(items) && items.every(isValidItem);
  }
  function normalize(item) {
    return item.kind === "builtin"
      ? { kind: "builtin", id: item.id }
      : { kind: "custom", text: item.text };
  }
  function resolve(items) {
    return isValidItems(items) ? items.map(normalize) : null;
  }
  function defaults() {
    return DEFAULT_ITEMS.map(normalize);
  }
  function key(item) {
    if (!isValidItem(item)) return null;
    return item.kind === "builtin" ? `builtin/${item.id}` : `custom/${item.text}`;
  }
  function label(item, t) {
    if (!isValidItem(item)) return "";
    return item.kind === "builtin" ? t(`tag.${item.id}`) : item.text;
  }
  function dedupe(items) {
    if (!Array.isArray(items)) return [];
    const seen = new Set();
    return items.filter(item => {
      const identity = key(item);
      if (identity === null || seen.has(identity)) return false;
      seen.add(identity);
      return true;
    }).map(normalize);
  }

  return Object.freeze({
    BUILTIN_IDS, DEFAULT_IDS, BUILTIN_ITEMS, DEFAULT_ITEMS, defaults, isValidItem, isValidItems,
    resolve, normalize, key, label, dedupe,
  });
})();

if (typeof module !== "undefined" && module.exports) module.exports = TeaTags;
