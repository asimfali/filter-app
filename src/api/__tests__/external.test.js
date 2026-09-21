import { describe, it, expect, vi, beforeEach } from 'vitest';
import { externalApi } from '../external';
import { apiFetch } from '../auth';

vi.mock('../auth', () => ({ apiFetch: vi.fn(), tokenStorage: { getAccess: () => 't' } }));

const respond = (status, body) => apiFetch.mockResolvedValue({ ok: status < 400, status, json: async () => body });

beforeEach(() => vi.clearAllMocks());

describe('externalApi — ГС1', () => {
    it('getGs1Items: пропускает пустые параметры и кодирует остальные', async () => {
        respond(200, { success: true, data: { results: [] } });
        await externalApi.getGs1Items({ status: 'conflict', reason: '', search: 'a b', is_active_in_gs1: 'true', page: 2 });
        expect(apiFetch).toHaveBeenCalledWith(
            '/api/v1/external/gs1/items/?status=conflict&search=a+b&is_active_in_gs1=true&page=2',
            { method: 'GET' },
        );
    });

    it('resolveGs1Item: product_id только когда передан', async () => {
        respond(200, { success: true, data: {} });
        await externalApi.resolveGs1Item(5, 'ignore');
        expect(apiFetch.mock.calls[0][1].body).toBe(JSON.stringify({ action: 'ignore' }));
        await externalApi.resolveGs1Item(5, 'assign', 9);
        expect(apiFetch.mock.calls[1][0]).toBe('/api/v1/external/gs1/items/5/resolve/');
        expect(apiFetch.mock.calls[1][1].body).toBe(JSON.stringify({ action: 'assign', product_id: 9 }));
    });

    it('startGs1Sync: по умолчанию dry-run', async () => {
        respond(200, { success: true, data: { task_id: 'x' } });
        await externalApi.startGs1Sync();
        expect(apiFetch.mock.calls[0][1].body).toBe(JSON.stringify({ apply_matches: false }));
    });

    it('возвращает status и data 409-ответа', async () => {
        respond(409, { success: false, error: { code: 'already_running' } });
        const res = await externalApi.startGs1Sync(true);
        expect(res).toEqual({ ok: false, status: 409, data: { success: false, error: { code: 'already_running' } } });
    });

    it('не падает на не-JSON теле', async () => {
        apiFetch.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error('x'); } });
        expect(await externalApi.getGs1Summary()).toEqual({ ok: false, status: 502, data: null });
    });
});
