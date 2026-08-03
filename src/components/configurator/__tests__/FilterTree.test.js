import { describe, it, expect } from 'vitest';
import { byNumericValue } from '../FilterTree.jsx';

describe('byNumericValue', () => {
    it('сортирует числовые label по значению, включая запятую как разделитель', () => {
        const items = [{ label: '10' }, { label: '2' }, { label: '1,5' }];
        expect([...items].sort(byNumericValue).map(i => i.label)).toEqual(['1,5', '2', '10']);
    });

    it('числовые всегда идут раньше нечисловых', () => {
        const items = [{ label: 'абв' }, { label: '5' }, { label: 'ааа' }, { label: '1' }];
        const sorted = [...items].sort(byNumericValue).map(i => i.label);
        expect(sorted.slice(0, 2)).toEqual(['1', '5']);
        expect(sorted.slice(2)).toEqual(['ааа', 'абв']);
    });

    it('оба нечисловые — сравнение по локали ru', () => {
        const items = [{ label: 'Я' }, { label: 'А' }, { label: 'Б' }];
        expect([...items].sort(byNumericValue).map(i => i.label)).toEqual(['А', 'Б', 'Я']);
    });
});
