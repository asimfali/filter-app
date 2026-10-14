import { describe, it, expect } from 'vitest';
import { byNumericValue, attachSummary, withoutSkipped } from '../FilterTree.jsx';

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

describe('attachSummary', () => {
    it('без пропусков — только итог привязки', () => {
        expect(attachSummary({ axes: 2, created: 3, updated: 1, skipped: 0, conflicts: [] }))
            .toBe('Привязано к 2 осям: создано 3, обновлено 1');
    });

    it('частичный пропуск — число и первый конфликт', () => {
        expect(attachSummary({
            axes: 2, created: 0, updated: 5, skipped: 207,
            conflicts: [{ product_id: 1, axis_id: 3, axis_name: 'Дизайн', current_value: 'Комфорт', requested_value: 'Комфорт Плюс' }],
        })).toBe('Привязано к 2 осям: создано 0, обновлено 5; пропущено 207: другое значение оси «Дизайн» («Комфорт» вместо «Комфорт Плюс»)');
    });

    it('старый ответ без skipped/conflicts — как раньше', () => {
        expect(attachSummary({ axes: 1, created: 1, updated: 0 })).toBe('Привязано к 1 осям: создано 1, обновлено 0');
    });
});

describe('withoutSkipped', () => {
    it('убирает пропущенные товары, сравнивая id как строки', () => {
        expect(withoutSkipped(['1', 2, '3'], [2, 3])).toEqual(['1']);
    });

    it('без skipped_ids (старый ответ) — все товары', () => {
        expect(withoutSkipped([1, 2])).toEqual([1, 2]);
    });
});
