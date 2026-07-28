import { describe, it, expect } from 'vitest';
import { parseError } from '../index';

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
