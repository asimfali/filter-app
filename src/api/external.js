// src/api/external.js
import { tokenStorage } from './auth';

const API_BASE = '/api/v1/external';

export const externalApi = {
    pushToSite: async (productIds = null) => {
        const res = await fetch(`${API_BASE}/push-to-site/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokenStorage.getAccess()}`,
            },
            body: JSON.stringify(productIds ? { product_ids: productIds } : {}),
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
};