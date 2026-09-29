import { useState, useEffect, useCallback, useRef } from 'react';
import { catalogApi } from '../api/catalog';
import { parseError } from '../utils';
import { readinessBadge } from '../utils/nk';
import ProductListFilters from '../components/catalog/ProductListFilters';
import NkCardPanel from '../components/catalog/NkCardPanel';

const READINESS_CHUNK = 300; // лимит nk-readiness на один запрос

// Карточки Национального каталога (Честный знак) — только просмотр: готовность и что не хватает.
// Список бэка без пагинации — грузим только при выбранной группе/типе/поиске.
export default function NkCardsPage() {
    const [filters, setFilters] = useState({ folder: '', search: '', codes: '', productType: '' });
    const { folder, search, codes, productType } = filters;
    const [items, setItems] = useState([]);
    const [readiness, setReadiness] = useState({}); // {productId: {has_profile, ready, problems}}
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState(null);
    const reqRef = useRef(0);

    const load = useCallback(async () => {
        if (!folder && !search && !productType) { setItems([]); return; }
        const req = ++reqRef.current;
        setLoading(true);
        setError('');
        setReadiness({});
        try {
            const { ok, status, data } = await catalogApi.listProducts({ onec_folder: folder, search, codes, product_type: productType });
            if (req !== reqRef.current) return;
            if (!ok) { setError(parseError(data, status)); setItems([]); return; }
            const list = Array.isArray(data) ? data : data?.data ?? data?.results ?? [];
            setItems(list);
            const ids = list.map(p => p.id);
            for (let i = 0; i < ids.length; i += READINESS_CHUNK) {
                const r = await catalogApi.nkReadiness(ids.slice(i, i + READINESS_CHUNK));
                if (req !== reqRef.current) return;
                if (r.ok && r.data?.success) {
                    setReadiness(prev => ({
                        ...prev,
                        ...Object.fromEntries(r.data.data.items.map(it => [it.product_id, it])),
                    }));
                }
            }
        } catch {
            if (req === reqRef.current) setError('Не удалось загрузить товары');
        } finally {
            if (req === reqRef.current) setLoading(false);
        }
    }, [folder, search, codes, productType]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="max-w-6xl mx-auto space-y-4">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Карточки Национального каталога</h1>

            <ProductListFilters value={filters} withProductType withCodes={false}
                onChange={patch => setFilters(f => ({ ...f, ...patch }))} />

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {!folder && !search && !productType && (
                <p className="text-sm text-gray-500 dark:text-gray-400">Выберите тип продукции, группу 1С или введите поисковый запрос.</p>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,40rem)] items-start">
                {items.length > 0 && (
                    <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-3 py-2">Товар</th>
                                    <th className="px-3 py-2">Артикул</th>
                                    <th className="px-3 py-2">GTIN</th>
                                    <th className="px-3 py-2">ТНВЭД</th>
                                    <th className="px-3 py-2">ОКПД2</th>
                                    <th className="px-3 py-2">Готовность</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {items.map(p => {
                                    const b = readinessBadge(readiness[p.id]);
                                    return (
                                        <tr key={p.id} onClick={() => setSelected(p)}
                                            className={`cursor-pointer text-gray-900 dark:text-gray-100 hover:bg-neutral-50 dark:hover:bg-neutral-800
                                                ${selected?.id === p.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                            <td className="px-3 py-1.5">{p.name}</td>
                                            <td className="px-3 py-1.5 font-mono text-xs">{p.sku}</td>
                                            <td className="px-3 py-1.5 font-mono text-xs">{p.gtin || '—'}</td>
                                            <td className="px-3 py-1.5 font-mono text-xs">{p.tnved || '—'}</td>
                                            <td className="px-3 py-1.5 font-mono text-xs">{p.okpd2 || '—'}</td>
                                            <td className="px-3 py-1.5">
                                                <span className={`px-2 py-0.5 rounded text-xs ${b.cls}`}>{b.label}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                {selected && <NkCardPanel product={selected} onClose={() => setSelected(null)} />}
            </div>

            {loading && <p className="text-sm text-gray-500">Загрузка…</p>}
            {!loading && (folder || search || productType) && !error && items.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">Товаров не найдено.</p>
            )}
        </div>
    );
}
