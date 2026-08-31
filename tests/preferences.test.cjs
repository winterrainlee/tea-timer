const test = require('node:test');
const assert = require('node:assert/strict');

const {
  KEY,
  DEFAULT_TAGS,
  TEA_IDS,
  VESSEL_IDS,
  LOCALES,
  localeChanged,
  createStore,
} = require('../scripts/preferences.js');
const TeaTags = require('../scripts/tags.js');

function storageWith(raw) {
  let value = raw;
  return {
    getItem() { return value; },
    setItem(_key, next) { value = String(next); },
    removeItem() { value = null; },
    raw() { return value; },
  };
}

function storeFor(raw) {
  const storage = storageWith(raw);
  return { storage, store: createStore(() => storage) };
}

function payload(fields = {}) {
  return JSON.stringify({
    version: 1,
    lastTeaId: 'oolong',
    lastVesselId: 'gaiwan',
    muted: false,
    secDeltaByTea: {},
    customTags: [...DEFAULT_TAGS],
    ...fields,
  });
}

function runtime(fields = {}) {
  return {
    lastTeaId: 'oolong', lastVesselId: 'gaiwan', muted: false,
    secDeltaByTea: {}, customTags: DEFAULT_TAGS, locale: 'ko',
    tagItems: TeaTags.defaults(), tagItemsProtected: false,
    ...fields,
  };
}

test('exports stable key, IDs, and the confirmed 15 default tags', () => {
  assert.equal(KEY, 'teaTimer.preferences.v1');
  assert.deepEqual(TEA_IDS, ['green', 'white', 'oolong', 'nong', 'black', 'sheng', 'shou']);
  assert.deepEqual(VESSEL_IDS, ['teapot', 'eastern-pot', 'gaiwan', 'mug', 'piaoyibei']);
  assert.deepEqual(LOCALES, ['ko', 'zh-TW']);
  assert.deepEqual(DEFAULT_TAGS, ['식물향', '꽃향', '달콤한 향', '과일향', '구운 향', '감칠맛', '단맛', '짠맛', '신맛', '쓴맛', '깔끔함', '텁텁함', '떫음', '묵직함', '여운']);
});

test('localeChanged ignores unrelated writes and identifies actual supported-locale transitions', () => {
  const ko = payload({ locale: 'ko', muted: false });
  const koTimeOnly = payload({ locale: 'ko', muted: true, secDeltaByTea: { oolong: -15 } });
  const zh = payload({ locale: 'zh-TW' });
  const noLocale = payload();
  assert.equal(localeChanged(ko, koTimeOnly), false);
  assert.equal(localeChanged(ko, zh), true);
  assert.equal(localeChanged(zh, noLocale), true);
  assert.equal(localeChanged('{malformed', null), false);
});

test('missing storage key reads defaults and does not write until an explicit patch', () => {
  const { storage, store } = storeFor(null);
  const read = store.read();
  assert.deepEqual(read.values, runtime());
  assert.equal(read.writable, true);
  assert.equal(read.reason, null);
  assert.equal(storage.raw(), null);
  assert.equal(store.patch({ muted: true }).ok, true);
  assert.equal(JSON.parse(storage.raw()).muted, true);
});

test('partially damaged known fields fall back while preserving unrelated raw fields', () => {
  const { storage, store } = storeFor(payload({
    lastTeaId: 'not-a-tea', lastVesselId: 'gaiwan', muted: 'yes',
    secDeltaByTea: { oolong: 116, green: -4, extra: 'keep' },
    customTags: ['保留', 9], extraField: { nested: true },
  }));
  assert.deepEqual(store.read().values, runtime({ secDeltaByTea: { green: -4 } }));
  assert.equal(store.patch({ muted: true }).ok, true);
  const saved = JSON.parse(storage.raw());
  assert.equal(saved.extraField.nested, true);
  assert.equal(saved.secDeltaByTea.oolong, 116);
  assert.equal(saved.secDeltaByTea.extra, 'keep');
  assert.deepEqual(saved.customTags, ['保留', 9]);
});

