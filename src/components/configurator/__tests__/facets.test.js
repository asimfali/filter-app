import { describe, it, expect } from 'vitest';
import {
    buildFacetIndex, matches, matchedProducts, activeValues, isDead, deadValues,
    rebuildSelection, pruneOrphanRefs, applyClick, normalizeSelection,
} from '../facets';

// Серия (тег) 4 · Нагрев: E=18 A=19 W=20 · IP: IP54=49 IP20=52 · Сеть: 230=13486 400=13487
// Справочная «Патрубки» (родитель W): 3/4"=93, 1"=94. Справочная PCB-AC (родитель — тег 4): 90
const v = (id, axis) => ({ data: { id: `value-${id}`, type: 'value', axis_id: axis } });
const nodes = [
    { data: { id: 'axis-1', type: 'axis' } },
    v(4, '1'), v(18, '4'), v(19, '4'), v(20, '4'), v(49, '17'), v(52, '17'), v(13486, '9'), v(13487, '9'),
];
const referenceAxes = [
    { axis_id: '30', parent_value_ids: ['20'], values: [{ id: 93 }, { id: 94 }] },
    { axis_id: '29', parent_value_ids: ['4'], values: [{ id: 90 }] },
];
const facetProducts = {
    common: [4],
    products: [
        [1, 1, 18, 52, 13487],
        [2, 0, 18, 52, 13487],
        [3, 1, 20, 52, 13487, 93],
        [4, 0, 20, 52, 13486, 93],
        [5, 0, 20, 52, 13486, 94],
        [6, 1, 19, 52, 13486],
        [7, 0, 19, 13486],          // неполный: нет IP
    ],
};
const idx = buildFacetIndex({ nodes, referenceAxes, facetProducts, tagIds: ['4'] });
const ids = (sel, opts) => matchedProducts(idx, sel, opts).map(p => p.id);

describe('buildFacetIndex', () => {
    it('значения товара = common ∪ хвост, id приводятся к строкам', () => {
        const p3 = idx.products.find(p => p.id === 3);
        expect(Object.fromEntries(p3.vals)).toEqual({ 1: '4', 4: '20', 17: '52', 9: '13487', 30: '93' });
        expect(p3.parent).toBe(true);
        expect(idx.graphAxes).toEqual(new Set(['1', '4', '17', '9']));
        expect(idx.refAxes).toEqual(new Set(['30', '29']));
    });
});

describe('matches / matchedProducts (правило 1, 8)', () => {
    it('внутри оси — «или», между осями — «и»', () => {
        expect(ids(['20'])).toEqual([3, 4, 5]);
        expect(ids(['20', '19'])).toEqual([3, 4, 5, 6]);
        expect(ids(['20', '13486'])).toEqual([4, 5]);
    });

    it('без галочки неполный товар не подходит, с галочкой — подходит и при отсутствии оси', () => {
        expect(ids(['19'])).toEqual([6]);
        expect(ids(['19'], { partial: true })).toEqual([6, 7]);
        expect(ids(['52'], { partial: true })).toContain(7);
    });

    it('reference — жёсткое сужение, галочка не действует', () => {
        expect(ids(['20', '93'], { partial: true })).toEqual([3, 4]);
        expect(matches(idx, idx.products[4], ['20', '93'], true)).toBe(false);
    });

    it('parentsOnly — только is_parent=1', () => {
        expect(ids(['52'], { parentsOnly: true })).toEqual([1, 3, 6]);
    });
});

describe('activeValues (правило 2)', () => {
    it('при W активны A (другая ветка той же оси) и патрубки; при W+3/4" A неактивен', () => {
        const a1 = activeValues(idx, ['20'], false);
        expect(a1.has('19')).toBe(true);
        expect(a1.has('93')).toBe(true);
        const a2 = activeValues(idx, ['20', '93'], false);
        expect(a2.has('19')).toBe(false);
        expect(a2.has('13486')).toBe(true);
    });

    it('при E неактивен 230 В', () => {
        expect(activeValues(idx, ['18'], false).has('13486')).toBe(false);
        expect(activeValues(idx, ['18'], false).has('13487')).toBe(true);
    });
});

