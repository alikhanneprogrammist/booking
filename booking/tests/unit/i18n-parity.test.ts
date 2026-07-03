import {describe, expect, it} from 'vitest';
import ru from '@/messages/ru.json';
import kk from '@/messages/kk.json';

function keysOf(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object' ? keysOf(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('паритет словарей ru/kk', () => {
  const ruKeys = new Set(keysOf(ru));
  const kkKeys = new Set(keysOf(kk));

  it('нет ключей только в ru', () => {
    expect(Array.from(ruKeys).filter((k) => !kkKeys.has(k))).toEqual([]);
  });
  it('нет ключей только в kk', () => {
    expect(Array.from(kkKeys).filter((k) => !ruKeys.has(k))).toEqual([]);
  });
  it('все значения — непустые строки', () => {
    const empty = (o: Record<string, unknown>, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v !== null && typeof v === 'object'
          ? empty(v as Record<string, unknown>, `${p}${k}.`)
          : typeof v === 'string' && v.trim() !== '' ? [] : [`${p}${k}`],
      );
    expect(empty(ru)).toEqual([]);
    expect(empty(kk)).toEqual([]);
  });
});