test('tag field missing, empty, and existing arrays remain distinguishable', () => {
  for (const [tags, expected] of [
    [undefined, DEFAULT_TAGS],
    [[], []],
    [['단맛', '單味', '단맛'], ['단맛', '單味', '단맛']],
  ]) {
    const fields = tags === undefined ? {} : { customTags: tags };
    const source = JSON.parse(payload(fields));
    if (tags === undefined) delete source.customTags;
    const { storage, store } = storeFor(JSON.stringify(source));
    assert.deepEqual(store.read().values.customTags, expected);
    assert.equal(store.patch({ muted: true }).ok, true);
    const saved = JSON.parse(storage.raw());
    if (tags === undefined) assert.equal(Object.hasOwn(saved, 'customTags'), false);
    else assert.deepEqual(saved.customTags, tags);
  }
});

test('all supported aliases read canonically and are retained when normalized on write', () => {
  for (const [alias, canonical] of [['dark-oolong', 'nong'], ['sheng-puer', 'sheng'], ['shou-puer', 'shou']]) {
    const { storage, store } = storeFor(payload({ lastTeaId: alias, secDeltaByTea: { [alias]: 4 } }));
    assert.equal(store.read().values.lastTeaId, canonical);
    assert.equal(store.read().values.secDeltaByTea[canonical], 4);
    assert.equal(store.patch({ muted: true }).ok, true);
    const saved = JSON.parse(storage.raw());
    assert.equal(saved.secDeltaByTea[alias], 4);
    assert.equal(saved.secDeltaByTea[canonical], 4);
  }
});

test('canonical delta wins over alias; invalid canonical falls back without unrelated overwrite', () => {
  const { storage, store } = storeFor(payload({ secDeltaByTea: {
    nong: 4, 'dark-oolong': 7, sheng: 'bad', 'sheng-puer': 8,
  } }));
  assert.equal(store.read().values.secDeltaByTea.nong, 4);
  assert.equal(store.read().values.secDeltaByTea.sheng, 8);
  assert.equal(store.patch({ muted: true }).ok, true);
  const saved = JSON.parse(storage.raw());
  assert.equal(saved.secDeltaByTea.nong, 4);
  assert.equal(saved.secDeltaByTea.sheng, 'bad');
  assert.equal(saved.secDeltaByTea['sheng-puer'], 8);
});

test('explicit delta edits accept integer range and null deletes canonical plus aliases', () => {
  const { storage, store } = storeFor(payload({ secDeltaByTea: {
    nong: 4, 'dark-oolong': 7, green: 0, other: 3,
  } }));
  assert.equal(store.patch({ secDeltaByTea: { nong: null } }).ok, true);
  let saved = JSON.parse(storage.raw());
  assert.equal(Object.hasOwn(saved.secDeltaByTea, 'nong'), false);
  assert.equal(Object.hasOwn(saved.secDeltaByTea, 'dark-oolong'), false);
  assert.equal(saved.secDeltaByTea.other, 3);
  assert.equal(store.patch({ secDeltaByTea: { green: 115, white: -115 } }).ok, true);
  assert.equal(store.patch({ secDeltaByTea: { green: 116 } }).reason, 'invalid');
  assert.equal(store.patch({ secDeltaByTea: { white: 1.5 } }).reason, 'invalid');
  saved = JSON.parse(storage.raw());
  assert.equal(saved.secDeltaByTea.green, 115);
  assert.equal(saved.secDeltaByTea.white, -115);
});

