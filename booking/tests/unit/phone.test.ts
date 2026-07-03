import {describe, expect, it} from 'vitest';
import {normalizePhone} from '@/lib/phone';

describe('normalizePhone → +7XXXXXXXXXX', () => {
  it('форматированный номер с +7', () => {
    expect(normalizePhone('+7 701 123-45-67')).toBe('+77011234567');
  });
  it('«восьмёрка» превращается в 7', () => {
    expect(normalizePhone('8 (701) 123 45 67')).toBe('+77011234567');
  });
  it('10 цифр без кода страны получают 7', () => {
    expect(normalizePhone('7011234567')).toBe('+77011234567');
  });
  it('пустая строка и мусор без цифр → пусто', () => {
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone('abc')).toBe('');
  });
});
