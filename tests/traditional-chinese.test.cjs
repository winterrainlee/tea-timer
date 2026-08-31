const test = require('node:test');
const assert = require('node:assert/strict');

const TeaTags = require('../scripts/tags.js');
const { KEY, createStore } = require('../scripts/preferences.js');

const TW = ['青香', '花香', '甜香', '果香', '焙香', '鮮', '甜', '鹹', '酸', '苦', '清爽', '細膩', '粗澀', '濃稠', '餘韻感'];
const KO_LEGACY = ['taste.sweet', 'aroma.floral', 'taste.fruity', 'taste.grain', 'taste.roasted', 'taste.nutty', 'aroma.grassy', 'aroma.woody', 'taste.earthy', 'aroma.smoky', 'taste.astringent', 'texture.smooth', 'taste.clean', 'body.full', 'aroma.plant', 'aroma.sweet', 'aroma.fruity', 'aroma.roasted', 'taste.umami', 'taste.salty', 'taste.sour', 'taste.bitter', 'texture.clean', 'texture.coating', 'finish.lingering'];

function memory(raw = null, fail = false) {
  let value = raw;
  return {
    getItem(key) { assert.equal(key, KEY); return value; },
    setItem(key, next) { assert.equal(key, KEY); if (fail) throw new Error('storage unavailable'); value = String(next); },
    removeItem() { value = null; },
    raw: () => value,
  };
}
function values(items) { return items.map(item => TeaTags.label(item)); }

test('virgin zh-TW read provides 15 originals without an automatic tag write', () => {
  const storage = memory();
  const store = createStore(() => storage);
  assert.deepEqual(values(store.read('zh-TW').values.tagItems), TW);
  assert.equal(storage.raw(), null);
});

test('locale changes retain Korean saved builtin and custom originals', () => {
  const ko = TeaTags.defaults('ko');
  const raw = JSON.stringify({ version: 1, locale: 'ko', tagItems: ko, customTags: ['원문'] });
  const storage = memory(raw);
  const store = createStore(() => storage);
  assert.deepEqual(values(store.read('zh-TW').values.tagItems), values(ko));
  assert.equal(store.patch({ locale: 'zh-TW' }).ok, true);
  assert.deepEqual(values(store.read('zh-TW').values.tagItems), values(ko));
  assert.equal(store.patch({ tagItems: ko.filter(item => item.id !== 'taste.sweet') }).ok, true);
  assert.equal(values(store.read('zh-TW').values.tagItems).includes('단맛'), false);
});

test('zh-TW saved list remains visible after returning to Korean', () => {
  const tw = TeaTags.defaults('zh-TW');
  const storage = memory(JSON.stringify({ version: 1, locale: 'zh-TW', tagItems: tw }));
  const store = createStore(() => storage);
  assert.deepEqual(values(store.read('ko').values.tagItems), TW);
  assert.equal(store.patch({ locale: 'ko' }).ok, true);
  assert.deepEqual(values(store.read('ko').values.tagItems), TW);
});

test('first custom add materializes the current UI defaults, not raw saved locale defaults', () => {
  const storage = memory(JSON.stringify({ version: 1, locale: 'ko' }));
  const store = createStore(() => storage);
  const result = store.addTag({ kind: 'custom', text: '自訂詞' }, 'zh-TW');
  assert.equal(result.ok, true);
  assert.deepEqual(values(result.items), [...TW, '自訂詞']);
  const saved = JSON.parse(storage.raw());
  assert.equal(saved.locale, 'ko');
  assert.deepEqual(values(saved.tagItems), [...TW, '自訂詞']);
});

test('saved Korean, explicit empty, and legacy custom arrays are never replaced by zh defaults', () => {
  const cases = [
    { tagItems: TeaTags.defaults('ko'), expected: values(TeaTags.defaults('ko')) },
    { tagItems: [], expected: [] },
    { customTags: ['기존 원문', '既存原文'], expected: ['기존 원문', '既存原文'] },
  ];
  for (const entry of cases) {
    const storage = memory(JSON.stringify({ version: 1, locale: 'ko', ...entry }));
    const store = createStore(() => storage);
    assert.deepEqual(values(store.read('zh-TW').values.tagItems), entry.expected);
    assert.equal(store.patch({ muted: true }).ok, true);
    const saved = JSON.parse(storage.raw());
    if ('tagItems' in entry) assert.deepEqual(saved.tagItems, entry.tagItems);
    if ('customTags' in entry) assert.deepEqual(saved.customTags, entry.customTags);
  }
});

test('restore accepts the visible locale defaults and a storage failure never fabricates a saved list', () => {
  const storage = memory(JSON.stringify({ version: 1, locale: 'ko' }));
  const store = createStore(() => storage);
  assert.equal(store.restoreTags(TeaTags.defaults('zh-TW')).ok, true);
  assert.deepEqual(values(store.read('ko').values.tagItems), TW);

  const failing = memory(null, true);
  const failedStore = createStore(() => failing);
  assert.equal(failedStore.addTag({ kind: 'custom', text: '自訂詞' }, 'zh-TW').reason, 'storage');
  assert.equal(failing.raw(), null);
});

test('all legacy Korean builtin identities remain valid and fixed as Korean originals', () => {
  assert.equal(KO_LEGACY.length, 25);
  for (const id of KO_LEGACY) {
    const item = { kind: 'builtin', id };
    assert.equal(TeaTags.isValidItem(item), true, id);
    assert.match(TeaTags.label(item), /[\uac00-\ud7a3]/, id);
  }
});
