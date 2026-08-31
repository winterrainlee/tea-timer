const test = require('node:test');
const assert = require('node:assert/strict');
const announcements = require('../scripts/announcements.js');
const item = id => Object.freeze({ id, titleKey: `title.${id}`, bodyKey: `body.${id}` });
const batch = (id, ...items) => Object.freeze({ id, items: Object.freeze(items) });

test('current release shows the four agreed items without draft or empty past sections', () => {
  const sections = announcements.getSections();
  assert.deepEqual(sections.map(section => section.id), ['released', 'planned']);
  assert.equal(announcements.releases.length, 1);
  assert.equal(announcements.draft.length, 0);
  assert.deepEqual(sections[0].items.map(item => item.id), ['main-ui', 'feeling-words', 'chinese-locales', 'creator-feedback']);
  assert.deepEqual(sections[1].items.map(item => item.id), []);
});

test('publishing a new batch moves all previous current items into past without altering them', () => {
  const first = batch('first', item('a'), item('b'));
  const planned = Object.freeze([item('future')]);
  const before = { releases: Object.freeze([first]), planned };
  const snapshot = JSON.stringify(before);
  assert.deepEqual(announcements.getSections(before).map(section => section.id), ['released', 'planned']);
  const next = batch('next', item('c'));
  const sections = announcements.getSections({ releases: [next, ...before.releases], planned });
  assert.deepEqual(sections.map(section => section.id), ['released', 'planned', 'past']);
  assert.deepEqual(sections[0].items, next.items);
  assert.deepEqual(sections[2].items, first.items);
  assert.strictEqual(sections[1].items, planned);
  assert.equal(JSON.stringify(before), snapshot);
});

test('empty release drafts do not move current into past; history retains newest-first batches', () => {
  const empty = batch('empty');
  const current = batch('current', item('new'));
  assert.deepEqual(announcements.getSections({ releases: [empty, current, empty], planned: [] })
    .map(section => section.id), ['released', 'planned']);
  const sections = announcements.getSections({
    releases: [empty, current, batch('previous', item('old-a'), item('old-b')), empty, batch('first', item('oldest'))], planned: [],
  });
  assert.deepEqual(sections[2].items.map(item => item.id), ['old-a', 'old-b', 'oldest']);
});

test('changing the notice date or planned content never archives the current release', () => {
  const releases = [batch('current', item('a'))];
  for (const updatedOn of ['2026-08-31', '2030-01-01']) {
    const sections = announcements.getSections({ releases, planned: [item(updatedOn)], updatedOn });
    assert.deepEqual(sections.map(section => section.id), ['released', 'planned']);
    assert.deepEqual(sections[0].items.map(item => item.id), ['a']);
  }
});
