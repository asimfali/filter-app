import { apiFetch } from './auth';

// Контракт портала (apps.dealers@dev, 6a12ecf): роутер без префикса, поэтому путь
// один — /api/v1/dealers/ (раньше был двойной /api/v1/dealers/dealers/). Список
// приходит массивом без конверта (у ViewSet нет filter_backends и пагинации),
// create/update/revoke/restore/import — конвертом {success, data}; страница понимает
// и конверт вокруг списка.
// Права: бэкенд требует portal.dealers.write на все методы, включая чтение.
const BASE = '/api/v1/dealers';

const buildQuery = (params) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') q.set(key, value);
    });
    const str = q.toString();
    return str ? `?${str}` : '';
};

const readJson = async (res) => ({ ok: res.ok, status: res.status, data: await res.json() });

export const dealersApi = {

    // isActive: true — только авторизованные, false — только снятые, null — все
    async list({ search, isActive, page, pageSize } = {}) {
        const q = buildQuery({
            search,
            is_active: isActive === true ? 'true' : isActive === false ? 'false' : '',
            page,
            page_size: pageSize,
        });
        return readJson(await apiFetch(`${BASE}/${q}`));
    },

    async get(id) {
        return readJson(await apiFetch(`${BASE}/${id}/`));
    },

    async create(payload) {
        return readJson(await apiFetch(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(payload),
        }));
    },

    async update(id, payload) {
        return readJson(await apiFetch(`${BASE}/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }));
    },

    // Отмена авторизации — не удаление: is_active=false. Причина (необязательная)
    // уходит в note дилера.
    async revoke(id, reason = '') {
        return readJson(await apiFetch(`${BASE}/${id}/revoke/`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        }));
    },

    async restore(id) {
        return readJson(await apiFetch(`${BASE}/${id}/restore/`, {
            method: 'POST',
            body: JSON.stringify({}),
        }));
    },

    // Импорт справочника из xlsx: файл уходит celery-задаче, ответ — только task_id.
    // Прогресс и статистику забираем опросом importStatus (PENDING/RUNNING/COMPLETED/FAILED).
    async importXlsx(file) {
        const formData = new FormData();
        formData.append('file', file);
        return readJson(await apiFetch(`${BASE}/import/`, { method: 'POST', body: formData }));
    },

    // Внимание: id в пути — это id задачи импорта, а не дилера (бэкенд ищет
    // DealerImportTask по pk, дилера не запрашивает).
    async importStatus(taskId) {
        return readJson(await apiFetch(`${BASE}/${taskId}/import-status/`));
    },

    // Полный список активных дилеров на сайт одним батчем (вебхук dealers.updated).
    // Отдельного item id нет: действие одно на весь справочник.
    async pushToSite() {
        return readJson(await apiFetch(`${BASE}/push-to-site/`, {
            method: 'POST',
            body: JSON.stringify({}),
        }));
    },
};
