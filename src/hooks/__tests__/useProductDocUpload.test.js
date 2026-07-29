import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProductDocUpload } from '../useProductDocUpload';
import { mediaApi } from '../../api/media';

vi.mock('../../api/media', () => ({
    mediaApi: {
        uploadProductDocument: vi.fn(),
        getProductDocuments: vi.fn(),
    },
}));

const ok = (data) => ({ ok: true, data });
const docType = { id: 3, code: 'model-3d' };

beforeEach(() => {
    vi.clearAllMocks();
});
afterEach(() => {
    vi.useRealTimers();
});

describe('useProductDocUpload', () => {
    it('без файла/docType — no-op', async () => {
        const { result } = renderHook(() => useProductDocUpload({ onUploaded: vi.fn() }));
        await act(async () => { await result.current.upload(null, 1, docType); });
        await act(async () => { await result.current.upload(new File(['x'], 'a.glb'), 1, null); });
        expect(mediaApi.uploadProductDocument).not.toHaveBeenCalled();
    });

    it('успешная загрузка без конвертации перезагружает файлы и вызывает onUploaded', async () => {
        const onUploaded = vi.fn();
        mediaApi.uploadProductDocument.mockResolvedValue(ok({ success: true }));
        mediaApi.getProductDocuments.mockResolvedValue(ok({
            success: true,
            data: [{ current: [{ name: 'model.glb' }] }],
        }));
        const { result } = renderHook(() => useProductDocUpload({ onUploaded }));
        const file = new File(['x'], 'model.glb');
        await act(async () => { await result.current.upload(file, 7, docType); });

        expect(mediaApi.uploadProductDocument).toHaveBeenCalledWith(3, 7, file);
        expect(mediaApi.getProductDocuments).toHaveBeenCalledWith(7, 3);
        expect(onUploaded).toHaveBeenCalledWith(7, 'model-3d', [{ name: 'model.glb' }]);
        expect(result.current.uploadResult).toEqual({ ok: true, message: '✓ model.glb' });
    });

    it('converting:true — запускает поллинг, находит .glb и вызывает onUploaded', async () => {
        vi.useFakeTimers();
        const onUploaded = vi.fn();
        mediaApi.uploadProductDocument.mockResolvedValue(ok({ success: true, converting: true }));
        mediaApi.getProductDocuments
            .mockResolvedValueOnce(ok({ success: true, data: [{ current: [] }] }))
            .mockResolvedValueOnce(ok({ success: true, data: [{ current: [{ name: 'model.glb' }] }] }));

        const { result } = renderHook(() => useProductDocUpload({ onUploaded }));
        await act(async () => { await result.current.upload(new File(['x'], 'a.step'), 7, docType); });
        expect(result.current.uploadResult.message).toBe('Конвертация STEP → GLB...');

        await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
        expect(mediaApi.getProductDocuments).toHaveBeenCalledTimes(1);
        expect(onUploaded).not.toHaveBeenCalled();

        await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
        expect(onUploaded).toHaveBeenCalledWith(7, 'model-3d', [{ name: 'model.glb' }]);
        expect(result.current.uploadResult).toEqual({ ok: true, message: '✓ 3D модель готова' });
    });

    it('поллинг исчерпывает попытки (POLL_MAX=12) без .glb — сообщение об ошибке', async () => {
        vi.useFakeTimers();
        mediaApi.uploadProductDocument.mockResolvedValue(ok({ success: true, converting: true }));
        mediaApi.getProductDocuments.mockResolvedValue(ok({ success: true, data: [{ current: [] }] }));

        const { result } = renderHook(() => useProductDocUpload({ onUploaded: vi.fn() }));
        await act(async () => { await result.current.upload(new File(['x'], 'a.step'), 7, docType); });

        await act(async () => { await vi.advanceTimersByTimeAsync(5000 * 12); });
        expect(mediaApi.getProductDocuments).toHaveBeenCalledTimes(12);
        expect(result.current.uploadResult).toEqual({
            ok: false, message: 'Конвертация не завершилась — обновите страницу',
        });
    });

    it('ошибка API — сообщение', async () => {
        mediaApi.uploadProductDocument.mockResolvedValue({ ok: false, data: { success: false, error: 'Файл слишком большой' } });
        const { result } = renderHook(() => useProductDocUpload({ onUploaded: vi.fn() }));
        await act(async () => { await result.current.upload(new File(['x'], 'a.glb'), 7, docType); });
        expect(result.current.uploadResult).toEqual({ ok: false, message: 'Файл слишком большой' });
    });

    it('сетевая ошибка — "Ошибка сети"', async () => {
        mediaApi.uploadProductDocument.mockRejectedValue(new Error('network'));
        const { result } = renderHook(() => useProductDocUpload({ onUploaded: vi.fn() }));
        await act(async () => { await result.current.upload(new File(['x'], 'a.glb'), 7, docType); });
        expect(result.current.uploadResult).toEqual({ ok: false, message: 'Ошибка сети' });
    });
});
