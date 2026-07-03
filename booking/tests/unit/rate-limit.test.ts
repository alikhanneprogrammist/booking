import {describe, expect, it} from 'vitest';
import {rateLimited, WINDOW_MS, GLOBAL_LIMIT} from '@/lib/rate-limit';

// Журнал лимитера — модульное состояние: тесты используют далеко разнесённые
// временные окна и уникальные IP, чтобы не влиять друг на друга.

describe('rateLimited', () => {
  it('5 заявок с одного IP проходят, шестая — отбой', () => {
    const t0 = 1_000_000_000_000;
    const results = Array.from({length: 6}, (_, i) => rateLimited('ip-a', t0 + i * 1000));
    expect(results).toEqual([false, false, false, false, false, true]);
  });

  it('после истечения окна лимит снимается', () => {
    const t0 = 2_000_000_000_000;
    for (let i = 0; i < 5; i++) rateLimited('ip-b', t0 + i);
    expect(rateLimited('ip-b', t0 + 1000)).toBe(true);
    expect(rateLimited('ip-b', t0 + WINDOW_MS + 1)).toBe(false);
  });

  it('глобальный потолок: суммарно не больше GLOBAL_LIMIT за окно', () => {
    const t0 = 3_000_000_000_000;
    let allowed = 0;
    for (let i = 0; i < GLOBAL_LIMIT + 10; i++) {
      if (!rateLimited(`ip-c-${i}`, t0 + i)) allowed += 1;
    }
    expect(allowed).toBe(GLOBAL_LIMIT);
  });

  it('отбитая попытка не продлевает окно', () => {
    const t0 = 4_000_000_000_000;
    for (let i = 0; i < 5; i++) rateLimited('ip-d', t0 + i);
    // отбой в конце окна не должен «освежить» счётчик
    rateLimited('ip-d', t0 + WINDOW_MS - 1);
    expect(rateLimited('ip-d', t0 + WINDOW_MS + 1)).toBe(false);
  });
});
