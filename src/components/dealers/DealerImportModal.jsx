import { useEffect, useRef, useState } from 'react';
import { dealersApi } from '../../api/dealers';
import { envelopeError } from '../../utils';
import FileDropZone from '../common/FileDropZone';
import Modal from '../common/Modal';
import ModalFooter from '../common/ModalFooter';

const POLL_MS = 2000;

const STATUS_LABEL = {
    PENDING: 'Задача в очереди…',
    RUNNING: 'Импорт выполняется…',
    COMPLETED: 'Импорт завершён',
    FAILED: 'Импорт не выполнен',
};

const countRow = (label, value) => (
    <div className="flex justify-between gap-4">
        <span className="text-gray-500 dark:text-gray-400">{label}</span>
        <span className="font-medium text-gray-900 dark:text-white">{value ?? 0}</span>
    </div>
);

// Импорт справочника из xlsx: файл → celery-задача портала → опрос
// import-status раз в 2 с. Итог — счётчики и ошибки по строкам: битая строка
// не валит импорт, она попадает в errors[{row, inn, error}].
export default function DealerImportModal({ onClose, onImported }) {
    const [file, setFile] = useState(null);
    const [taskId, setTaskId] = useState(null);
    const [task, setTask] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const onImportedRef = useRef(onImported);
    onImportedRef.current = onImported;

    useEffect(() => {
        if (!taskId) return undefined;
        let stopped = false;

        const poll = async () => {
            const { ok, status, data } = await dealersApi.importStatus(taskId);
            if (stopped) return;
            if (!ok || data?.success === false) {
                stopped = true;
                setTaskId(null);
                setBusy(false);
                setError(envelopeError(data, status));
                return;
            }
            const next = data.data;
            setTask(next);
            if (next.status !== 'COMPLETED' && next.status !== 'FAILED') return;

            stopped = true;
            setTaskId(null);
            setBusy(false);
            if (next.status === 'FAILED') setError(next.result?.error || 'Импорт завершился с ошибкой');
            // Список мог измениться и при частичном прогоне — перезагружаем всегда.
            onImportedRef.current?.(next);
        };

        const timer = setInterval(poll, POLL_MS);
        poll();
        return () => {
            stopped = true;
            clearInterval(timer);
        };
    }, [taskId]);

    const start = async () => {
        if (!file || busy) return;
        setBusy(true);
        setError('');
        setTask(null);
        try {
            const { ok, status, data } = await dealersApi.importXlsx(file);
            if (!ok || data?.success === false) {
                setBusy(false);
                setError(envelopeError(data, status));
                return;
            }
            setTask({ status: 'PENDING' });
            setTaskId(data.data.task_id);
        } catch {
            setBusy(false);
            setError('Не удалось загрузить файл');
        }
    };

    const done = task?.status === 'COMPLETED' || task?.status === 'FAILED';
    const errors = task?.errors || [];
    const statusText = task ? (STATUS_LABEL[task.status] || task.status) : '';

    return (
        <Modal
            title="Импорт дилеров из xlsx"
            subtitle="Справочник обновляется по ИНН: существующие дилеры правятся, новые создаются"
            onClose={onClose}
            maxWidth="lg"
            scrollBody
            footer={(
                <ModalFooter
                    onClose={onClose}
                    onConfirm={done ? undefined : start}
                    loading={busy}
                    disabled={!file}
                    confirmLabel="Импортировать"
                    closeLabel={done ? 'Закрыть' : 'Отмена'}
                />
            )}
        >
            <div className="space-y-4">
                {!taskId && !done && (
                    <>
                        <FileDropZone
                            file={file}
                            onFile={(f) => { setFile(f); setError(''); }}
                            accept=".xlsx"
                            hint=".xlsx, выгрузка справочника дилеров"
                        />
                        {/* Колонку разбирает портал (d1c864e): необязательная, по шапке,
                            код или подпись; пустая ячейка не сбрасывает уже назначенную группу */}
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                            Необязательная колонка «Группа»: Дилер / Филиал / Дистрибьютор /
                            Сервисный центр (или dealer/branch/distributor/service_center).
                            Пустая ячейка сохраняет текущую группу, у новых записей — Дилер.
                        </p>
                    </>
                )}

                {busy && (
                    <div className="space-y-1">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            {statusText || 'Загрузка файла…'}{taskId ? ` (задача #${taskId})` : ''}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                            Импорт идёт в фоне; окно можно закрыть — задача на портале
                            продолжит выполняться.
                        </p>
                    </div>
                )}

                {done && task.status === 'COMPLETED' && (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-1 text-sm">
                        {countRow('Строк в файле', task.rows_total)}
                        {countRow('Создано', task.created)}
                        {countRow('Обновлено', task.updated)}
                        {countRow('Отменено авторизации', task.revoked)}
                        {countRow('Ошибок', errors.length)}
                    </div>
                )}

                {error && (!busy || done) && (
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                )}
                {errors.length > 0 && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400
                            bg-neutral-50 dark:bg-neutral-800 border-b border-gray-200 dark:border-gray-700">
                            Строки с ошибками ({errors.length}) — остальные применены
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-left text-gray-500 dark:text-gray-400">
                                        <th className="px-3 py-1.5 font-medium whitespace-nowrap">Строка</th>
                                        <th className="px-3 py-1.5 font-medium whitespace-nowrap">ИНН</th>
                                        <th className="px-3 py-1.5 font-medium">Ошибка</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {errors.map((e, i) => (
                                        <tr key={`${e.row}-${i}`}
                                            className="border-t border-gray-100 dark:border-gray-800">
                                            <td className="px-3 py-1.5 font-mono whitespace-nowrap">{e.row ?? '—'}</td>
                                            <td className="px-3 py-1.5 font-mono whitespace-nowrap">{e.inn || '—'}</td>
                                            <td className="px-3 py-1.5 text-red-600 dark:text-red-400">{e.error}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {done && task.status === 'COMPLETED' && errors.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                        Все строки применены без ошибок. Список дилеров обновлён.
                    </p>
                )}
            </div>
        </Modal>
    );
}
