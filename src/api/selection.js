import { apiFetch } from './auth';

const BASE = '/api/v1/selection';

export const selectionApi = {
    async formData() {
        const res = await apiFetch(`${BASE}/form-data/`);
        return { ok: res.ok, data: await res.json() };
    },

    async regions(search) {
        const res = await apiFetch(`${BASE}/regions/?search=${encodeURIComponent(search)}`);
        return { ok: res.ok, data: await res.json() };
    },

    async calculate(payload) {
        const res = await apiFetch(`${BASE}/calculate/`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async report(params, data) {
        const res = await apiFetch('/api/v1/selection/report/', {
            method: 'POST',
            body: JSON.stringify({ params, data }),
        });
        return res;  // raw response — caller делает blob()
    },

    async nearestRegion(lat, lon) {
        const res = await apiFetch(`${BASE}/regions/nearest/?lat=${lat}&lon=${lon}`);
        return { ok: res.ok, data: await res.json() };
    },
};