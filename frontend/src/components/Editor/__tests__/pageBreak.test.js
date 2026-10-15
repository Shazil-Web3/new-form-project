import { DocumentEngine, BLOCK_TYPES, ContentChangeHandler } from '../DocumentEngine';

describe('DocumentEngine Page Break System', () => {
  let engine;

  beforeEach(() => {
    engine = new DocumentEngine();
  });

  test('BLOCK_TYPES includes PAGE_BREAK', () => {
    expect(BLOCK_TYPES.PAGE_BREAK).toBe('page-break');
  });

  test('createBlock creates a valid page break block', () => {
    const block = engine.createBlock(BLOCK_TYPES.PAGE_BREAK, '');
    expect(block.type).toBe(BLOCK_TYPES.PAGE_BREAK);
    expect(block.id).toBeDefined();
    expect(block.content).toBe('');
  });

  test('blockToHTML renders page break marker', () => {
    const block = engine.createBlock(BLOCK_TYPES.PAGE_BREAK, '');
    const html = engine.blockToHTML(block);
    expect(html).toContain('class="page-break-marker"');
    expect(html).toContain('data-page-break="true"');
    expect(html).toContain(`data-block-id="${block.id}"`);
    expect(html).toContain('contenteditable="false"');
  });

  test('_measureWithMargins returns 0 height for PAGE_BREAK', () => {
    const block = engine.createBlock(BLOCK_TYPES.PAGE_BREAK, '');
    const measure = engine._measureWithMargins(block);
    expect(measure.total).toBe(0);
    expect(measure.box).toBe(0);
  });

  test('_layoutBlocksIntoPages splits blocks across pages when PAGE_BREAK is present', () => {
    const p1 = engine.createBlock(BLOCK_TYPES.PARAGRAPH, 'Page 1 Content');
    const pb1 = engine.createBlock(BLOCK_TYPES.PAGE_BREAK, '');
    const p2 = engine.createBlock(BLOCK_TYPES.PARAGRAPH, 'Page 2 Content');

    const pages = engine._layoutBlocksIntoPages([p1, pb1, p2]);
    expect(pages.length).toBe(2);
    expect(pages[0].blocks).toEqual([p1, pb1]);
    expect(pages[1].blocks).toEqual([p2]);
  });

  test('_layoutBlocksIntoPages handles multiple consecutive page breaks', () => {
    // Simulating pressing Ctrl+Enter twice from an empty document
    const p1 = engine.createBlock(BLOCK_TYPES.PARAGRAPH, '');
    const pb1 = engine.createBlock(BLOCK_TYPES.PAGE_BREAK, '');
    const p2 = engine.createBlock(BLOCK_TYPES.PARAGRAPH, '');
    const pb2 = engine.createBlock(BLOCK_TYPES.PAGE_BREAK, '');
    const p3 = engine.createBlock(BLOCK_TYPES.PARAGRAPH, '');

    const pages = engine._layoutBlocksIntoPages([p1, pb1, p2, pb2, p3]);
    expect(pages.length).toBe(3);
    expect(pages[0].blocks).toEqual([p1, pb1]);
    expect(pages[1].blocks).toEqual([p2, pb2]);
    expect(pages[2].blocks).toEqual([p3]);
  });

  test('_layoutBlocksIntoPages seeds an empty paragraph if trailing page is empty', () => {
    const p1 = engine.createBlock(BLOCK_TYPES.PARAGRAPH, 'Page 1');
    const pb1 = engine.createBlock(BLOCK_TYPES.PAGE_BREAK, '');

    // Layout where page break is the last block
    const pages = engine._layoutBlocksIntoPages([p1, pb1]);
    expect(pages.length).toBe(2);
    expect(pages[0].blocks).toEqual([p1, pb1]);
    // Trailing page should have been auto-seeded with an empty paragraph
    expect(pages[1].blocks.length).toBe(1);
    expect(pages[1].blocks[0].type).toBe(BLOCK_TYPES.PARAGRAPH);
  });

  test('ContentChangeHandler syncDOMToBlocks recognizes page break markers', () => {
    const handler = new ContentChangeHandler(engine);
    const container = document.createElement('div');
    container.className = 'document-renderer';
    const page = document.createElement('div');
    page.className = 'page';
    const pageContent = document.createElement('div');
    pageContent.className = 'page-content';

    const p = document.createElement('p');
    p.setAttribute('data-block-id', 'b1');
    p.textContent = 'Hello World';

    const pb = document.createElement('div');
    pb.setAttribute('data-block-id', 'b2');
    pb.className = 'page-break-marker';
    pb.setAttribute('data-page-break', 'true');

    pageContent.appendChild(p);
    pageContent.appendChild(pb);
    page.appendChild(pageContent);
    container.appendChild(page);

    handler.syncDOMToBlocks(container);

    const allBlocks = engine.getAllBlocks();
    expect(allBlocks.length).toBe(2);
    expect(allBlocks[0].id).toBe('b1');
    expect(allBlocks[0].type).toBe(BLOCK_TYPES.PARAGRAPH);
    expect(allBlocks[1].id).toBe('b2');
    expect(allBlocks[1].type).toBe(BLOCK_TYPES.PAGE_BREAK);
  });

  test('HTMLToBlocksParser preserves page breaks and empty pages when saving/loading drafts', () => {
    const { HTMLToBlocksParser } = require('../PasteHandler');
    const parser = new HTMLToBlocksParser(engine);

    // Exact user scenario: 2 empty pages, 3rd page with text, serialized to HTML as a draft
    const draftHtml = [
      '<p data-block-id="b1"><br></p>',
      '<div data-block-id="b2" data-page-break="true" class="page-break-marker" contenteditable="false" style="height:0px;margin:0;padding:0;line-height:0;overflow:hidden;"></div>',
      '<p data-block-id="b3"><br></p>',
      '<div data-block-id="b4" data-page-break="true" class="page-break-marker" contenteditable="false" style="height:0px;margin:0;padding:0;line-height:0;overflow:hidden;"></div>',
      '<p data-block-id="b5">Page 3 typed text</p>'
    ].join('');

    const parsedBlocks = parser.parseHTML(draftHtml);
    expect(parsedBlocks.length).toBe(5);
    expect(parsedBlocks[0].type).toBe(BLOCK_TYPES.PARAGRAPH);
    expect(parsedBlocks[1].type).toBe(BLOCK_TYPES.PAGE_BREAK);
    expect(parsedBlocks[2].type).toBe(BLOCK_TYPES.PARAGRAPH);
    expect(parsedBlocks[3].type).toBe(BLOCK_TYPES.PAGE_BREAK);
    expect(parsedBlocks[4].type).toBe(BLOCK_TYPES.PARAGRAPH);
    expect(parsedBlocks[4].content).toBe('Page 3 typed text');

    // Layout into pages
    const pages = engine._layoutBlocksIntoPages(parsedBlocks);
    expect(pages.length).toBe(3);
    // Page 1: empty paragraph + page break
    expect(pages[0].blocks[0].type).toBe(BLOCK_TYPES.PARAGRAPH);
    expect(pages[0].blocks[1].type).toBe(BLOCK_TYPES.PAGE_BREAK);
    // Page 2: empty paragraph + page break
    expect(pages[1].blocks[0].type).toBe(BLOCK_TYPES.PARAGRAPH);
    expect(pages[1].blocks[1].type).toBe(BLOCK_TYPES.PAGE_BREAK);
    // Page 3: paragraph with text
    expect(pages[2].blocks[0].type).toBe(BLOCK_TYPES.PARAGRAPH);
    expect(pages[2].blocks[0].content).toBe('Page 3 typed text');
  });

  test('_layoutBlocksIntoPages auto-seeds editable paragraph if page has only a page break', () => {
    // Blocks where first two pages only contain page break blocks
    const pb1 = engine.createBlock(BLOCK_TYPES.PAGE_BREAK, '');
    const pb2 = engine.createBlock(BLOCK_TYPES.PAGE_BREAK, '');
    const p3 = engine.createBlock(BLOCK_TYPES.PARAGRAPH, 'Page 3 text');

    const pages = engine._layoutBlocksIntoPages([pb1, pb2, p3]);
    expect(pages.length).toBe(3);
    // Page 1 should auto-seed an empty paragraph before pb1
    expect(pages[0].blocks.length).toBe(2);
    expect(pages[0].blocks[0].type).toBe(BLOCK_TYPES.PARAGRAPH);
    expect(pages[0].blocks[1].type).toBe(BLOCK_TYPES.PAGE_BREAK);
    // Page 2 should auto-seed an empty paragraph before pb2
    expect(pages[1].blocks.length).toBe(2);
    expect(pages[1].blocks[0].type).toBe(BLOCK_TYPES.PARAGRAPH);
    expect(pages[1].blocks[1].type).toBe(BLOCK_TYPES.PAGE_BREAK);
    // Page 3 should contain p3
    expect(pages[2].blocks.length).toBe(1);
    expect(pages[2].blocks[0].content).toBe('Page 3 text');
  });

  test('Page break markers are explicitly contenteditable="false"', () => {
    const pb = engine.createBlock(BLOCK_TYPES.PAGE_BREAK, '');
    const html = engine.blockToHTML(pb);
    expect(html).toContain('contenteditable="false"');
  });

  test('Inserting paragraph below a heading correctly orders blocks before any trailing page break', () => {
    const h1 = engine.createBlock(BLOCK_TYPES.HEADING, 'Heading 1', { level: 1 });
    const pb = engine.createBlock(BLOCK_TYPES.PAGE_BREAK, '');
    engine.document.pages = [
      { id: 'page1', blocks: [h1, pb] },
      { id: 'page2', blocks: [engine.createBlock(BLOCK_TYPES.PARAGRAPH, 'Next Page')] }
    ];

    // Simulate creating paragraph below h1
    const newBlock = engine.createBlock(BLOCK_TYPES.PARAGRAPH, '<br>');
    const targetPage = engine.document.pages[0];
    const h1Idx = targetPage.blocks.findIndex(b => b.id === h1.id);
    targetPage.blocks.splice(h1Idx + 1, 0, newBlock);

    // New block should be right after h1 and before pb
    expect(targetPage.blocks.length).toBe(3);
    expect(targetPage.blocks[0].id).toBe(h1.id);
    expect(targetPage.blocks[1].id).toBe(newBlock.id);
    expect(targetPage.blocks[2].id).toBe(pb.id);
  });
});

