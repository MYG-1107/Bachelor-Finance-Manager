/**
 * CSV serialization helpers.
 * Neutralizes spreadsheet formula prefixes before quoting cells.
 */

export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\\s]*[=+\\-@]/.test(text)) text = `'${text}`;
  return /[",\\n\\r]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

export function serializeCsv(rows) {
  if (!Array.isArray(rows)) throw new TypeError('CSV rows must be an array.');
  return rows.map(row => {
    if (!Array.isArray(row)) throw new TypeError('Each CSV row must be an array.');
    return row.map(csvCell).join(',');
  }).join('\\r\\n');
}
