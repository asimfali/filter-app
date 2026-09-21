import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Gs1RunPanel from '../Gs1RunPanel';
import { externalApi } from '../../../api/external';

vi.mock('../../../api/external', () => ({
    externalApi: { getGs1Runs: vi.fn(), startGs1Sync: vi.fn() },
}));

const run = (over = {}) => ({
    id: 1, status: 'success', trigger: 'beat', apply_matches: false, created_at: '2026-03-05T04:00:00Z',
    registry_total: 100, fetched: 10, matched: 0, conflicts: 3, unmatched: 2, failed: 0, skipped_no_record: 1, ...over,
});
const runs = (...results) => ({ ok: true, status: 200, data: { success: true, data: { results } } });
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    externalApi.getGs1Runs.mockResolvedValue(runs(run()));
});
afterEach(() => vi.useRealTimers());

describe('Gs1RunPanel', () => {
    it('показывает историю запусков со счётчиками и режимом', async () => {
        render(<Gs1RunPanel />);
        await flush();
        expect(screen.getByText('dry-run')).toBeInTheDocument();
        expect(screen.getByText('Успешно')).toBeInTheDocument();
        expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('по умолчанию чекбокс выключен: запуск идёт как dry-run без подтверждения', async () => {
        externalApi.startGs1Sync.mockResolvedValue({ ok: true, status: 200, data: { success: true, data: { task_id: 't' } } });
        render(<Gs1RunPanel />);
        await flush();
        expect(screen.getByRole('checkbox')).not.toBeChecked();

        fireEvent.click(screen.getByRole('button', { name: 'Синхронизировать с ГС1' }));
        await flush();
        expect(externalApi.startGs1Sync).toHaveBeenCalledWith(false);
        expect(screen.queryByText(/Запуск с записью/)).not.toBeInTheDocument();
    });

    it('запуск с записью требует подтверждения', async () => {
        externalApi.startGs1Sync.mockResolvedValue({ ok: true, status: 200, data: { success: true, data: { task_id: 't' } } });
        render(<Gs1RunPanel />);
        await flush();
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: 'Синхронизировать с ГС1' }));
        expect(externalApi.startGs1Sync).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));
        await flush();
        expect(externalApi.startGs1Sync).toHaveBeenCalledWith(true);
    });

    it('опрашивает историю до завершения запуска и вызывает onFinished', async () => {
        const onFinished = vi.fn();
        externalApi.startGs1Sync.mockResolvedValue({ ok: true, status: 200, data: { success: true, data: { task_id: 't' } } });
        render(<Gs1RunPanel onFinished={onFinished} />);
        await flush();

        externalApi.getGs1Runs.mockResolvedValue(runs(run({ id: 2, status: 'running' }), run()));
        fireEvent.click(screen.getByRole('button', { name: 'Синхронизировать с ГС1' }));
        await flush();
        expect(screen.getByText('Синхронизация выполняется…')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Синхронизировать с ГС1' })).toBeDisabled();
        expect(onFinished).not.toHaveBeenCalled();

        externalApi.getGs1Runs.mockResolvedValue(runs(run({ id: 2, status: 'success', matched: 5 }), run()));
        await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
        expect(onFinished).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Синхронизация выполняется…')).not.toBeInTheDocument();
    });

    it('409 already_running показывает ошибку бэкенда', async () => {
        externalApi.startGs1Sync.mockResolvedValue({
            ok: false, status: 409,
            data: { success: false, error: { code: 'already_running', message: 'Синхронизация ГС1 уже выполняется' } },
        });
        render(<Gs1RunPanel />);
        await flush();
        fireEvent.click(screen.getByRole('button', { name: 'Синхронизировать с ГС1' }));
        await flush();
        expect(screen.getByText('Синхронизация ГС1 уже выполняется')).toBeInTheDocument();
    });
});
