/**
 * @file csvUtils.js
 * @description Secure CSV generation utilities with protection against CSV / Formula Injection (SEC-FE-07 / CWE-1236).
 */

/**
 * Escapes a cell value for safe CSV output.
 * If the value begins with a spreadsheet formula prefix (=, +, -, @, tab, CR),
 * it is prefixed with a single quote (') so that spreadsheet programs treat it as text.
 *
 * @param {any} value - Cell value to escape
 * @returns {string} Escaped CSV field surrounded by quotes
 */
export const sanitizeCsvCell = (value) => {
  if (value === null || value === undefined) {
    return '""';
  }
  let str = String(value);
  
  // Neutralize CSV formula execution characters
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  
  // Escape double quotes and enclose in quotes
  return `"${str.replace(/"/g, '""')}"`;
};

export default sanitizeCsvCell;
