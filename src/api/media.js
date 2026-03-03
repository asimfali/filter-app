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