// src/api/external.js
import { tokenStorage, apiFetch } from './auth';

const API_BASE = '/api/v1/external';
const GS1_BASE = `${API_BASE}/gs1`;

// {ok, status, data} — status нужен для 409-веток разбора ГС1 (product_has_other_gtin/gtin_taken)
const gs1Request = async (method, url, body) => {
    const res = await apiFetch(url, { method, ...(body !== undefined && { body: JSON.stringify(body) }) });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
};

const qs = (params = {}) => {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') p.append(k, v);
    });
    const s = p.toString();
    return s ? `?${s}` : '';
};

export const externalApi = {
    pushToSite: async (productIds = null, productTypeSlug = null) => {
        const body = productIds
            ? { product_ids: productIds }
            : productTypeSlug ? { product_type_slug: productTypeSlug } : {};
        const res = await fetch(`${API_BASE}/push-to-site/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokenStorage.getAccess()}`,
            },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        return { ok: res.ok, data };
    },

    taskStatus: async (taskId) => {
        const res = await fetch(`/api/v1/catalog/products/task-status/${taskId}/`, {
            headers: { Authorization: `Bearer ${tokenStorage.getAccess()}` },
        });
        const data = await res.json();
        return { ok: res.ok, data };
    },

    syncPrices: async (configId) => {
        const res = await fetch(`${API_BASE}/sync-prices/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokenStorage.getAccess()}`,
            },
            body: JSON.stringify({ config_id: configId }),
        });
        const data = await res.json();
        return { ok: res.ok, data };
    },
    
    syncCatalog: async (configId, fullSync = false) => {
        const res = await fetch(`${API_BASE}/sync-catalog/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokenStorage.getAccess()}`,
            },
            body: JSON.stringify({ config_id: configId, full_sync: fullSync }),
        });
        const data = await res.json();
        return { ok: res.ok, data };
    },

    rsyncMedia: async (mediaType = 'all', syncDocuments = true) => {
        const res = await fetch(`${API_BASE}/rsync-media/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokenStorage.getAccess()}`,
            },
            body: JSON.stringify({ media_type: mediaType, sync_documents: syncDocuments }),
        });
        const data = await res.json();
        return { ok: res.ok, data };
    },

    getRsyncFolders: async () => {
        const res = await fetch(`${API_BASE}/rsync-folders/`, {
            headers: { Authorization: `Bearer ${tokenStorage.getAccess()}` },
        });
        const data = await res.json();
        return { ok: res.ok, data };
    },

    getSyncConfigs: async () => {
        const res = await fetch(`${API_BASE}/sync-configs/`, {
            headers: { Authorization: `Bearer ${tokenStorage.getAccess()}` },
        });
        const data = await res.json();
        return { ok: res.ok, data };
    },
    applyVariantRules: async (productTypeId, resetFirst = false) => {
        const res = await fetch(`${API_BASE}/apply-variant-rules/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokenStorage.getAccess()}`,
            },
            body: JSON.stringify({
                product_type_id: productTypeId,
                reset_first: resetFirst,
            }),
        });
        const data = await res.json();
        return { ok: res.ok, data };
    },
    
    getVariantRules: async () => {
        const res = await fetch(`/api/v1/catalog/variant-rules/`, {
            headers: { Authorization: `Bearer ${tokenStorage.getAccess()}` },
        });
        const data = await res.json();
        return { ok: res.ok, data };
    },

    pushFanCharts: async () => {
        const res = await fetch(`${API_BASE}/push-fan-charts/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokenStorage.getAccess()}`,
            },
            body: JSON.stringify({}),
        });
        const data = await res.json();
        return { ok: res.ok, data };
    },

    // ── ГС1 РУС: очередь разбора GTIN (external.gs1_resolve) и запуск/история (external.gs1_sync) ──
    getGs1Items: (params) => gs1Request('GET', `${GS1_BASE}/items/${qs(params)}`),
    getGs1Item: (id) => gs1Request('GET', `${GS1_BASE}/items/${id}/`),
    getGs1Summary: () => gs1Request('GET', `${GS1_BASE}/items/summary/`),
    resolveGs1Item: (id, action, productId = null) =>
        gs1Request('POST', `${GS1_BASE}/items/${id}/resolve/`,
            { action, ...(productId && { product_id: productId }) }),
    startGs1Sync: (applyMatches = false) =>
        gs1Request('POST', `${GS1_BASE}/runs/start/`, { apply_matches: applyMatches }),
    getGs1Runs: (params) => gs1Request('GET', `${GS1_BASE}/runs/${qs(params)}`),
};
