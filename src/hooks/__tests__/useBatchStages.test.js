import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useBatchStages, useProductStages } from '../useBatchStages';
import { plmApi } from '../../api/plm';

vi.mock('../../api/plm', () => ({
    plmApi: {
        getStages: vi.fn(),
    },
}));

const ok = (data) => ({ ok: true, data: { success: true, data } });

beforeEach(() => {
    vi.clearAllMocks();
});

describe('useBatchStages', () => {
    it('не грузит ничего для пустого/undefined productIds', () => {
        const { result } = renderHook(() => useBatchStages([]));
        expect(plmApi.getStages).not.toHaveBeenCalled();
        expect(result.current.stagesByProduct).toEqual({});

        const { result: result2 } = renderHook(() => useBatchStages(undefined));
        expect(result2.current.loading).toBe(false);
    });

    it('грузит стадии параллельно для каждого id, собирает { [id]: stages }', async () => {
        plmApi.getStages.mockImplementation((id) => Promise.resolve(
            id === 1 ? ok([{ id: 10, status: 'active' }]) : ok([])
        ));
        const { result } = renderHook(() => useBatchStages([1, 2]));

        expect(plmApi.getStages).toHaveBeenCalledWith(1);
        expect(plmApi.getStages).toHaveBeenCalledWith(2);
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.stagesByProduct).toEqual({
            1: [{ id: 10, status: 'active' }],
            2: [],
        });
    });

    it('неуспешный ответ для конкретного id даёт []', async () => {
        plmApi.getStages.mockImplementation((id) => Promise.resolve(
            id === 1 ? ok([{ id: 10 }]) : { ok: false, data: { success: false } }
        ));
        const { result } = renderHook(() => useBatchStages([1, 2]));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.stagesByProduct[2]).toEqual([]);
    });

    it('reload() перезапрашивает стадии', async () => {
        plmApi.getStages.mockResolvedValue(ok([{ id: 1 }]));
        const { result } = renderHook(() => useBatchStages([1]));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(plmApi.getStages).toHaveBeenCalledTimes(1);

        await act(async () => { await result.current.reload(); });
        expect(plmApi.getStages).toHaveBeenCalledTimes(2);
    });
});

describe('useProductStages', () => {
    it('автовыбирает активную стадию, если есть', async () => {
        plmApi.getStages.mockResolvedValue(ok([
            { id: 1, status: 'draft' },
            { id: 2, status: 'active' },
        ]));
        const { result } = renderHook(() => useProductStages(5));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.selectedStage).toEqual({ id: 2, status: 'active' });
        expect(result.current.stages).toHaveLength(2);
    });

    it('без активной стадии выбирает первую из списка', async () => {
        plmApi.getStages.mockResolvedValue(ok([{ id: 1, status: 'draft' }, { id: 2, status: 'archived' }]));
        const { result } = renderHook(() => useProductStages(5));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.selectedStage).toEqual({ id: 1, status: 'draft' });
    });

    it('пустой список стадий — selectedStage null', async () => {
        plmApi.getStages.mockResolvedValue(ok([]));
        const { result } = renderHook(() => useProductStages(5));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.selectedStage).toBeNull();
    });

    it('setSelectedStage меняет выбор вручную', async () => {
        const stages = [{ id: 1, status: 'draft' }, { id: 2, status: 'archived' }];
        plmApi.getStages.mockResolvedValue(ok(stages));
        const { result } = renderHook(() => useProductStages(5));
        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => result.current.setSelectedStage(stages[1]));
        expect(result.current.selectedStage).toEqual(stages[1]);
    });

    it('без productId не грузит', () => {
        renderHook(() => useProductStages(null));
        expect(plmApi.getStages).not.toHaveBeenCalled();
    });

    it('reload() перезапрашивает', async () => {
        plmApi.getStages.mockResolvedValue(ok([{ id: 1, status: 'active' }]));
        const { result } = renderHook(() => useProductStages(5));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(plmApi.getStages).toHaveBeenCalledTimes(1);

        await act(async () => { await result.current.reload(); });
        expect(plmApi.getStages).toHaveBeenCalledTimes(2);
    });
});
