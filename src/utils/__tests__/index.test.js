import { describe, it, expect } from 'vitest';
import { parseError, unwrapList, translitSlug } from '../index';

describe('parseError', () => {
  it('returns a fixed message for 403 without detail', () => {
    expect(parseError({}, 403)).toBe('Недостаточно прав');
  });

  it('prefers data.detail on 403 when present', () => {
    expect(parseError({ detail: 'Нет доступа к отделу' }, 403)).toBe('Нет доступа к отделу');
  });

  it('returns data.detail for non-403 statuses when present', () => {
    expect(parseError({ detail: 'Не найдено' }, 404)).toBe('Не найдено');
  });

  it('flattens DRF-style field errors into a joined string', () => {
    const data = { email: ['Обязательное поле'], password: ['Слишком короткий', 'Нужна цифра'] };
    expect(parseError(data, 400)).toBe('Обязательное поле, Слишком короткий, Нужна цифра');
  });

  it('falls back to a generic message for non-object data', () => {
    expect(parseError(null, 500)).toBe('Неизвестная ошибка');
    expect(parseError('plain text', 500)).toBe('Неизвестная ошибка');
  });
});

describe('unwrapList', () => {
  it('returns the array as-is when data is already an array', () => {
    expect(unwrapList([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('unwraps a paginated {results: [...]} response', () => {
    expect(unwrapList({ results: [1, 2] })).toEqual([1, 2]);
  });

  it('returns [] for a paginated response without results', () => {
    expect(unwrapList({})).toEqual([]);
  });

  it('returns [] for null/undefined', () => {
    expect(unwrapList(null)).toEqual([]);
    expect(unwrapList(undefined)).toEqual([]);
  });
});

describe('translitSlug', () => {
  it('кириллица → латиница, пробелы → _', () => {
    expect(translitSlug('Вид нагрева')).toBe('vid_nagreva');
    expect(translitSlug('Исполнение')).toBe('ispolnenie');
    expect(translitSlug('Щётка')).toBe('shchetka');
  });
  it('мусор вычищается, смешанный текст сохраняется, пусто → пусто', () => {
    expect(translitSlug('  IP-класс (2) ')).toBe('ip_klass_2');
    expect(translitSlug('Mount Type!')).toBe('mount_type');
    expect(translitSlug(null)).toBe('');
  });
});
