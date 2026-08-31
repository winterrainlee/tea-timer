const test = require('node:test');
const assert = require('node:assert/strict');

const {
  KEY,
  DEFAULT_TAGS,
  TEA_IDS,
  VESSEL_IDS,
  createStore,
} = require('../scripts/preferences.js');

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

test('exports stable key, IDs, and 14 default tags', () => {
  assert.equal(KEY, 'teaTimer.preferences.v1');
  assert.deepEqual(TEA_IDS, ['green', 'white', 'oolong', 'nong', 'black', 'sheng', 'shou']);
  assert.deepEqual(VESSEL_IDS, ['teapot', 'eastern-pot', 'gaiwan', 'mug', 'piaoyibei']);
  assert.equal(DEFAULT_TAGS.length, 14);
});

test('missing storage key reads defaults and does not write until an explicit patch', () => {
  const { storage, store } = storeFor(null);
  const read = store.read();
  assert.deepEqual(read.values, {
    lastTeaId: 'oolong', lastVesselId: 'gaiwan', muted: false,
    secDeltaByTea: {}, customTags: DEFAULT_TAGS,
  });
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
  assert.deepEqual(store.read().values, {
    lastTeaId: 'oolong', lastVesselId: 'gaiwan', muted: false,
    secDeltaByTea: { green: -4 }, customTags: DEFAULT_TAGS,
  });
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
  const extra = { locale: 'zh-Hant', tagItems: [{ id: 'sweet', label: { raw: '甜' } }], nested: { keep: ['原文'] } };
  const { storage, store } = storeFor(payload(extra));
  assert.equal(store.patch({ muted: true }).ok, true);
  const saved = JSON.parse(storage.raw());
  assert.deepEqual(saved.locale, extra.locale);
  assert.deepEqual(saved.tagItems, extra.tagItems);
  assert.deepEqual(saved.nested, extra.nested);
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
  const before = payload({ secDeltaByTea: { green: 2, extra: undefined } });
  const { storage, store } = storeFor(before);
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
  let writes = 0;
  const store = createStore(() => { throw new Error('factory'); });
  assert.deepEqual(store.read().values.secDeltaByTea, {});
  assert.equal(store.read().reason, 'storage');
  assert.doesNotThrow(() => store.patch({ muted: true }));
  assert.equal(store.patch({ muted: true }).ok, false);
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
