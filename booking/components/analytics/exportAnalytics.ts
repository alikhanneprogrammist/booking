// Выгрузка аналитики в .xlsx: один лист, секции таблицами друг под другом.
// Данные и подписи готовит AnalyticsView (там есть t() и словари названий),
// здесь — только универсальная вёрстка через хелперы lib/excel.ts.
import {MONEY_FMT} from '@/lib/excel';

export interface ExportSection {
  title: string;
  header: string[];
  rows: Array<Array<string | number>>;
  /** 1-based индексы колонок с деньгами (формат "# ##0 ₸"). */
  moneyCols?: number[];
  /** Итоговая строка (опционально). */
  total?: Array<string | number>;
}

export async function exportAnalytics(opts: {
  fileName: string;
  sheetName: string;
  title: string;
  sections: ExportSection[];
}) {
  const {newWorkbook, addTitle, addHeader, addDataRow, addTotalRow, saveWorkbook} =
    await import('@/lib/excel');
  const wb = await newWorkbook();
  const ws = wb.addWorksheet(opts.sheetName);
  const width = Math.max(...opts.sections.map((s) => s.header.length));

  addTitle(ws, opts.title, width);

  const applyMoney = (row: import('exceljs').Row, moneyCols?: number[]) => {
    for (const col of moneyCols ?? []) {
      const c = row.getCell(col);
      if (typeof c.value === 'number') c.numFmt = MONEY_FMT;
    }
  };

  for (const s of opts.sections) {
    ws.addRow([]); // пустая строка-разделитель между секциями
    const head = ws.addRow([s.title]);
    head.getCell(1).font = {bold: true, size: 11};
    addHeader(ws, s.header);
    s.rows.forEach((r, i) => applyMoney(addDataRow(ws, r, i % 2 === 1), s.moneyCols));
    if (s.total) applyMoney(addTotalRow(ws, s.total), s.moneyCols);
  }

  ws.columns = [{width: 28}, {width: 14}, {width: 16}, {width: 16}];
  await saveWorkbook(wb, opts.fileName);
}
