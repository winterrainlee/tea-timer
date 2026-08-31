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
  ]);
  const BUILTIN_IDS = Object.freeze(BUILTIN_ITEMS.map(([id]) => id));
  const DEFAULT_ITEMS = Object.freeze(BUILTIN_IDS.map(id => Object.freeze({ kind: "builtin", id })));
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
    BUILTIN_IDS, BUILTIN_ITEMS, DEFAULT_ITEMS, defaults, isValidItem, isValidItems,
    resolve, normalize, key, label, dedupe,
  });
})();

if (typeof module !== "undefined" && module.exports) module.exports = TeaTags;
