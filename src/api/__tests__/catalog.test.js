import { describe, it, expect, vi, beforeEach } from 'vitest';
import { catalogApi } from '../catalog';
import { apiFetch } from '../auth';

vi.mock('../auth', () => ({ apiFetch: vi.fn(), tokenStorage: { getAccess: () => 't' } }));

beforeEach(() => vi.clearAllMocks());

describe('catalogApi.pushGtinTo1C', () => {
    it('POSTит product_ids и возвращает status вместе с data', async () => {
        apiFetch.mockResolvedValue({
            ok: true, status: 200,
            json: async () => ({ success: true, data: { task_id: 't1', total: 2, message: 'Запущена отправка GTIN 2 товаров в 1С' } }),
        });

        const res = await catalogApi.pushGtinTo1C([1, 2]);

        expect(apiFetch).toHaveBeenCalledWith('/api/v1/catalog/products/push-gtin-to-1c/', {
            method: 'POST',
            body: JSON.stringify({ product_ids: [1, 2] }),
        });
        expect(res).toEqual({
            ok: true, status: 200,
            data: { success: true, data: { task_id: 't1', total: 2, message: 'Запущена отправка GTIN 2 товаров в 1С' } },
        });
    });

    it('403 без права: возвращает status и DRF-конверт как есть', async () => {
        apiFetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({ detail: 'Нет права на отправку GTIN в 1С.' }) });
        const res = await catalogApi.pushGtinTo1C([1]);
        expect(res).toEqual({ ok: false, status: 403, data: { detail: 'Нет права на отправку GTIN в 1С.' } });
    });
});
