import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as issuesApi from '../api/issues.js';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  // ─── Загрузка при входе ──────────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await issuesApi.getNotifications();
      setNotifications(data?.results ?? data ?? []);
    } catch {
      // молча — не критично
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ─── Добавить из WS (вызывается из IssuesContext) ────────────────────────

  const addNotification = useCallback((notification) => {
    setNotifications((prev) => {
      // Дедупликация по id
      if (prev.some((n) => n.id === notification.id)) return prev;
      return [notification, ...prev];
    });
  }, []);

  // ─── Прочитать все ───────────────────────────────────────────────────────

  const markAllRead = useCallback(async () => {
    try {
      await issuesApi.markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_delivered: true }))
      );
    } catch {
      // молча
    }
  }, []);

  // ─── Удалить одно локально (без API) ─────────────────────────────────────

  const dismiss = useCallback((notificationId) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_delivered).length;

  const value = {
    notifications,
    unreadCount,
    loading,
    addNotification,
    markAllRead,
    dismiss,
    fetchNotifications,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationsProvider>');
  return ctx;
}