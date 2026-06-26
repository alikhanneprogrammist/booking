// Юнит-тесты чистой доменной логики (без БД). Запуск: npx tsx scripts/test-domain.ts
import {durationHours, isWeekend, intervalsOverlap, fromAlmaty} from '../lib/time';
import {computePrice, type PricingResource} from '../lib/pricing';

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

console.log(failed === 0 ? '\nВСЕ ТЕСТЫ ПРОЙДЕНЫ ✅' : `\n${failed} ТЕСТ(ОВ) УПАЛО ❌`);
process.exit(failed === 0 ? 0 : 1);
