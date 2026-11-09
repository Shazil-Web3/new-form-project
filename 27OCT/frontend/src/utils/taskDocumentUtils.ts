import { sanitizeCsvCell } from './csvUtils';

export const buildCsvFromDocumentContent = (documentData) => {
  const content = documentData?.content || documentData?.document_content || '';
  const contentText = typeof content === 'string' ? content : JSON.stringify(content || {}, null, 2);
  const rows = contentText
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      const columns = line.split(',').map((value) => value.trim());
      return columns.join(' ');
    });

  const header = ['title', 'content'].map(sanitizeCsvCell).join(',');
  const rowData = [
    documentData?.title || 'Document',
    rows.join(' ').replace(/\s+/g, ' ')
  ].map(sanitizeCsvCell).join(',');

  return [header, rowData].join('\n');
};
