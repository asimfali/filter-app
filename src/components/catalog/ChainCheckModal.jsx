import { useState, useEffect, useCallback } from 'react';
import Modal from '../common/Modal';
import ChainOperationModal from './ChainOperationModal';
import { catalogApi } from '../../api/catalog';
import { envelopeError, fmtDate } from '../../utils';

const LEVEL_CLS = {
    error: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300',
    warning: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300',
    info: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300',
};

// «Проверить цепочку»: анализ проблем, кнопка «Починить» (op=repair), история операций с отменой.
export default function ChainCheckModal({ typeId, typeName, onClose, onChanged }) {
    const [report, setReport] = useState(null);
    const [ops, setOps] = useState([]);
    const [error, setError] = useState('');
    const [repair, setRepair] = useState(false);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setError('');
        const [a, o] = await Promise.all([catalogApi.chainAnalyze(typeId), catalogApi.chainOperations(typeId)]);
        if (a.ok && a.data.success !== false) setReport(a.data.data ?? a.data);
        else setError(envelopeError(a.data, a.status));
        if (o.ok) setOps(Array.isArray(o.data) ? o.data : (o.data?.data ?? o.data?.results ?? []));
    }, [typeId]);

    useEffect(() => { load(); }, [load]);

    const undo = async (id) => {
        setBusy(true);
        setError('');
        try {
            const { ok, status, data } = await catalogApi.chainUndo(id);
            if (!ok || data.success === false) setError(envelopeError(data, status));
            else { onChanged?.(); await load(); }
        } catch {
            setError('Ошибка соединения');
        } finally {
            setBusy(false);
        }
    };

    const counts = report?.counts ?? {};
    const fixable = (counts.error ?? 0) + (counts.warning ?? 0) > 0;

    return (
        <Modal title="Проверка цепочки осей" subtitle={typeName} onClose={onClose} maxWidth="4xl" scrollBody
            footer={
                <div className="flex gap-2 justify-end">
                    <button onClick={onClose}
                        className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm px-4 py-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800">
                        Закрыть
                    </button>
                    <button onClick={() => setRepair(true)} disabled={!fixable}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg transition-colors">
                        Починить…
                    </button>
                </div>
            }>
            <div className="space-y-4">
                {error && <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300 text-xs px-3 py-2 rounded-lg">{error}</div>}
                {!report && !error && <div className="text-sm text-gray-400">Анализ…</div>}
                {report && (
                    <>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                            Цепочка: {report.chain.map(a => `${a.order}. ${a.name}`).join(' → ') || '—'}
                            <span className="ml-3">ошибок: {counts.error ?? 0} · предупреждений: {counts.warning ?? 0} · заметок: {counts.info ?? 0}</span>
                        </div>
                        {report.problems.length === 0 && (
                            <div className="text-sm text-emerald-600">Проблем не найдено ✓</div>
                        )}
                        <div className="space-y-2">
                            {report.problems.map((p, i) => (
                                <div key={i} className={`text-xs rounded-lg px-3 py-2 border ${LEVEL_CLS[p.level] ?? LEVEL_CLS.info}`}>
                                    {p.message}
                                    {p.product_count > 0 && <span className="ml-2 opacity-70">товаров: {p.product_count}</span>}
                                </div>
                            ))}
                        </div>
                    </>
                )}

                <div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">История операций</div>
                    {ops.length === 0 ? <div className="text-xs text-gray-400">Операций нет</div> : (
                        <div className="space-y-1">
                            {ops.map(o => (
                                <div key={o.id} className="flex items-center gap-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5">
                                    <span className="flex-1 text-gray-700 dark:text-gray-300">
                                        {fmtDate(o.created_at, true)} · {o.kind} · {o.user_name}
                                        {o.undone_at && <span className="ml-2 text-gray-400">отменена {fmtDate(o.undone_at, true)}{o.undone_by_name && ` (${o.undone_by_name})`}</span>}
                                    </span>
                                    {o.can_undo && (
                                        <button onClick={() => undo(o.id)} disabled={busy}
                                            className="text-blue-500 hover:text-blue-400 underline disabled:opacity-40">Отменить</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {repair && (
                <ChainOperationModal typeId={typeId} typeName={typeName} op="repair"
                    onClose={() => setRepair(false)}
                    onApplied={() => { onChanged?.(); load(); }} />
            )}
        </Modal>
    );
}