describe('isDead / deadValues (правило 3)', () => {
    it('IP54 без товаров — мёртв; с галочкой оживает за счёт товара без оси IP', () => {
        expect(isDead(idx, '49', false)).toBe(true);
        expect(isDead(idx, '49', true)).toBe(false);
        expect(deadValues(idx, false)).toEqual(new Set(['49', '90']));   // 90 — PCB-AC без товаров
    });
});

describe('rebuildSelection (правило 6)', () => {
    it('W → 3/4" → перестройка от A: [W, A], 3/4" снят', () => {
        expect(rebuildSelection(idx, '19', ['20', '93'], false)).toEqual(['20', '19']);
    });
});

describe('pruneOrphanRefs (правило 7)', () => {
    it('reference без выбранного родителя снимается; родитель-тег считается выбранным', () => {
        expect(pruneOrphanRefs(idx, ['93'])).toEqual([]);
        expect(pruneOrphanRefs(idx, ['20', '93'])).toEqual(['20', '93']);
        expect(pruneOrphanRefs(idx, ['18', '90'])).toEqual(['18', '90']);
    });
});

describe('applyClick', () => {
    const click = (sel, val, additive = false, partial = false) => applyClick(idx, sel, val, { additive, partial });

    it('клик заменяет выбор; повторный клик по единственному — сброс', () => {
        expect(click(['20', '93'], '18')).toEqual(['18']);
        expect(click(['18'], '18')).toEqual([]);
    });

    it('клик и Shift+клик по мёртвому узлу игнорируются', () => {
        expect(click(['20'], '49')).toEqual(['20']);
        expect(click(['20'], '49', true)).toEqual(['20']);
    });

    it('Shift+клик по активному — добавить', () => {
        expect(click(['20'], '93', true)).toEqual(['20', '93']);
        expect(click(['20'], '19', true)).toEqual(['20', '19']);
    });

    it('Shift+клик по погашенному — перестройка', () => {
        expect(click(['20', '93'], '19', true)).toEqual(['20', '19']);
    });

    it('смена классификатора снимает осиротевший reference', () => {
        expect(click(['20', '93'], '19', true).includes('93')).toBe(false);
    });

    it('клик по reference без Shift заменяет значение только в своей оси, повторный — снимает', () => {
        expect(click(['20', '93'], '94')).toEqual(['20', '94']);
        expect(click(['20', '93'], '93')).toEqual(['20']);
    });

    it('Shift-снятие, после которого ничего не нашлось бы, перестраивает выбор', () => {
        const next = click(['19', '20', '93'], '20', true);
        expect(next.length === 0 || ids(next).length > 0).toBe(true);
    });
});

describe('normalizeSelection', () => {
    it('выключение галочки снимает ставший мёртвым узел', () => {
        expect(normalizeSelection(idx, ['49'], false)).toEqual([]);
        expect(normalizeSelection(idx, ['49'], true)).toEqual(['49']);
    });

    it('неизвестные id (другой тег) отбрасываются', () => {
        expect(normalizeSelection(idx, ['20', '999'], false)).toEqual(['20']);
    });
});

describe('инвариант: через клики нельзя получить «Найдено: 0»', () => {
    it('случайные последовательности кликов (с Shift и без, обе галочки)', () => {
        const all = [...idx.axisOf.keys()];
        let seed = 42;
        const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
        for (const partial of [false, true]) {
            for (let run = 0; run < 300; run++) {
                let sel = [];
                for (let step = 0; step < 8; step++) {
                    sel = applyClick(idx, sel, all[rnd(all.length)], { additive: rnd(3) > 0, partial });
                    if (sel.length) expect(matchedProducts(idx, sel, { partial }).length).toBeGreaterThan(0);
                }
            }
        }
    });
});