test('invalid root payload is protected until explicit reset', () => {
  for (const raw of ['{bad json', '[]', 'null', JSON.stringify({}), JSON.stringify({ version: 99 })]) {
    const { storage, store } = storeFor(raw);
    const read = store.read();
    assert.equal(read.writable, false);
    assert.equal(read.reason, 'protected');
    assert.equal(store.patch({ muted: true }).ok, false);
    assert.equal(store.patch({ muted: true }).reason, 'protected');
    assert.equal(storage.raw(), raw);
    assert.equal(store.reset().ok, true);
    assert.equal(storage.raw(), null);
  }
});

test('sequential stores reread latest raw state before patching', () => {
  const storage = storageWith(payload({ customTags: ['처음'] }));
  const first = createStore(() => storage);
  const second = createStore(() => storage);
  assert.equal(first.patch({ customTags: ['태그'] }).ok, true);
  assert.equal(second.patch({ muted: true }).ok, true);
  const saved = JSON.parse(storage.raw());
  assert.deepEqual(saved.customTags, ['태그']);
  assert.equal(saved.muted, true);
});

test('storage get, set, and remove failures never throw or report success', () => {
  const getFault = { getItem() { throw new Error('get'); }, setItem() {}, removeItem() {} };
  const getStore = createStore(() => getFault);
  assert.doesNotThrow(() => getStore.read());
  assert.equal(getStore.read().reason, 'storage');

  const setFault = { getItem() { return null; }, setItem() { throw new Error('set'); }, removeItem() {} };
  const setStore = createStore(() => setFault);
  assert.doesNotThrow(() => setStore.patch({ muted: true }));
  assert.equal(setStore.patch({ muted: true }).ok, false);
  assert.equal(setStore.patch({ muted: true }).reason, 'storage');

  const removeFault = { getItem() { return payload(); }, setItem() {}, removeItem() { throw new Error('remove'); } };
  const removeStore = createStore(() => removeFault);
  assert.doesNotThrow(() => removeStore.reset());
  assert.equal(removeStore.reset().ok, false);
  assert.equal(removeStore.reset().reason, 'storage');
});

test('unknown locale and tagItems fields, including nested values, survive unrelated edits', () => {
  for (const tagItems of [[], [{ kind: 'builtin', id: 'taste.sweet' }, { kind: 'custom', text: '單味' }], { future: ['原文'] }, null]) {
    const extra = { locale: 'zh-TW', tagItems, nested: { keep: ['原文'] } };
    const { storage, store } = storeFor(payload(extra));
    assert.equal(store.patch({ muted: true }).ok, true);
    assert.equal(store.patch({ secDeltaByTea: { green: 3 } }).ok, true);
    const saved = JSON.parse(storage.raw());
    assert.deepEqual(saved.locale, extra.locale);
    assert.deepEqual(saved.tagItems, extra.tagItems);
    assert.deepEqual(saved.nested, extra.nested);
  }
});

test('locale is a field patch and invalid saved locale falls back without rewrite', () => {
  const { storage, store } = storeFor(payload({ locale: 'future-locale', nested: { keep: true } }));
  assert.equal(store.read().values.locale, 'ko');
  assert.equal(store.patch({ locale: 'zh-TW' }).ok, true);
  const saved = JSON.parse(storage.raw());
  assert.equal(saved.locale, 'zh-TW');
  assert.deepEqual(saved.nested, { keep: true });
  assert.equal(store.patch({ locale: 'en' }).reason, 'invalid');
});

test('valid tagItems take priority and preserve builtin/custom identity and raw duplicates', () => {
  const tagItems = [
    { kind: 'builtin', id: 'taste.sweet' },
    { kind: 'custom', text: '단맛' },
    { kind: 'custom', text: '단맛' },
  ];
  const { storage, store } = storeFor(payload({ customTags: ['legacy'], tagItems }));
  const values = store.read().values;
  assert.deepEqual(values.tagItems, tagItems);
  assert.equal(values.tagItemsProtected, false);
  assert.deepEqual(TeaTags.dedupe(values.tagItems), tagItems.slice(0, 2));
  assert.equal(TeaTags.key(tagItems[0]), 'builtin/taste.sweet');
  assert.equal(TeaTags.key(tagItems[1]), 'custom/단맛');
  assert.equal(TeaTags.label(tagItems[0], key => ({ 'tag.taste.sweet': '甜味' })[key]), '甜味');
  assert.equal(TeaTags.label(tagItems[1], () => 'wrong'), '단맛');
  assert.equal(store.patch({ tagItems: [{ kind: 'custom', text: '새 단어' }] }).ok, true);
  const saved = JSON.parse(storage.raw());
  assert.deepEqual(saved.tagItems, [{ kind: 'custom', text: '새 단어' }]);
  assert.deepEqual(saved.customTags, ['legacy']);
});

