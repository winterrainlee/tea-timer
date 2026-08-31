const test = require('node:test');
const assert = require('node:assert/strict');

const TeaTags = require('../scripts/tags.js');
const { KEY, LOCALES, createStore, localeChanged } = require('../scripts/preferences.js');

const CN = ['青香', '花香', '甜香', '果香', '焙香', '鲜', '甜', '咸', '酸', '苦', '清爽', '细腻', '粗涩', '浓稠', '余韵感'];
const TW = ['青香', '花香', '甜香', '果香', '焙香', '鮮', '甜', '鹹', '酸', '苦', '清爽', '細膩', '粗澀', '濃稠', '餘韻感'];

function memory(raw = null, fail = false) {
  let value = raw;
  return {
    getItem(key) { assert.equal(key, KEY); return value; },
    setItem(key, next) { assert.equal(key, KEY); if (fail) throw new Error('storage unavailable'); value = String(next); },
    raw: () => value,
  };
}
const labels = items => items.map(item => TeaTags.label(item));

test('zh-CN is a supported third locale with its own fifteen stable builtin identities', () => {
  assert.deepEqual(LOCALES, ['ko', 'zh-TW', 'zh-CN']);
  assert.deepEqual(labels(TeaTags.defaults('zh-CN')), CN);
  assert.deepEqual(TeaTags.defaults('zh-CN').map(item => item.id), [
    'cn.aroma.vegetal', 'cn.aroma.floral', 'cn.aroma.sweet', 'cn.aroma.fruity', 'cn.aroma.roasted',
    'cn.taste.umami', 'cn.taste.sweet', 'cn.taste.salty', 'cn.taste.sour', 'cn.taste.bitter',
    'cn.mouthfeel.fresh', 'cn.mouthfeel.fine', 'cn.mouthfeel.astringent', 'cn.mouthfeel.full', 'cn.mouthfeel.aftertaste',
  ]);
  assert.notDeepEqual(TeaTags.defaults('zh-CN').map(item => item.id), TeaTags.defaults('zh-TW').map(item => item.id));
  assert.deepEqual(labels(TeaTags.defaults('zh-TW')), TW);
  assert.equal(TeaTags.label({ kind: 'builtin', id: 'cn.taste.umami' }), '鲜');
  assert.equal(TeaTags.label({ kind: 'builtin', id: 'tw.taste.umami' }), '鮮');
});

test('a missing list projects zh-CN defaults without writing, and a first append persists those visible defaults', () => {
  const storage = memory(JSON.stringify({ version: 1, locale: 'ko', keep: { raw: '保留' } }));
  const store = createStore(() => storage);
  assert.deepEqual(labels(store.read('zh-CN').values.tagItems), CN);
  assert.equal(JSON.parse(storage.raw()).locale, 'ko');
  assert.equal(store.addTag({ kind: 'custom', text: '自定义原文' }, 'zh-CN').ok, true);
  const saved = JSON.parse(storage.raw());
  assert.equal(saved.locale, 'ko');
  assert.equal(saved.keep.raw, '保留');
  assert.deepEqual(labels(saved.tagItems), [...CN, '自定义原文']);
});

test('existing Korean, Traditional Chinese, unknown, and damaged raw lists survive zh-CN locale writes', () => {
  const cases = [
    { tagItems: TeaTags.defaults('ko') },
    { tagItems: TeaTags.defaults('zh-TW') },
    { customTags: ['한국어 원문', '繁體原文', '简体原文'] },
    { tagItems: { future: ['원문', '原文'] }, customTags: ['legacy 原文'] },
  ];
  for (const entry of cases) {
    const storage = memory(JSON.stringify({ version: 1, locale: 'ko', ...entry, nested: { keep: true } }));
    const before = storage.raw();
    const store = createStore(() => storage);
    assert.equal(store.patch({ locale: 'zh-CN' }).ok, true);
    const saved = JSON.parse(storage.raw());
    assert.equal(saved.locale, 'zh-CN');
    assert.equal(saved.nested.keep, true);
    if ('tagItems' in entry) assert.deepEqual(saved.tagItems, entry.tagItems);
    if ('customTags' in entry) assert.deepEqual(saved.customTags, entry.customTags);
    assert.notEqual(storage.raw(), before);
  }
});

test('explicit restore selects the stored zh-CN locale, while cancellation remains a UI-only decision', () => {
  const storage = memory(JSON.stringify({ version: 1, locale: 'zh-CN', tagItems: TeaTags.defaults('ko') }));
  const store = createStore(() => storage);
  const cancelled = storage.raw();
  // The settings confirmation has not called the store yet: no implicit replacement occurs.
  assert.equal(storage.raw(), cancelled);
  assert.equal(store.restoreTags().ok, true);
  assert.deepEqual(labels(JSON.parse(storage.raw()).tagItems), CN);
});

test('a failed locale write leaves raw storage untouched and subsequent append uses the current zh-CN projection', () => {
  const storage = memory(null, true);
  const store = createStore(() => storage);
  assert.deepEqual(labels(store.read('zh-CN').values.tagItems), CN);
  assert.equal(store.patch({ locale: 'zh-CN' }).reason, 'storage');
  assert.equal(storage.raw(), null);
  assert.equal(store.addTag({ kind: 'custom', text: '不会写入' }, 'zh-CN').reason, 'storage');
  assert.equal(storage.raw(), null);
});

test('locale change detection distinguishes all three locales and ignores malformed raw payloads', () => {
  const raw = locale => JSON.stringify({ version: 1, locale });
  assert.equal(localeChanged(raw('ko'), raw('zh-TW')), true);
  assert.equal(localeChanged(raw('zh-TW'), raw('zh-CN')), true);
  assert.equal(localeChanged(raw('zh-CN'), raw('ko')), true);
  assert.equal(localeChanged(raw('zh-CN'), JSON.stringify({ version: 1, locale: 'future' })), true);
  assert.equal(localeChanged('{broken', null), false);
});
