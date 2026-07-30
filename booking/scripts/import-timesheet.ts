/**
 * Разовый импорт табеля из экселя «Табель План-Факт» во вкладку «Табель».
 *
 * Формат листа: шапка до строки «№ | Наименование | …», далее сотрудники,
 * сгруппированные строками-отделами (АУП/Кухня/Сервис/Охрана), колонки
 * 8..38 — часы по дням месяца, конец таблицы — строка «ВСЕГО».
 *
 * Часы пишутся И в план, И в факт (в файле один лист на текущий месяц) —
 * дальше факт правится в приложении. Повторный запуск безопасен (upsert).
 *
 * Запуск:
 *   npx tsx scripts/import-timesheet.ts "<файл.xlsx>" "<имя листа>" <YYYY-MM>
 * По умолчанию: файл «Табель План-Факт 2026год OFFICE июль.xlsx» из корня
 * репо, лист «Июль 2026», месяц 2026-07.
 */
import {PrismaClient} from '@prisma/client';
import ExcelJS from 'exceljs';
import path from 'path';

const prisma = new PrismaClient();

const DEFAULT_FILE = path.resolve(__dirname, '../../Табель План-Факт 2026год OFFICE июль.xlsx');

// Отделы экселя → ключи TIMESHEET_DEPARTMENTS.
const DEPT_MAP: Record<string, string> = {
  'ауп': 'AUP',
  'кухня': 'KITCHEN',
  'сервис': 'SERVICE',
  'охрана': 'SECURITY',
};

const FIRST_DAY_COL = 8; // колонка дня «1»

// Значение ячейки: числа как есть, формулы — их результат, прочее — текст.
function cellValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v && typeof v === 'object' && 'result' in v) return (v as {result: unknown}).result;
  if (v && typeof v === 'object' && 'richText' in v) {
    return (v as {richText: Array<{text: string}>}).richText.map((t) => t.text).join('');
  }
  return v;
}

const asText = (v: unknown): string => (v == null ? '' : String(v).trim());

function asHours(v: unknown): number | null {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 24 ? n : null;
}

async function main() {
  const [, , fileArg, sheetArg, monthArg] = process.argv;
  const file = fileArg || DEFAULT_FILE;
  const sheetName = sheetArg || 'Июль 2026';
  const monthKey = monthArg || '2026-07';

  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) throw new Error(`Месяц должен быть в формате YYYY-MM, получено: ${monthKey}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet(sheetName);
  if (!ws) throw new Error(`Лист «${sheetName}» не найден в ${file}`);

  let dept = 'OTHER';
  let sortOrder = 0;
  let imported = 0;
  let cells = 0;

  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const num = asText(cellValue(row.getCell(1)));
    const position = asText(cellValue(row.getCell(2)));
    const name = asText(cellValue(row.getCell(4)));

    if (position.toUpperCase() === 'ВСЕГО' || name === 'Всего') break;

    // Строка-отдел: без № и Ф.И.О. совпадает с наименованием (АУП/Кухня/…).
    const deptKey = DEPT_MAP[position.toLowerCase()];
    if (!num && deptKey && name === position) {
      dept = deptKey;
      continue;
    }
    // Сотрудник — только строки с числовым № (шапка и служебные строки мимо).
    if (!/^\d+$/.test(num) || !name || !position) continue;

    sortOrder += 1;
    const data = {
      name,
      position,
      department: dept,
      schedule: asText(cellValue(row.getCell(5))) || null,
      shiftHours: asHours(cellValue(row.getCell(6))),
      workPattern: asText(cellValue(row.getCell(7))) || null,
      sortOrder,
      isActive: true,
    };

    const existing = await prisma.employee.findFirst({where: {name, position}});
    const employee = existing
      ? await prisma.employee.update({where: {id: existing.id}, data})
      : await prisma.employee.create({data});
    imported += 1;

    for (let day = 1; day <= daysInMonth; day++) {
      const hours = asHours(cellValue(row.getCell(FIRST_DAY_COL + day - 1)));
      if (hours === null) continue;
      const date = new Date(Date.UTC(year, month - 1, day));
      await prisma.timesheetEntry.upsert({
        where: {employeeId_date: {employeeId: employee.id, date}},
        create: {employeeId: employee.id, date, planHours: hours, factHours: hours, updatedBy: 'импорт из экселя'},
        update: {planHours: hours, factHours: hours, updatedBy: 'импорт из экселя'},
      });
      cells += 1;
    }
    console.log(`  ${dept.padEnd(8)} ${name} — ${position}`);
  }

  console.log(`Готово: сотрудников ${imported}, ячеек часов ${cells} (${monthKey}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
