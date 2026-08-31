const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');
const catalogFiles = {
  ko: ['scripts/locales/ko.js', 'scripts/locales/ko-settings.js', 'scripts/locales/ko-help.js'],
  'zh-TW': ['scripts/locales/zh-TW.js', 'scripts/locales/zh-TW-settings.js', 'scripts/locales/zh-TW-help.js'],
};

function catalogKeys(files) {
  return files.flatMap(file => [...source(file).matchAll(/^\s*"([^"]+)":/gm)].map(match => match[1]));
}

function loadCore(savedLocale = 'ko', locales = ['ko']) {
  const context = vm.createContext({
    console,
    TeaPreferences: {
      createStore: () => ({ read: () => ({ values: { locale: savedLocale } }) }),
    },
    module: { exports: {} },
  });
  vm.runInContext(source('scripts/i18n.js'), context, { filename: 'scripts/i18n.js' });
  for (const locale of locales) for (const file of catalogFiles[locale]) {
    vm.runInContext(source(file), context, { filename: file });
  }
  vm.runInContext(source('scripts/tags.js'), context, { filename: 'scripts/tags.js' });
  return {
    i18n: vm.runInContext('TeaI18n', context),
    tags: vm.runInContext('TeaTags', context),
  };
}

test('Korean catalog loads in a browserless context and preserves literal placeholder values', () => {
  const { i18n } = loadCore();
  assert.equal(i18n.getLocale(), 'ko');
  assert.equal(i18n.t('tea.oolong.name'), '청향 우롱');
  assert.equal(i18n.t('infusion.brew', { n: '<img src=x onerror=alert(1)>', sec: '__proto__' }),
    '<img src=x onerror=alert(1)>포 __proto__초');
  assert.equal(i18n.t('infusion.brew', { n: 3 }), '3포 {sec}초');
  assert.equal(i18n.t('unknown.key'), 'unknown.key');
});

test('Traditional Chinese catalogs cover every Korean UI key and preserve placeholders', () => {
  const { i18n } = loadCore('zh-TW', ['ko', 'zh-TW']);
  const koKeys = catalogKeys(catalogFiles.ko);
  const zhKeys = catalogKeys(catalogFiles['zh-TW']);
  assert.deepEqual([...new Set(zhKeys)].sort(), [...new Set(koKeys)].sort());
  const placeholders = value => [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map(match => match[1]).sort();
  for (const key of new Set(koKeys)) {
    assert.deepEqual(placeholders(i18n.translate('zh-TW', key)), placeholders(i18n.translate('ko', key)), key);
  }
  assert.equal(i18n.getLocale(), 'zh-TW');
  assert.equal(i18n.t('infusion.brew', { n: 3 }), '第3泡 {sec}秒');
  assert.equal(i18n.t('infusion.brew', { n: '<&>', sec: 20 }), '第<&>泡 20秒');
});

test('Traditional Chinese UI translations do not accidentally fall back to Hangul', () => {
  const { i18n, tags } = loadCore('zh-TW', ['ko', 'zh-TW']);
  const allowedHangul = new Set([
    'settings.language.ko', 'common.product', 'settings.title', 'help.title',
    'export.heading', 'card.shareTitle', 'help.creator.name',
  ]);
  const legacyTags = new Set(tags.BUILTIN_IDS.filter(id => !id.startsWith('tw.')).map(id => `tag.${id}`));
  for (const key of catalogKeys(catalogFiles.ko)) {
    if (allowedHangul.has(key) || legacyTags.has(key)) continue;
    // The introduction names the fixed Korean product; all other prose must be translated.
    const text = key === 'help.intro' ? i18n.t(key).replace('차 한 잔의 시간', '') : i18n.t(key);
    assert.equal(/[\uac00-\ud7a3]/.test(text), false, `${key}: ${i18n.t(key)}`);
  }
});

test('each app page loads its Traditional Chinese catalogs and caches those runtime assets', () => {
  const sw = source('sw.js');
  for (const [page, localeFile] of [['index.html', null], ['settings.html', 'settings'], ['help.html', 'help']]) {
    const html = source(page);
    const required = ['scripts/locales/zh-TW.js', ...(localeFile ? [`scripts/locales/zh-TW-${localeFile}.js`] : [])];
    for (const asset of required) {
      assert.ok(html.includes(`src="${asset}"`), `${page}: ${asset}`);
      assert.ok(sw.includes(`"./${asset}"`), `cache: ${asset}`);
    }
    assert.doesNotMatch(html, /data-i18n="(?:settings\.)?language\.preview"/, page);
  }
});

test('synthetic isolated catalog switches locale and falls back per missing key or placeholder', () => {
  const { i18n } = loadCore('not-supported');
  assert.equal(i18n.getLocale(), 'ko');
  i18n.register('zh-TW', { 'synthetic.greeting': '您好 {name}，{missing}' });
  assert.equal(i18n.setLocale('zh-TW'), true);
  assert.equal(i18n.t('synthetic.greeting', { name: '차 <&>' }), '您好 차 <&>，{missing}');
  assert.equal(i18n.t('common.cancel'), '취소');
  assert.equal(i18n.setLocale('unsupported'), true);
  assert.equal(i18n.getLocale(), 'ko');
});

test('locale changes notify each active listener once and duplicate registrations reject conflicts', () => {
  const { i18n } = loadCore();
  i18n.register('zh-TW', { 'synthetic.value': '值' });
  const calls = [];
  const unsubscribe = i18n.onChange(locale => calls.push(locale));
  assert.equal(i18n.setLocale('zh-TW'), true);
  assert.equal(i18n.setLocale('zh-TW'), false);
  assert.deepEqual(calls, ['zh-TW']);
  assert.throws(() => i18n.register('zh-TW', { 'synthetic.value': '다른 값' }), /Duplicate translation/);
  assert.throws(() => i18n.register('en', { x: 'x' }), /Unsupported catalog locale/);
  assert.equal(unsubscribe(), true);
  assert.equal(i18n.setLocale('ko'), true);
  assert.deepEqual(calls, ['zh-TW']);
});

test('tag registry keeps legacy Korean IDs and zh-TW IDs as raw originals across UI locales', () => {
  const { i18n, tags } = loadCore('zh-TW', ['ko', 'zh-TW']);
  const expectedTw = ['青香', '花香', '甜香', '果香', '焙香', '鮮', '甜', '鹹', '酸', '苦', '清爽', '細膩', '粗澀', '濃稠', '餘韻感'];
  assert.deepEqual(Array.from(tags.defaults('zh-TW'), item => item.id), [
    'tw.aroma.vegetal', 'tw.aroma.floral', 'tw.aroma.sweet', 'tw.aroma.fruity', 'tw.aroma.roasted',
    'tw.taste.umami', 'tw.taste.sweet', 'tw.taste.salty', 'tw.taste.sour', 'tw.taste.bitter',
    'tw.mouthfeel.fresh', 'tw.mouthfeel.fine', 'tw.mouthfeel.astringent', 'tw.mouthfeel.full', 'tw.mouthfeel.aftertaste',
  ]);
  assert.deepEqual(Array.from(tags.defaults('zh-TW'), item => tags.label(item, i18n.t)), expectedTw);
  assert.equal(tags.label({ kind: 'builtin', id: 'taste.sweet' }, i18n.t), '단맛');
  assert.equal(tags.label({ kind: 'custom', text: '自訂原文' }, i18n.t), '自訂原文');
  i18n.setLocale('ko');
  assert.deepEqual(Array.from(tags.defaults('zh-TW'), item => tags.label(item, i18n.t)), expectedTw);
});

test('product identity stays Korean while zh-TW draft wording refers to the whole tea session', () => {
  const { i18n } = loadCore('zh-TW', ['ko', 'zh-TW']);
  for (const key of ['common.product', 'settings.title', 'help.title', 'export.heading', 'card.shareTitle']) {
    assert.match(i18n.t(key), /차 한 잔의 시간/, key);
  }
  assert.match(i18n.t('note.draftHint'), /這次泡茶/);
  assert.match(i18n.t('note.draftLifetime'), /這次泡茶/);
  assert.doesNotMatch(i18n.t('note.draftHint'), /這一泡/);
  assert.doesNotMatch(i18n.t('note.draftLifetime'), /這一泡/);
});
