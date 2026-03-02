import { apiFetch } from './auth';

const BASE = '/api/v1/catalog';

export const catalogApi = {

    // ── Типы продукции ────────────────────────────────────────────────────

    async productTypes() {
        const res = await fetch(`${BASE}/product-types/`);
        return { ok: res.ok, data: await res.json() };
    },

    async configuration(productTypeId) {
        const res = await fetch(`${BASE}/product-types/${productTypeId}/configuration/`);
        return { ok: res.ok, data: await res.json() };
    },

    async filteredConfiguration(productTypeId, valueIds = []) {
        const q = valueIds.length ? `?value_ids=${valueIds.join(',')}` : '';
        const res = await fetch(`${BASE}/product-types/${productTypeId}/filtered-configuration/${q}`);
        return { ok: res.ok, data: await res.json() };
    },

    // ── Товары ────────────────────────────────────────────────────────────

    async searchProducts(q, { productTypeId, limit = 15 } = {}) {
        const params = new URLSearchParams({ q, limit });
        if (productTypeId) params.set('product_type', productTypeId);
        const res = await apiFetch(`${BASE}/products/search/?${params}`);
        return { ok: res.ok, data: await res.json() };
    },

    async filterCount(filters) {
        const res = await apiFetch(`${BASE}/products/filter-count/`, {
            method: 'POST',
            body: JSON.stringify({ filters }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async byIds(ids, search = '') {
        const res = await apiFetch(`${BASE}/products/by-ids/`, {
            method: 'POST',
            body: JSON.stringify({ ids, search }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async attachByIds(productIds, valueId) {
        const res = await apiFetch(`${BASE}/products/attach-by-ids/`, {
            method: 'POST',
            body: JSON.stringify({ product_ids: productIds, value_id: valueId }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async bulkAttachParameter(filters, axisId, valueId) {
        const res = await apiFetch(`${BASE}/products/bulk-attach-parameter/`, {
            method: 'POST',
            body: JSON.stringify({ filters, axis_id: axisId, value_id: valueId }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async bulkDetachParameter(filters, axisId) {
        const res = await apiFetch(`${BASE}/products/bulk-detach-parameter/`, {
            method: 'POST',
            body: JSON.stringify({ filters, axis_id: axisId }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async currentParameters(filters, axisId) {
        const res = await apiFetch(`${BASE}/products/current-parameters/`, {
            method: 'POST',
            body: JSON.stringify({ filters, axis_id: axisId }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async specsBulk(productIds) {
        const res = await apiFetch(`${BASE}/products/specs-bulk/`, {
            method: 'POST',
            body: JSON.stringify({ product_ids: productIds }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async specsBulkSave(productTypeId, changes) {
        const res = await apiFetch(`${BASE}/products/specs-bulk-save/`, {
            method: 'POST',
            body: JSON.stringify({ product_type_id: productTypeId, changes }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    // ── Параметры ─────────────────────────────────────────────────────────

    async parameterValues(axisId) {
        const res = await apiFetch(`${BASE}/parameter-values/?axis=${axisId}&is_active=true`);
        return { ok: res.ok, data: await res.json() };
    },

    async connectValues(fromValueId, toValueId) {
        const res = await apiFetch(`${BASE}/parameter-connections/connect-values/`, {
            method: 'POST',
            body: JSON.stringify({ from_value_id: fromValueId, to_value_id: toValueId }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async disconnectValues(fromValueId, toValueId) {
        const res = await apiFetch(`${BASE}/parameter-connections/disconnect-values/`, {
            method: 'POST',
            body: JSON.stringify({ from_value_id: fromValueId, to_value_id: toValueId }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async attachByIdsBulk(productIds, valueIds) {
        const res = await apiFetch(`${BASE}/products/attach-by-ids-bulk/`, {
            method: 'POST',
            body: JSON.stringify({ product_ids: productIds, value_ids: valueIds }),
        });
        return { ok: res.ok, data: await res.json() };
    },
};