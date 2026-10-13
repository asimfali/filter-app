import { describe, it, expect } from 'vitest';
import { chainSearchValueIds } from '../chainIds';

describe('chainSearchValueIds', () => {
    const node = (id, isRef = false, type = 'value') => ({
        id: () => `value-${id}`,
        data: k => ({ type, is_reference: isRef })[k],
    });
    const klapany = node('1'), seria = node('2'), dkp = node('50', true), dkp2 = node('51', true);

    it('classifier + явно выбранный reference — в поиск уходят оба', () => {
        expect(chainSearchValueIds([klapany, seria, dkp, dkp2], [klapany, dkp])).toEqual(['1', '2', '50']);
    });

    it('выбран только classifier — достижимые reference не уходят', () => {
        expect(chainSearchValueIds([klapany, seria, dkp, dkp2], [klapany])).toEqual(['1', '2']);
    });

    it('выбранный reference вне пересечения всё равно уходит, без дублей', () => {
        expect(chainSearchValueIds([klapany], [klapany, dkp, dkp])).toEqual(['1', '50']);
    });
});
