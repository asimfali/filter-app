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
            // messages теперь массив {issue_id, total_messages, preview_message}
            const previews = [];
            const issueMeta = {}; // { [issue_id]: { total_messages } }
        
            for (const item of messages) {
                issueMeta[item.issue_id] = { total_messages: item.total_messages };
                if (item.preview_message) previews.push(item.preview_message);
            }
        
            const existing = state.threads[thread_id]?.messages ?? [];
            // Оставляем WS-сообщения которых нет в превью
            const previewIds = new Set(previews.map(m => m.message_id));
            const wsOnly = existing.filter(m => !previewIds.has(m.message_id));
            const merged = [...previews, ...wsOnly]
                .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        
            return {
                ...state,
                threads: {
                    ...state.threads,
                    [thread_id]: {
                        ...state.threads[thread_id],
                        messages: merged,
                        issueMeta, // { [issue_id]: { total_messages } }
                    },
                },
            };
        }
        case 'NEW_MESSAGE': {
            const { thread_id, issue_id, message_id, text, author, author_id, created_at, attachments } = action.payload;
            const thread = state.threads[thread_id] ?? { messages: [], issues: [] };
            if (thread.messages.some((m) => m.message_id === message_id)) return state;
            const msg = { message_id, issue_id, text, author_name: author, author_id, created_at, attachments: attachments ?? [] };
            return {
                ...state,
                threads: {
                    ...state.threads,
                    [thread_id]: {
                        ...thread,
                        messages: [...thread.messages, msg],
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
            const exists = thread.issues?.some(i => i.id === issue_id);
            return {
                ...state,
                threads: {
                    ...state.threads,
                    [thread_id]: {
                        ...thread,
                        issues: exists
                            ? thread.issues.map(i => i.id === issue_id ? { ...i, status: new_status } : i)
                            : [...(thread.issues ?? []), { id: issue_id, status: new_status }],
                    },
                },
            };
        }
        case 'NOTIFICATION':
            return { ...state, notifications: [action.payload, ...state.notifications] };
        case 'ISSUE_MESSAGES_LOADED': {
            const { issue_id, messages } = action.payload;
            // Найти thread_id по issue_id — ищем в существующих threads
            const threadEntry = Object.entries(state.threads).find(([, t]) =>
                t.messages?.some(m => String(m.issue_id) === String(issue_id))
            );
            if (!threadEntry) return state;
            const [thread_id, thread] = threadEntry;
            const otherMessages = (thread.messages ?? []).filter(
                m => String(m.issue_id) !== String(issue_id)
            );
            return {
                ...state,
                threads: {
                    ...state.threads,
                    [thread_id]: {
                        ...thread,
                        messages: [...otherMessages, ...messages].sort(
                            (a, b) => new Date(a.created_at) - new Date(b.created_at)
                        ),
                    },
                },
            };
        }
        case 'CLEAR_NOTIFICATIONS':
            return { ...state, notifications: [] };
        default:
            return state;
    }
}

export function useIssuesSocket({ onNotification } = {}) {
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
        // Ping-pong — отвечаем напрямую через wsRef
        if (data.type === 'ping') {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'pong' }));
            }
            return;
        }

        switch (data.type) {
            case 'thread_history':
                console.log('[thread_history]', data);
                dispatch({ type: 'THREAD_HISTORY', payload: { thread_id: data.thread_id, messages: data.messages } });
                break;
            case 'new_message':
                dispatch({ type: 'NEW_MESSAGE', payload: data });
                break;
            case 'issue_created':
                dispatch({
                    type: 'ISSUE_CREATED',
                    payload: {
                        thread_id: data.thread_id,
                        issue: {
                            id: data.issue_id,
                            number: data.issue_number,
                            title: data.title,
                            status: data.status,
                            assigned_to_department: data.assigned_to_department,
                            assigned_to_department_name: data.assigned_to_department_name,
                            assigned_to_user: data.assigned_to_user,
                        },
                    },
                });
                break;
            case 'issue_status_changed':
                dispatch({ type: 'ISSUE_STATUS_CHANGED', payload: { thread_id: data.thread_id, issue_id: data.issue_id, new_status: data.new_status } });
                break;
            case 'notification':
                console.log('[notification payload]', data.payload);
                onNotification?.({
                    id: Date.now(),
                    notification_type: data.payload.type,
                    is_delivered: false,
                    created_at: new Date().toISOString(),
                    payload: data.payload,
                });
                break;
            case 'issue_messages_loaded':
                dispatch({
                    type: 'ISSUE_MESSAGES_LOADED',
                    payload: { issue_id: data.issue_id, messages: data.messages },
                });
                break;
            case 'error':
                dispatch({ type: 'ERROR', payload: data.details ?? data.code });
                break;
        }
    }, [onNotification]);

    const connect = useCallback(() => {
        const token = tokenStorage.getAccess();
        if (!token) return;

        if (wsRef.current?.readyState === WebSocket.OPEN ||
            wsRef.current?.readyState === WebSocket.CONNECTING) return;

        manualClose.current = false;
        const ws = new WebSocket(`ws://${window.location.host}/ws/issues/?token=${token}`);
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
    const loadIssueMessages = useCallback(
        (issueId) => send({ action: 'load_issue_messages', issue_id: issueId }),
        [send]
    );

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
        loadIssueMessages,
    };
}