import { useState, useEffect } from 'react';
import { catalogApi } from '../../api/catalog';
import { inputCls } from '../../utils/styles';
import { flattenOnecFolders } from '../../utils/productCodes';

const CODES_FILTERS = [
    { id: '', label: 'Все' },
    { id: 'missing', label: 'Без кодов' },
    { id: 'filled', label: 'Заполнены' },
];

// Общие фильтры списка товаров для страниц ТНВЭД/ОКПД2 и карточек НК: группа 1С, тип продукции
// (только если передан onChange для него — value.productType задан), поиск с debounce и (опционально) codes.
// value = {folder, search, codes, productType}; onChange(patch) получает изменённые поля.
export default function ProductListFilters({ value, onChange, withCodes = true, withProductType = false }) {
    const [folders, setFolders] = useState([]);
    const [types, setTypes] = useState([]);
    const [searchInput, setSearchInput] = useState(value.search || '');

    useEffect(() => {
        catalogApi.onecGroups().then(({ ok, data }) => {
            if (ok && data?.success) setFolders(flattenOnecFolders(data.data));
        });
        if (withProductType) {
            catalogApi.productTypes().then(({ ok, data }) => {
                if (ok) setTypes(Array.isArray(data) ? data : (data.data ?? []));
            });
        }
    }, [withProductType]);

    useEffect(() => {
        const t = setTimeout(() => onChange({ search: searchInput.trim() }), 300);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchInput]);

    return (
        <div className="flex flex-wrap gap-2">
            <select className={`${inputCls} !w-auto min-w-64`} value={value.folder}
                onChange={e => onChange({ folder: e.target.value })}>
                <option value="">Группа 1С…</option>
                {folders.map(f => (
                    <option key={f.code} value={f.code}>
                        {'  '.repeat(f.depth)}{f.name} ({f.products}{f.missing ? `, без кодов: ${f.missing}` : ''})
                    </option>
                ))}
            </select>
            {withProductType && (
                <select className={`${inputCls} !w-auto min-w-48`} value={value.productType}
                    onChange={e => onChange({ productType: e.target.value })}>
                    <option value="">Тип продукции…</option>
                    {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            )}
            <input className={`${inputCls} !w-64`} placeholder="Поиск по названию, артикулу, коду"
                value={searchInput} onChange={e => setSearchInput(e.target.value)} />
            {withCodes && (
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {CODES_FILTERS.map(f => (
                        <button key={f.id} onClick={() => onChange({ codes: f.id })}
                            className={`px-3 py-1.5 text-sm ${value.codes === f.id
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}>
                            {f.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
