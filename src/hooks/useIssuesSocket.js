import { useEffect, useRef, useCallback, useReducer } from 'react';
import { tokenStorage } from '../api/auth.js';

const initialState = {
  connected: false,
  error: null,
  threads: {},
  notifications: [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'CONNECTED':
      return { ...state, connected: true, error: null };
    case 'DISCONNECTED':
      return { ...state, connected: false };
    case 'ERROR':
      return { ...state, error: action.payload };
    case 'THREAD_HISTORY': {
      const { thread_id, messages } = action.payload;
      return {
        ...state,
        threads: {
          ...state.threads,
          [thread_id]: { ...state.threads[thread_id], messages },
        },
      };
    }
    case 'NEW_MESSAGE': {
      const { thread_id, issue_id, message } = action.payload;
      const thread = state.threads[thread_id] ?? { messages: [], issues: [] };
      if (thread.messages.some((m) => m.id === message.id)) return state;
      return {
        ...state,
        threads: {
          ...state.threads,
          [thread_id]: {
            ...thread,
            messages: [...thread.messages, { ...message, issue_id }],
          },
        },
      };
    }
    case 'ISSUE_CREATED': {
      const { thread_id, issue } = action.payload;
      const thread = state.threads[thread_id] ?? { messages: [], issues: [] };
      return {
        ...state,
        threads: {
          ...state.threads,
          [thread_id]: { ...thread, issues: [...(thread.issues ?? []), issue] },
        },
      };
    }
    case 'ISSUE_STATUS_CHANGED': {
      const { thread_id, issue_id, new_status } = action.payload;
      const thread = state.threads[thread_id];
      if (!thread) return state;
      return {
        ...state,
        threads: {
          ...state.threads,
          [thread_id]: {
            ...thread,
            issues: thread.issues.map((iss) =>
              iss.id === issue_id ? { ...iss, status: new_status } : iss
            ),
          },
        },
      };
    }
    case 'NOTIFICATION':
      return { ...state, notifications: [action.payload, ...state.notifications] };
    case 'CLEAR_NOTIFICATIONS':
      return { ...state, notifications: [] };
    default:
      return state;
  }
}

export function useIssuesSocket() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectAttempts = useRef(0);
  const manualClose = useRef(false);
  const MAX_RECONNECT_ATTEMPTS = 5;

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) return;
    const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
    reconnectAttempts.current += 1;
    reconnectTimer.current = setTimeout(() => connect(), delay);
  }, []);

  const handleServerEvent = useCallback((data) => {
    switch (data.type) {
      case 'thread_history':
        dispatch({ type: 'THREAD_HISTORY', payload: { thread_id: data.thread_id, messages: data.messages } });
        break;
      case 'new_message':
        dispatch({ type: 'NEW_MESSAGE', payload: { thread_id: data.thread_id, issue_id: data.issue_id, message: data.message } });
        break;
      case 'issue_created':
        dispatch({ type: 'ISSUE_CREATED', payload: { thread_id: data.thread_id, issue: data.issue } });
        break;
      case 'issue_status_changed':
        dispatch({ type: 'ISSUE_STATUS_CHANGED', payload: { thread_id: data.thread_id, issue_id: data.issue_id, new_status: data.new_status } });
        break;
      case 'notification':
        dispatch({ type: 'NOTIFICATION', payload: data });
        break;
      case 'error':
        dispatch({ type: 'ERROR', payload: data.details ?? data.code });
        break;
    }
  }, []);

  const connect = useCallback(() => {
    const token = tokenStorage.getAccess();
    if (!token) return;

    // Не создавать новое соединение если уже открыто
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) return;

    manualClose.current = false;
    const ws = new WebSocket(`ws://localhost:8001/ws/issues/?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempts.current = 0;
      dispatch({ type: 'CONNECTED' });
    };

    ws.onclose = () => {
      dispatch({ type: 'DISCONNECTED' });
      if (!manualClose.current) scheduleReconnect();
    };

    ws.onerror = () => {
      dispatch({ type: 'ERROR', payload: 'WebSocket error' });
    };

    ws.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      handleServerEvent(data);
    };
  }, [scheduleReconnect, handleServerEvent]);

  // Один useEffect
  useEffect(() => {
    connect();
    return () => {
      manualClose.current = true;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const joinThread = useCallback((threadId) => send({ action: 'join_thread', thread_id: threadId }), [send]);
  const leaveThread = useCallback((threadId) => send({ action: 'leave_thread', thread_id: threadId }), [send]);
  const sendMessage = useCallback((issueId, text) => send({ action: 'send_message', issue_id: issueId, text }), [send]);
  const changeStatus = useCallback((issueId, status) => send({ action: 'change_status', issue_id: issueId, status }), [send]);
  const markRead = useCallback((messageIds) => send({ action: 'mark_read', message_ids: messageIds }), [send]);
  const clearNotifications = useCallback(() => dispatch({ type: 'CLEAR_NOTIFICATIONS' }), []);

  return {
    connected: state.connected,
    error: state.error,
    threads: state.threads,
    notifications: state.notifications,
    joinThread,
    leaveThread,
    sendMessage,
    changeStatus,
    markRead,
    clearNotifications,
  };
}