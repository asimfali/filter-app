import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IssuesProvider, useIssues } from '../IssuesContext.jsx';
import { useIssuesSocket } from '../../hooks/useIssuesSocket.js';
import { useNotifications } from '../NotificationsContext.jsx';
import * as issuesApi from '../../api/issues.js';

vi.mock('../../hooks/useIssuesSocket.js', () => ({ useIssuesSocket: vi.fn() }));
vi.mock('../NotificationsContext.jsx', () => ({ useNotifications: vi.fn() }));
vi.mock('../../api/issues.js', () => ({
    getThreads: vi.fn(),
    getThread: vi.fn(),
    createThread: vi.fn(),
    createIssue: vi.fn(),
}));

function makeSocket(overrides = {}) {
    return {
        connected: true,
        error: null,
        threads: {},
        joinThread: vi.fn(),
        leaveThread: vi.fn(),
        sendMessage: vi.fn(),
        changeStatus: vi.fn(),
        markRead: vi.fn(),
        loadIssueMessages: vi.fn(),
        ...overrides,
    };
}

function Harness() {
    const issues = useIssues();
    return (
        <div>
            <div data-testid="connected">{String(issues.connected)}</div>
            <div data-testid="thread-list">{JSON.stringify(issues.threadList)}</div>
            <div data-testid="thread-list-loading">{String(issues.threadListLoading)}</div>
            <div data-testid="current-thread">{JSON.stringify(issues.currentThread)}</div>
            <div data-testid="error">{issues.error ? 'err' : ''}</div>
            <button onClick={() => issues.fetchThreads()}>fetch-threads</button>
            <button onClick={() => issues.fetchThread('t1')}>fetch-thread</button>
            <button onClick={() => issues.leaveThread('t1')}>leave-thread</button>
            <button onClick={async () => { await issues.createThread({ title: 'X' }); }}>create-thread</button>
            <button onClick={() => issues.createIssue('t1', { title: 'Y' })}>create-issue</button>
            <button onClick={() => issues.changeStatus(5, 'resolved')}>change-status</button>
            <button onClick={() => issues.sendMessage(5, 'привет')}>send-message</button>
            <button onClick={() => issues.markRead([1, 2])}>mark-read</button>
            <button onClick={() => issues.loadIssueMessages(5)}>load-issue-messages</button>
        </div>
    );
}

let socket;
const renderIssues = () => render(<IssuesProvider><Harness /></IssuesProvider>);

beforeEach(() => {
    vi.clearAllMocks();
    socket = makeSocket();
    useIssuesSocket.mockReturnValue(socket);
    useNotifications.mockReturnValue({ addNotification: vi.fn() });
});

describe('IssuesProvider — треды', () => {
    it('fetchThreads — успех наполняет threadList и снимает loading', async () => {
        issuesApi.getThreads.mockResolvedValue({ results: [{ id: 1, title: 'T1' }] });
        const user = userEvent.setup();
        renderIssues();

        await user.click(screen.getByText('fetch-threads'));
        await waitFor(() => expect(screen.getByTestId('thread-list-loading')).toHaveTextContent('false'));
        expect(JSON.parse(screen.getByTestId('thread-list').textContent)).toEqual([{ id: 1, title: 'T1' }]);
    });

    it('fetchThreads — поддерживает голый массив в ответе', async () => {
        issuesApi.getThreads.mockResolvedValue([{ id: 2, title: 'T2' }]);
        const user = userEvent.setup();
        renderIssues();

        await user.click(screen.getByText('fetch-threads'));
        await waitFor(() => expect(JSON.parse(screen.getByTestId('thread-list').textContent)).toEqual([{ id: 2, title: 'T2' }]));
    });

    it('fetchThreads — ошибка выставляет error', async () => {
        issuesApi.getThreads.mockRejectedValue(new Error('network'));
        const user = userEvent.setup();
        renderIssues();

        await user.click(screen.getByText('fetch-threads'));
        await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('err'));
    });

    it('fetchThread — успех сохраняет currentThread и вызывает socket.joinThread', async () => {
        issuesApi.getThread.mockResolvedValue({ id: 't1', title: 'Тред 1' });
        const user = userEvent.setup();
        renderIssues();

        await user.click(screen.getByText('fetch-thread'));
        await waitFor(() => expect(JSON.parse(screen.getByTestId('current-thread').textContent)).toEqual({ id: 't1', title: 'Тред 1' }));
        expect(socket.joinThread).toHaveBeenCalledWith('t1');
    });

    it('leaveThread вызывает socket.leaveThread и сбрасывает currentThread', async () => {
        issuesApi.getThread.mockResolvedValue({ id: 't1', title: 'Тред 1' });
        const user = userEvent.setup();
        renderIssues();
        await user.click(screen.getByText('fetch-thread'));
        await waitFor(() => expect(screen.getByTestId('current-thread')).not.toHaveTextContent('null'));

        await user.click(screen.getByText('leave-thread'));
        expect(socket.leaveThread).toHaveBeenCalledWith('t1');
        expect(screen.getByTestId('current-thread')).toHaveTextContent('null');
    });

    it('createThread добавляет созданный тред в начало threadList', async () => {
        issuesApi.getThreads.mockResolvedValue({ results: [{ id: 1, title: 'Старый' }] });
        issuesApi.createThread.mockResolvedValue({ id: 2, title: 'Новый' });
        const user = userEvent.setup();
        renderIssues();
        await user.click(screen.getByText('fetch-threads'));
        await waitFor(() => expect(screen.getByTestId('thread-list-loading')).toHaveTextContent('false'));

        await user.click(screen.getByText('create-thread'));
        await waitFor(() => expect(JSON.parse(screen.getByTestId('thread-list').textContent)).toEqual([
            { id: 2, title: 'Новый' },
            { id: 1, title: 'Старый' },
        ]));
        expect(issuesApi.createThread).toHaveBeenCalledWith({ title: 'X' });
    });
});

describe('IssuesProvider — замечания/сообщения/уведомления — тонкие прокси', () => {
    it('createIssue делегирует в issuesApi.createIssue', async () => {
        issuesApi.createIssue.mockResolvedValue({ id: 9 });
        const user = userEvent.setup();
        renderIssues();
        await user.click(screen.getByText('create-issue'));
        await waitFor(() => expect(issuesApi.createIssue).toHaveBeenCalledWith('t1', { title: 'Y' }));
    });

    it('changeStatus/sendMessage/markRead/loadIssueMessages вызывают соответствующие методы сокета', async () => {
        const user = userEvent.setup();
        renderIssues();

        await user.click(screen.getByText('change-status'));
        expect(socket.changeStatus).toHaveBeenCalledWith(5, 'resolved');

        await user.click(screen.getByText('send-message'));
        expect(socket.sendMessage).toHaveBeenCalledWith(5, 'привет');

        await user.click(screen.getByText('mark-read'));
        expect(socket.markRead).toHaveBeenCalledWith([1, 2]);

        await user.click(screen.getByText('load-issue-messages'));
        expect(socket.loadIssueMessages).toHaveBeenCalledWith(5);
    });

    it('connected/threadData пробрасываются напрямую из сокета', () => {
        socket = makeSocket({ connected: false, threads: { t1: { messages: [], issues: [] } } });
        useIssuesSocket.mockReturnValue(socket);
        renderIssues();
        expect(screen.getByTestId('connected')).toHaveTextContent('false');
    });
});

describe('useIssues — без провайдера', () => {
    it('бросает ошибку', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => render(<Harness />)).toThrow('useIssues must be used inside <IssuesProvider>');
        spy.mockRestore();
    });
});
