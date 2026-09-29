// Нормализация/валидация кодов ТНВЭД (10 цифр) и ОКПД2 (NN.NN.NN.NNN) — зеркало правил бэка
// (products/set-codes/); сервер всё равно перепроверяет.
const digits = (v) => (v || '').replace(/[\s.]/g, '');

export const normTnved = (v) => digits(v);

export const normOkpd2 = (v) => {
    const d = digits(v);
    return /^\d{9}$/.test(d) ? `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4, 6)}.${d.slice(6)}` : (v || '').replace(/\s/g, '');
};

export const validateTnved = (v) => (/^\d{10}$/.test(normTnved(v)) ? '' : 'ТНВЭД — ровно 10 цифр');
export const validateOkpd2 = (v) => (/^\d{2}\.\d{2}\.\d{2}\.\d{3}$/.test(normOkpd2(v)) ? '' : 'ОКПД2 — формат NN.NN.NN.NNN');

// Дерево групп 1С по path[{name,code}] → плоский список папок для выбора (отступ = глубина).
// Папка = общий префикс пути; её code уходит в ?onec_folder=, лист — в ?onec_hierarchy=.
export function flattenOnecFolders(groups) {
    const map = new Map();
    (groups || []).forEach(g => {
        (g.path || []).forEach((node, depth) => {
            const cur = map.get(node.code) || { code: node.code, name: node.name, depth, products: 0, missing: 0 };
            cur.products += g.products || 0;
            cur.missing += g.missing_codes || 0;
            map.set(node.code, cur);
        });
    });
    // порядок первого появления сохраняет обход дерева
    return [...map.values()];
}
