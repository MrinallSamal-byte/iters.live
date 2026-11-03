/**
 * CSV export helpers.
 *
 * Exports are opened in Excel/Sheets by staff. A cell that starts with `=`,
 * `+`, `-`, `@`, a tab or a carriage return is evaluated as a formula there,
 * so user-controlled text (names, remarks, ...) would let any student plant
 * formulas in an admin's spreadsheet. Such cells are prefixed with a single
 * quote, which spreadsheets render as plain text.
 */

const { stringify } = require('csv-stringify/sync');

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

function neutralizeCell(value) {
  if (typeof value !== 'string') return value;
  return FORMULA_TRIGGER.test(value) ? `'${value}` : value;
}

/**
 * @param {Array<object>} rows
 * @param {string[]} columns  keys, in output order (also used as the header)
 * @returns {string}
 */
function toSafeCsv(rows, columns) {
  const safeRows = rows.map((row) => {
    const safe = {};
    for (const column of columns) {
      const value = row[column];
      safe[column] = value === undefined || value === null ? '' : neutralizeCell(value);
    }
    return safe;
  });

  return stringify(safeRows, { header: true, columns });
}

module.exports = { toSafeCsv, neutralizeCell };
