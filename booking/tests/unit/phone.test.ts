import {describe, expect, it} from 'vitest';
import {formatPhoneDraft, normalizePhone} from '@/lib/phone';

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

describe('formatPhoneDraft — живой ввод с префиксом +7', () => {
  it('пустое поле и мусор → «+7»', () => {
    expect(formatPhoneDraft('')).toBe('+7');
    expect(formatPhoneDraft('abc')).toBe('+7');
  });
  it('«восьмёрка» превращается в +7', () => {
    expect(formatPhoneDraft('8701')).toBe('+7701');
    expect(formatPhoneDraft('8 (701) 123 45 67')).toBe('+77011234567');
  });
  it('вставка 10 цифр без кода страны получает +7', () => {
    expect(formatPhoneDraft('7011234567')).toBe('+77011234567');
    expect(formatPhoneDraft('(701) 123-45-67')).toBe('+77011234567');
  });
  it('готовый +7-номер проходит без изменений', () => {
    expect(formatPhoneDraft('+77011234567')).toBe('+77011234567');
  });
  it('обрезает всё сверх 11 цифр', () => {
    expect(formatPhoneDraft('+77011234567999')).toBe('+77011234567');
  });
});
