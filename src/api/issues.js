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

/**
 * Переоткрыть тред.
 * POST /api/v1/issues/threads/{id}/reopen/
 */
export const reopenThread = (threadId) =>
  apiFetch(`${API_BASE}/threads/${threadId}/reopen/`, { method: 'POST' });

// ─── Замечания (Issues) ───────────────────────────────────────────────────────

/**
 * Получить список замечаний треда.
 * GET /api/v1/issues/threads/{threadId}/issues/
 */
export const getIssues = (threadId) =>
  apiFetch(`${API_BASE}/threads/${threadId}/issues/`);

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

/**
 * Получить допустимые переходы статуса для замечания.
 * GET /api/v1/issues/threads/{threadId}/issues/{issueId}/allowed_statuses/
 */
export const getAllowedStatuses = (threadId, issueId) =>
  apiFetch(`${API_BASE}/threads/${threadId}/issues/${issueId}/allowed_statuses/`);

/**
 * Сменить статус замечания.
 * POST /api/v1/issues/threads/{threadId}/issues/{issueId}/change_status/
 * @param {'in_progress'|'resolved'|'verified'|'rejected'} newStatus
 */
export const changeIssueStatus = (threadId, issueId, newStatus) =>
  apiFetch(`${API_BASE}/threads/${threadId}/issues/${issueId}/change_status/`, {
    method: 'POST',
    body: JSON.stringify({ status: newStatus }),
  });

// ─── Сообщения ────────────────────────────────────────────────────────────────

/**
 * Получить историю сообщений замечания (fallback без WS).
 * GET /api/v1/issues/threads/{threadId}/issues/{issueId}/messages/
 */
export const getMessages = (threadId, issueId) =>
  apiFetch(`${API_BASE}/threads/${threadId}/issues/${issueId}/messages/`);

/**
 * Отправить сообщение через REST (fallback без WS).
 * POST /api/v1/issues/threads/{threadId}/issues/{issueId}/messages/
 */
export const sendMessage = (threadId, issueId, text) =>
  apiFetch(`${API_BASE}/threads/${threadId}/issues/${issueId}/messages/`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });

/**
 * Отметить сообщения прочитанными.
 * POST /api/v1/issues/threads/{threadId}/issues/{issueId}/messages/mark_read/
 * @param {string[]} messageIds
 */
export const markMessagesRead = (threadId, issueId, messageIds) =>
  apiFetch(
    `${API_BASE}/threads/${threadId}/issues/${issueId}/messages/mark_read/`,
    {
      method: 'POST',
      body: JSON.stringify({ message_ids: messageIds }),
    }
  );

// ─── Уведомления ─────────────────────────────────────────────────────────────

/**
 * Получить список уведомлений.
 * GET /api/v1/issues/notifications/
 */
export const getNotifications = () =>
  apiFetch(`${API_BASE}/notifications/`);

/**
 * Отметить все уведомления прочитанными.
 * POST /api/v1/issues/notifications/mark_all_read/
 */
export const markAllNotificationsRead = () =>
  apiFetch(`${API_BASE}/notifications/mark_all_read/`, { method: 'POST' });