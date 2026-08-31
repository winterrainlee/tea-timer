// Display-only projection. Never edit the session, preferences, or full text export.
const TeaCard = (() => {
  'use strict';
  const WIDTH = 680, HEIGHT = 900, CONTENT = 564;
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  function graphemes(text) {
    if (segmenter) return Array.from(segmenter.segment(text), part => part.segment);
    // Older WebViews: keep combining marks, variation selectors and ZWJ sequences intact.
    const result = [];
    for (const char of Array.from(text)) {
      if (result.length && (/\p{Mark}|[\uFE0E\uFE0F\u200D]|[\u{1F3FB}-\u{1F3FF}]/u.test(char) || result.at(-1).endsWith('\u200D'))) result[result.length - 1] += char;
      else result.push(char);
    }
    return result;
  }
  function ellipsize(text, width, measure, force = false) {
    if (!force && measure(text) <= width) return text;
    const chars = graphemes(text.trimEnd());
    while (chars.length && measure(chars.join('') + '…') > width) chars.pop();
    return chars.join('').trimEnd() + '…';
  }
  function wrapText(text, width, maxLines, measure) {
    const lines = [];
    const paragraphs = String(text).replace(/\r\n?/g, '\n').split('\n');
    let truncated = false;
    outer: for (const paragraph of paragraphs) {
      let chars = graphemes(paragraph);
      do {
        if (lines.length === maxLines) { truncated = true; break outer; }
        let count = 0;
        while (count < chars.length && measure(chars.slice(0, count + 1).join('')) <= width) count++;
        if (count === 0 && chars.length) count = 1;
        if (count < chars.length) {
          // Prefer word boundaries for spaced text; CJK still wraps by grapheme.
          let space = count;
          while (space > 0 && !/\s/u.test(chars[space])) space--;
          if (space > count / 2) count = space;
          // Do not begin a CJK line with closing punctuation or end it with an opener.
          while (count > 1 && (/[（「『【(]$/u.test(chars[count - 1]) || /^[，。！？、；：）」』】,.!?;:)]/u.test(chars[count]))) count--;
        }
        lines.push(chars.splice(0, count).join('').trimEnd());
        while (chars.length && /^\s+$/u.test(chars[0])) chars.shift();
      } while (chars.length);
    }
    if (truncated) lines[lines.length - 1] = ellipsize(lines.at(-1), width, measure, true);
    return { lines, truncated };
  }
  function fitItems(texts, width, maxRows, gap, padding, measure, moreLabel) {
    const items = texts.map(text => {
      const display = ellipsize(text, width - padding * 2, measure);
      return { text: display, width: measure(display) + padding * 2, more: false };
    });
    function pack(list) {
      const rows = [];
      for (const item of list) {
        let row = rows.at(-1);
        if (!row || row.width + gap + item.width > width) { row = { items: [], width: 0 }; rows.push(row); }
        row.width += (row.items.length ? gap : 0) + item.width;
        row.items.push(item);
        if (rows.length > maxRows) return null;
      }
      return rows;
    }
    // Find the fitting prefix in a single pass; then make room for the count marker.
    let shown = 0, rowWidth = 0, rowCount = 1;
    for (const item of items) {
      if (rowWidth && rowWidth + gap + item.width > width) { rowCount++; rowWidth = 0; }
      if (rowCount > maxRows) break;
      rowWidth += (rowWidth ? gap : 0) + item.width; shown++;
    }
    if (shown === items.length) return { rows: pack(items), omitted: 0 };
    for (; shown >= 0; shown--) {
      const text = ellipsize(moreLabel(items.length - shown), width - padding * 2, measure);
      const marker = { text, width: measure(text) + padding * 2, more: true };
      const rows = pack([...items.slice(0, shown), marker]);
      if (rows) return { rows, omitted: items.length - shown };
    }
  }
  function layout(snapshot, ctx, t, family) {
    const measureAt = (size, bold = false) => {
      ctx.font = `${bold ? '700 ' : ''}${size}px ${family}`;
      return text => ctx.measureText(text).width;
    };
    const title = wrapText(snapshot.rawName, CONTENT, 2, measureAt(38, true));
    const summary = ellipsize(snapshot.infusionText, CONTENT, measureAt(26));
    const history = fitItems(snapshot.history.map(h => t('infusion.brew', h)), CONTENT, 2, 18, 0, measureAt(24), count => t('card.moreInfusions', { count }));
    const tags = fitItems(snapshot.tags.map(tag => '#' + tag), CONTENT, 3, 10, 14, measureAt(28, true), count => t('card.moreTags', { count }));
    const note = wrapText(snapshot.note.trim() || t('card.emptyNote'), 520, 5, measureAt(28));
    const date = snapshot.date;
    const dateText = date.getFullYear() + '.' + String(date.getMonth() + 1).padStart(2, '0') + '.' + String(date.getDate()).padStart(2, '0');
    return { title, summary, history, tags, note, dateText, brand: '차 한 잔의 시간' };
  }
  function render(canvas, snapshot, t, family) {
    canvas.width = WIDTH; canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    const model = layout(snapshot, ctx, t, family);
    const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    grad.addColorStop(0, '#21190e'); grad.addColorStop(1, '#100b07');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = '#584827'; ctx.lineWidth = 1; ctx.strokeRect(24, 30, 632, 840);
    ctx.strokeStyle = '#3d331d'; ctx.strokeRect(32, 40, 616, 820);
    function text(value, x, y, size, color, align = 'center', bold = false) {
      ctx.font = `${bold ? '700 ' : ''}${size}px ${family}`;
      ctx.textBaseline = 'middle'; ctx.textAlign = align; ctx.fillStyle = color;
      ctx.fillText(value, x, y);
    }
    text(t('card.badge'), 340, 86, 24, '#e4d691');
    model.title.lines.forEach((line, i) => text(line, 340, 142 + i * 48, 38, '#efe6d6', 'center', true));
    text(model.summary, 340, 237, 26, '#e4d691');
    model.history.rows.forEach((row, r) => {
      let x = (WIDTH - row.width) / 2;
      row.items.forEach(item => { text(item.text, x, 284 + r * 36, 24, '#b8a98e', 'left'); x += item.width + 18; });
    });
    ctx.strokeStyle = '#584827'; ctx.beginPath(); ctx.moveTo(58, 346); ctx.lineTo(622, 346); ctx.stroke();
    const startY = 439 - (model.tags.rows.length - 1) * 26;
    model.tags.rows.forEach((row, r) => {
      let x = (WIDTH - row.width) / 2;
      row.items.forEach(item => {
        if (!item.more) {
          ctx.fillStyle = '#352e19'; ctx.beginPath(); ctx.roundRect(x, startY + r * 52 - 21, item.width, 42, 5); ctx.fill();
        }
        text(item.text, x + item.width / 2, startY + r * 52, 28, item.more ? '#b8a98e' : '#e4d691', 'center', true);
        x += item.width + 10;
      });
    });
    ctx.fillStyle = '#151009'; ctx.fillRect(58, 544, CONTENT, 236);
    ctx.fillStyle = '#b5a459'; ctx.fillRect(58, 544, 3, 236);
    const noteStart = 662 - (model.note.lines.length - 1) * 21;
    model.note.lines.forEach((line, i) => text(line, 80, noteStart + i * 42, 28, '#efe6d6', 'left'));
    text(model.dateText, 58, 825, 22, '#b8a98e', 'left');
    text(model.brand, 622, 825, 22, '#b8a98e', 'right');
    return model;
  }
  return Object.freeze({ WIDTH, HEIGHT, graphemes, ellipsize, wrapText, fitItems, layout, render });
})();
if (typeof module !== 'undefined' && module.exports) module.exports = TeaCard;
