import { apiFetch } from './auth';

const BASE = '/api/v1/sales';

async function call(url, options = {}) {
    const res = await apiFetch(url, options);
    const data = res.status === 204 ? null : await res.json();
    return { ok: res.ok, data };
}

export const salesApi = {

    // ── Корзины ──────────────────────────────────────────────────────────

    listCarts: ({ search = '', page = 1, status = '' } = {}) => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (page > 1) params.set('page', page);
        if (status) params.set('status', status);
        return call(`${BASE}/carts/?${params.toString()}`);
    },

    listCartsUrl: (url) => call(url),

    createCart: (data) =>
        call(`${BASE}/carts/`, { method: 'POST', body: JSON.stringify(data) }),

    getCart: (cartId) =>
        call(`${BASE}/carts/${cartId}/`),

    updateCart: (cartId, data) =>
        call(`${BASE}/carts/${cartId}/`, { method: 'PATCH', body: JSON.stringify(data) }),

    deleteCart: (cartId) =>
        call(`${BASE}/carts/${cartId}/`, { method: 'DELETE' }),

    // ── Позиции ───────────────────────────────────────────────────────────

    addItem: (cartId, data) =>
        call(`${BASE}/carts/${cartId}/items/`, { method: 'POST', body: JSON.stringify(data) }),

    updateItem: (cartId, itemId, data) =>
        call(`${BASE}/carts/${cartId}/items/${itemId}/`, { method: 'PATCH', body: JSON.stringify(data) }),

    deleteItem: (cartId, itemId) =>
        call(`${BASE}/carts/${cartId}/items/${itemId}/`, { method: 'DELETE' }),

    // ── Комплектующие ─────────────────────────────────────────────────────

    suggestAccessories: (cartId, itemId, data) =>
        call(`${BASE}/carts/${cartId}/items/${itemId}/suggest/`, { method: 'POST', body: JSON.stringify(data) }),

    addAccessory: (cartId, itemId, data) =>
        call(`${BASE}/carts/${cartId}/items/${itemId}/accessories/`, { method: 'POST', body: JSON.stringify(data) }),

    updateAccessory: (cartId, itemId, accId, data) =>
        call(`${BASE}/carts/${cartId}/items/${itemId}/accessories/${accId}/`, { method: 'PATCH', body: JSON.stringify(data) }),

    deleteAccessory: (cartId, itemId, accId) =>
        call(`${BASE}/carts/${cartId}/items/${itemId}/accessories/${accId}/`, { method: 'DELETE' }),

    // ── КП ────────────────────────────────────────────────────────────────

    getKP: (cartId) =>
        call(`${BASE}/carts/${cartId}/kp/`),

    refreshGroup: (cartId, groupId) =>
        call(`${BASE}/carts/${cartId}/groups/${groupId}/refresh/`, { method: 'POST', body: JSON.stringify({}) }),
    
    updateGroupAccessory: (cartId, groupId, accId, data) =>
        call(`${BASE}/carts/${cartId}/groups/${groupId}/accessories/${accId}/`, { method: 'PATCH', body: JSON.stringify(data) }),
    
    deleteGroupAccessory: (cartId, accId) =>
        call(`${BASE}/carts/${cartId}/group-accessories/${accId}/`, { method: 'DELETE' }),
};