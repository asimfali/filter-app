import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDocTypes, useCommonDocUpload } from '../useDocUpload';
import { mediaApi } from '../../api/media';

vi.mock('../../api/media', () => ({
    mediaApi: {
        getFormData: vi.fn(),
        uploadDocument: vi.fn(),
    },
}));
vi.mock('../../utils/permissions', () => ({
    can: (user, code) => !!user?.permissions?.includes(code),
}));

const ok = (data) => ({ ok: true, data });
const withPerms = (...perms) => ({ id: 1, permissions: perms });

const dtUpload = { code: 'passport', name: 'Паспорт', upload_permission_code: 'media.upload' };
const dtViewOnly = { code: 'cert', name: 'Сертификат', upload_permission_code: 'media.other', view_permission_code: '' };
const dtRestrictedView = { code: 'secret', name: 'Секрет', upload_permission_code: 'media.other', view_permission_code: 'media.view_secret' };

beforeEach(() => {
    vi.clearAllMocks();
});

describe('useDocTypes', () => {
    it('без user не грузит данные', () => {
        renderHook(() => useDocTypes(null));
        expect(mediaApi.getFormData).not.toHaveBeenCalled();
    });

    it('фильтрует uploadDocTypes по upload_permission_code и viewDocTypes по view_permission_code', async () => {
        mediaApi.getFormData.mockResolvedValue(ok({ doc_types: [dtUpload, dtViewOnly, dtRestrictedView] }));
        const user = withPerms('media.upload');
        const { result } = renderHook(() => useDocTypes(user));

        await waitFor(() => expect(result.current.docTypes).toHaveLength(3));
        expect(result.current.uploadDocTypes).toEqual([dtUpload]);
        // viewDocTypes: пустой view_permission_code = доступен всем; secret требует право, которого нет
        expect(result.current.viewDocTypes.map(d => d.code)).toEqual(['passport', 'cert']);
    });

    it('автовыбирает первый доступный для загрузки тип в activeDocType', async () => {
        mediaApi.getFormData.mockResolvedValue(ok({ doc_types: [dtUpload] }));
        const { result } = renderHook(() => useDocTypes(withPerms('media.upload')));
        await waitFor(() => expect(result.current.activeDocType).toEqual(dtUpload));
    });

    it('без прав на загрузку activeDocType остаётся null', async () => {
        mediaApi.getFormData.mockResolvedValue(ok({ doc_types: [dtUpload] }));
        const { result } = renderHook(() => useDocTypes(withPerms()));
        await waitFor(() => expect(result.current.docTypes).toHaveLength(1));
        expect(result.current.activeDocType).toBeNull();
    });

    it('неуспешный ответ — все списки остаются пустыми', async () => {
        mediaApi.getFormData.mockResolvedValue({ ok: false, data: {} });
        const { result } = renderHook(() => useDocTypes(withPerms('media.upload')));
        await new Promise(r => setTimeout(r, 0));
        expect(result.current.docTypes).toEqual([]);
    });

    it('setActiveDocType позволяет сменить выбор вручную', async () => {
        mediaApi.getFormData.mockResolvedValue(ok({ doc_types: [dtUpload, { ...dtViewOnly, upload_permission_code: 'media.upload' }] }));
        const { result } = renderHook(() => useDocTypes(withPerms('media.upload')));
        await waitFor(() => expect(result.current.uploadDocTypes).toHaveLength(2));
        act(() => result.current.setActiveDocType(result.current.uploadDocTypes[1]));
        expect(result.current.activeDocType.code).toBe('cert');
    });
});

describe('useCommonDocUpload', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('без файла — no-op', async () => {
        const { result } = renderHook(() => useCommonDocUpload({ onUploaded: vi.fn() }));
        await act(async () => { await result.current.upload(null, 1, 'ext'); });
        expect(mediaApi.uploadDocument).not.toHaveBeenCalled();
    });

    it('успешная загрузка (обычный файл) — сообщение с именем, затем onUploaded через 1.5с', async () => {
        vi.useFakeTimers();
        const onUploaded = vi.fn();
        mediaApi.uploadDocument.mockResolvedValue(ok({ success: true }));
        const { result } = renderHook(() => useCommonDocUpload({ onUploaded }));

        const file = new File(['x'], 'passport.pdf');
        let uploadPromise;
        act(() => { uploadPromise = result.current.upload(file, 5, 'ext-1'); });
        await act(async () => { await uploadPromise; });

        expect(mediaApi.uploadDocument).toHaveBeenCalledWith(5, 'ext-1', file);
        expect(result.current.uploadResult).toEqual({ ok: true, message: '✓ passport.pdf' });
        expect(result.current.uploading).toBe(false);

        await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
        expect(onUploaded).toHaveBeenCalled();
        expect(result.current.uploadResult).toBeNull();
    });

    it('успешная загрузка STEP (converting) — отдельное сообщение', async () => {
        mediaApi.uploadDocument.mockResolvedValue(ok({ success: true, converting: true }));
        const { result } = renderHook(() => useCommonDocUpload({ onUploaded: vi.fn() }));
        await act(async () => { await result.current.upload(new File(['x'], 'a.step'), 1, 'e'); });
        expect(result.current.uploadResult.message).toBe('STEP загружен — конвертация ~30 сек');
    });

    it('ошибка API — сообщение об ошибке, сброс через 3с', async () => {
        vi.useFakeTimers();
        mediaApi.uploadDocument.mockResolvedValue({ ok: false, data: { success: false, error: 'Слишком большой файл' } });
        const { result } = renderHook(() => useCommonDocUpload({ onUploaded: vi.fn() }));
        await act(async () => { await result.current.upload(new File(['x'], 'a.pdf'), 1, 'e'); });
        expect(result.current.uploadResult).toEqual({ ok: false, message: 'Слишком большой файл' });

        await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
        expect(result.current.uploadResult).toBeNull();
    });

    it('сетевая ошибка — "Ошибка сети"', async () => {
        mediaApi.uploadDocument.mockRejectedValue(new Error('network'));
        const { result } = renderHook(() => useCommonDocUpload({ onUploaded: vi.fn() }));
        await act(async () => { await result.current.upload(new File(['x'], 'a.pdf'), 1, 'e'); });
        expect(result.current.uploadResult).toEqual({ ok: false, message: 'Ошибка сети' });
    });
});
