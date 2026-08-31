const test = require('node:test');
const assert = require('node:assert/strict');

const { KEY, DEFAULT_TAGS, createStore } = require('../scripts/preferences.js');
const TeaTags = require('../scripts/tags.js');

function payload(fields = {}) {
  return JSON.stringify({ version: 1, customTags: [...DEFAULT_TAGS], ...fields });
}

function storageWith(raw) {
  let value = raw;
  let writes = 0;
  return {
    getItem() { return value; },
    setItem(_key, next) { writes++; value = String(next); },
    raw() { return value; },
    writes() { return writes; },
  };
}

function storeFor(raw) {
  const storage = storageWith(raw);
  return { storage, store: createStore(() => storage) };
}

test('appends to legacy custom tags verbatim and leaves legacy field intact', () => {
  const { storage, store } = storeFor(payload({ customTags: ['기존'] }));
  const result = store.addTag({ kind: 'custom', text: '  #새 태그  ' });
  assert.deepEqual(result, {
    ok: true, reason: null, added: true,
    items: [{ kind: 'custom', text: '기존' }, { kind: 'custom', text: '  #새 태그  ' }],
  });
  const saved = JSON.parse(storage.raw());
  assert.deepEqual(saved.customTags, ['기존']);
  assert.deepEqual(saved.tagItems, result.items);
});

test('uses defaults when no tag list exists and honors explicit empty lists', () => {
  const defaults = storeFor(JSON.stringify({ version: 1 }));
  assert.equal(defaults.store.addTag({ kind: 'custom', text: '새' }).items.length, TeaTags.defaults().length + 1);

  const empty = storeFor(payload({ customTags: [], tagItems: [] }));
  assert.deepEqual(empty.store.addTag({ kind: 'custom', text: '새' }).items, [{ kind: 'custom', text: '새' }]);
});

test('seeds a first edit from the explicit UI locale even when stored locale changed elsewhere', () => {
  const { storage, store } = storeFor(JSON.stringify({ version: 1, locale: 'ko', metadata: { keep: true } }));
  const result = store.addTag({ kind: 'custom', text: '我的詞' }, 'zh-TW');
  assert.deepEqual(result.items, [...TeaTags.defaults('zh-TW'), { kind: 'custom', text: '我的詞' }]);
  const saved = JSON.parse(storage.raw());
  assert.equal(saved.locale, 'ko');
  assert.deepEqual(saved.tagItems, result.items);
  assert.deepEqual(saved.metadata, { keep: true });
});

test('uses stored locale for a missing-list seed without an explicit UI locale', () => {
  const { store } = storeFor(JSON.stringify({ version: 1, locale: 'zh-TW' }));
  const result = store.addTag({ kind: 'custom', text: '我的詞' });
  assert.deepEqual(result.items, [...TeaTags.defaults('zh-TW'), { kind: 'custom', text: '我的詞' }]);
});

test('is idempotent by custom identity and needs no write for an existing tag', () => {
  const { storage, store } = storeFor(payload({ tagItems: [{ kind: 'custom', text: '원문' }] }));
  const result = store.addTag({ kind: 'custom', text: '원문' });
  assert.deepEqual(result, { ok: true, reason: null, added: false, items: [{ kind: 'custom', text: '원문' }] });
  assert.equal(storage.writes(), 0);

  storage.setItem = () => { throw new Error('read-only duplicate'); };
  assert.equal(store.addTag({ kind: 'custom', text: '원문' }).ok, true);
});

test('keeps builtin and same-label custom tags as separate identities', () => {
  const { store } = storeFor(payload({ tagItems: [{ kind: 'builtin', id: 'taste.sweet' }] }));
  const result = store.addTag({ kind: 'custom', text: '단맛' });
  assert.equal(result.added, true);
  assert.deepEqual(result.items, [
    { kind: 'builtin', id: 'taste.sweet' }, { kind: 'custom', text: '단맛' },
  ]);
});

test('preserves unknown metadata on valid stored items while returning runtime items', () => {
  const rawItems = [
    { kind: 'builtin', id: 'taste.sweet', future: { color: 'amber' } },
    { kind: 'custom', text: '기존', source: 'imported' },
  ];
  const { storage, store } = storeFor(payload({ tagItems: rawItems }));
  const result = store.addTag({ kind: 'custom', text: '새' });
  assert.deepEqual(result.items, [
    { kind: 'builtin', id: 'taste.sweet' },
    { kind: 'custom', text: '기존' },
    { kind: 'custom', text: '새' },
  ]);
  assert.deepEqual(JSON.parse(storage.raw()).tagItems, [
    ...rawItems,
    { kind: 'custom', text: '새' },
  ]);
});

test('rereads the latest raw payload and preserves unknown fields on append', () => {
  const storage = storageWith(payload({ tagItems: [{ kind: 'custom', text: '처음' }], unknown: { keep: true } }));
  const first = createStore(() => storage);
  const second = createStore(() => storage);
  assert.equal(first.addTag({ kind: 'custom', text: '첫째' }).ok, true);
  assert.equal(second.addTag({ kind: 'custom', text: '둘째' }).ok, true);
  const saved = JSON.parse(storage.raw());
  assert.deepEqual(saved.tagItems, [
    { kind: 'custom', text: '처음' }, { kind: 'custom', text: '첫째' }, { kind: 'custom', text: '둘째' },
  ]);
  assert.deepEqual(saved.unknown, { keep: true });
});

test('rejects invalid items and reports read or write storage failures', () => {
  const { storage, store } = storeFor(payload());
  for (const item of [null, {}, { kind: 'builtin', id: 'taste.sweet' }, { kind: 'custom', text: '' }, { kind: 'custom', text: 1 }]) {
    assert.deepEqual(store.addTag(item), { ok: false, reason: 'invalid' });
  }
  storage.setItem = () => { throw new Error('write'); };
  assert.deepEqual(store.addTag({ kind: 'custom', text: '새' }), { ok: false, reason: 'storage' });
  const readFault = createStore(() => ({ getItem() { throw new Error('read'); } }));
  assert.deepEqual(readFault.addTag({ kind: 'custom', text: '새' }), { ok: false, reason: 'storage' });
});

test('never overwrites malformed, future, or corrupt explicit tag lists', () => {
  for (const raw of [
    '{bad json', JSON.stringify({ version: 2 }), payload({ tagItems: { future: ['원문'] } }), payload({ tagItems: [{ kind: 'custom', text: 7 }] }),
  ]) {
    const { storage, store } = storeFor(raw);
    assert.deepEqual(store.addTag({ kind: 'custom', text: '새' }), { ok: false, reason: 'protected' });
    assert.equal(storage.raw(), raw);
  }
});

test('reads storage under the shared preferences key', () => {
  const storage = storageWith(null);
  const store = createStore(() => storage);
  store.addTag({ kind: 'custom', text: '새' });
  assert.ok(JSON.parse(storage.raw()).tagItems);
  assert.equal(KEY, 'teaTimer.preferences.v1');
});
