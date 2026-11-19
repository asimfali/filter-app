import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dealersApi } from '../dealers';
import { apiFetch } from '../auth';

vi.mock('../auth', () => ({ apiFetch: vi.fn() }));

const respond = (status, body) => apiFetch.mockResolvedValue({ ok: status < 400, status, json: async () => body });

beforeEach(() => vi.clearAllMocks());

describe('dealersApi.list', () => {
    it('без фильтров — запрос без query', async () => {
        respond(200, [{ id: 1, inn: '7701234567' }]);
        const res = await dealersApi.list();
        expect(apiFetch).toHaveBeenCalledWith('/api/v1/dealers/');
        expect(res).toEqual({ ok: true, status: 200, data: [{ id: 1, inn: '7701234567' }] });
    });

    it('search/is_active/page/page_size уходят в query', async () => {
        respond(200, []);
        await dealersApi.list({ search: '7701', isActive: true, page: 2, pageSize: 50 });
        expect(apiFetch).toHaveBeenCalledWith(
            '/api/v1/dealers/?search=7701&is_active=true&page=2&page_size=50',
        );
    });

    it('isActive=false — только снятые; isActive=null — без фильтра', async () => {
        respond(200, []);
        await dealersApi.list({ isActive: false });
        expect(apiFetch).toHaveBeenLastCalledWith('/api/v1/dealers/?is_active=false');
        await dealersApi.list({ isActive: null });
        expect(apiFetch).toHaveBeenLastCalledWith('/api/v1/dealers/');
    });

    it('ошибка возвращается как есть (DRF detail)', async () => {
        respond(403, { detail: 'Недостаточно прав' });
        const res = await dealersApi.list();
        expect(res).toEqual({ ok: false, status: 403, data: { detail: 'Недостаточно прав' } });
    });

    it('group уходит в query, пустое значение — нет', async () => {
        respond(200, []);
        await dealersApi.list({ group: 'branch' });
        expect(apiFetch).toHaveBeenLastCalledWith('/api/v1/dealers/?group=branch');
        await dealersApi.list({ group: '' });
        expect(apiFetch).toHaveBeenLastCalledWith('/api/v1/dealers/');
    });
});

describe('dealersApi.groups', () => {
    it('GET /groups/ — значения и подписи идут с портала', async () => {
        respond(200, { success: true, data: [{ value: 'dealer', label: 'Дилер' }] });
        const res = await dealersApi.groups();

        expect(apiFetch).toHaveBeenCalledWith('/api/v1/dealers/groups/');
        expect(res.data.data).toEqual([{ value: 'dealer', label: 'Дилер' }]);
    });
});

describe('dealersApi — запись', () => {
    it('create POSTит payload в коллекцию', async () => {
        respond(201, { success: true, data: { id: 5, inn: '7701234567', code: 'D10001' } });
        await dealersApi.create({ inn: '7701234567', name: 'ООО «Юг»' });
        expect(apiFetch).toHaveBeenCalledWith('/api/v1/dealers/', {
            method: 'POST',
            body: JSON.stringify({ inn: '7701234567', name: 'ООО «Юг»' }),
        });
    });

    it('update PATCHит по id', async () => {
        respond(200, { success: true, data: {} });
        await dealersApi.update(7, { name: 'Новое' });
        expect(apiFetch).toHaveBeenCalledWith('/api/v1/dealers/7/', {
            method: 'PATCH',
            body: JSON.stringify({ name: 'Новое' }),
        });
    });

    it('revoke — POST-действие с причиной, не удаление', async () => {
        respond(200, { success: true, data: {} });
        await dealersApi.revoke(7, 'нарушение условий');
        expect(apiFetch).toHaveBeenCalledWith('/api/v1/dealers/7/revoke/', {
            method: 'POST',
            body: JSON.stringify({ reason: 'нарушение условий' }),
        });
    });

    it('revoke без причины шлёт пустую строку', async () => {
        respond(200, { success: true, data: {} });
        await dealersApi.revoke(7);
        expect(apiFetch).toHaveBeenCalledWith('/api/v1/dealers/7/revoke/', {
            method: 'POST',
            body: JSON.stringify({ reason: '' }),
        });
    });

    it('restore — POST-действие', async () => {
        respond(200, { success: true, data: {} });
        await dealersApi.restore(7);
        expect(apiFetch).toHaveBeenCalledWith('/api/v1/dealers/7/restore/', {
            method: 'POST',
            body: JSON.stringify({}),
        });
    });

    it('pushToSite — POST на действие справочника, без item id', async () => {
        respond(200, { success: true, data: { success: true, total: 420 } });
        const res = await dealersApi.pushToSite();
        expect(apiFetch).toHaveBeenCalledWith('/api/v1/dealers/push-to-site/', {
            method: 'POST',
            body: JSON.stringify({}),
        });
        expect(res.data.data.total).toBe(420);
    });
});

describe('dealersApi — импорт из xlsx', () => {
    it('importXlsx отправляет файл multipart и возвращает task_id', async () => {
        respond(201, { success: true, data: { task_id: 12 } });
        const file = new File(['x'], 'dealers.xlsx');
        const res = await dealersApi.importXlsx(file);

        expect(apiFetch).toHaveBeenCalledTimes(1);
        const [url, options] = apiFetch.mock.calls[0];
        expect(url).toBe('/api/v1/dealers/import/');
        expect(options.method).toBe('POST');
        expect(options.body).toBeInstanceOf(FormData);
        expect(options.body.get('file')).toBe(file);
        expect(res.data.data.task_id).toBe(12);
    });

    it('importStatus опрашивает задачу по её id, а не дилера', async () => {
        respond(200, {
            success: true,
            data: { task_id: 12, status: 'RUNNING', rows_total: 0, errors: [], result: {} },
        });
        const res = await dealersApi.importStatus(12);
        expect(apiFetch).toHaveBeenCalledWith('/api/v1/dealers/12/import-status/');
        expect(res.data.data.status).toBe('RUNNING');
    });

    it('importStatus отдаёт 404 как ошибку, не бросает', async () => {
        respond(404, { success: false, error: { code: 'NOT_FOUND' } });
        const res = await dealersApi.importStatus(999);
        expect(res.ok).toBe(false);
        expect(res.status).toBe(404);
    });
});
