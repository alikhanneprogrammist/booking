// Юнит-тесты чистой доменной логики (без БД). Запуск: npx tsx scripts/test-domain.ts
import {durationHours, isWeekend, intervalsOverlap, fromAlmaty} from '../lib/time';
import {computePrice, type PricingResource} from '../lib/pricing';
import {formatPhoneDraft, normalizePhone} from '../lib/phone';
import {mergeTags} from '../lib/tags';
import {shiftStart, shiftAnchor} from '../lib/calendar';
import {monthDays, rowTotals, parseMonthParam, shiftMonth} from '../lib/timesheet';

let failed = 0;
function check(name: string, cond: boolean, got?: unknown) {
  const ok = cond ? 'PASS' : 'FAIL';
  if (!cond) failed++;
  console.log(`  [${ok}] ${name}${cond ? '' : `  (got: ${JSON.stringify(got)})`}`);
}

// «7 VIP» из ТЗ §5.8
const vip7: PricingResource = {
  hourlyPrice: 35000,
  minHours: 3,
  halfDayPrice: 150000,
  fullDayPrice: 300000,
  weekendPrice: 300000,
  weekdayMinDeposit: null,
  capacity: 22,
};

const D = (iso: string) => new Date(iso);

console.log('time.ts');
check('длительность 22:00→02:00 = 4ч',
  durationHours(D('2026-06-22T22:00:00Z'), D('2026-06-23T02:00:00Z')) === 4);
check('пт (19.06) — выходной', isWeekend(fromAlmaty(new Date(2026, 5, 19, 20))) === true);
check('сб (20.06) — выходной', isWeekend(fromAlmaty(new Date(2026, 5, 20, 12))) === true);
check('вс (21.06) — будни', isWeekend(fromAlmaty(new Date(2026, 5, 21, 12))) === false);
check('пн (22.06) — будни', isWeekend(fromAlmaty(new Date(2026, 5, 22, 12))) === false);

console.log('intervalsOverlap (§9 п.3, п.5)');
check('20–22 и 22–23 НЕ пересекаются (граница)',
  intervalsOverlap(D('2026-06-22T20:00:00Z'), D('2026-06-22T22:00:00Z'),
                   D('2026-06-22T22:00:00Z'), D('2026-06-22T23:00:00Z')) === false);
check('22–02 и 23–00:30 пересекаются (через полночь)',
  intervalsOverlap(D('2026-06-22T22:00:00Z'), D('2026-06-23T02:00:00Z'),
                   D('2026-06-22T23:00:00Z'), D('2026-06-23T00:30:00Z')) === true);

console.log('pricing.ts (§9 п.7, п.8)');
const day = computePrice(vip7, 'FULL_DAY', D('2026-06-22T14:00:00Z'), D('2026-06-23T14:00:00Z'));
check('тариф «Сутки» → 300 000', day.total === 300000, day.total);

const hourly = computePrice(vip7, 'HOURLY', D('2026-06-22T22:00:00Z'), D('2026-06-23T02:00:00Z'));
check('почасовой 4ч → 140 000', hourly.total === 140000, hourly.total);

const withAddons = computePrice(
  vip7, 'FULL_DAY', D('2026-06-22T14:00:00Z'), D('2026-06-23T14:00:00Z'),
  [{price: 15000, qty: 1}, {price: 20000, qty: 1}], // кальян + СПА
);
check('сутки + кальян + СПА → 335 000', withAddons.total === 335000, withAddons.total);

const overCap = computePrice(vip7, 'FULL_DAY', D('2026-06-22T14:00:00Z'), D('2026-06-23T14:00:00Z'), [], 30);
check('гости сверх вместимости → предупреждение, не блок', overCap.warnings.length === 1, overCap.warnings);

console.log('calendar.ts (смена 10:00→10:00)');
{
  const at = (y: number, mo: number, d: number, h: number) => fromAlmaty(new Date(y, mo - 1, d, h, 0));
  check('03:00 27.07 → смена 26.07 10:00',
    shiftStart(at(2026, 7, 27, 3)).getTime() === at(2026, 7, 26, 10).getTime(),
    shiftStart(at(2026, 7, 27, 3)).toISOString());
  check('12:00 27.07 → смена 27.07 10:00',
    shiftStart(at(2026, 7, 27, 12)).getTime() === at(2026, 7, 27, 10).getTime());
  check('ровно 10:00 → своя смена',
    shiftStart(at(2026, 7, 27, 10)).getTime() === at(2026, 7, 27, 10).getTime());
  check('09:59 → вчерашняя смена',
    shiftStart(at(2026, 7, 27, 9)).getTime() === at(2026, 7, 26, 10).getTime());
  check('shiftAnchor: полночь + 10ч',
    shiftAnchor(at(2026, 7, 27, 0)).getTime() === at(2026, 7, 27, 10).getTime());
}

