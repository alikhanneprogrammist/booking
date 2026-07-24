// Юнит-тесты чистой доменной логики (без БД). Запуск: npx tsx scripts/test-domain.ts
import {durationHours, isWeekend, intervalsOverlap, fromAlmaty} from '../lib/time';
import {computePrice, type PricingResource} from '../lib/pricing';
import {formatPhoneDraft, normalizePhone} from '../lib/phone';
import {mergeTags} from '../lib/tags';

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

console.log(failed === 0 ? '\nВСЕ ТЕСТЫ ПРОЙДЕНЫ ✅' : `\n${failed} ТЕСТ(ОВ) УПАЛО ❌`);
process.exit(failed === 0 ? 0 : 1);
