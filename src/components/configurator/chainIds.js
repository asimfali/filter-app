// Цепочка value_id выделения на графе (Cytoscape): classifier-узлы пересечения +
// только ЯВНО выбранные reference-узлы. Достижимые reference из пересечения не берём:
// в filter-by-chain они отсекли бы товары без справочного значения, а в attach-by-ids-bulk
// молча записали бы последнее значение каждой справочной оси.
export const chainSearchValueIds = (intersection, selected) => {
    const vid = n => n.id().replace('value-', '');
    return [...new Set([
        ...intersection.filter(n => n.data('type') === 'value' && !n.data('is_reference')).map(vid),
        ...selected.filter(n => n.data('is_reference')).map(vid),
    ])];
};
