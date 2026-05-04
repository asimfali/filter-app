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

    async filteredConfiguration(productTypeId, valueIds = [], allAxes = false, realProducts = false, realEdges = false) {
        const params = new URLSearchParams();
        if (valueIds.length) params.set('value_ids', valueIds.join(','));
        if (allAxes) params.set('tag_axes', 'all');
        if (realProducts) params.set('real_products', 'true');
        if (realEdges) params.set('real_edges', 'true');
        const q = params.toString() ? `?${params}` : '';
        const res = await fetch(`${BASE}/product-types/${productTypeId}/filtered-configuration/${q}`);
        return { ok: res.ok, data: await res.json() };
    },

    // ── Товары ────────────────────────────────────────────────────────────

    async searchProducts(q, { productTypeId, limit = 15, regex = false, noParams = false } = {}) {
        const params = new URLSearchParams({ limit });
        if (q) params.set('q', q);
        if (productTypeId) params.set('product_type', productTypeId);
        if (regex) params.set('regex', 'true');
        if (noParams) params.set('no_params', 'true');

        const res = await apiFetch(`${BASE}/products/search/?${params}`);
        return { ok: res.ok, data: await res.json() };
    },

    async detachChain(productIds, chainValueIds) {
        const res = await apiFetch(`${BASE}/products/detach-chain/`, {
            method: 'POST',
            body: JSON.stringify({
                product_ids: productIds,
                chain_value_ids: chainValueIds,
            }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async filterCount(filters) {
        const res = await apiFetch(`${BASE}/products/filter-count/`, {
            method: 'POST',
            body: JSON.stringify({ filters }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async filterByAnchor(valueIds) {
        const res = await apiFetch(`${BASE}/products/filter-by-anchor/`, {
            method: 'POST',
            body: JSON.stringify({ value_ids: valueIds }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async filterByChain(productTypeId, chainValueIds, partial = false) {
        const res = await apiFetch(`${BASE}/products/filter-by-chain/`, {
            method: 'POST',
            body: JSON.stringify({
                product_type_id: productTypeId,
                chain_value_ids: chainValueIds,
                partial,            // ← новое
            }),
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

    async previewBulk(productIds, stageId = null) {
        const res = await apiFetch(`${BASE}/products/preview-bulk/`, {
            method: 'POST',
            body: JSON.stringify({
                product_ids: productIds,
                ...(stageId && { stage_id: stageId }),
            }),
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
    async bulkConnect(connections) {
        const res = await apiFetch(`${BASE}/parameter-connections/bulk-connect/`, {
            method: 'POST',
            body: JSON.stringify({ connections }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async taskStatus(taskId) {
        const res = await apiFetch(`${BASE}/products/task-status/${taskId}/`);
        return { ok: res.ok, data: await res.json() };
    },

    // Серии
    async getSeriesTemplates(productTypeId = null) {
        const q = productTypeId ? `?product_type=${productTypeId}` : '';
        const res = await apiFetch(`${BASE}/series-templates/${q}`);
        return { ok: res.ok, data: await res.json() };
    },

    async getSeriesTemplate(id) {
        const res = await apiFetch(`${BASE}/series-templates/${id}/`);
        return { ok: res.ok, data: await res.json() };
    },

    async createSeriesTemplate(payload) {
        const res = await apiFetch(`${BASE}/series-templates/`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async generateSeriesRules(templateId, validate = false) {
        const res = await apiFetch(`${BASE}/series-templates/${templateId}/generate-rules/`, {
            method: 'POST',
            body: JSON.stringify({ validate }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async createSeriesProducts(templateId) {
        const res = await apiFetch(`${BASE}/series-templates/${templateId}/create-products/`, {
            method: 'POST',
            body: JSON.stringify({}),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async addSeriesItem(templateId, item) {
        const res = await apiFetch(`${BASE}/series-templates/${templateId}/items/`, {
            method: 'POST',
            body: JSON.stringify(item),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async parameterAxes(productTypeId = null) {
        const q = productTypeId ? `?product_type=${productTypeId}` : '';
        const res = await apiFetch(`${BASE}/parameter-axes/${q}`);
        return { ok: res.ok, data: await res.json() };
    },

    async powerValues() {
        const res = await apiFetch(`${BASE}/power-values/`);
        return { ok: res.ok, data: await res.json() };
    },

    async masterConfig(productTypeId) {
        const res = await apiFetch(`${BASE}/master-config/${productTypeId}/`);
        return { ok: res.ok, data: await res.json() };
    },

    // ── Варианты (группировка исполнений) ────────────────────────────────

    async variantFreeProducts({ q = '', productTypeId = null, page = 1, parentName = '', parentTypeId = '', parentId = null } = {}) {
        const params = new URLSearchParams({ page });
        if (q) params.set('q', q);
        if (productTypeId) params.set('product_type', productTypeId);
        if (parentName) params.set('parent_name', parentName);
        if (parentTypeId) params.set('parent_type_id', parentTypeId);
        if (parentId) params.set('parent_id', parentId);
        const res = await apiFetch(`${BASE}/variants/free/?${params}`);
        return { ok: res.ok, data: await res.json() };
    },

    async variantParents({ q = '', productTypeId = null, page = 1, withVariants = false, parentId = null, problematic = false } = {}) {
        const params = new URLSearchParams({ page });
        if (q) params.set('q', q);
        if (productTypeId) params.set('product_type', productTypeId);
        if (withVariants) params.set('with_variants', 'true');
        if (parentId) params.set('parent_id', parentId);
        if (problematic) params.set('problematic', 'true');
        const res = await apiFetch(`${BASE}/variants/parents/?${params}`);
        return { ok: res.ok, data: await res.json() };
    },

    async variantFillExternalNames(productTypeId) {
        const res = await apiFetch(`${BASE}/variants/fill-external-names/`, {
            method: 'POST',
            body: JSON.stringify({ product_type_id: productTypeId }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async variantLink(productIds, parentId, externalName = null) {
        const res = await apiFetch(`${BASE}/variants/link/`, {
            method: 'POST',
            body: JSON.stringify({
                action: 'link',
                product_ids: productIds,
                parent_id: parentId,
                ...(externalName !== null && { external_name: externalName }),
            }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async variantUnlink(productIds) {
        const res = await apiFetch(`${BASE}/variants/link/`, {
            method: 'POST',
            body: JSON.stringify({
                action: 'unlink',
                product_ids: productIds,
            }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async variantSetExternalName(parentId, externalName) {
        const res = await apiFetch(`${BASE}/variants/link/`, {
            method: 'POST',
            body: JSON.stringify({
                action: 'set_external_name',
                product_ids: [],
                parent_id: parentId,
                external_name: externalName,
            }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async variantRules() {
        const res = await apiFetch(`${BASE}/variant-rules/`);
        return { ok: res.ok, data: await res.json() };
    },
};