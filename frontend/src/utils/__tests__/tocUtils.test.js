import { calculateTOCNumbers } from '../tocUtils';

describe('calculateTOCNumbers', () => {
  it('should return empty array for empty headings', () => {
    expect(calculateTOCNumbers([])).toEqual([]);
    expect(calculateTOCNumbers()).toEqual([]);
  });

  it('should correctly number 3 levels of headings (1, 1.1, 1.1.1)', () => {
    const headings = [
      { tagName: 'h1' },
      { tagName: 'h2' },
      { tagName: 'h3' },
      { tagName: 'h3' },
      { tagName: 'h2' },
      { tagName: 'h3' },
      { tagName: 'h1' },
      { tagName: 'h2' },
      { tagName: 'h3' },
    ];

    const result = calculateTOCNumbers(headings);
    expect(result).toEqual([
      '1',
      '1.1',
      '1.1.1',
      '1.1.2',
      '1.2',
      '1.2.1',
      '2',
      '2.1',
      '2.1.1',
    ]);
  });

  it('should cap headings deeper than level 3 (h4, h5, h6) at level 3', () => {
    const headings = [
      { tagName: 'h1' },
      { tagName: 'h2' },
      { tagName: 'h3' },
      { tagName: 'h4' },
      { tagName: 'h5' },
    ];

    const result = calculateTOCNumbers(headings);
    expect(result).toEqual([
      '1',
      '1.1',
      '1.1.1',
      '1.1.2',
      '1.1.3',
    ]);
  });

  it('should handle starting directly with h2 or h3 gracefully', () => {
    const headings = [
      { tagName: 'h2' },
      { tagName: 'h3' },
      { tagName: 'h1' },
    ];

    const result = calculateTOCNumbers(headings);
    expect(result).toEqual([
      '1.1',
      '1.1.1',
      '2',
    ]);
  });

  it('should handle skipping level 2 (h1 directly followed by h3)', () => {
    const headings = [
      { tagName: 'h1' },
      { tagName: 'h3' },
      { tagName: 'h3' },
      { tagName: 'h2' },
    ];

    const result = calculateTOCNumbers(headings);
    expect(result).toEqual([
      '1',
      '1.1.1',
      '1.1.2',
      '1.2',
    ]);
  });

  it('should work with DOM-like elements or uppercase tagNames', () => {
    const headings = [
      { tagName: 'H1' },
      { tagName: 'H2' },
      { tagName: 'H3' },
    ];

    const result = calculateTOCNumbers(headings);
    expect(result).toEqual([
      '1',
      '1.1',
      '1.1.1',
    ]);
  });
});
