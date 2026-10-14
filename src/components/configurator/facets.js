// Фасетная логика «Фильтра графа» (без cytoscape).
// Данные — facet_products из filtered-configuration?facets=true:
//   { common: [valueId], products: [[productId, isParent(1|0), valueId, ...], ...] }
// Значения товара = common ∪ хвост. Выбор (ids) — массив value_id-строк в порядке клика (старые → новые).

// ── Индекс ────────────────────────────────────────────────────────────────

export function buildFacetIndex({ nodes = [], referenceAxes = [], facetProducts, tagIds = [] }) {
    const axisOf = new Map();       // valueId → axisId (строки)
    const graphAxes = new Set();    // classifier-оси графа
    const refAxes = new Set();
    const parentsOf = new Map();    // refAxisId → Set(parent valueId)

    nodes.filter(n => n.data.type === 'value').forEach(n => {
        const axis = String(n.data.axis_id);
        axisOf.set(n.data.id.replace('value-', ''), axis);
        graphAxes.add(axis);
    });
    referenceAxes.forEach(a => {
        const axis = String(a.axis_id);
        refAxes.add(axis);
        parentsOf.set(axis, new Set((a.parent_value_ids || []).map(String)));
        a.values.forEach(v => axisOf.set(String(v.id), axis));
    });

    const common = (facetProducts?.common || []).map(String);
    const products = (facetProducts?.products || []).map(([id, isParent, ...tail]) => {
        const vals = new Map();     // axisId → valueId
        [...common, ...tail.map(String)].forEach(v => {
            const axis = axisOf.get(v);
            if (axis) vals.set(axis, v);
        });
        return { id, parent: isParent === 1, vals };
    });

    return { axisOf, graphAxes, refAxes, parentsOf, products, tagIds: new Set(tagIds.map(String)) };
}

// ── Подбор ────────────────────────────────────────────────────────────────

const toSelection = (index, ids) => {
    const S = new Map();
    ids.forEach(id => {
        const axis = index.axisOf.get(String(id));
        if (!axis) return;
        if (!S.has(axis)) S.set(axis, new Set());
        S.get(axis).add(String(id));
    });
    return S;
};

// Правило 1. skipAxis — проверка «без оси v» (правило 2)
const productMatches = (index, p, S, partial, skipAxis) => {
    for (const [axis, values] of S) {
        if (axis === skipAxis) continue;
        const v = p.vals.get(axis);
        if (v === undefined) {
            if (partial && !index.refAxes.has(axis)) continue;   // галочка — только classifier
            return false;
        }
        if (!values.has(v)) return false;
    }
    if (!partial) {
        for (const axis of index.graphAxes) if (!p.vals.has(axis)) return false;
    }
    return true;
};

const matchedBy = (index, S, partial, skipAxis) =>
    index.products.filter(p => productMatches(index, p, S, partial, skipAxis));

export const matches = (index, product, ids, partial) =>
    productMatches(index, product, toSelection(index, ids), partial);

// Правило 8: товары под выбор (parentsOnly — только is_parent=1)
export const matchedProducts = (index, ids, { partial = false, parentsOnly = false } = {}) =>
    matchedBy(index, toSelection(index, ids), partial)
        .filter(p => !parentsOnly || p.parent);

// Правило 2: v активен, если есть товар со значением v, подходящий под S без оси v
export function activeValues(index, ids, partial) {
    const S = toSelection(index, ids);
    const active = new Set();
    const all = matchedBy(index, S, partial);
    const axes = new Set(index.axisOf.values());
    axes.forEach(axis => {
        const pool = S.has(axis) ? matchedBy(index, S, partial, axis) : all;
        pool.forEach(p => {
            const v = p.vals.get(axis);
            if (v !== undefined) active.add(v);
        });
    });
    return active;
}

// Правило 3: выбор из одного [v] не находит ни одного товара
export const isDead = (index, v, partial) =>
    !index.products.some(p => productMatches(index, p, toSelection(index, [v]), partial));

export const deadValues = (index, partial) =>
    new Set([...index.axisOf.keys()].filter(v => isDead(index, v, partial)));

// Каждое значение выбора есть хотя бы у одного подходящего товара
const everyValueCovered = (index, ids, partial) => {
    const prods = matchedProducts(index, ids, { partial });
    return ids.every(x => {
        const axis = index.axisOf.get(x);
        return prods.some(p => p.vals.get(axis) === x);
    });
};

// Правило 6: res=[clicked], остальные от новых к старым — оставляем, если покрытие не ломается
export function rebuildSelection(index, clicked, ids, partial) {
    clicked = String(clicked);
    let res = [clicked];
    [...ids].map(String).reverse().forEach(v => {
        if (v === clicked) return;
        if (everyValueCovered(index, [...res, v], partial)) res = [...res, v];
    });
    // порядок «старые → новые», кликнутый — самый новый
    const order = ids.map(String);
    return [...res.filter(v => v !== clicked).sort((a, b) => order.indexOf(a) - order.indexOf(b)), clicked];
}

// Правило 7: reference без выбранного родителя (теги считаются выбранными) снимается
export function pruneOrphanRefs(index, ids) {
    const chosen = new Set([...ids.map(String), ...index.tagIds]);
    return ids.map(String).filter(v => {
        const axis = index.axisOf.get(v);
        if (!index.refAxes.has(axis)) return true;
        return [...(index.parentsOf.get(axis) || [])].some(pid => chosen.has(pid));
    });
}

// ── Клик ──────────────────────────────────────────────────────────────────

// Новый выбор после клика по v (additive — Shift/Ctrl). Мёртвый узел — без изменений.
export function applyClick(index, ids, v, { additive = false, partial = false } = {}) {
    v = String(v);
    ids = ids.map(String);
    if (isDead(index, v, partial)) return ids;

    const axis = index.axisOf.get(v);
    const isSelected = ids.includes(v);
    let next;

    if (!additive && !index.refAxes.has(axis)) {
        // Правило 4: замена выбора; повторный клик по единственному выбранному — сброс
        next = isSelected && ids.length === 1 ? [] : [v];
    } else if (isSelected) {
        // Снятие (Shift-клик по выбранному или клик по выбранному reference)
        next = ids.filter(x => x !== v);
        if (next.length && !matchedProducts(index, next, { partial }).length) {
            next = rebuildSelection(index, next[next.length - 1], next, partial);
        }
    } else {
        const others = additive ? ids : ids.filter(x => index.axisOf.get(x) !== axis); // reference без Shift — замена в своей оси
        next = activeValues(index, ids, partial).has(v)
            ? [...others, v]                                        // правило 5
            : rebuildSelection(index, v, others, partial);          // правило 6
    }
    return pruneOrphanRefs(index, next);
}

// После смены галочки / восстановления: убрать мёртвые и неизвестные, гарантировать ненулевой результат
export function normalizeSelection(index, ids, partial) {
    let next = pruneOrphanRefs(index, ids.map(String)
        .filter(v => index.axisOf.has(v) && !isDead(index, v, partial)));
    if (next.length && !matchedProducts(index, next, { partial }).length) {
        next = pruneOrphanRefs(index, rebuildSelection(index, next[next.length - 1], next, partial));
    }
    return next;
}
