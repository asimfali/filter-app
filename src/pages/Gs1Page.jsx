import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { externalApi } from '../api/external';
import { can, PERM } from '../utils/permissions';
import { inputCls } from '../utils/styles';
import {
    gs1Error, fmtGs1Date, GS1_STATUS_LABEL, GS1_STATUS_COLOR, GS1_REASON_LABEL,
} from '../utils/gs1';
import useGs1Summary, { notifyGs1SummaryChanged } from '../hooks/useGs1Summary';
import { useMultiSelect } from '../hooks/useMultiSelect';
import Gs1ItemModal from '../components/sync/Gs1ItemModal';
import Gs1RunPanel from '../components/sync/Gs1RunPanel';
import Gs1PushErpPanel from '../components/sync/Gs1PushErpPanel';

const PAGE_SIZE = 50;
// «Предложено» — new с кандидатом (результат dry-run), «Новые» — new без кандидатов;
// count — ключ счётчика во вкладке из summary.
const TABS = [
    { id: 'conflict', label: 'Конфликты', params: { status: 'conflict' }, count: s => s.by_status?.conflict },
    { id: 'unmatched', label: 'Не найдены', params: { status: 'unmatched' }, count: s => s.by_status?.unmatched },
    { id: 'proposed', label: 'Предложено', params: { status: 'new', has_candidates: 'true' }, count: s => s.proposals },
    { id: 'new', label: 'Новые', params: { status: 'new', has_candidates: 'false' } },
    { id: 'ignored', label: 'Игнорируемые', params: { status: 'ignored' } },
    { id: 'matched', label: 'Сопоставленные', params: { status: 'matched' } },
];

