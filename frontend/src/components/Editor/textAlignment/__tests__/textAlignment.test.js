import {
  normalizeAlign,
  readStoredAlign,
  writeAlignToElement,
  getAlignFromElement,
  getAlignmentTargets,
  applyTextAlignment,
  buildAlignAttrs,
  persistBlockAlign,
  applyAlignmentFromBlock,
  DATA_TEXT_ALIGN_ATTR,
  DEFAULT_TEXT_ALIGN,
} from '../textAlignment';

function makePage(html) {
  const renderer = document.createElement('div');
  renderer.className = 'document-renderer';
  const page = document.createElement('div');
  page.className = 'page';
  const content = document.createElement('div');
  content.className = 'page-content';
  content.innerHTML = html;
  page.appendChild(content);
  renderer.appendChild(page);
  document.body.appendChild(renderer);
  return { renderer, content };
}

function selectInside(node, collapsed = true) {
  const range = document.createRange();
  const text = node.firstChild || node;
  range.selectNodeContents(text.nodeType === Node.TEXT_NODE ? text.parentNode === node ? text : node : node);
  if (collapsed) range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  return range;
}

describe('text alignment helpers', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    window.getSelection()?.removeAllRanges();
  });

  test('normalizeAlign maps aliases', () => {
    expect(normalizeAlign('Center')).toBe('center');
    expect(normalizeAlign('start')).toBe('left');
    expect(normalizeAlign('end')).toBe('right');
    expect(normalizeAlign('justifyFull')).toBe('justify');
    expect(normalizeAlign('nope')).toBeNull();
  });

  test('writeAlignToElement stores data-text-align and style', () => {
    const p = document.createElement('p');
    writeAlignToElement(p, 'center');
    expect(p.getAttribute(DATA_TEXT_ALIGN_ATTR)).toBe('center');
    expect(p.style.textAlign).toBe('center');
    expect(readStoredAlign(p)).toBe('center');
  });

  test('buildAlignAttrs serializes for engine HTML', () => {
    const attrs = buildAlignAttrs('right');
    expect(attrs).toContain(`${DATA_TEXT_ALIGN_ATTR}="right"`);
    expect(attrs).toContain('text-align:right');
  });

  test('getAlignmentTargets aligns the whole paragraph when a word is selected', () => {
    const { content } = makePage('<p data-block-id="b1">Hello world sentence</p>');
    const p = content.querySelector('p');
    const text = p.firstChild;
    const range = document.createRange();
    range.setStart(text, 6);
    range.setEnd(text, 11);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const targets = getAlignmentTargets(range);
    expect(targets).toEqual([p]);
  });

  test('getAlignmentTargets skips table and figure wrappers', () => {
    const { content } = makePage(`
      <p data-block-id="b1">Text</p>
      <table data-block-id="t1"><tbody><tr><td>Cell</td></tr></tbody></table>
      <figure data-block-id="i1" data-type="image" class="img-block"><img alt=""></figure>
    `);
    const p = content.querySelector('p');
    const table = content.querySelector('table');
    const figure = content.querySelector('figure');
    const range = document.createRange();
    range.setStartBefore(p);
    range.setEndAfter(figure);

    const targets = getAlignmentTargets(range);
    expect(targets).toContain(p);
    expect(targets).not.toContain(table);
    expect(targets).not.toContain(figure);
  });

  test('getAlignmentTargets uses table cell when caret is inside a cell', () => {
    const { content } = makePage(
      '<table data-block-id="t1"><tbody><tr><td>Cell text</td></tr></tbody></table>'
    );
    const td = content.querySelector('td');
    const range = selectInside(td);
    const targets = getAlignmentTargets(range);
    expect(targets).toEqual([td]);
  });

  test('getAlignmentTargets uses list items line by line', () => {
    const { content } = makePage(
      '<ul data-block-id="l1"><li>One</li><li>Two</li></ul>'
    );
    const firstLi = content.querySelector('li');
    const range = selectInside(firstLi);
    const targets = getAlignmentTargets(range);
    expect(targets).toEqual([firstLi]);
  });

  test('applyTextAlignment writes attrs and does not wrap in divs', () => {
    const { content } = makePage('<p data-block-id="b1">Hello world</p>');
    const p = content.querySelector('p');
    selectInside(p, false);
    const targets = applyTextAlignment('center');
    expect(targets).toEqual([p]);
    expect(p.getAttribute(DATA_TEXT_ALIGN_ATTR)).toBe('center');
    expect(p.querySelector('div')).toBeNull();
    expect(p.innerHTML).toContain('Hello world');
  });

  test('getAlignFromElement falls back to default justify', () => {
    const p = document.createElement('p');
    expect(getAlignFromElement(p)).toBe(DEFAULT_TEXT_ALIGN);
  });
});

describe('text alignment persistence', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('blockToHTML emits data-text-align so review/reload keep alignment', () => {
    const { DocumentEngine } = require('../../DocumentEngine');
    const engine = new DocumentEngine();
    const block = engine.createBlock('paragraph', 'Hello', { align: 'center' });
    const html = engine.blockToHTML(block);
    expect(html).toContain('data-text-align="center"');
    expect(html).toContain('text-align:center');
    expect(html).toContain('Hello');
  });

  test('syncDOMToBlocks stores paragraph align in engine metadata', () => {
    const { DocumentEngine, ContentChangeHandler } = require('../../DocumentEngine');
    const engine = new DocumentEngine();
    const handler = new ContentChangeHandler(engine);
    const { renderer } = makePage(
      '<p data-block-id="b1" data-text-align="right" style="text-align:right">Review me</p>'
    );
    handler.syncDOMToBlocks(renderer);
    const block = engine.getBlock('b1');
    expect(block.metadata.align).toBe('right');
    expect(engine.blockToHTML(block)).toContain('data-text-align="right"');
  });

  test('list item aligns persist through blockToHTML', () => {
    const { DocumentEngine } = require('../../DocumentEngine');
    const engine = new DocumentEngine();
    const block = engine.createBlock('list', ['One', 'Two'], {
      listType: 'bullet',
      itemAligns: [null, 'center'],
    });
    const html = engine.blockToHTML(block);
    expect(html).toContain('<li>One</li>');
    expect(html).toContain('data-text-align="center"');
    expect(html).toContain('Two');
  });

  test('persistBlockAlign does not wipe saved align when DOM attrs are missing', () => {
    const meta = { align: 'center' };
    persistBlockAlign(meta, document.createElement('p'));
    expect(meta.align).toBe('center');
  });

  test('applyAlignmentFromBlock restores attrs after a pagination rebuild', () => {
    const p = document.createElement('p');
    p.innerHTML = 'Hello';
    applyAlignmentFromBlock(p, { type: 'paragraph', metadata: { align: 'right' } });
    expect(p.getAttribute(DATA_TEXT_ALIGN_ATTR)).toBe('right');
    expect(p.style.textAlign).toBe('right');
  });
});
