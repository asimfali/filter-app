import { describe, it, expect } from 'vitest';
import { normTnved, normOkpd2, validateTnved, validateOkpd2, flattenOnecFolders } from '../productCodes';

describe('productCodes', () => {
    it('нормализует ТНВЭД и проверяет 10 цифр', () => {
        expect(normTnved('8537 10 9800')).toBe('8537109800');
        expect(validateTnved('8537109800')).toBe('');
        expect(validateTnved('85371')).not.toBe('');
    });
    it('расставляет точки в ОКПД2 из 9 цифр', () => {
        expect(normOkpd2('271231000')).toBe('27.12.31.000');
        expect(validateOkpd2('27.12.31.000')).toBe('');
        expect(validateOkpd2('27.12')).not.toBe('');
    });
    it('строит плоский список папок с суммами', () => {
        const groups = [
            { path: [{ name: 'A', code: 'a' }, { name: 'B', code: 'b' }], products: 2, missing_codes: 1 },
            { path: [{ name: 'A', code: 'a' }, { name: 'C', code: 'c' }], products: 3, missing_codes: 0 },
        ];
        const flat = flattenOnecFolders(groups);
        expect(flat.map(f => f.code)).toEqual(['a', 'b', 'c']);
        expect(flat[0]).toMatchObject({ products: 5, missing: 1, depth: 0 });
        expect(flat[1].depth).toBe(1);
    });
});
