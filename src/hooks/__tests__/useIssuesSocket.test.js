import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIssuesSocket } from '../useIssuesSocket.js';

class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    static instances = [];

    constructor(url) {
        this.url = url;
        this.readyState = MockWebSocket.CONNECTING;
        this.sent = [];
        this.onopen = null;
        this.onclose = null;
        this.onerror = null;
        this.onmessage = null;
        MockWebSocket.instances.push(this);
    }

    send(data) { this.sent.push(data); }

    close() {
        this.readyState = MockWebSocket.CLOSED;
        this.onclose?.();
    }

    // ── тестовые хелперы, эмулирующие сервер ──
    _open() {
        this.readyState = MockWebSocket.OPEN;
        this.onopen?.();
    }
    _message(data) {
        this.onmessage?.({ data: JSON.stringify(data) });
    }
    _serverClose() {
        this.readyState = MockWebSocket.CLOSED;
        this.onclose?.();
    }
}

const lastWs = () => MockWebSocket.instances[MockWebSocket.instances.length - 1];

beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
    localStorage.setItem('access_token', 'tok-1');
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    localStorage.clear();
});

describe('useIssuesSocket — подключение', () => {
    it('без токена — WebSocket не создаётся', () => {
        localStorage.clear();
        renderHook(() => useIssuesSocket());
        expect(MockWebSocket.instances).toHaveLength(0);
    });

    it('с токеном создаёт соединение, connected становится true после onopen', () => {
        const { result } = renderHook(() => useIssuesSocket());
        expect(result.current.connected).toBe(false);

        act(() => lastWs()._open());
        expect(result.current.connected).toBe(true);
    });

    it('onclose (не ручное закрытие) выставляет connected=false и планирует переподключение', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useIssuesSocket());
        act(() => lastWs()._open());
        expect(result.current.connected).toBe(true);

        act(() => lastWs()._serverClose());
        expect(result.current.connected).toBe(false);
        expect(MockWebSocket.instances).toHaveLength(1);

        act(() => { vi.advanceTimersByTime(1000); });
        expect(MockWebSocket.instances).toHaveLength(2);
    });

    it('onerror выставляет error', () => {
        const { result } = renderHook(() => useIssuesSocket());
        act(() => lastWs().onerror?.());
        expect(result.current.error).toBe('WebSocket error');
    });

    it('размонтирование — ручное закрытие, без переподключения', () => {
        vi.useFakeTimers();
        const { unmount } = renderHook(() => useIssuesSocket());
        act(() => lastWs()._open());
        const ws1 = lastWs();

        unmount();
        expect(ws1.readyState).toBe(MockWebSocket.CLOSED);

        act(() => { vi.advanceTimersByTime(30000); });
        expect(MockWebSocket.instances).toHaveLength(1);
    });

    it('невалидный JSON в сообщении молча игнорируется', () => {
        const { result } = renderHook(() => useIssuesSocket());
        act(() => lastWs()._open());
        expect(() => {
            act(() => lastWs().onmessage({ data: 'not-json' }));
        }).not.toThrow();
        expect(result.current.error).toBeNull();
    });

    it('ping от сервера — немедленный ответ pong', () => {
        const { result } = renderHook(() => useIssuesSocket());
        act(() => lastWs()._open());
        act(() => lastWs()._message({ type: 'ping' }));
        expect(lastWs().sent).toContain(JSON.stringify({ type: 'pong' }));
        expect(result.current.connected).toBe(true); // ping не должен влиять на состояние
    });
});

