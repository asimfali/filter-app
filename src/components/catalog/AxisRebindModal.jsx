import { useState, useEffect, useRef, useCallback } from 'react';
import Modal from '../common/Modal';
import { catalogApi } from '../../api/catalog';
import { envelopeError, unwrapList } from '../../utils';

const BLOCK_CLS = 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300';
const WARN_CLS = 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300';
const selectCls = 'border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs ' +
    'bg-white dark:bg-neutral-800 text-gray-900 dark:text-white';
const section = 'text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1';
const NO_MERGE = 'none';

// Пересвязь собственной оси типа: «сделать общей» (без цели) или «влить в общую ось».
// plan (без записи) → apply; после применения — «Отменить» через chain-operations/undo.
export default function AxisRebindModal({ axis, onClose, onChanged }) {
    const [targets, setTargets] = useState([]);
    const [targetId, setTargetId] = useState('');          // '' — сделать общей
    const [valueMap, setValueMap] = useState({});          // sourceValueId → targetValueId | null
    const [targetValues, setTargetValues] = useState([]);
    const [plan, setPlan] = useState(null);
    const [error, setError] = useState('');
    const [stale, setStale] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);            // {operation_id, undone}
    const req = useRef(0);

    useEffect(() => {
        catalogApi.parameterAxes('global').then(({ ok, data }) => {
            if (ok) setTargets(unwrapList(data).filter(a => a.id !== axis.id && a.is_active !== false && a.axis_type === axis.axis_type));
        });
    }, [axis.id, axis.axis_type]);

    useEffect(() => {
        setValueMap({});
        setTargetValues([]);
        if (!targetId) return;
        catalogApi.parameterValues(targetId).then(({ ok, data }) => { if (ok) setTargetValues(unwrapList(data)); });
    }, [targetId]);

    const buildBody = useCallback(() => ({
        ...(targetId && { target_axis_id: Number(targetId) }),
        ...(Object.keys(valueMap).length && { value_map: valueMap }),
        delete_source: true,
    }), [targetId, valueMap]);

    const runPlan = useCallback(async () => {
        const id = ++req.current;
        setLoading(true);
        setError('');
        try {
            const { ok, status, data } = await catalogApi.axisRebindPlan(axis.id, buildBody());
            if (id !== req.current) return;
            if (ok && data.success !== false) { setPlan(data.data ?? data); setStale(false); }
            else { setPlan(null); setError(envelopeError(data, status)); }
        } catch {
            if (id === req.current) setError('Ошибка соединения');
        } finally {
            if (id === req.current) setLoading(false);
        }
    }, [axis.id, buildBody]);

    useEffect(() => { if (!result) runPlan(); }, [runPlan, result]);

    const handleApply = async () => {
        setLoading(true);
        setError('');
        try {
            const { ok, status, data } = await catalogApi.axisRebindApply(axis.id, { ...buildBody(), plan_hash: plan.plan_hash });
            if (ok && data.success !== false) {
                setResult({ operation_id: (data.data ?? data).operation_id, undone: false });
                onChanged?.();
                return;
            }
            const err = data?.error;
            if (err?.code === 'PLAN_CHANGED') { setStale(true); await runPlan(); setStale(true); }
            else if (err?.code === 'REBIND_BLOCKED' && err.plan) setPlan(err.plan);
            else if (err?.code === 'REBIND_INCOMPLETE') setError('Операция откатилась из-за внутренней ошибки — сообщите разработчикам бэкенда');
            else setError(envelopeError(data, status));
        } catch {
            setError('Ошибка соединения');
        } finally {
            setLoading(false);
        }
    };

    const handleUndo = async () => {
        setLoading(true);
        setError('');
        try {
            const { ok, status, data } = await catalogApi.chainUndo(result.operation_id);
            if (ok && data.success !== false) { setResult(r => ({ ...r, undone: true })); onChanged?.(); }
            else setError(envelopeError(data, status));
        } catch {
            setError('Ошибка соединения');
        } finally {
            setLoading(false);
        }
    };

    const setMapping = (srcId, v) => setValueMap(m => ({ ...m, [srcId]: v === NO_MERGE ? null : Number(v) }));
    const rowValue = (row) => {
        const ov = valueMap[row.source_value_id];
        if (ov === null) return NO_MERGE;
        return String(ov ?? row.target_value_id ?? NO_MERGE);
    };

    const blocking = plan?.blocking ?? [];
    const canApply = plan && !blocking.length && !loading && !stale;
    const promote = !targetId;
    const btn = 'text-sm px-4 py-2 rounded-lg transition-colors';
    const cancelBtn = `${btn} border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-neutral-50 dark:hover:bg-neutral-800`;

    return (
        <Modal
            title="Пересвязь оси"
            subtitle={[plan?.product_type?.name, axis.name].filter(Boolean).join(' · ')}
            onClose={onClose}
            maxWidth="4xl"
            scrollBody
            bodyClassName="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4"
            footer={result ? (
                <div className="flex gap-2 justify-end w-full">
                    {!result.undone && (
                        <button onClick={handleUndo} disabled={loading} className={`${cancelBtn} disabled:opacity-40`}>
                            {loading ? '...' : 'Отменить операцию'}
                        </button>
                    )}
                    <button onClick={onClose} className={`${btn} bg-blue-600 hover:bg-blue-700 text-white`}>Закрыть</button>
                </div>
            ) : (
                <div className="flex gap-2 justify-end w-full">
                    <button onClick={onClose} className={cancelBtn}>Отмена</button>
                    <button onClick={handleApply} disabled={!canApply}
                        className={`${btn} bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white`}>
                        {loading ? '...' : 'Применить'}
                    </button>
                </div>
            )}
        >
            {error && <div className={`text-xs rounded-lg px-3 py-2 border ${BLOCK_CLS}`}>{error}</div>}

            {result ? (
                <div className="text-sm text-gray-700 dark:text-gray-300">
                    {result.undone ? 'Операция отменена: ось, значения и привязки возвращены как были.'
                        : promote ? `Ось «${axis.name}» теперь общая.`
                            : `Ось «${axis.name}» влита в «${plan?.target?.name}».`}
                </div>
            ) : (
                <>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="shrink-0">Действие:</span>
                        <select value={targetId} onChange={e => setTargetId(e.target.value)} className={`${selectCls} flex-1 py-2 text-sm`}>
                            <option value="">Сделать ось общей</option>
                            {targets.map(t => <option key={t.id} value={t.id}>Влить в общую ось: {t.name} ({t.code})</option>)}
                        </select>
                    </label>

                    {stale && (
                        <div className={`text-xs rounded-lg px-3 py-2 border ${WARN_CLS}`}>
                            Данные изменились после предпросмотра — план обновлён, проверьте и примените снова.
                        </div>
                    )}

                    {blocking.map((b, i) => (
                        <div key={`${b.code}-${i}`} className={`text-xs rounded-lg px-3 py-2 border ${BLOCK_CLS}`}>
                            {b.message}
                            {b.count != null && <span className="ml-1 text-red-400">({b.count})</span>}
                        </div>
                    ))}
                    {plan?.warnings?.map((w, i) => (
                        <div key={`${w.code}-${i}`} className={`text-xs rounded-lg px-3 py-2 border ${WARN_CLS}`}>{w.message}</div>
                    ))}

                    {plan?.value_map?.length > 0 && (
                        <div>
                            <div className={section}>Значения{!promote && ' — слияние по названию'}</div>
                            <div className="space-y-1">
                                {plan.value_map.map(row => (
                                    <div key={row.source_value_id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                                        <span className="w-48 shrink-0 truncate" title={row.label}>{row.label}</span>
                                        {promote ? (
                                            <span className="text-gray-400">остаётся без изменений</span>
                                        ) : (
                                            <select value={rowValue(row)} onChange={e => setMapping(row.source_value_id, e.target.value)}
                                                className={`${selectCls} flex-1 min-w-0 ${row.action === 'merge' ? '' : 'text-emerald-600'}`}>
                                                <option value={NO_MERGE}>перенести как новое значение</option>
                                                {targetValues.map(v => <option key={v.id} value={v.id}>слить с «{v.value}»</option>)}
                                            </select>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {plan?.changes?.length > 0 && (
                        <div>
                            <div className={section}>Что изменится</div>
                            <table className="w-full text-xs text-gray-700 dark:text-gray-300">
                                <thead>
                                    <tr className="text-left text-gray-400">
                                        <th className="font-normal py-0.5">Таблица</th>
                                        <th className="font-normal py-0.5">Поле</th>
                                        <th className="font-normal py-0.5 text-right">Перенесено</th>
                                        <th className="font-normal py-0.5 text-right">Удалено</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {plan.changes.map((c, i) => (
                                        <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                                            <td className="py-0.5">{c.label ?? c.model}</td>
                                            <td className="py-0.5 text-gray-400">{c.field}</td>
                                            <td className="py-0.5 text-right">{c.moved}</td>
                                            <td className="py-0.5 text-right">{c.deleted || ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </Modal>
    );
}
