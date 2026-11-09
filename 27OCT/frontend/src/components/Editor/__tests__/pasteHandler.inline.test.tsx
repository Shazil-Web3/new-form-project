import { DocumentEngine, BLOCK_TYPES } from '../DocumentEngine';
import { HTMLToBlocksParser, PasteHandler } from '../PasteHandler';

describe('PasteHandler inline subscript/superscript grouping', () => {
  let engine;
  let parser;
  let pasteHandler;

  beforeEach(() => {
    engine = new DocumentEngine();
    parser = new HTMLToBlocksParser(engine);
    pasteHandler = new PasteHandler(engine);
  });

  test('Wikipedia chem-formula span H<sub>2</sub>O stays one paragraph with sub', () => {
    const html = '<!--StartFragment--><span class="chemf nowrap">H<sub>2</sub>O</span><!--EndFragment-->';
    const blocks = parser.parseHTML(html);
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe(BLOCK_TYPES.PARAGRAPH);
    expect(blocks[0].content).toContain('<sub>');
    expect(blocks[0].content.replace(/<[^>]*>/g, '')).toBe('H2O');
  });

  test('unwrapped H + sub + O siblings stay one paragraph', () => {
    const html = 'H<sub>2</sub>O';
    const blocks = parser.parseHTML(html);
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe(BLOCK_TYPES.PARAGRAPH);
    expect(blocks[0].content).toMatch(/H<sub[^>]*>2<\/sub>O/);
  });

  test('full sentence with subscript stays one paragraph', () => {
    const html = '<p><span class="chemf nowrap">H<sub>2</sub>O</span> is the chemical formula for water.</p>';
    const blocks = parser.parseHTML(html);
    expect(blocks.length).toBe(1);
    expect(blocks[0].content).toContain('<sub>');
    expect(blocks[0].content).toContain('chemical formula');
  });

  test('heading with subscript stays one heading block', () => {
    const html = '<h1>H<sub>2</sub>O (disambiguation)</h1>';
    const blocks = parser.parseHTML(html);
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe(BLOCK_TYPES.HEADING);
    expect(blocks[0].content).toContain('<sub>');
  });

  test('CSS vertical-align sub is promoted to <sub>', () => {
    const html = 'H<span style="vertical-align:sub;font-size:80%">2</span>O';
    const blocks = parser.parseHTML(html);
    expect(blocks.length).toBe(1);
    expect(blocks[0].content).toContain('<sub');
    expect(blocks[0].content.replace(/<[^>]*>/g, '')).toBe('H2O');
  });

  test('table cell paste does not insert <br> between H, 2, and O', () => {
    const html = 'H<sub>2</sub>O';
    const cellHtml = pasteHandler.parseHTMLForCell(html);
    expect(cellHtml).not.toMatch(/<br/i);
    expect(cellHtml).toMatch(/H<sub[^>]*>2<\/sub>O/);
  });
});
