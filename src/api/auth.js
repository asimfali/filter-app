const BASE = '/api/v1/auth';

// Храним токены в localStorage
export const tokenStorage = {
  getAccess:  () => localStorage.getItem('access_token'),
  getRefresh: () => localStorage.getItem('refresh_token'),
  set: (access, refresh) => {
    localStorage.setItem('access_token', access);
    if (refresh) localStorage.setItem('refresh_token', refresh);
  },
  clear: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },
};

// Базовый fetch с авторизацией
export async function apiFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const access = tokenStorage.getAccess();
  if (access) headers['Authorization'] = `Bearer ${access}`;

  const res = await fetch(url, { ...options, headers });

  // Попытка рефреша при 401
  if (res.status === 401 && tokenStorage.getRefresh()) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${tokenStorage.getAccess()}`;
      return fetch(url, { ...options, headers });
    }
    tokenStorage.clear();
  }

  return res;
}

async function refreshTokens() {
  try {
    const res = await fetch(`${BASE}/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: tokenStorage.getRefresh() }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    tokenStorage.set(data.access, data.refresh);
    return true;
  } catch {
    return false;
  }
}

// Auth API
export const authApi = {
  async login(email, password) {
    const res = await fetch(`${BASE}/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  },

  async login2fa(email, code) {
    const res = await fetch(`${BASE}/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, '2fa_code': code }),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  },

  async register(payload) {
    const res = await fetch(`${BASE}/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  },

  async activate(email, code) {
    const res = await fetch(`${BASE}/activate/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, activation_code: code }),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  },

  async profile() {
    const res = await apiFetch(`${BASE}/profile/`);
    return { ok: res.ok, data: await res.json() };
  },

  async logout(refreshToken) {
    await apiFetch(`${BASE}/logout/`, {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    tokenStorage.clear();
  },

  async departments() {
    const res = await apiFetch(`${BASE}/departments/?root_only=false`);
    return { ok: res.ok, data: await res.json() };
  },
  
  async roles() {
    const res = await apiFetch(`${BASE}/roles/`);
    return { ok: res.ok, data: await res.json() };
  },
};