test('saved legacy builtin and legacy string lists survive reads and unrelated locale edits', () => {
  const legacyItems = TeaTags.BUILTIN_IDS.slice(0, 14).map(id => ({ kind: 'builtin', id }));
  const legacyStrings = TeaTags.BUILTIN_ITEMS.slice(0, 14).map(([, label]) => label);
  for (const fields of [{ tagItems: legacyItems, customTags: ['사용자'] }, { customTags: legacyStrings }]) {
    const { storage, store } = storeFor(payload(fields));
    assert.deepEqual(store.read().values.tagItems, fields.tagItems || legacyStrings.map(text => ({ kind: 'custom', text })));
    assert.equal(store.patch({ locale: 'zh-TW' }).ok, true);
    const saved = JSON.parse(storage.raw());
    if (fields.tagItems) assert.deepEqual(saved.tagItems, legacyItems);
    else assert.deepEqual(saved.customTags, legacyStrings);
  }
});

test('same-text custom and explicit empty lists remain unchanged, while restore writes new defaults only', () => {
  const { storage, store } = storeFor(payload({
    customTags: ['식물향'], tagItems: [{ kind: 'custom', text: '식물향' }],
    muted: true, locale: 'zh-TW', extra: { keep: true },
  }));
  assert.equal(store.patch({ muted: false }).ok, true);
  assert.deepEqual(JSON.parse(storage.raw()).tagItems, [{ kind: 'custom', text: '식물향' }]);
  const empty = storeFor(payload({ customTags: [], tagItems: [] }));
  assert.deepEqual(empty.store.read().values.tagItems, []);
  assert.equal(empty.store.patch({ locale: 'zh-TW' }).ok, true);
  assert.deepEqual(JSON.parse(empty.storage.raw()).tagItems, []);
  assert.equal(store.restoreTags().ok, true);
  const restored = JSON.parse(storage.raw());
  assert.deepEqual(restored.tagItems, TeaTags.defaults());
  assert.deepEqual(restored.customTags, ['식물향']);
  assert.equal(restored.extra.keep, true);
  assert.equal(restored.muted, false);
});

test('legacy tags remain literal custom items, including duplicates and empty lists', () => {
  for (const customTags of [['단맛', '단맛'], []]) {
    const { store } = storeFor(payload({ customTags }));
    assert.deepEqual(store.read().values.tagItems, customTags.map(text => ({ kind: 'custom', text })));
  }
});

test('damaged tagItems keep raw data through unrelated writes and require explicit restore', () => {
  const damaged = { future: ['원문'] };
  const { storage, store } = storeFor(payload({ customTags: ['원문'], tagItems: damaged }));
  const read = store.read();
  assert.equal(read.values.tagItemsProtected, true);
  assert.deepEqual(read.values.tagItems, [{ kind: 'custom', text: '원문' }]);
  assert.equal(store.patch({ muted: true }).ok, true);
  assert.deepEqual(JSON.parse(storage.raw()).tagItems, damaged);
  assert.equal(store.patch({ tagItems: TeaTags.defaults() }).reason, 'protected');
  assert.equal(store.patch({ customTags: ['변경'] }).reason, 'protected');
  assert.deepEqual(JSON.parse(storage.raw()).tagItems, damaged);
  assert.equal(store.restoreTags().ok, true);
  const saved = JSON.parse(storage.raw());
  assert.deepEqual(saved.tagItems, TeaTags.defaults());
  assert.deepEqual(saved.customTags, ['원문']);
});

