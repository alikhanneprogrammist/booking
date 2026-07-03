import {describe, expect, it} from 'vitest';
import {bookingInput} from '@/lib/bookings';

describe('bookingInput (Zod)', () => {
  const valid = {
    resourceId: 'r-1',
    clientId: 'c-1',
    startAt: '2026-07-03T05:00:00.000Z',
    endAt: '2026-07-03T09:00:00.000Z',
  };

  it('минимальный валидный ввод: даты коэрсятся, дефолты подставляются', () => {
    const d = bookingInput.parse(valid);
    expect(d.startAt).toBeInstanceOf(Date);
    expect(d.status).toBe('NEW');
    expect(d.tariff).toBe('HOURLY');
    expect(d.addons).toEqual([]);
  });

  it('отрицательные суммы отбиваются', () => {
    expect(() => bookingInput.parse({...valid, total: -1})).toThrow();
    expect(() => bookingInput.parse({...valid, deposit: -1})).toThrow();
    expect(() => bookingInput.parse({...valid, discountValue: -1})).toThrow();
  });

  it('комментарий ограничен 2000 символами', () => {
    expect(() => bookingInput.parse({...valid, comment: 'x'.repeat(2001)})).toThrow();
    expect(bookingInput.parse({...valid, comment: 'x'.repeat(2000)}).comment).toHaveLength(2000);
  });

  it('неизвестный статус отбивается', () => {
    expect(() => bookingInput.parse({...valid, status: 'MAYBE'})).toThrow();
  });

  describe('partial() для патчей updateBooking', () => {
    it('валидация заданных полей сохраняется', () => {
      expect(() => bookingInput.partial().parse({total: -5})).toThrow();
      expect(bookingInput.partial().parse({total: 100}).total).toBe(100);
    });

    it('ГОТЧА: .partial() ПОДСТАВЛЯЕТ дефолты для отсутствующих ключей — ' +
       'updateBooking обязан фильтровать по ключам исходного патча', () => {
      const parsed = bookingInput.partial().parse({total: 100});
      // если это поведение Zod изменится, фильтр в updateBooking можно упростить
      expect(parsed.status).toBe('NEW');
      expect(parsed.addons).toEqual([]);
      // сама защита: фильтрация по `k in rawInput` оставляет только total
      const filtered = Object.fromEntries(Object.entries(parsed).filter(([k]) => k in {total: 100}));
      expect(Object.keys(filtered)).toEqual(['total']);
    });
  });
});
