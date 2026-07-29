import { tokenStorage } from './auth.js';

const API_BASE = '/api/v1/issues';

/**
 * Базовый fetch с авторизацией.
 * Повторяет паттерн из auth.js и sessions.js.
 */
async function apiFetch(url, options = {}) {
  const token = tokenStorage.getAccess();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw { status: response.status, ...error };
  }

  // 204 No Content — тело отсутствует
  if (response.status === 204) return null;
  return response.json();
}

// ─── Треды ────────────────────────────────────────────────────────────────────

/**
 * Получить список тредов текущего пользователя.
 * GET /api/v1/issues/threads/
 */
export const getThreads = () => apiFetch(`${API_BASE}/threads/`);

/**
 * Получить тред по ID.
 * GET /api/v1/issues/threads/{id}/
 */
export const getThread = (threadId) =>
  apiFetch(`${API_BASE}/threads/${threadId}/`);

/**
 * Создать тред из FilterTreeGraph.
 * POST /api/v1/issues/threads/
 * @param {Object} payload
 * @param {string}   payload.title
 * @param {string[]} payload.product_external_ids  — external_id из 1С
 * @param {Object}   payload.graph_context      — сохранённый фильтр для восстановления
 * @param {'PUBLIC'|'RESTRICTED'} payload.visibility
 * @param {string[]} [payload.department_ids]   — для RESTRICTED
 */
export const createThread = (payload) =>
  apiFetch(`${API_BASE}/threads/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

/**
 * Закрыть тред.
 * POST /api/v1/issues/threads/{id}/close/
 */
export const closeThread = (threadId) =>
  apiFetch(`${API_BASE}/threads/${threadId}/close/`, { method: 'POST' });

export const getThreadsByProduct = (externalId) =>
    apiFetch(`${API_BASE}/threads/?product_external_id=${externalId}`);

// ─── Замечания (Issues) ───────────────────────────────────────────────────────

/**
 * Создать замечание в треде.
 * POST /api/v1/issues/threads/{threadId}/issues/
 * @param {Object} payload
 * @param {string} payload.title
 * @param {string} payload.assigned_to_department_id
 * @param {string} [payload.assigned_to_user_id]
 */
export const createIssue = (threadId, payload) =>
  apiFetch(`${API_BASE}/threads/${threadId}/issues/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

// ─── Уведомления ─────────────────────────────────────────────────────────────

/**
 * Получить список уведомлений.
 * GET /api/v1/issues/notifications/
 */
export const getNotifications = () =>
  apiFetch(`${API_BASE}/notifications/?is_delivered=false`);

/**
 * Отметить все уведомления прочитанными.
 * POST /api/v1/issues/notifications/mark_all_read/
 */
export const markAllNotificationsRead = () =>
  apiFetch(`${API_BASE}/notifications/mark_all_read/`, { method: 'POST' });

/**
 * Отправить сообщение с вложениями (файлами).
 * POST /api/v1/issues/issues/{issueId}/messages/
 */
export const sendMessageWithFiles = (threadId, issueId, text, files = []) => {
  const token = tokenStorage.getAccess();
  const formData = new FormData();
  if (text) formData.append('text', text);
  files.forEach(f => formData.append('files', f));

  return fetch(`${API_BASE}/threads/${threadId}/issues/${issueId}/messages/`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  }).then(r => r.json());
};