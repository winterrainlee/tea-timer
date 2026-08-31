const test = require('node:test');
const assert = require('node:assert/strict');
const TeaTags = require('../scripts/tags.js');

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
  const two = TeaTags.defaults('ko');
  one.pop();
  assert.equal(two.length, 15);
  assert.deepEqual(two[0], { kind: 'builtin', id: 'aroma.plant' });
});

test('locale defaults are independent and every Korean historical builtin remains supported', () => {
  assert.deepEqual(TeaTags.DEFAULT_ITEMS, TeaTags.DEFAULT_IDS.map(id => ({ kind: 'builtin', id })));
  for (const [id, label] of [
    ['taste.sweet', '단맛'], ['aroma.floral', '꽃향'], ['taste.fruity', '과일'],
    ['taste.grain', '곡물'], ['taste.roasted', '구운맛'], ['taste.nutty', '견과'],
    ['aroma.grassy', '풀'], ['aroma.woody', '나무'], ['taste.earthy', '흙'],
    ['aroma.smoky', '연기'], ['taste.astringent', '떫음'], ['texture.smooth', '부드러움'],
    ['taste.clean', '맑음'], ['body.full', '묵직함'],
  ]) {
    assert.equal(TeaTags.isValidItem({ kind: 'builtin', id }), true);
    assert.equal(TeaTags.label({ kind: 'builtin', id }, () => '번역되면 안 됨'), label);
  }
  assert.deepEqual(TeaTags.defaults('zh-TW'), [
    'tw.aroma.vegetal', 'tw.aroma.floral', 'tw.aroma.sweet', 'tw.aroma.fruity', 'tw.aroma.roasted',
    'tw.taste.umami', 'tw.taste.sweet', 'tw.taste.salty', 'tw.taste.sour', 'tw.taste.bitter',
    'tw.mouthfeel.fresh', 'tw.mouthfeel.fine', 'tw.mouthfeel.astringent', 'tw.mouthfeel.full', 'tw.mouthfeel.aftertaste',
  ].map(id => ({ kind: 'builtin', id })));
  assert.equal(TeaTags.BUILTIN_IDS.length, 40);
  assert.equal(TeaTags.label({ kind: 'builtin', id: 'tw.mouthfeel.fine' }), '細膩');
  assert.equal(TeaTags.label({ kind: 'builtin', id: 'tw.taste.sweet' }, () => '단맛'), '甜');
});

test('default and registry labels retain their original source language', () => {
  assert.deepEqual(TeaTags.defaults().map(item => TeaTags.label(item)), [
    '식물향', '꽃향', '달콤한 향', '과일향', '구운 향',
    '감칠맛', '단맛', '짠맛', '신맛', '쓴맛',
    '깔끔함', '텁텁함', '떫음', '묵직함', '여운',
  ]);
  assert.deepEqual(TeaTags.defaults('zh-TW').map(item => TeaTags.label(item)), [
    '青香', '花香', '甜香', '果香', '焙香', '鮮', '甜', '鹹', '酸', '苦', '清爽', '細膩', '粗澀', '濃稠', '餘韻感',
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