test('tag restore and tag edits report storage failures without changing raw data', () => {
  const storage = storageWith(payload({ tagItems: { bad: true } }));
  storage.setItem = () => { throw new Error('set'); };
  const store = createStore(() => storage);
  const before = storage.raw();
  assert.equal(store.restoreTags().reason, 'storage');
  assert.equal(storage.raw(), before);
});

test('malformed delta containers remain raw until an explicit canonical edit replaces them', () => {
  for (const malformed of [[], 'bad', null]) {
    const { storage, store } = storeFor(payload({ secDeltaByTea: malformed }));
    assert.deepEqual(store.read().values.secDeltaByTea, {});
    assert.equal(store.patch({ muted: true }).ok, true);
    assert.deepEqual(JSON.parse(storage.raw()).secDeltaByTea, malformed);
    assert.equal(store.patch({ secDeltaByTea: { nong: 9 } }).ok, true);
    assert.deepEqual(JSON.parse(storage.raw()).secDeltaByTea, { nong: 9 });
  }
});

test('undefined delta entries and invalid patches leave the raw payload unchanged', () => {
  const before = payload({ secDeltaByTea: { green: 2, undefined: 8 } });
  const { storage, store } = storeFor(before);
  assert.deepEqual(store.read().values.secDeltaByTea, { green: 2 });
  assert.equal(store.patch({ secDeltaByTea: { green: undefined } }).reason, 'invalid');
  assert.equal(storage.raw(), before);
  assert.equal(store.patch({ unknown: true }).reason, 'invalid');
  assert.equal(storage.raw(), before);
});

test('each alias conflict and invalid canonical value resets both keys explicitly', () => {
  for (const [alias, canonical] of [['dark-oolong', 'nong'], ['sheng-puer', 'sheng'], ['shou-puer', 'shou']]) {
    const { storage, store } = storeFor(payload({ secDeltaByTea: { [canonical]: 'bad', [alias]: 11, other: 3 } }));
    assert.equal(store.read().values.secDeltaByTea[canonical], 11);
    assert.equal(store.patch({ secDeltaByTea: { [canonical]: null } }).ok, true);
    const saved = JSON.parse(storage.raw());
    assert.equal(Object.hasOwn(saved.secDeltaByTea, canonical), false);
    assert.equal(Object.hasOwn(saved.secDeltaByTea, alias), false);
    assert.equal(saved.secDeltaByTea.other, 3);
  }
});

test('getStorage factory failure is contained and never followed by a write', () => {
  const store = createStore(() => { throw new Error('factory'); });
  assert.deepEqual(store.read().values.secDeltaByTea, {});
  assert.equal(store.read().reason, 'storage');
  assert.doesNotThrow(() => store.patch({ muted: true }));
  assert.equal(store.patch({ muted: true }).ok, false);
  assert.equal(store.reset().ok, false);
  let writes = 0;
  const readFault = createStore(() => ({
    getItem() { throw new Error('read denied'); },
    setItem() { writes++; },
  }));
  assert.equal(readFault.patch({ muted: true }).ok, false);
  assert.equal(writes, 0);
});

test('separate stores merge edits to different nested deltas without losing either change', () => {
  const storage = storageWith(payload({ secDeltaByTea: { green: 1, white: 2 } }));
  const a = createStore(() => storage);
  const b = createStore(() => storage);
  assert.equal(a.patch({ secDeltaByTea: { green: 5 } }).ok, true);
  assert.equal(b.patch({ secDeltaByTea: { white: -4 } }).ok, true);
  assert.deepEqual(JSON.parse(storage.raw()).secDeltaByTea, { green: 5, white: -4 });
});