console.log('phone.ts (статичный +7 и иностранные номера)');
check('пусто → +7', formatPhoneDraft('') === '+7', formatPhoneDraft(''));
check('8701… → +7701…', formatPhoneDraft('87011234567') === '+77011234567', formatPhoneDraft('87011234567'));
check('голая вставка 10 цифр → +7…', formatPhoneDraft('7011234567') === '+77011234567', formatPhoneDraft('7011234567'));
check('чужой код: +996 остаётся', formatPhoneDraft('+996700123456') === '+996700123456', formatPhoneDraft('+996700123456'));
check('вставка +996 после +7 чистит префикс',
  formatPhoneDraft('+7+996 700 123 456', '+7') === '+996700123456', formatPhoneDraft('+7+996 700 123 456', '+7'));
check('вставка +7707 после +7 не двоит префикс',
  formatPhoneDraft('+7+7 707 123 45 67', '+7') === '+77071234567', formatPhoneDraft('+7+7 707 123 45 67', '+7'));
check('стирание +996 не дорисовывает 7', formatPhoneDraft('+99670012345', '+996700123456') === '+99670012345');
check('одинокий «+» остаётся (набор +996 посимвольно)', formatPhoneDraft('+', '+9') === '+', formatPhoneDraft('+', '+9'));
check('после «+» цифра 9 → +9 (не +79)', formatPhoneDraft('+9', '+') === '+9', formatPhoneDraft('+9', '+'));
check('стёрли всё → снова +7', formatPhoneDraft('', '+') === '+7', formatPhoneDraft('', '+'));
check('normalize: 8701… → +7701…', normalizePhone('8 701 123 45 67') === '+77011234567');
check('normalize: 10 цифр → +7…', normalizePhone('701 123 45 67') === '+77011234567');
check('normalize: +996 как есть', normalizePhone('+996 700 123 456') === '+996700123456');
check('normalize: +81 (Япония) не превращается в +71', normalizePhone('+81 90 1234 5678') === '+819012345678', normalizePhone('+81 90 1234 5678'));

console.log('tags.ts (теги брони добавляются к тегам клиента, не заменяют)');
check('новый тег сохраняет существующие: инста + VIP',
  JSON.stringify(mergeTags(['инста'], ['VIP'])) === JSON.stringify(['инста', 'VIP']),
  mergeTags(['инста'], ['VIP']));
check('дубликат без учёта регистра: VIP + vip → VIP',
  JSON.stringify(mergeTags(['VIP'], ['vip'])) === JSON.stringify(['VIP']),
  mergeTags(['VIP'], ['vip']));
check('точный дубликат не двоится',
  JSON.stringify(mergeTags(['инста', 'VIP'], ['VIP', 'Сегмент A'])) ===
    JSON.stringify(['инста', 'VIP', 'Сегмент A']),
  mergeTags(['инста', 'VIP'], ['VIP', 'Сегмент A']));
check('пустой incoming → существующие без изменений',
  JSON.stringify(mergeTags(['инста'], [])) === JSON.stringify(['инста']));
check('пустой existing → только новые',
  JSON.stringify(mergeTags([], ['VIP'])) === JSON.stringify(['VIP']));

console.log('timesheet.ts (вкладка «Табель»)');
{
  const july = monthDays(2026, 7);
  check('июль 2026 — 31 день', july.length === 31, july.length);
  check('3 июля 2026 (пт) — выходной', july[2].isWeekend === true);
  check('4 июля 2026 (сб) — выходной', july[3].isWeekend === true);
  check('5 июля 2026 (вс) — будни', july[4].isWeekend === false);
  check('февраль 2028 (високосный) — 29 дней', monthDays(2028, 2).length === 29);

  const tot = rowTotals({1: 12, 3: 24, 5: 9});
  check('итог строки: 3 дня, 45 часов', tot.days === 3 && tot.hours === 45, tot);
  check('пустая строка — нули', JSON.stringify(rowTotals({})) === JSON.stringify({days: 0, hours: 0}));

  const fb = {year: 2026, month: 7};
  check('parseMonthParam: 2026-03 разбирается',
    JSON.stringify(parseMonthParam('2026-03', fb)) === JSON.stringify({year: 2026, month: 3}));
  check('parseMonthParam: мусор → fallback',
    JSON.stringify(parseMonthParam('abc', fb)) === JSON.stringify(fb));
  check('parseMonthParam: 2026-13 → fallback',
    JSON.stringify(parseMonthParam('2026-13', fb)) === JSON.stringify(fb));

  check('shiftMonth: янв −1 → дек прошлого года',
    JSON.stringify(shiftMonth(2026, 1, -1)) === JSON.stringify({year: 2025, month: 12}));
  check('shiftMonth: дек +1 → янв следующего',
    JSON.stringify(shiftMonth(2026, 12, 1)) === JSON.stringify({year: 2027, month: 1}));
}

console.log(failed === 0 ? '\nВСЕ ТЕСТЫ ПРОЙДЕНЫ ✅' : `\n${failed} ТЕСТ(ОВ) УПАЛО ❌`);
process.exit(failed === 0 ? 0 : 1);
