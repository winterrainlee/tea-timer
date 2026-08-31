const test = require('node:test');
const assert = require('node:assert/strict');
const TeaCard = require('../scripts/card-layout.js');

// This deliberately is not a monospace measurement: the same grapheme count
// can occupy materially different card width.
function visualWidth(text) {
  let width = 0;
  for (const glyph of TeaCard.graphemes(String(text))) {
    if (/^[ilI1 .,]$/u.test(glyph)) width += 3;
    else if (/^[MW@#%]$/u.test(glyph)) width += 12;
    else if (/^[\u{1F300}-\u{1FAFF}]$/u.test(glyph)) width += 16;
    else if (/^[\u3400-\u9FFF\uAC00-\uD7A3]$/u.test(glyph)) width += 10;
    else width += 7;
  }
  return width;
}

function makeContext() {
  let font = '10px serif';
  return {
    get font() { return font; },
    set font(value) { font = value; },
    measureText(text) {
      const size = Number(font.match(/(\d+(?:\.\d+)?)px/)?.[1]) || 10;
      return { width: visualWidth(text) * size / 10 };
    },
  };
}

const measure = visualWidth;
const t = (key, vars = {}) => ({
  'infusion.brew': `第${vars.n}泡 ${vars.sec}秒`,
  'card.moreInfusions': `외 ${vars.count}포`,
  'card.moreTags': `외 ${vars.count}개`,
  'card.emptyNote': '비어 있는 메모',
  'common.product': '차 한 잔의 시간',
}[key] ?? key);

test('graphemes never splits combining marks, variation selectors, or joined emoji', () => {
  assert.deepEqual(TeaCard.graphemes('e\u0301茶✈️👩🏽‍💻'), ['e\u0301', '茶', '✈️', '👩🏽‍💻']);
  assert.equal(TeaCard.ellipsize('e\u0301茶✈️👩🏽‍💻', measure('e\u0301茶✈️') + 1, measure), 'e\u0301茶…');
});

test('ellipsize observes exact width boundaries and never changes its source', () => {
  const source = 'wide WWW · 한글 · emoji 🍵';
  const before = source;
  assert.equal(TeaCard.ellipsize(source, measure(source), measure), source);
  const clipped = TeaCard.ellipsize(source, measure(source) - 1, measure);
  assert.equal(clipped.endsWith('…'), true);
  assert.ok(measure(clipped) <= measure(source) - 1);
  assert.equal(source, before);
  assert.equal(TeaCard.ellipsize('WW', 1, measure), '…');
});

test('wrapText honours explicit newlines, prefers a space boundary, and truncates only past the line limit', () => {
  const source = 'narrow words wrap here\n繁體中文沒有空格也要換行\nlast paragraph';
  const result = TeaCard.wrapText(source, 55, 6, measure);
  assert.deepEqual(result.lines.slice(0, 2), ['narrow', 'words']);
  assert.equal(result.lines.some(line => line.includes('繁體')), true);
  assert.equal(result.truncated, true);
  assert.equal(result.lines.length, 6);
  assert.equal(result.lines.at(-1).endsWith('…'), true);
  assert.equal(source, 'narrow words wrap here\n繁體中文沒有空格也要換行\nlast paragraph');

  const exact = TeaCard.wrapText('one\ntwo', 100, 2, measure);
  assert.deepEqual(exact, { lines: ['one', 'two'], truncated: false });
});

test('fitItems packs by measured width, uses at most three rows, and includes a precise omission marker', () => {
  const texts = ['iiiiiiii', 'WWWW', '茶茶茶茶', '가나다라마바사', 'emoji🍵emoji', 'narrow', '另一个很长的词'];
  const source = texts.slice();
  const fit = TeaCard.fitItems(texts, 95, 3, 5, 6, measure, count => `외 ${count}개`);
  assert.equal(fit.rows.length, 3);
  const visible = fit.rows.flatMap(row => row.items).filter(item => !item.more).length;
  assert.equal(fit.omitted, texts.length - visible);
  assert.equal(fit.rows.flatMap(row => row.items).at(-1).text, `외 ${fit.omitted}개`);
  assert.equal(fit.rows.flatMap(row => row.items).at(-1).more, true);
  assert.ok(fit.rows.every(row => row.width <= 95));
  assert.deepEqual(texts, source);

  const single = '너비가 카드보다 훨씬 긴 하나의 사용자 태그 원문';
  const clipped = TeaCard.fitItems([single], 70, 3, 4, 8, measure, count => `외 ${count}개`);
  assert.equal(clipped.omitted, 0);
  assert.equal(clipped.rows[0].items[0].text.endsWith('…'), true);
  assert.ok(clipped.rows[0].width <= 70);
});

test('layout applies 2/2/3/5 display ceilings without mutating a long mixed-language snapshot', () => {
  const snapshot = {
    rawName: '🍵 阿里山 韓國語 茶 이름이 아주 길어서 두 줄을 넘어가도 원문은 그대로 남아야 합니다',
    infusionText: '완료된 우림이 아주 많아 긴 요약도 표시 한도를 넘습니다',
    history: Array.from({ length: 6 }, (_, index) => ({ n: index + 1, sec: 100000000 + index })),
    tags: Array.from({ length: 12 }, (_, index) => `서로폭이다른긴사용자태그${index + 1}`),
    note: ('첫 문장에는 한국어와繁體中文과 emoji 🍃가 함께 있습니다.\n둘째 문장도 공백 없는 긴문장으로 카드의 다섯 줄 표시 한도를 확실히 넘깁니다 그리고 원문은 유지됩니다. ').repeat(3),
    date: new Date(2026, 7, 31),
  };
  const original = structuredClone(snapshot);
  const model = TeaCard.layout(snapshot, makeContext(), t, 'Mock CJK');

  assert.equal(model.title.lines.length, 2);
  assert.equal(model.title.truncated, true);
  assert.equal(model.title.lines.at(-1).endsWith('…'), true);
  assert.equal(model.history.rows.length, 2);
  const visibleHistory = model.history.rows.flatMap(row => row.items).filter(item => !item.more).length;
  assert.ok(model.history.omitted > 0);
  assert.equal(model.history.omitted, snapshot.history.length - visibleHistory);
  assert.equal(model.history.rows.flatMap(row => row.items).at(-1).text, `외 ${model.history.omitted}포`);
  assert.equal(model.tags.rows.length, 3);
  const visibleTags = model.tags.rows.flatMap(row => row.items).filter(item => !item.more).length;
  assert.ok(model.tags.omitted > 0);
  assert.equal(model.tags.omitted, snapshot.tags.length - visibleTags);
  assert.equal(model.tags.rows.flatMap(row => row.items).at(-1).text, `외 ${model.tags.omitted}개`);
  assert.equal(model.note.lines.length, 5);
  assert.equal(model.note.truncated, true);
  assert.equal(model.note.lines.at(-1).endsWith('…'), true);
  assert.equal(model.dateText, '2026.08.31');
  assert.equal(model.brand, '차 한 잔의 시간');
  assert.deepEqual(snapshot, original);
});

test('layout leaves short content whole, with no synthetic rows, markers, or ellipses', () => {
  const snapshot = {
    rawName: '阿里山 차',
    infusionText: '1포 우림 (개완)',
    history: [{ n: 1, sec: 45 }],
    tags: ['맑음', '青香'],
    note: '첫 모금이 맑았습니다.',
    date: new Date(2026, 7, 31),
  };
  const model = TeaCard.layout(snapshot, makeContext(), t, 'Mock CJK');
  assert.deepEqual(model.title, { lines: ['阿里山 차'], truncated: false });
  assert.equal(model.history.rows.length, 1);
  assert.equal(model.history.omitted, 0);
  assert.equal(model.tags.rows.length, 1);
  assert.equal(model.tags.omitted, 0);
  assert.deepEqual(model.note, { lines: ['첫 모금이 맑았습니다.'], truncated: false });
  for (const item of [...model.history.rows.flatMap(row => row.items), ...model.tags.rows.flatMap(row => row.items)]) {
    assert.equal(item.more, false);
    assert.equal(item.text.includes('…'), false);
  }
});
