const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');

function loadCore(savedLocale = 'ko') {
  const context = vm.createContext({
    console,
    TeaPreferences: {
      createStore: () => ({ read: () => ({ values: { locale: savedLocale } }) }),
    },
    module: { exports: {} },
  });
  vm.runInContext(source('scripts/i18n.js'), context, { filename: 'scripts/i18n.js' });
  vm.runInContext(source('scripts/locales/ko.js'), context, { filename: 'scripts/locales/ko.js' });
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

test('synthetic Traditional Chinese catalog switches locale and falls back per missing key or placeholder', () => {
  const { i18n } = loadCore('not-supported');
  assert.equal(i18n.getLocale(), 'ko');
  i18n.register('zh-TW', {
    'synthetic.greeting': '您好 {name}，{missing}',
    'tea.oolong.name': '阿里山烏龍',
  });
  assert.equal(i18n.setLocale('zh-TW'), true);
  assert.equal(i18n.t('synthetic.greeting', { name: '차 <&>' }), '您好 차 <&>，{missing}');
  assert.equal(i18n.t('tea.oolong.name'), '阿里山烏龍');
  assert.equal(i18n.t('common.cancel'), '취소');
  assert.equal(i18n.setLocale('unsupported'), true);
  assert.equal(i18n.getLocale(), 'ko');
  assert.equal(i18n.t('tea.oolong.name'), '청향 우롱');
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

test('builtin tag labels are catalog keys while custom text is independent raw user data', () => {
  const { i18n, tags } = loadCore();
  const builtin = { kind: 'builtin', id: 'taste.sweet' };
  const custom = { kind: 'custom', text: '단맛' };
  assert.equal(tags.label(builtin, i18n.t), '단맛');
  assert.equal(tags.label(custom, i18n.t), '단맛');
  i18n.register('zh-TW', { 'tag.taste.sweet': '甜味' });
  i18n.setLocale('zh-TW');
  assert.equal(tags.label(builtin, i18n.t), '甜味');
  assert.equal(tags.label(custom, i18n.t), '단맛');
  assert.notEqual(tags.key(builtin), tags.key(custom));
});
