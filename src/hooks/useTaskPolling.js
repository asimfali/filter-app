import { useState, useEffect, useRef } from 'react';
import { envelopeError } from '../utils';

const POLL_MS = 2000;

// Запуск celery-задачи ({success, data: {task_id, message?}}) и опрос её статуса
// ({success, data: {status, ready, info, result}}) раз в 2 с.
// onReady(result, error) — по завершении; error непустой при FAILURE или result.success === false.
export default function useTaskPolling(getStatus, onReady) {
    const [taskId, setTaskId] = useState(null);
    const [busy, setBusy] = useState(false);
    const [info, setInfo] = useState(null); // info задачи; до первого опроса — {status: message запуска}
    const [error, setError] = useState('');
    const getStatusRef = useRef(getStatus);
    getStatusRef.current = getStatus;
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;

    useEffect(() => {
        if (!taskId) return undefined;
        const poll = async () => {
            const { ok, data } = await getStatusRef.current(taskId);
            if (!ok || !data?.success) return;
            const { ready, status, info: taskInfo, result } = data.data;
            if (taskInfo) setInfo(taskInfo);
            if (!ready) return;
            setTaskId(null);
            setBusy(false);
            const err = status === 'FAILURE' || result?.success === false
                ? (result?.error || 'Задача завершилась с ошибкой') : '';
            setError(err);
            onReadyRef.current?.(result, err);
        };
        const t = setInterval(poll, POLL_MS);
        poll();
        return () => clearInterval(t);
    }, [taskId]);

    // launch — вызов api, возвращающий {ok, status, data}
    const start = async (launch, failMessage = 'Не удалось запустить задачу') => {
        setBusy(true);
        setError('');
        try {
            const { ok, data, status } = await launch();
            if (ok && data?.success) {
                setInfo({ status: data.data.message || 'Запуск…' });
                setTaskId(data.data.task_id);
            } else {
                setBusy(false);
                setError(envelopeError(data, status));
            }
        } catch {
            setBusy(false);
            setError(failMessage);
        }
    };

    return { busy, info, error, start };
}
