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

    async uploadProductDocument(docTypeId, productId, file) {
        const fd = new FormData();
        fd.append('doc_type_id', docTypeId);
        fd.append('product_id', productId);
        fd.append('file', file);

        const res = await fetch(`${BASE}/product-documents/upload/`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenStorage.getAccess()}` },
            body: fd,
        });
        return { ok: res.ok, data: await res.json() };
    },

    async getProductDocuments(productId, docTypeId = null) {
        const params = new URLSearchParams({ product_id: productId });
        if (docTypeId) params.append('doc_type_id', docTypeId);
        const res = await apiFetch(`${BASE}/product-documents/?${params}`);
        return { ok: res.ok, data: await res.json() };
    },

    async getAccessTokens(productId, docTypeId = null) {
        const params = new URLSearchParams({ product_id: productId });
        if (docTypeId) params.append('doc_type_id', docTypeId);
        const res = await apiFetch(`${BASE}/access-tokens/?${params}`);
        return { ok: res.ok, data: await res.json() };
    },

    async createAccessToken(payload) {
        const res = await apiFetch(`${BASE}/access-tokens/`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async revokeAccessToken(id) {
        const res = await apiFetch(`${BASE}/access-tokens/${id}/revoke/`, {
            method: 'POST',
        });
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

    // ── Теплообменники ────────────────────────────────────────────────────────

    async getHeatExchangers() {
        const res = await apiFetch(`${BASE}/heat-exchangers/`);
        return { ok: res.ok, data: await res.json() };
    },

    async createHeatExchanger(payload) {
        const res = await apiFetch(`${BASE}/heat-exchangers/`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async updateHeatExchanger(id, payload) {
        const res = await apiFetch(`${BASE}/heat-exchangers/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async deleteHeatExchanger(id) {
        const res = await apiFetch(`${BASE}/heat-exchangers/${id}/`, { method: 'DELETE' });
        return { ok: res.ok, data: await res.json() };
    },

    async getHeatExchangerFilters(id) {
        const res = await apiFetch(`${BASE}/heat-exchangers/${id}/filters/`);
        return { ok: res.ok, data: await res.json() };
    },

    async addFilterToHeatExchanger(id, filterId) {
        const res = await apiFetch(`${BASE}/heat-exchangers/${id}/filters/`, {
            method: 'POST',
            body: JSON.stringify({ filter_id: filterId }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async removeFilterFromHeatExchanger(id, filterId) {
        const res = await apiFetch(`${BASE}/heat-exchangers/${id}/filters/${filterId}/`, {
            method: 'DELETE',
        });
        return { ok: res.ok, data: res.status !== 204 ? await res.json() : {} };
    },

    async getHeatExchanger(id) {
        const res = await apiFetch(`${BASE}/heat-exchangers/${id}/`);
        return { ok: res.ok, data: await res.json() };
    },

    async uploadHeatExchangerDrawing(id, file) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`${BASE}/heat-exchangers/${id}/drawing/`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenStorage.getAccess()}` },
            body: fd,
        });
        return { ok: res.ok, data: await res.json() };
    },

    async bulkCreateHeatExchangers(items, updateExisting = false) {
        const res = await apiFetch(`${BASE}/heat-exchangers/bulk-create/`, {
            method: 'POST',
            body: JSON.stringify({ items, update_existing: updateExisting }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    // Прямые привязки — документы
    async getDocumentProducts(id) {
        const res = await apiFetch(`${BASE}/documents/${id}/products/`);
        return { ok: res.ok, data: await res.json() };
    },
    async addProductsToDocument(id, productIds) {
        const res = await apiFetch(`${BASE}/documents/${id}/products/`, {
            method: 'POST',
            body: JSON.stringify({ product_ids: productIds }),
        });
        return { ok: res.ok, data: await res.json() };
    },
    async removeProductsFromDocument(id, productIds) {
        const res = await apiFetch(`${BASE}/documents/${id}/products/`, {
            method: 'DELETE',
            body: JSON.stringify({ product_ids: productIds }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    // Прямые привязки — теплообменники
    async getHeatExchangerProducts(id) {
        const res = await apiFetch(`${BASE}/heat-exchangers/${id}/products/`);
        return { ok: res.ok, data: await res.json() };
    },
    async addProductsToHeatExchanger(id, productIds) {
        const res = await apiFetch(`${BASE}/heat-exchangers/${id}/products/`, {
            method: 'POST',
            body: JSON.stringify({ product_ids: productIds }),
        });
        return { ok: res.ok, data: await res.json() };
    },
    async removeProductsFromHeatExchanger(id, productIds) {
        const res = await apiFetch(`${BASE}/heat-exchangers/${id}/products/`, {
            method: 'DELETE',
            body: JSON.stringify({ product_ids: productIds }),
        });
        return { ok: res.ok, data: await res.json() };
    },

};