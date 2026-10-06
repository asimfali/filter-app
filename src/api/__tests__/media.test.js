import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mediaApi } from '../media';

vi.mock('../auth', () => ({ apiFetch: vi.fn(), tokenStorage: { getAccess: () => 't' } }));

beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }));
});
afterEach(() => vi.unstubAllGlobals());

describe('last_modified', () => {
    it('дата файла уходит в FormData обоих эндпоинтов', async () => {
        const file = new File(['x'], 'a.pdf', { lastModified: 1700000000000 });
        await mediaApi.uploadDocument(1, 'p-1', file);
        expect(fetch.mock.calls[0][1].body.get('last_modified')).toBe('1700000000000');
        await mediaApi.uploadProductDocument(1, 2, file);
        expect(fetch.mock.calls[1][1].body.get('last_modified')).toBe('1700000000000');
    });
});

describe('mediaApi.uploadDocument', () => {
    it('name и doc_number уходят в FormData; пустые — не отправляются', async () => {
        const file = new File(['x'], 'a.pdf');
        await mediaApi.uploadDocument(1, 'passport-1', file, 'Паспорт', 'N-1');
        const fd = fetch.mock.calls[0][1].body;
        expect(fd.get('name')).toBe('Паспорт');
        expect(fd.get('doc_number')).toBe('N-1');

        await mediaApi.uploadDocument(1, 'passport-1', file, '', '');
        const fd2 = fetch.mock.calls[1][1].body;
        expect(fd2.has('name')).toBe(false);
        expect(fd2.has('doc_number')).toBe(false);
    });
});
