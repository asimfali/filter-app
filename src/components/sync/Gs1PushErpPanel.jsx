import { useState, useEffect, useRef } from 'react';
import { catalogApi } from '../../api/catalog';
import { parseError } from '../../utils';
import ConfirmModal from '../common/ConfirmModal';

const POLL_MS = 2000;

const CAUSE_LABEL = {
    no_gtin: 'У товара не заполнен GTIN локально',
    '1c_error': 'Отказ 1С',
    exception: 'Ошибка',
    inactive: 'Товар деактивирован в каталоге',
    not_found: 'Товар не найден',
};

// Юридически значимая запись GTIN сопоставленных товаров в 1С (Честный знак/Контур.Маркировка).
// Список товаров — выбор из вкладки «Сопоставленные» очереди ГС1 (external.gs1_resolve),
// право на саму отправку — catalog.push_gtin_to_1c, отдельное от разбора очереди.
export default function Gs1PushErpPanel({ productIds, onDone }) {
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [taskId, setTaskId] = useState(null);
    const [progress, setProgress] = useState('');
    const [error, setError] = useState('');
    const [result, setResult] = useState(null); // {total, pushed, errors}
    const onDoneRef = useRef(onDone);
    onDoneRef.current = onDone;

    useEffect(() => {
        if (!taskId) return undefined;
        const poll = async () => {
            const { ok, data } = await catalogApi.taskStatus(taskId);
            if (!ok || !data?.success) return;
            const { ready, status, info, result: taskResult } = data.data;
            if (info?.status) setProgress(info.status);
            if (ready) {
                setTaskId(null);
                setBusy(false);
                if (status === 'FAILURE' || taskResult?.success === false) {
                    setError(taskResult?.error || 'Задача завершилась с ошибкой');
                } else {
                    setResult(taskResult);
                    onDoneRef.current?.(taskResult);
                }
            }
        };
        const t = setInterval(poll, POLL_MS);
        poll();
        return () => clearInterval(t);
    }, [taskId]);

    const start = async () => {
        setConfirming(false);
        setBusy(true);
        setError('');
        setResult(null);
        try {
            const { ok, data, status } = await catalogApi.pushGtinTo1C(productIds);
            if (ok && data?.success) {
                setProgress(data.data.message || 'Запуск…');
                setTaskId(data.data.task_id);
            } else {
                setBusy(false);
                setError(data?.error || parseError(data, status));
            }
        } catch {
            setBusy(false);
            setError('Не удалось запустить отправку');
        }
    };

    const disabled = busy || productIds.length === 0;

    return (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">Отправить GTIN в 1С</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Записывает GTIN выбранных товаров в регистр «Штрихкоды номенклатуры» — источник
                        данных для Контур.Маркировки/Честного знака. Действие юридически значимое, отмене не подлежит.
                    </p>
                </div>
                <button
                    onClick={() => setConfirming(true)}
                    disabled={disabled}
                    className="shrink-0 px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white
                               disabled:opacity-50 transition-colors">
                    {busy ? (progress || 'Выполняется…') : `Отправить GTIN в 1С (${productIds.length})`}
                </button>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            {result && (
                <div className="text-xs space-y-1.5 border-t border-gray-100 dark:border-gray-800 pt-3">
                    <p className="text-gray-700 dark:text-gray-300">
                        Отправлено {result.pushed} из {result.total}
                        {result.errors?.length > 0 && `, ошибок: ${result.errors.length}`}.
                    </p>
                    {result.errors?.length > 0 && (
                        <ul className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                            {result.errors.map((e, i) => (
                                <li key={i} className="px-2.5 py-1.5 flex items-start justify-between gap-3">
                                    <span className="text-gray-700 dark:text-gray-300">{e.product}</span>
                                    <span className="text-right text-gray-500 dark:text-gray-400 shrink-0">
                                        {CAUSE_LABEL[e.cause] ?? e.cause}: {e.error}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {confirming && (
                <ConfirmModal
                    danger={false}
                    message={`Записать GTIN ${productIds.length} товаров в регистр «Штрихкоды номенклатуры» в 1С? Действие юридически значимое (источник для Честного знака) и не отменяется.`}
                    onConfirm={start}
                    onCancel={() => setConfirming(false)}
                />
            )}
        </div>
    );
}
