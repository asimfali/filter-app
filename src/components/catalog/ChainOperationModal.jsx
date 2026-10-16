import { useState, useEffect, useRef, useCallback } from 'react';
import Modal from '../common/Modal';
import { catalogApi } from '../../api/catalog';
import { envelopeError, unwrapList } from '../../utils';

const OP_TITLE = {
    remove: 'Убрать ось из цепочки',
    insert: 'Вставить ось в цепочку',
    move: 'Переместить ось',
    repair: 'Починить цепочку',
};

const edgeKey = e => `${e.from}:${e.to}`;
const START = 'start';

// Диалог структурной операции с цепочкой классификационных осей: plan (без записи) → apply.
// op: 'remove' | 'insert' | 'move' | 'repair'; axis — {id, name} (для repair не нужна).
export default function ChainOperationModal({ typeId, typeName, op, axis, direction, onClose, onApplied }) {
    const needsPosition = op === 'insert' || op === 'move';
    const [chain, setChain] = useState([]);
    const [after, setAfter] = useState('');            // '' — не выбрано, START — в начало, иначе id оси
    const [skip, setSkip] = useState({});              // edgeKey → true («не создавать»)
    const [rules, setRules] = useState({});            // axisId → {value_id, axisName, valueName}: «всем без значения на оси»
    const [fromHints, setFromHints] = useState(false);  // принять все подсказки parameters_path
    const [assign, setAssign] = useState({});          // `${pid}:${axisId}` → value_id
    const [plan, setPlan] = useState(null);
    const [error, setError] = useState('');
    const [stale, setStale] = useState(false);
    const [loading, setLoading] = useState(false);
    const [confirmLosses, setConfirmLosses] = useState(false);
    const [axisValues, setAxisValues] = useState({});    // axisId → [{id, value}] для ручного assign
    const req = useRef(0);

    useEffect(() => {
        if (!needsPosition) return;
        catalogApi.chainAnalyze(typeId).then(({ ok, data }) => {
            if (!ok || data.success === false) return;
            const full = (data.data?.chain ?? []).slice().sort((a, b) => a.order - b.order);
            const rest = full.filter(a => a.id !== axis?.id);
            setChain(rest);
            // ↑/↓ в списке осей: позицию считаем по полной цепочке (с общими осями)
            if (direction) {
                const idx = full.findIndex(a => a.id === axis?.id);
                if (direction === 'up' && idx <= 0) setError('Ось уже первая в цепочке');
                else if (direction === 'down' && (idx < 0 || idx >= full.length - 1)) setError('Ось уже последняя в цепочке');
                else setAfter(direction === 'up' ? (idx === 1 ? START : String(full[idx - 2].id)) : String(full[idx + 1].id));
            }
        });
    }, [typeId, needsPosition, axis?.id, direction]);

    const buildBody = useCallback(() => {
        const skip_edges = [], assignList = [];
        Object.entries(skip).forEach(([k, v]) => { if (v) skip_edges.push(k.split(':').map(Number)); });
        Object.entries(assign).forEach(([k, value_id]) => {
            if (!value_id) return;
            const [product_id, axis_id] = k.split(':').map(Number);
            assignList.push({ product_id, axis_id, value_id: Number(value_id) });
        });
        return {
            op,
            ...(axis && { axis_id: axis.id }),
            ...(needsPosition && { after_axis_id: after === START ? null : Number(after) }),
            assign: assignList,
            skip_edges,
            ...(fromHints && { assign_from_hints: true }),
            ...(Object.keys(rules).length && {
                assign_rules: Object.entries(rules).map(([axis_id, r]) => ({ axis_id: Number(axis_id), value_id: Number(r.value_id), only_missing: true })),
            }),
        };
    }, [op, axis, needsPosition, after, skip, assign, rules, fromHints]);

    const runPlan = useCallback(async () => {
        const id = ++req.current;
        setLoading(true);
        setError('');
        try {
            const { ok, status, data } = await catalogApi.chainPlan(typeId, buildBody());
            if (id !== req.current) return;
            if (ok && data.success !== false) { setPlan(data.data ?? data); setConfirmLosses(false); }
            else { setPlan(null); setError(envelopeError(data, status)); }
        } catch {
            if (id === req.current) setError('Ошибка соединения');
        } finally {
            if (id === req.current) setLoading(false);
        }
    }, [typeId, buildBody]);

    useEffect(() => {
        if (needsPosition && after === '') return;
        runPlan();
    }, [runPlan, needsPosition, after]);

    const handleApply = async () => {
        setLoading(true);
        setError('');
        try {
            const { ok, status, data } = await catalogApi.chainApply(typeId, {
                ...buildBody(), plan_hash: plan.plan_hash, ...(confirmLosses && { confirm_losses: true }),
            });
            if (ok && data.success !== false) { onApplied?.(data.data ?? data); onClose(); return; }
            const err = data?.error;
            if (err?.code === 'PLAN_CHANGED' && err.plan) { setPlan(err.plan); setStale(true); setConfirmLosses(false); }
            else if (err?.plan && (err.code === 'CHAIN_BLOCKED' || err.code === 'CONFIRMATION_REQUIRED')) setPlan(err.plan);
            else if (err?.code === 'POST_CHECK_FAILED') {
                const probs = (err.problems ?? []).map(p => p.message).join('; ');
                setError(`Проверка после операции не пройдена, всё откатано${probs ? `: ${probs}` : ''}`);
            } else setError(envelopeError(data, status));
        } catch {
            setError('Ошибка соединения');
        } finally {
            setLoading(false);
        }
    };

    // Значения осей для ручного выбора у товаров с дырками
    useEffect(() => {
        const ids = new Set();
        [...(plan?.blocking ?? []), ...(plan?.warnings ?? [])].forEach(p => p.products?.forEach(pr => pr.missing?.forEach(id => ids.add(id))));
        ids.forEach(id => {
            if (axisValues[id]) return;
            setAxisValues(v => ({ ...v, [id]: [] }));
            catalogApi.parameterValues(id).then(({ ok, data }) => {
                if (ok) setAxisValues(v => ({ ...v, [id]: unwrapList(data) }));
            });
        });
    }, [plan]); // eslint-disable-line react-hooks/exhaustive-deps

    const edgesDel = plan?.edges_delete ?? [];
    const staleCount = edgesDel.filter(e => e.reason === 'stale').length;
    const flipCount = edgesDel.filter(e => e.reason === 'flip').length;
    const otherDelCount = edgesDel.length - staleCount - flipCount;
    const blocked = plan && !plan.can_apply;
    const needConfirm = plan?.requires_confirmation;
    const canApply = plan && plan.can_apply && !loading && (!needConfirm || confirmLosses);
    const setRule = (axId, axisName, valueId) => setRules(r => {
        const n = { ...r };
        const valueName = axisValues[axId]?.find(v => String(v.id) === String(valueId))?.value;
        if (valueId) n[axId] = { value_id: valueId, axisName, valueName }; else delete n[axId];
        return n;
    });
    const hasHints = (products) => products?.some(p => Object.keys(p.hints ?? {}).length);

    const section = 'text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1';
    const selectCls = 'border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm ' +
        'bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

    const renderProblem = (p, i, tone) => (
        <div key={`${p.code}-${i}`} className={`text-xs rounded-lg px-3 py-2 border ${tone}`}>
            <div>{p.message}</div>
            {p.products?.length > 0 && (
                <div className="mt-1 space-y-0.5">
                    {[...new Set(p.products.flatMap(pr => pr.missing ?? []))].map(axId => {
                        const name = p.products.map(pr => pr.missing_names?.[pr.missing?.indexOf(axId)]).find(Boolean) ?? `ось ${axId}`;
                        return (
                            <label key={`all-${axId}`} className="flex items-center gap-2 mb-1">
                                <span className="shrink-0 text-gray-500 dark:text-gray-400">Всем товарам без значения — {name}:</span>
                                <select value={rules[axId]?.value_id ?? ''} onChange={e => setRule(axId, name, e.target.value)}
                                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-neutral-800 text-gray-900 dark:text-white">
                                    <option value="">— выбрать —</option>
                                    {(axisValues[axId] ?? []).map(v => <option key={v.id} value={v.id}>{v.value}</option>)}
                                </select>
                            </label>
                        );
                    })}
                    <details className="mt-1">
                        <summary className="cursor-pointer text-gray-500 dark:text-gray-400">Настроить по отдельным товарам ({p.products.length}{p.products_truncated ? ` из ${p.product_count}` : ''})</summary>
                    {p.products.slice(0, 50).map(pr => (
                        <div key={pr.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-gray-600 dark:text-gray-300">
                            <span className="w-40 shrink-0 truncate" title={pr.name}>{pr.name}</span>
                            {pr.missing?.map((axId, i) => (
                                <label key={axId} className="flex items-center gap-1 flex-1 min-w-48">
                                    <span className="text-gray-400">{pr.missing_names?.[i] ?? `ось ${axId}`}</span>
                                    <select value={assign[`${pr.id}:${axId}`] ?? ''}
                                        onChange={e => setAssign(a => ({ ...a, [`${pr.id}:${axId}`]: e.target.value }))}
                                        className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-neutral-800 text-gray-900 dark:text-white">
                                        <option value="">— не задано —</option>
                                        {(axisValues[axId] ?? []).map(v => <option key={v.id} value={v.id}>{v.value}</option>)}
                                    </select>
                                </label>
                            ))}
                        </div>
                    ))}
                    </details>
                    {p.product_count > 0 && <div className="text-gray-400">Всего товаров с проблемой: {p.product_count}{p.products_truncated && `; в списке первые ${p.products.length}`}</div>}
                    {hasHints(p.products) && !fromHints && (
                        <button onClick={() => setFromHints(true)}
                            className="mt-1 text-blue-500 underline hover:text-blue-400">
                            Принять все подсказки из parameters_path
                        </button>
                    )}
                </div>
            )}
            {p.values?.length > 0 && <div className="mt-1 text-gray-500">Значения: {p.values.join(', ')}</div>}
        </div>
    );

    return (
        <Modal
            title={OP_TITLE[op]}
            subtitle={[typeName, axis?.name].filter(Boolean).join(' · ')}
            onClose={onClose}
            maxWidth="4xl"
            scrollBody
            bodyClassName="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4"
            footer={
                <div className="flex gap-2 justify-end w-full">
                    <button onClick={onClose}
                        className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm px-4 py-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800">
                        Отмена
                    </button>
                    <button onClick={handleApply} disabled={!canApply}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg transition-colors">
                        {loading ? '...' : 'Применить'}
                    </button>
                </div>
            }
        >
            {needsPosition && (
                <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Поставить после оси</label>
                    <select value={after} onChange={e => { setAfter(e.target.value); setStale(false); }} className={`w-full ${selectCls}`}>
                        <option value="">— выберите —</option>
                        <option value={START}>— в начало цепочки —</option>
                        {chain.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </div>
            )}

            {(fromHints || Object.keys(rules).length > 0) && (
                <div className="text-xs rounded-lg px-3 py-2 border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 space-y-1">
                    <div className="font-medium">Массовые назначения (применятся в этой операции)</div>
                    {fromHints && (
                        <div>Все подсказки из parameters_path{' '}
                            <button onClick={() => setFromHints(false)} className="underline">сбросить</button></div>
                    )}
                    {Object.entries(rules).map(([axId, r]) => (
                        <div key={axId}>{r.axisName} = {r.valueName ?? r.value_id} для всех без значения{' '}
                            <button onClick={() => setRule(axId, r.axisName, '')} className="underline">сбросить</button></div>
                    ))}
                    {plan?.params_set != null && <div className="text-gray-500 dark:text-gray-400">Будет проставлено значений: {Array.isArray(plan.params_set) ? plan.params_set.length : plan.params_set}</div>}
                </div>
            )}

            {stale && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300 text-xs px-3 py-2 rounded-lg">
                    Данные изменились — предпросмотр обновлён, проверьте и примените ещё раз.
                </div>
            )}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300 text-xs px-3 py-2 rounded-lg">{error}</div>
            )}
            {loading && !plan && <div className="text-sm text-gray-400">Расчёт…</div>}

            {plan && (
                <>
                    {blocked && (
                        <div className="space-y-2">
                            <div className={section}>Блокирующие проблемы</div>
                            {(plan.blocking ?? []).map((p, i) => renderProblem(p, i, 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300'))}
                        </div>
                    )}

                    {plan.warnings?.length > 0 && (
                        <div className="space-y-2">
                            <div className={section}>Предупреждения</div>
                            {plan.warnings.map((p, i) => renderProblem(p, i, 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300'))}
                        </div>
                    )}

                    {plan.edges_add?.length > 0 && (
                        <div>
                            <div className={section}>Новые связи ({plan.edges_add.length})</div>
                            <div className="space-y-1">
                                {plan.edges_add.map(e => {
                                    const k = edgeKey(e);
                                    return (
                                        <div key={k} className="flex items-center gap-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5">
                                            <span className="flex-1 text-gray-700 dark:text-gray-300">
                                                {e.from_label} → {e.to_label}
                                                {e.note && <span className="ml-2 text-gray-400">{e.note}</span>}
                                            </span>
                                            {!e.supported && (
                                                <label className="flex items-center gap-1 text-amber-500 shrink-0">
                                                    <input type="checkbox" checked={!!skip[k]}
                                                        onChange={ev => setSkip(s => ({ ...s, [k]: ev.target.checked }))} />
                                                    не создавать
                                                </label>
                                            )}
                                            {!e.supported && !skip[k] && <span className="text-amber-500 shrink-0">нет товаров</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {plan.changed_pairs?.length > 0 && (
                        <div>
                            <div className={section}>Изменённые пары осей: до / после</div>
                            <div className="space-y-2">
                                {plan.changed_pairs.map((cp, i) => (
                                    <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            {cp.from_axis_name} → {cp.to_axis_name}
                                        </div>
                                        <div className="space-y-0.5">
                                            {cp.edges.map((e, j) => (
                                                <div key={j} className={`text-xs ${e.new ? 'text-emerald-600' : 'text-gray-500 dark:text-gray-400'}`}>
                                                    {e.new ? '+ ' : '  '}{e.from_label} → {e.to_label}
                                                    <span className="ml-2 text-gray-400">товаров: {e.products}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {(plan.order_before || plan.order_after) && (
                        <div className="grid grid-cols-2 gap-3">
                            {[['Порядок до', plan.order_before], ['Порядок после', plan.order_after]].map(([t, list]) => (
                                <div key={t}>
                                    <div className={section}>{t}</div>
                                    <ol className="text-xs text-gray-700 dark:text-gray-300 space-y-0.5">
                                        {[...(list ?? [])].sort((x, y) => x.order - y.order).map(a => (
                                            <li key={a.id} className={a.id === axis?.id ? 'font-semibold' : ''}>
                                                {a.order}. {a.name}{a.shared && <span className="ml-1 text-gray-400">(общая)</span>}
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            ))}
                        </div>
                    )}

                    {plan.comparison && !plan.comparison.exact && plan.comparison.unreachable?.length > 0 && (
                        <div className="text-xs text-amber-500">
                            Недостижимые сочетания после операции: {plan.comparison.unreachable.length}
                        </div>
                    )}

                    {plan.other_types?.length > 0 && (
                        <div className="text-xs text-amber-500">
                            Затрагивает другие типы (общая ось): {plan.other_types.map(t => `${t.name} (+${t.edges_add} связей)`).join(', ')}
                        </div>
                    )}

                    {needConfirm && (
                        <label className="flex items-start gap-2 text-sm text-red-500">
                            <input type="checkbox" className="mt-1" checked={confirmLosses}
                                onChange={e => setConfirmLosses(e.target.checked)} />
                            Операция удалит данные (связи / значения у товаров). Подтверждаю потерю.
                        </label>
                    )}

                    {['edges_delete', 'axis_edges_delete', 'params_delete'].some(k => plan[k]?.length > 0) && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                            {staleCount > 0 && <div>Будут удалены {staleCount} связей между осями, которые больше не соседние</div>}
                            {flipCount > 0 && <div>Будут развёрнуты {flipCount} связей (вместо каждой создаётся обратная)</div>}
                            {otherDelCount > 0 && <div>Будут удалены связи: {otherDelCount}</div>}
                            {plan.axis_edges_delete?.length > 0 && <div>Связей осей: {plan.axis_edges_delete.length}</div>}
                            {plan.params_delete?.length > 0 && <div>Значений у товаров: {plan.params_delete.length}</div>}
                        </div>
                    )}
                </>
            )}
        </Modal>
    );
}
