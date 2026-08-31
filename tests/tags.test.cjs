const test = require('node:test');
const assert = require('node:assert/strict');
const TeaTags = require('../scripts/tags.js');

const catalogs = {};
global.TeaI18n = { register(locale, catalog) { catalogs[locale] = catalog; } };
require('../scripts/locales/ko.js');

test('default items are stable IDs and fresh defaults cannot mutate shared defaults', () => {
  assert.equal(TeaTags.DEFAULT_ITEMS.length, 15);
  assert.deepEqual(TeaTags.DEFAULT_IDS, [
    'aroma.plant', 'aroma.floral', 'aroma.sweet', 'aroma.fruity', 'aroma.roasted',
    'taste.umami', 'taste.sweet', 'taste.salty', 'taste.sour', 'taste.bitter',
    'texture.clean', 'texture.coating', 'taste.astringent', 'body.full', 'finish.lingering',
  ]);
  assert.equal(Object.isFrozen(TeaTags.DEFAULT_ITEMS), true);
  assert.equal(Object.isFrozen(TeaTags.DEFAULT_ITEMS[0]), true);
  const one = TeaTags.defaults();
  const two = TeaTags.defaults();
  one.pop();
  assert.equal(two.length, 15);
  assert.deepEqual(two[0], { kind: 'builtin', id: 'aroma.plant' });
});

test('new defaults use the confirmed Korean vocabulary and historical builtins remain supported', () => {
  assert.deepEqual(TeaTags.DEFAULT_ITEMS, TeaTags.DEFAULT_IDS.map(id => ({ kind: 'builtin', id })));
  for (const [id, label] of [
    ['taste.sweet', '단맛'], ['aroma.floral', '꽃향'], ['taste.fruity', '과일'],
    ['taste.grain', '곡물'], ['taste.roasted', '구운맛'], ['taste.nutty', '견과'],
    ['aroma.grassy', '풀'], ['aroma.woody', '나무'], ['taste.earthy', '흙'],
    ['aroma.smoky', '연기'], ['taste.astringent', '떫음'], ['texture.smooth', '부드러움'],
    ['taste.clean', '맑음'], ['body.full', '묵직함'],
  ]) {
    assert.equal(TeaTags.isValidItem({ kind: 'builtin', id }), true);
    assert.equal(TeaTags.label({ kind: 'builtin', id }, key => catalogs.ko[key]), label);
  }
});

test('Korean catalog provides the exact label for every new default ID', () => {
  const ko = catalogs.ko;
  assert.deepEqual(TeaTags.DEFAULT_IDS.map(id => ko[`tag.${id}`]), [
    '식물향', '꽃향', '달콤한 향', '과일향', '구운 향',
    '감칠맛', '단맛', '짠맛', '신맛', '쓴맛',
    '깔끔함', '텁텁함', '떫음', '묵직함', '긴 여운',
  ]);
});

test('validation accepts only known builtin IDs and literal custom text', () => {
  assert.equal(TeaTags.isValidItems([]), true);
  assert.equal(TeaTags.isValidItems([{ kind: 'builtin', id: 'taste.sweet' }]), true);
  assert.equal(TeaTags.isValidItems([{ kind: 'builtin', id: 'future.id' }]), false);
  assert.equal(TeaTags.isValidItems([{ kind: 'custom', text: '내 단어' }]), true);
  assert.equal(TeaTags.isValidItems([{ kind: 'custom', text: 1 }]), false);
  assert.equal(TeaTags.isValidItems({}), false);
});

test('dedupe is only a display projection and keeps builtin and same-text custom separate', () => {
  const raw = [
    { kind: 'builtin', id: 'taste.sweet' },
    { kind: 'custom', text: '단맛' },
    { kind: 'custom', text: '단맛' },
  ];
  assert.deepEqual(TeaTags.dedupe(raw), raw.slice(0, 2));
  assert.deepEqual(raw, [
    { kind: 'builtin', id: 'taste.sweet' },
    { kind: 'custom', text: '단맛' },
    { kind: 'custom', text: '단맛' },
  ]);
});
