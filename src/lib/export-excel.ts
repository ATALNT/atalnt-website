import * as XLSX from 'xlsx';

/**
 * Export an array of objects to an Excel (.xlsx) file and trigger download.
 * @param data - Array of row objects
 * @param headers - Array of { key, label } for column mapping
 * @param filename - File name without extension
 * @param sheetName - Optional worksheet name (default "Sheet1")
 */
export function exportToExcel(
  data: Record<string, any>[],
  headers: { key: string; label: string }[],
  filename: string,
  sheetName = 'Sheet1',
) {
  // Build rows with header labels
  const rows = data.map((row) => {
    const obj: Record<string, any> = {};
    headers.forEach(({ key, label }) => {
      obj[label] = row[key] ?? '';
    });
    return obj;
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-size columns based on header + content width
  const colWidths = headers.map(({ label, key }) => {
    let max = label.length;
    data.forEach((row) => {
      const val = String(row[key] ?? '');
      if (val.length > max) max = val.length;
    });
    return { wch: Math.min(max + 2, 50) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
