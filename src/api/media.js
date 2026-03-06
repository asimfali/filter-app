import { apiFetch, tokenStorage } from './auth';

const BASE = '/api/v1/media';

export const mediaApi = {

    // ── Документы ────────────────────────────────────────────────────────

    async getDocuments(q = '') {
        const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
        const res = await apiFetch(`${BASE}/documents/${params}`);
        return { ok: res.ok, data: await res.json() };
    },

    async getFormData() {
        const res = await apiFetch(`${BASE}/form-data/`);
        return { ok: res.ok, data: await res.json() };
    },

    async uploadDocument(docTypeId, externalId, file) {
        const fd = new FormData();
        fd.append('doc_type_id', docTypeId);
        fd.append('external_id', externalId);
        fd.append('file', file);

        // FormData — не передаём Content-Type, браузер сам выставит boundary
        const res = await fetch(`${BASE}/upload/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tokenStorage.getAccess()}`,
            },
            body: fd,
        });
        return { ok: res.ok, data: await res.json() };
    },

    async downloadFile(relPath) {
        const res = await fetch(
            `${BASE}/download/?path=${encodeURIComponent(relPath)}`,
            { headers: { 'Authorization': `Bearer ${tokenStorage.getAccess()}` } }
        );
        return res; // возвращаем raw response — caller сам делает blob()
    },

    async searchDocuments(docTypeId, q) {
        if (q.length < 2) return { ok: true, data: { results: [] } };
        const res = await apiFetch(
            `${BASE}/documents/search/?doc_type_id=${docTypeId}&q=${encodeURIComponent(q)}`
        );
        return { ok: res.ok, data: await res.json() };
    },

    async deleteFile(relPath) {
        const res = await apiFetch(
            `${BASE}/delete/?path=${encodeURIComponent(relPath)}`,
            { method: 'DELETE' }
        );
        return { ok: res.ok, data: await res.json() };
    },

    async deleteDocument(id) {
        const res = await apiFetch(`${BASE}/documents/${id}/`, { method: 'DELETE' });
        return { ok: res.ok, data: await res.json() };
    },

    async bulkCreateDocuments(docTypeId, externalIds) {
        const res = await apiFetch(`${BASE}/documents/bulk-create/`, {
            method: 'POST',
            body: JSON.stringify({ doc_type_id: docTypeId, external_ids: externalIds }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    // ── Фильтры-теги ──────────────────────────────────────────────────────────

    async getFilters(axisId = null) {
        const params = axisId ? `?axis_id=${axisId}` : '';
        const res = await apiFetch(`${BASE}/filters/${params}`);
        return { ok: res.ok, data: await res.json() };
    },

    async createFilter(filterAxisId, valueIds) {
        const res = await apiFetch(`${BASE}/filters/`, {
            method: 'POST',
            body: JSON.stringify({ filter_axis_id: filterAxisId, value_ids: valueIds }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async getDocumentFilters(docId) {
        const res = await apiFetch(`${BASE}/documents/${docId}/filters/`);
        return { ok: res.ok, data: await res.json() };
    },

    async addFilterToDocument(docId, filterId) {
        const res = await apiFetch(`${BASE}/documents/${docId}/filters/`, {
            method: 'POST',
            body: JSON.stringify({ filter_id: filterId }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async removeFilterFromDocument(docId, filterId) {
        const res = await apiFetch(`${BASE}/documents/${docId}/filters/${filterId}/`, {
            method: 'DELETE',
        });
        return { ok: res.ok, data: res.status !== 204 ? await res.json() : {} };
    },

    async getAxisValues(axisId) {
        const res = await apiFetch(`${BASE}/values/${axisId}/`);
        return { ok: res.ok, data: await res.json() };
    },

    // ── Галерея ───────────────────────────────────────────────────────────

    async getProductImages(productId) {
        const res = await apiFetch(`${BASE}/gallery/${productId}/`);
        return { ok: res.ok, data: await res.json() };
    },

    async getAxisValues(axisId) {
        const res = await apiFetch(`${BASE}/values/${axisId}/`);
        return { ok: res.ok, data: await res.json() };
    },
    
};