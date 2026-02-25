import { tokenStorage } from './auth';

const API_BASE = '/api/v1/core';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${tokenStorage.getAccess()}`,
});

export const sessionsApi = {
  // Получить активную сессию (вызывается при входе)
  getCurrent: async () => {
    const res = await fetch(`${API_BASE}/sessions/current/`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  // Создать новую сессию
  create: async (sessionType, name, data) => {
    const res = await fetch(`${API_BASE}/sessions/`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ session_type: sessionType, name, data }),
    });
    return res.json();
  },

  // Обновить существующую сессию
  update: async (id, patch) => {
    const res = await fetch(`${API_BASE}/sessions/${id}/`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    });
    return res.json();
  },

  // Сделать сессию активной
  activate: async (id) => {
    const res = await fetch(`${API_BASE}/sessions/${id}/activate/`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return res.json();
  },

  // Список сессий (для будущего менеджера сессий)
  list: async (sessionType = null) => {
    const params = sessionType ? `?session_type=${sessionType}` : '';
    const res = await fetch(`${API_BASE}/sessions/${params}`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  // Удалить сессию
  remove: async (id) => {
    await fetch(`${API_BASE}/sessions/${id}/`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  },
};