// Очередь разбора GTIN из ГС1 РУС: права — external.gs1_resolve (очередь/разбор),
// external.gs1_sync (блок запуска и история) независимы.
export default function Gs1Page() {
    const { user } = useAuth();
    const canResolve = can(user, PERM.EXTERNAL_GS1_RESOLVE);
    const canSync = can(user, PERM.EXTERNAL_GS1_SYNC);
    const canPushGtin = can(user, PERM.CATALOG_PUSH_GTIN_TO_1C);
    const summary = useGs1Summary(canResolve, null);

    const [tab, setTab] = useState('conflict');
    const [reason, setReason] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const [hidePushed, setHidePushed] = useState(false);
    const [page, setPage] = useState(1);
    const [data, setData] = useState({ count: 0, results: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const reqRef = useRef(0);
    // Отправка GTIN в 1С — только с «Сопоставленные» (только там гарантирован Product.gtin)
    const gtinSelect = useMultiSelect(data.results);
    const showGtinStatus = tab === 'matched'; // колонка «GTIN в 1С» видна всем, кто видит вкладку
    const showGtinSelect = showGtinStatus && canPushGtin; // чекбоксы/панель — только с правом на отправку
    const extraCols = (showGtinSelect ? 1 : 0) + (showGtinStatus ? 1 : 0);

    useEffect(() => {
        const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    const load = useCallback(async () => {
        const req = ++reqRef.current;
        setLoading(true);
        setError('');
        try {
            const { ok, data: body, status } = await externalApi.getGs1Items({
                ...TABS.find(t => t.id === tab).params,
                reason: tab === 'conflict' ? reason : '',
                search,
                // по умолчанию — только активные в ГС1; деактивированные автоматически не сопоставляются
                is_active_in_gs1: showInactive ? '' : 'true',
                ...(tab === 'matched' && hidePushed ? { gtin_pushed_to_1c: 'false' } : {}),
                page,
                page_size: PAGE_SIZE,
            });
            if (req !== reqRef.current) return;
            if (ok && body?.success) setData(body.data);
            else setError(gs1Error(body, status));
        } catch {
            if (req === reqRef.current) setError('Не удалось загрузить очередь');
        } finally {
            if (req === reqRef.current) setLoading(false);
        }
    }, [tab, reason, search, showInactive, hidePushed, page]);

    useEffect(() => { if (canResolve) load(); }, [canResolve, load]);

    const changed = () => { load(); notifyGs1SummaryChanged(); };
    const pickTab = (t) => { setTab(t); setReason(''); setPage(1); };

    // Список выбранных — «живой» на текущей странице; смена страницы/фильтров/вкладки его обнуляет
    useEffect(() => { gtinSelect.clearAll(); }, [tab, page, search, reason, showInactive, hidePushed]); // eslint-disable-line react-hooks/exhaustive-deps
    const gtinProductIds = data.results
        .filter(r => gtinSelect.selected.has(r.id) && r.product)
        .map(r => r.product);

    if (!canResolve) {
        return <p className="text-sm text-gray-500 dark:text-gray-400">Недостаточно прав для просмотра очереди ГС1</p>;
    }

    const totalPages = Math.max(1, Math.ceil(data.count / PAGE_SIZE));
    const reasons = Object.entries(summary?.conflicts_by_reason ?? {});

    return (
        <div className="max-w-6xl mx-auto space-y-4">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Синхронизация с ГС1 РУС</h1>

            {canSync && <Gs1RunPanel onFinished={changed} />}

            {showGtinSelect && (
                <Gs1PushErpPanel productIds={gtinProductIds} onDone={() => gtinSelect.clearAll()} />
            )}

            <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => pickTab(t.id)}
                        className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors
                            ${tab === t.id
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
                        {t.label}
                        {summary && t.count?.(summary) > 0 && (
                            <span className="ml-1.5 text-xs text-gray-400">{t.count(summary)}</span>
                        )}
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="w-72">
                    <input className={inputCls} value={searchInput} placeholder="GTIN, описание, товар…"
                        onChange={e => setSearchInput(e.target.value)} />
                </div>
                {tab === 'conflict' && reasons.length > 0 && (
                    <div className="w-64">
                        <select className={inputCls} value={reason}
                            onChange={e => { setReason(e.target.value); setPage(1); }}>
                            <option value="">Все причины</option>
                            {reasons.map(([r, n]) => (
                                <option key={r} value={r}>{GS1_REASON_LABEL[r] ?? r} ({n})</option>
                            ))}
                        </select>
                    </div>
                )}
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <input type="checkbox" className="rounded" checked={showInactive}
                        onChange={e => { setShowInactive(e.target.checked); setPage(1); }} />
                    Показать деактивированные в ГС1
                </label>
                {showGtinStatus && (
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <input type="checkbox" className="rounded" checked={hidePushed}
                            onChange={e => { setHidePushed(e.target.checked); setPage(1); }} />
                        Скрыть уже отправленные в 1С
                    </label>
                )}
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                            {showGtinSelect && (
                                <th className="px-3 py-2 w-8">
                                    <input type="checkbox" className="rounded"
                                        checked={data.results.length > 0 && gtinSelect.selected.size === data.results.length}
                                        onChange={e => (e.target.checked ? gtinSelect.selectAll() : gtinSelect.clearAll())} />
                                </th>
                            )}
                            <th className="px-3 py-2 font-medium">GTIN</th>
                            <th className="px-3 py-2 font-medium">Описание</th>
                            <th className="px-3 py-2 font-medium whitespace-nowrap">Регистрация в ГС1</th>
                            <th className="px-3 py-2 font-medium">Статус</th>
                            <th className="px-3 py-2 font-medium">Товар</th>
                            {showGtinStatus && <th className="px-3 py-2 font-medium whitespace-nowrap">GTIN в 1С</th>}
                        </tr>
                    </thead>
                    <tbody className={loading ? 'opacity-50' : ''}>
                        {data.results.map(row => (
                            <tr key={row.id} onClick={() => setSelectedId(row.id)}
                                className="border-b last:border-0 border-gray-100 dark:border-gray-800 cursor-pointer
                                           hover:bg-neutral-50 dark:hover:bg-neutral-800 text-gray-900 dark:text-white">
                                {showGtinSelect && (
                                    <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                                        <input type="checkbox" className="rounded"
                                            checked={gtinSelect.selected.has(row.id)}
                                            onChange={() => gtinSelect.toggle(row.id)} />
                                    </td>
                                )}
                                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{row.gtin}</td>
                                <td className="px-3 py-2">
                                    {row.prod_desc}
                                    {!row.is_active_in_gs1 && (
                                        <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">деактивирован</span>
                                    )}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">{fmtGs1Date(row.prod_regdate)}</td>
                                <td className="px-3 py-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${GS1_STATUS_COLOR[row.status] ?? ''}`}>
                                        {GS1_STATUS_LABEL[row.status] ?? row.status}
                                    </span>
                                    {row.reason && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            {GS1_REASON_LABEL[row.reason] ?? row.reason}
                                        </div>
                                    )}
                                    {(row.status === 'new' || row.status === 'unmatched') && row.candidates_count > 0 && (
                                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                                            {row.status === 'new' ? 'предложено совпадение' : `подсказок: ${row.candidates_count}`}
                                        </div>
                                    )}
                                </td>
                                <td className="px-3 py-2">{row.product_name ?? '—'}</td>
                                {showGtinStatus && (
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        {row.gtin_pushed_at
                                            ? <span className="text-xs text-emerald-600 dark:text-emerald-400">✓ {fmtGs1Date(row.gtin_pushed_at, true)}</span>
                                            : <span className="text-xs text-gray-400">не отправлен</span>}
                                    </td>
                                )}
                            </tr>
                        ))}
                        {!loading && data.results.length === 0 && (
                            <tr><td colSpan={5 + extraCols} className="px-3 py-8 text-center text-gray-400">Записей нет</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {data.count > PAGE_SIZE && (
                <div className="flex items-center justify-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                        className="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40">←</button>
                    <span>Стр. {page} из {totalPages} · всего {data.count}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40">→</button>
                </div>
            )}

            {selectedId && (
                <Gs1ItemModal itemId={selectedId} onClose={() => setSelectedId(null)} onChanged={changed} />
            )}
        </div>
    );
}
