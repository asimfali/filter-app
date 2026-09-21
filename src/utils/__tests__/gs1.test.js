import { describe, it, expect } from 'vitest';
import { gs1Error, fmtGs1Date } from '../gs1';

describe('gs1Error', () => {
    it('берёт message из конверта ошибки', () => {
        expect(gs1Error({ success: false, error: { code: 'invalid_action', message: 'Запись уже сопоставлена' } }, 400))
            .toBe('Запись уже сопоставлена');
    });
    it('403 в формате DRF {detail}', () => {
        expect(gs1Error({ detail: 'Нет доступа' }, 403)).toBe('Нет доступа');
    });
    it('ошибки валидации тела {field: [...]}', () => {
        expect(gs1Error({ product_id: ['Обязательно для assign/replace'] }, 400)).toBe('Обязательно для assign/replace');
    });
    it('пустой ответ', () => {
        expect(gs1Error(null, 500)).toBe('Неизвестная ошибка');
    });
});

describe('fmtGs1Date', () => {
    it('прочерк для пустой даты', () => expect(fmtGs1Date(null)).toBe('—'));
    it('форматирует дату по-русски', () => expect(fmtGs1Date('2026-03-05T10:00:00Z')).toMatch(/05\.03\.2026/));
});
