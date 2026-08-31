const test = require('node:test');
const assert = require('node:assert/strict');
const TeaTags = require('../scripts/tags.js');

test('default items are stable IDs and fresh defaults cannot mutate shared defaults', () => {
  assert.equal(TeaTags.DEFAULT_ITEMS.length, 14);
  assert.equal(Object.isFrozen(TeaTags.DEFAULT_ITEMS), true);
  assert.equal(Object.isFrozen(TeaTags.DEFAULT_ITEMS[0]), true);
  const one = TeaTags.defaults();
  const two = TeaTags.defaults();
  one.pop();
  assert.equal(two.length, 14);
  assert.deepEqual(two[0], { kind: 'builtin', id: 'taste.sweet' });
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
