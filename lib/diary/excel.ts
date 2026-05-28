// XLSX → CSV adapter for the diary importer.
//
// SheetJS is loaded only on the client (this file is imported from a
// "use client" page). For dates we ask SheetJS to render values as
// formatted strings — toIsoDate() in import.ts handles "DD.MM.YYYY".

import * as XLSX from "xlsx";

// Convert the first sheet of an XLSX/XLS workbook to a CSV string that
// importDiaryCsv() can parse. Throws on malformed input.
export async function xlsxFileToCsv(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, {
    type: "array",
    cellDates: false, // dates rendered via formatted strings instead
    cellNF: false,
    cellText: true,
  });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Файл не содержит ни одного листа");
  const sheet = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_csv(sheet, {
    FS: ",",
    blankrows: false,
    rawNumbers: false, // use formatted text so percents/dates survive
  });
}

export function isExcelFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".xlsm");
}

// Apple Numbers files (.numbers) are zipped proprietary XML.
// SheetJS Community can't read them — direct support needs SheetJS Pro
// (paid) or a server-side converter (libreoffice). For now we detect the
// extension and route the user to Numbers' built-in Excel export.
export function isNumbersFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".numbers");
}

export const NUMBERS_EXPORT_INSTRUCTIONS =
  "Файлы .numbers напрямую не поддерживаются. В Apple Numbers: Файл → Экспортировать в → Excel, затем загрузите получившийся .xlsx.";
