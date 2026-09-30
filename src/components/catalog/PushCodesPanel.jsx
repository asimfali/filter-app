import { useState, useEffect } from 'react';
import { catalogApi } from '../../api/catalog';
import useTaskPolling from '../../hooks/useTaskPolling';
import ConfirmModal from '../common/ConfirmModal';

const CAUSE_LABEL = {
    not_found: 'Товар не найден',
    inactive: 'Товар деактивирован в каталоге',
    no_codes: 'У товара нет ТНВЭД/ОКПД2',
    '1c_error': 'Отказ 1С',
    bad_response: 'Некорректный ответ 1С',
    exception: 'Ошибка',
};

// Запись ТНВЭД/ОКПД2 в 1С (catalog.push_codes_to_1c): сначала «Проверить» (dry_run, 1С не пишет),
// затем отдельная «Записать в 1С» с подтверждением — запись юридически значимая. Поллинг — useTaskPolling.
export default function PushCodesPanel({ productIds, onDone }) {
    const [confirming, setConfirming] = useState(false);
    const [result, setResult] = useState(null); // {dry_run,total,pushed,changed,errors}

    useEffect(() => { setResult(null); }, [productIds]); // проверка относится к конкретному выбору

    const { busy, info, error, start: run } = useTaskPolling(catalogApi.taskStatus, (r, err) => {
        if (err) return;
        setResult(r);
        if (!r.dry_run) onDone?.(r);
    });
    const progress = info?.status;

    const start = async (dryRun) => {
        setConfirming(false);
        setResult(null);
        await run(() => catalogApi.pushCodesTo1C(productIds, dryRun), 'Не удалось запустить отправку');
    };

    const disabled = busy || productIds.length === 0;
    const btn = 'shrink-0 px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50 transition-colors';
    const checked = result?.dry_run === true;

    return (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">Записать коды в 1С</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        ТНВЭД/ОКПД2 выбранных товаров — в карточки номенклатуры. Сначала «Проверить»: 1С ничего не пишет,
                        только считает, что изменится. Запись юридически значимая.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => start(true)} disabled={disabled} className={`${btn} bg-gray-600 hover:bg-gray-700`}>
                        {busy ? (progress || 'Выполняется…') : `Проверить в 1С (${productIds.length})`}
                    </button>
                    <button onClick={() => setConfirming(true)} disabled={disabled || !checked}
                        title={checked ? '' : 'Сначала выполните проверку'}
                        className={`${btn} bg-blue-600 hover:bg-blue-700`}>
                        Записать в 1С
                    </button>
                </div>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            {result && (
                <div className="text-xs space-y-1.5 border-t border-gray-100 dark:border-gray-800 pt-3">
                    <p className="text-gray-700 dark:text-gray-300">
                        {result.dry_run ? 'Проверка' : 'Запись'}: обработано {result.pushed} из {result.total},
                        {result.dry_run ? ' изменится в 1С: ' : ' изменено в 1С: '}{result.changed}
                        {result.errors?.length > 0 && `, ошибок: ${result.errors.length}`}.
                    </p>
                    {result.errors?.length > 0 && (
                        <ul className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                            {result.errors.map((e, i) => (
                                <li key={i} className="px-2.5 py-1.5 flex items-start justify-between gap-3">
                                    <span className="text-gray-700 dark:text-gray-300">{e.product}</span>
                                    <span className="text-right text-gray-500 dark:text-gray-400 shrink-0">
                                        {e.error || CAUSE_LABEL[e.cause] || e.cause}
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
                    message={`Записать ТНВЭД/ОКПД2 ${productIds.length} товаров в 1С? Действие юридически значимое и не отменяется.`}
                    onConfirm={() => start(false)}
                    onCancel={() => setConfirming(false)}
                />
            )}
        </div>
    );
}
