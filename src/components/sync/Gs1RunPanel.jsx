import { useState, useEffect, useCallback, useRef } from 'react';
import { externalApi } from '../../api/external';
import { gs1Error, fmtGs1Date, GS1_RUN_STATUS_LABEL } from '../../utils/gs1';
import ConfirmModal from '../common/ConfirmModal';

const POLL_MS = 3000;
const WAIT_START_MS = 120000; // сколько ждём, пока Celery подхватит задачу и создаст запись запуска

const RUN_STATUS_COLOR = {
    running: 'text-blue-600 dark:text-blue-400',
    success: 'text-emerald-600 dark:text-emerald-400',
    failed: 'text-red-600 dark:text-red-400',
};

const RUN_COLUMNS = [
    ['registry_total', 'Реестр'], ['fetched', 'Карточек'], ['matched', 'Совпало'],
    ['conflicts', 'Конфликтов'], ['unmatched', 'Не найдено'], ['failed', 'Ошибок'],
    ['skipped_no_record', 'Без карточки'],
];

// Блок запуска синхронизации с ГС1 и история запусков (external.gs1_sync).
// Запуск идёт минуты — вместо статуса Celery-задачи опрашиваем runs/: запись запуска
// создаётся при старте задачи и переходит running → success/failed.
export default function Gs1RunPanel({ onFinished }) {
    const [runs, setRuns] = useState([]);
    const [applyMatches, setApplyMatches] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState('');
    // {baselineId, at} — запуск поставлен в очередь, ждём появления/завершения новой записи
    const [pending, setPending] = useState(null);
    const onFinishedRef = useRef(onFinished);
    onFinishedRef.current = onFinished;

    const load = useCallback(async () => {
        try {
            const { ok, data } = await externalApi.getGs1Runs({ page_size: 10 });
            if (ok && data?.success) setRuns(data.data.results ?? []);
            else if (!ok) setError(gs1Error(data));
        } catch {
            setError('Не удалось загрузить историю запусков');
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const latest = runs[0];
    const running = latest?.status === 'running';
    const queued = !!pending && latest?.id === pending.baselineId && Date.now() - pending.at < WAIT_START_MS;
    const busy = running || queued;

    // Завершение: появилась новая запись запуска и она уже не running
    useEffect(() => {
        if (pending && latest && latest.id !== pending.baselineId && !running) {
            setPending(null);
            onFinishedRef.current?.();
        }
    }, [pending, latest, running]);

    useEffect(() => {
        if (!busy) return undefined;
        const t = setInterval(load, POLL_MS);
        return () => clearInterval(t);
    }, [busy, load]);

    const start = async () => {
        setConfirming(false);
        setStarting(true);
        setError('');
        try {
            const { ok, data, status } = await externalApi.startGs1Sync(applyMatches);
            if (ok && data?.success) {
                setPending({ baselineId: latest?.id ?? null, at: Date.now() });
                load();
            } else {
                setError(gs1Error(data, status));
                if (status === 409) load(); // уже идёт — покажем как running
            }
        } catch {
            setError('Не удалось запустить синхронизацию');
        } finally {
            setStarting(false);
        }
    };

    return (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input type="checkbox" className="rounded" checked={applyMatches} disabled={busy}
                            onChange={e => setApplyMatches(e.target.checked)} />
                        Записывать совпадения в каталог
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xl">
                        Выключено — пробный запуск (dry-run): только наполнит очередь разбора и предложит
                        совпадения, GTIN в товары не пишутся. Включите, чтобы строгие совпадения
                        записывались в Product.gtin.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {busy && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                            {running ? 'Синхронизация выполняется…' : 'Запуск поставлен в очередь…'}
                        </span>
                    )}
                    <button
                        onClick={() => (applyMatches ? setConfirming(true) : start())}
                        disabled={busy || starting}
                        className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white
                                   disabled:opacity-50 transition-colors">
                        {starting ? 'Запуск…' : 'Синхронизировать с ГС1'}
                    </button>
                </div>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            {runs.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-left text-gray-500 dark:text-gray-400">
                                <th className="py-1 pr-3 font-medium">Запуск</th>
                                <th className="py-1 pr-3 font-medium">Режим</th>
                                <th className="py-1 pr-3 font-medium">Статус</th>
                                {RUN_COLUMNS.map(([key, label]) => (
                                    <th key={key} className="py-1 pr-3 font-medium text-right">{label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="text-gray-700 dark:text-gray-300">
                            {runs.map(run => (
                                <tr key={run.id} className="border-t border-gray-100 dark:border-gray-800">
                                    <td className="py-1.5 pr-3 whitespace-nowrap">
                                        {fmtGs1Date(run.created_at, true)}
                                        <span className="text-gray-400"> · {run.trigger === 'beat' ? 'авто' : 'вручную'}</span>
                                    </td>
                                    <td className="py-1.5 pr-3 whitespace-nowrap">
                                        {run.apply_matches ? 'запись' : 'dry-run'}
                                    </td>
                                    <td className={`py-1.5 pr-3 whitespace-nowrap ${RUN_STATUS_COLOR[run.status] ?? ''}`}>
                                        {GS1_RUN_STATUS_LABEL[run.status] ?? run.status}
                                    </td>
                                    {RUN_COLUMNS.map(([key]) => (
                                        <td key={key} className="py-1.5 pr-3 text-right tabular-nums">{run[key] ?? 0}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {confirming && (
                <ConfirmModal
                    danger={false}
                    message="Запуск с записью: строгие совпадения будут записаны в GTIN товаров каталога. Продолжить?"
                    onConfirm={start}
                    onCancel={() => setConfirming(false)}
                />
            )}
        </div>
    );
}