describe('useIssuesSocket — исходящие команды гейтятся по readyState', () => {
    it('joinThread/sendMessage и т.д. ничего не шлют, пока соединение не открыто', () => {
        const { result } = renderHook(() => useIssuesSocket());
        act(() => result.current.joinThread('t1'));
        expect(lastWs().sent).toHaveLength(0);
    });

    it('после открытия соединения команды отправляются как JSON', () => {
        const { result } = renderHook(() => useIssuesSocket());
        act(() => lastWs()._open());

        act(() => result.current.joinThread('t1'));
        act(() => result.current.leaveThread('t1'));
        act(() => result.current.sendMessage(5, 'привет'));
        act(() => result.current.changeStatus(5, 'resolved'));
        act(() => result.current.markRead([1, 2]));
        act(() => result.current.loadIssueMessages(5));

        expect(lastWs().sent).toEqual([
            JSON.stringify({ action: 'join_thread', thread_id: 't1' }),
            JSON.stringify({ action: 'leave_thread', thread_id: 't1' }),
            JSON.stringify({ action: 'send_message', issue_id: 5, text: 'привет' }),
            JSON.stringify({ action: 'change_status', issue_id: 5, status: 'resolved' }),
            JSON.stringify({ action: 'mark_read', message_ids: [1, 2] }),
            JSON.stringify({ action: 'load_issue_messages', issue_id: 5 }),
        ]);
    });
});

