import { apiFetch } from './auth';

// Реальный контракт портала (apps.dealers@dev): include('api/v1/dealers/') + роутер
// с префиксом dealers/, поэтому путь двойной. Список сейчас приходит массивом без
// конверта (у ViewSet нет пагинации), create/update/revoke/restore — конвертом
// {success, data}; если список тоже начнут отдавать конвертом, страница это поймёт.
// Права: сейчас бэкенд требует portal.dealers.write на все методы, включая чтение.
const BASE = '/api/v1/dealers/dealers';

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

    // Полный список активных дилеров на сайт одним батчем (вебхук dealers.updated).
    // Отдельного item id нет: действие одно на весь справочник.
    async pushToSite() {
        return readJson(await apiFetch(`${BASE}/push-to-site/`, {
            method: 'POST',
            body: JSON.stringify({}),
        }));
    },
};
