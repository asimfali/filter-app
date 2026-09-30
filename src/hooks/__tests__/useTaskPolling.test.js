import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import useTaskPolling from '../useTaskPolling';

const launched = (taskId, message) => ({ ok: true, data: { success: true, data: { task_id: taskId, message } } });
const status = (data) => ({ ok: true, data: { success: true, data } });

beforeEach(() => vi.clearAllMocks());

describe('useTaskPolling', () => {
    it('запуск → busy, info из message; опрос до ready → onReady(result, "")', async () => {
        const getStatus = vi.fn()
            .mockResolvedValueOnce(status({ status: 'PROGRESS', ready: false, info: { current: 1, total: 4 } }))
            .mockResolvedValue(status({ status: 'SUCCESS', ready: true, result: { success: true, total: 4 } }));
        const onReady = vi.fn();
        const { result } = renderHook(() => useTaskPolling(getStatus, onReady));

        vi.useFakeTimers({ shouldAdvanceTime: true });
        await act(() => result.current.start(() => Promise.resolve(launched('t1', 'Старт'))));
        expect(result.current.busy).toBe(true);
        await waitFor(() => expect(result.current.info).toEqual({ current: 1, total: 4 }));

        await act(() => vi.advanceTimersByTimeAsync(2000));
        await waitFor(() => expect(onReady).toHaveBeenCalledWith({ success: true, total: 4 }, ''));
        expect(result.current.busy).toBe(false);
        expect(getStatus).toHaveBeenCalledWith('t1');
        vi.useRealTimers();
    });

    it('result.success=false — error из result.error, onReady получает result и ошибку', async () => {
        const res = { success: false, error: 'Реестр недоступен', found: 2 };
        const getStatus = vi.fn().mockResolvedValue(status({ status: 'SUCCESS', ready: true, result: res }));
        const onReady = vi.fn();
        const { result } = renderHook(() => useTaskPolling(getStatus, onReady));
        await act(() => result.current.start(() => Promise.resolve(launched('t2'))));
        await waitFor(() => expect(onReady).toHaveBeenCalledWith(res, 'Реестр недоступен'));
        expect(result.current.error).toBe('Реестр недоступен');
    });

    it('FAILURE без result — дефолтное сообщение', async () => {
        const getStatus = vi.fn().mockResolvedValue(status({ status: 'FAILURE', ready: true, result: null }));
        const { result } = renderHook(() => useTaskPolling(getStatus));
        await act(() => result.current.start(() => Promise.resolve(launched('t3'))));
        await waitFor(() => expect(result.current.error).toBe('Задача завершилась с ошибкой'));
    });

    it('ошибка запуска: строковый error (403) и исключение', async () => {
        const getStatus = vi.fn();
        const { result } = renderHook(() => useTaskPolling(getStatus));
        await act(() => result.current.start(() => Promise.resolve(
            { ok: false, status: 403, data: { success: false, error: 'Нет прав' } })));
        expect(result.current.error).toBe('Нет прав');
        expect(result.current.busy).toBe(false);

        await act(() => result.current.start(() => Promise.reject(new Error('net')), 'Не удалось'));
        expect(result.current.error).toBe('Не удалось');
        expect(getStatus).not.toHaveBeenCalled();
    });
});