describe('useIssuesSocket — обработка серверных событий (reducer)', () => {
    it('thread_history заполняет превью-сообщения из issue_id/total_messages/preview_message', () => {
        const { result } = renderHook(() => useIssuesSocket());
        act(() => lastWs()._open());

        act(() => lastWs()._message({
            type: 'thread_history',
            thread_id: 't1',
            messages: [
                { issue_id: 1, total_messages: 3, preview_message: { message_id: 'm1', issue_id: 1, text: 'a', created_at: '2026-01-01T00:00:00Z' } },
                { issue_id: 2, total_messages: 1, preview_message: null },
            ],
        }));

        const thread = result.current.threads.t1;
        expect(thread.messages).toEqual([
            { message_id: 'm1', issue_id: 1, text: 'a', created_at: '2026-01-01T00:00:00Z' },
        ]);
        expect(thread.issueMeta).toEqual({ 1: { total_messages: 3 }, 2: { total_messages: 1 } });
    });

    it('thread_history сохраняет уже пришедшие по WS сообщения, которых нет в превью, и сортирует всё по created_at', () => {
        const { result } = renderHook(() => useIssuesSocket());
        act(() => lastWs()._open());

        act(() => lastWs()._message({
            type: 'new_message',
            thread_id: 't1', issue_id: 1, message_id: 'ws-1', text: 'ws only',
            author: 'Иван', author_id: '10', created_at: '2026-01-01T00:00:02Z', attachments: [],
        }));

        act(() => lastWs()._message({
            type: 'thread_history',
            thread_id: 't1',
            messages: [
                { issue_id: 1, total_messages: 2, preview_message: { message_id: 'm0', issue_id: 1, text: 'first', created_at: '2026-01-01T00:00:01Z' } },
            ],
        }));

        expect(result.current.threads.t1.messages.map(m => m.message_id)).toEqual(['m0', 'ws-1']);
    });

    it('new_message добавляет сообщение и не дублирует по message_id', () => {
        const { result } = renderHook(() => useIssuesSocket());
        act(() => lastWs()._open());

        const payload = {
            type: 'new_message', thread_id: 't1', issue_id: 1, message_id: 'm1',
            text: 'привет', author: 'Иван', author_id: '10', created_at: '2026-01-01T00:00:00Z',
        };
        act(() => lastWs()._message(payload));
        act(() => lastWs()._message(payload));

        expect(result.current.threads.t1.messages).toHaveLength(1);
        expect(result.current.threads.t1.messages[0]).toMatchObject({
            message_id: 'm1', author_name: 'Иван', attachments: [],
        });
    });

    it('issue_created добавляет замечание в тред', () => {
        const { result } = renderHook(() => useIssuesSocket());
        act(() => lastWs()._open());

        act(() => lastWs()._message({
            type: 'issue_created', thread_id: 't1', issue_id: 7, issue_number: 3,
            title: 'Течь', status: 'open',
            assigned_to_department: 2, assigned_to_department_name: 'ОТК', assigned_to_user: null,
        }));

        expect(result.current.threads.t1.issues).toEqual([
            { id: 7, number: 3, title: 'Течь', status: 'open', assigned_to_department: 2, assigned_to_department_name: 'ОТК', assigned_to_user: null },
        ]);
    });

    it('issue_status_changed обновляет статус существующего замечания', () => {
        const { result } = renderHook(() => useIssuesSocket());
        act(() => lastWs()._open());
        act(() => lastWs()._message({
            type: 'issue_created', thread_id: 't1', issue_id: 7, issue_number: 3, title: 'Течь', status: 'open',
        }));
        act(() => lastWs()._message({ type: 'issue_status_changed', thread_id: 't1', issue_id: 7, new_status: 'resolved' }));

        expect(result.current.threads.t1.issues[0].status).toBe('resolved');
    });

    it('issue_status_changed для незнакомого issue_id добавляет минимальную запись', () => {
        const { result } = renderHook(() => useIssuesSocket());
        act(() => lastWs()._open());
        act(() => lastWs()._message({
            type: 'issue_created', thread_id: 't1', issue_id: 1, issue_number: 1, title: 'A', status: 'open',
        }));
        act(() => lastWs()._message({ type: 'issue_status_changed', thread_id: 't1', issue_id: 99, new_status: 'resolved' }));

        expect(result.current.threads.t1.issues).toEqual([
            { id: 1, number: 1, title: 'A', status: 'open', assigned_to_department: undefined, assigned_to_department_name: undefined, assigned_to_user: undefined },
            { id: 99, status: 'resolved' },
        ]);
    });

    it('issue_status_changed для неизвестного треда — no-op', () => {
        const { result } = renderHook(() => useIssuesSocket());
        act(() => lastWs()._open());
        act(() => lastWs()._message({ type: 'issue_status_changed', thread_id: 'unknown', issue_id: 1, new_status: 'resolved' }));
        expect(result.current.threads).toEqual({});
    });

    it('notification вызывает onNotification (единственный путь доставки — хук сам уведомления не хранит)', () => {
        const onNotification = vi.fn();
        renderHook(() => useIssuesSocket({ onNotification }));
        act(() => lastWs()._open());

        act(() => lastWs()._message({ type: 'notification', payload: { type: 'issue_assigned', text: 'Вам назначили замечание' } }));

        expect(onNotification).toHaveBeenCalledTimes(1);
        expect(onNotification.mock.calls[0][0]).toMatchObject({
            notification_type: 'issue_assigned',
            is_delivered: false,
            payload: { type: 'issue_assigned', text: 'Вам назначили замечание' },
        });
    });

    it('issue_messages_loaded заменяет сообщения найденного по issue_id треда и пересортировывает', () => {
        const { result } = renderHook(() => useIssuesSocket());
        act(() => lastWs()._open());
        act(() => lastWs()._message({
            type: 'new_message', thread_id: 't1', issue_id: 1, message_id: 'm-other',
            text: 'other issue', author: 'A', author_id: '1', created_at: '2026-01-01T00:00:05Z',
        }));
        act(() => lastWs()._message({
            type: 'new_message', thread_id: 't1', issue_id: 2, message_id: 'm-preview',
            text: 'preview', author: 'B', author_id: '2', created_at: '2026-01-01T00:00:01Z',
        }));

        act(() => lastWs()._message({
            type: 'issue_messages_loaded',
            issue_id: 2,
            messages: [
                { message_id: 'full-1', issue_id: 2, text: 'полное сообщение 1', created_at: '2026-01-01T00:00:00Z' },
                { message_id: 'full-2', issue_id: 2, text: 'полное сообщение 2', created_at: '2026-01-01T00:00:02Z' },
            ],
        }));

        expect(result.current.threads.t1.messages.map(m => m.message_id)).toEqual(['full-1', 'full-2', 'm-other']);
    });

    it('issue_messages_loaded для issue_id без единого известного треда — no-op', () => {
        const { result } = renderHook(() => useIssuesSocket());
        act(() => lastWs()._open());
        act(() => lastWs()._message({ type: 'issue_messages_loaded', issue_id: 999, messages: [] }));
        expect(result.current.threads).toEqual({});
    });

    it('error пишет details либо code в состояние', () => {
        const { result } = renderHook(() => useIssuesSocket());
        act(() => lastWs()._open());
        act(() => lastWs()._message({ type: 'error', code: 'not_found' }));
        expect(result.current.error).toBe('not_found');
    });
});
