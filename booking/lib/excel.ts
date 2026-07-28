// Общее оформление эксель-выгрузок (exceljs, клиент): единый стиль для
// предоплат, доставки и посещаемости — шапки с заливкой, границы, денежный
// формат, итоговые строки, скачивание в браузере.
import type * as ExcelJS from 'exceljs';

export const MONEY_FMT = '#,##0\\ "₸"';

const BORDER: Partial<ExcelJS.Borders> = {
  top: {style: 'thin', color: {argb: 'FFCBD5E1'}},
  left: {style: 'thin', color: {argb: 'FFCBD5E1'}},
  bottom: {style: 'thin', color: {argb: 'FFCBD5E1'}},
  right: {style: 'thin', color: {argb: 'FFCBD5E1'}},
};

export async function newWorkbook(): Promise<ExcelJS.Workbook> {
  const {Workbook} = await import('exceljs');
  return new Workbook();
}

/** Крупный заголовок листа (первая строка, слитая на width колонок). */
export function addTitle(ws: ExcelJS.Worksheet, text: string, width: number) {
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, Math.max(2, width));
  row.getCell(1).font = {bold: true, size: 13};
  row.height = 22;
}

/** Строка-шапка таблицы: белый жирный текст на тёмной заливке, по центру. */
export function addHeader(ws: ExcelJS.Worksheet, cells: Array<string | number>) {
  const row = ws.addRow(cells);
  row.eachCell({includeEmpty: true}, (c) => {
    c.font = {bold: true, color: {argb: 'FFFFFFFF'}, size: 10};
    c.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FF334155'}};
    c.alignment = {horizontal: 'center', vertical: 'middle', wrapText: true};
    c.border = BORDER;
  });
  row.height = 20;
  return row;
}

/** Обычная строка данных: границы + зебра по чётным строкам. */
export function addDataRow(ws: ExcelJS.Worksheet, cells: unknown[], zebra: boolean) {
  const row = ws.addRow(cells as ExcelJS.CellValue[]);
  row.eachCell({includeEmpty: true}, (c) => {
    c.border = BORDER;
    if (zebra) c.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFF8FAFC'}};
  });
  return row;
}

/** Итоговая строка: жирная на светло-серой заливке. */
export function addTotalRow(ws: ExcelJS.Worksheet, cells: unknown[], argb = 'FFE2E8F0') {
  const row = ws.addRow(cells as ExcelJS.CellValue[]);
  row.eachCell({includeEmpty: true}, (c) => {
    c.font = {bold: true, size: 10};
    c.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb}};
    c.border = BORDER;
  });
  return row;
}

/** Денежный формат для колонок (1-based индексы), начиная со строки fromRow. */
export function moneyColumns(ws: ExcelJS.Worksheet, cols: number[], fromRow: number) {
  for (const col of cols) {
    ws.getColumn(col).eachCell({includeEmpty: false}, (c, rowNum) => {
      if (rowNum >= fromRow && typeof c.value === 'number') c.numFmt = MONEY_FMT;
    });
  }
}

/** Заливка-теплокарта: белый → оранжевый по доле 0..1 (для отчёта по районам). */
export function heatFill(share: number): ExcelJS.Fill {
  const t = Math.max(0, Math.min(1, share));
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  const [r, g, b] = [mix(255, 249), mix(255, 115), mix(255, 22)]; // fff → f97316
  const hex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return {type: 'pattern', pattern: 'solid', fgColor: {argb: `FF${hex(r)}${hex(g)}${hex(b)}`}};
}

/** Скачивание книги в браузере. */
export async function saveWorkbook(wb: ExcelJS.Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
