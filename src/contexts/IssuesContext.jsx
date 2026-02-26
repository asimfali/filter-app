import { createContext, useContext, useState, useCallback } from 'react';
import { useIssuesSocket } from '../hooks/useIssuesSocket.js';
import * as issuesApi from '../api/issues.js';

const IssuesContext = createContext(null);

export function IssuesProvider({ children }) {
  const socket = useIssuesSocket();

  // Загруженные треды (список)
  const [threadList, setThreadList] = useState([]);
  const [threadListLoading, setThreadListLoading] = useState(false);

  // Текущий открытый тред
  const [currentThread, setCurrentThread] = useState(null);
  const [currentThreadLoading, setCurrentThreadLoading] = useState(false);

  const [error, setError] = useState(null);

  // ─── Треды ──────────────────────────────────────────────────────────────

  const fetchThreads = useCallback(async () => {
    setThreadListLoading(true);
    setError(null);
    try {
      const data = await issuesApi.getThreads();
      setThreadList(data?.results ?? data ?? []);
    } catch (e) {
      setError(e);
    } finally {
      setThreadListLoading(false);
    }
  }, []);

  const fetchThread = useCallback(async (threadId) => {
    setCurrentThreadLoading(true);
    setError(null);
    try {
      const data = await issuesApi.getThread(threadId);
      setCurrentThread(data);
      socket.joinThread(threadId);
    } catch (e) {
      setError(e);
    } finally {
      setCurrentThreadLoading(false);
    }
  }, [socket]);

  const leaveThread = useCallback((threadId) => {
    socket.leaveThread(threadId);
    setCurrentThread(null);
  }, [socket]);

  const createThread = useCallback(async (payload) => {
    const data = await issuesApi.createThread(payload);
    setThreadList((prev) => [data, ...prev]);
    return data;
  }, []);

  // ─── Замечания ──────────────────────────────────────────────────────────

  const createIssue = useCallback(async (threadId, payload) => {
    return await issuesApi.createIssue(threadId, payload);
    // issue_created придёт через WS и обновит socket.threads
  }, []);

  const changeStatus = useCallback((issueId, status) => {
    socket.changeStatus(issueId, status);
    // issue_status_changed придёт через WS
  }, [socket]);

  // ─── Сообщения ──────────────────────────────────────────────────────────

  const sendMessage = useCallback((issueId, text) => {
    socket.sendMessage(issueId, text);
    // new_message придёт через WS
  }, [socket]);

  const markRead = useCallback((messageIds) => {
    socket.markRead(messageIds);
  }, [socket]);

  // ─── Уведомления ────────────────────────────────────────────────────────

  const dismissNotifications = useCallback(() => {
    socket.clearNotifications();
    issuesApi.markAllNotificationsRead().catch(() => {});
  }, [socket]);

  const value = {
    // Состояние сокета
    connected: socket.connected,
    wsError: socket.error,

    // Треды
    threadList,
    threadListLoading,
    fetchThreads,
    createThread,

    // Текущий тред
    currentThread,
    currentThreadLoading,
    fetchThread,
    leaveThread,

    // WS-данные по тредам: { [thread_id]: { messages, issues } }
    threadData: socket.threads,

    // Замечания
    createIssue,
    changeStatus,

    // Сообщения
    sendMessage,
    markRead,

    // Уведомления
    notifications: socket.notifications,
    dismissNotifications,

    error,
  };

  return (
    <IssuesContext.Provider value={value}>
      {children}
    </IssuesContext.Provider>
  );
}

export function useIssues() {
  const ctx = useContext(IssuesContext);
  if (!ctx) throw new Error('useIssues must be used inside <IssuesProvider>');
  return ctx;
}