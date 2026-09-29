import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { catalogApi } from '../api/catalog';
import { can, PERM } from '../utils/permissions';
import { parseError } from '../utils';
import { inputCls } from '../utils/styles';
import { flattenOnecFolders } from '../utils/productCodes';
import { useMultiSelect } from '../hooks/useMultiSelect';
import SetCodesModal from '../components/catalog/SetCodesModal';
import PushCodesPanel from '../components/catalog/PushCodesPanel';

const CODES_FILTERS = [
    { id: '', label: 'Все' },
    { id: 'missing', label: 'Без кодов' },
    { id: 'filled', label: 'Заполнены' },
];

// Пакетное заполнение ТНВЭД/ОКПД2 и запись в 1С. Список бэка без пагинации — грузим только
// при выбранной группе 1С или поиске, иначе это все ~8000 активных товаров.
export default function ProductCodesPage() {
    const { user } = useAuth();
    const canWrite = can(user, PERM.CATALOG_PRODUCT_CODES_WRITE);
    const canPush = can(user, PERM.CATALOG_PUSH_CODES_TO_1C);

    const [folders, setFolders] = useState([]);
    const [folder, setFolder] = useState('');
    const [codes, setCodes] = useState('missing');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [setting, setSetting] = useState(false);
    const reqRef = useRef(0);
    const sel = useMultiSelect(items);
    const ids = useMemo(() => [...sel.selected], [sel.selected]);

    useEffect(() => {
        catalogApi.onecGroups().then(({ ok, data }) => {
            if (ok && data?.success) setFolders(flattenOnecFolders(data.data));
        });
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput.trim()), 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    const load = useCallback(async () => {
        if (!folder && !search) { setItems([]); return; }
        const req = ++reqRef.current;
        setLoading(true);
        setError('');
        try {
            const { ok, status, data } = await catalogApi.listProducts({ onec_folder: folder, search, codes });
            if (req !== reqRef.current) return;
            if (!ok) { setError(parseError(data, status)); setItems([]); return; }
            setItems(Array.isArray(data) ? data : data?.data ?? data?.results ?? []);
            sel.clearAll();
        } catch {
            if (req === reqRef.current) setError('Не удалось загрузить товары');
        } finally {
            if (req === reqRef.current) setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [folder, search, codes]);

    useEffect(() => { load(); }, [load]);

    const allSelected = items.length > 0 && sel.selected.size === items.length;

    return (
        <div className="max-w-5xl mx-auto space-y-4">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Коды ТНВЭД / ОКПД2</h1>

            <div className="flex flex-wrap gap-2">
                <select className={`${inputCls} !w-auto min-w-64`} value={folder} onChange={e => setFolder(e.target.value)}>
                    <option value="">Группа 1С…</option>
                    {folders.map(f => (
                        <option key={f.code} value={f.code}>
                            {'  '.repeat(f.depth)}{f.name} ({f.products}{f.missing ? `, без кодов: ${f.missing}` : ''})
                        </option>
                    ))}
                </select>
                <input className={`${inputCls} !w-64`} placeholder="Поиск по названию, артикулу, коду"
                    value={searchInput} onChange={e => setSearchInput(e.target.value)} />
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {CODES_FILTERS.map(f => (
                        <button key={f.id} onClick={() => setCodes(f.id)}
                            className={`px-3 py-1.5 text-sm ${codes === f.id
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}>
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {(canWrite || canPush) && (
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Выбрано: {ids.length}</span>
                    {canWrite && (
                        <button onClick={() => setSetting(true)} disabled={!ids.length}
                            className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
                            Задать коды
                        </button>
                    )}
                </div>
            )}
            {canPush && <PushCodesPanel productIds={ids} />}

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {!folder && !search && (
                <p className="text-sm text-gray-500 dark:text-gray-400">Выберите группу 1С или введите поисковый запрос.</p>
            )}

            {items.length > 0 && (
                <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="px-3 py-2 w-8">
                                    <input type="checkbox" checked={allSelected}
                                        onChange={() => (allSelected ? sel.clearAll() : sel.selectAll())} />
                                </th>
                                <th className="px-3 py-2">Товар</th>
                                <th className="px-3 py-2">Артикул</th>
                                <th className="px-3 py-2">ТНВЭД</th>
                                <th className="px-3 py-2">ОКПД2</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {items.map(p => (
                                <tr key={p.id} className="text-gray-900 dark:text-gray-100">
                                    <td className="px-3 py-1.5">
                                        <input type="checkbox" checked={sel.selected.has(p.id)} onChange={() => sel.toggle(p.id)} />
                                    </td>
                                    <td className="px-3 py-1.5">{p.name}</td>
                                    <td className="px-3 py-1.5 font-mono text-xs">{p.sku}</td>
                                    <td className="px-3 py-1.5 font-mono text-xs">{p.tnved || <span className="text-red-500">—</span>}</td>
                                    <td className="px-3 py-1.5 font-mono text-xs">{p.okpd2 || <span className="text-red-500">—</span>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {loading && <p className="text-sm text-gray-500">Загрузка…</p>}
            {!loading && (folder || search) && !error && items.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">Товаров не найдено.</p>
            )}

            {setting && (
                <SetCodesModal productIds={ids} onClose={() => setSetting(false)} onDone={() => load()} />
            )}
        </div>
    );
}
