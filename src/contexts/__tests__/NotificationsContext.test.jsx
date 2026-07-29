import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationsProvider, useNotifications } from '../NotificationsContext.jsx';
import * as issuesApi from '../../api/issues.js';

vi.mock('../../api/issues.js', () => ({
    getNotifications: vi.fn(),
    markAllNotificationsRead: vi.fn(),
}));

function Harness() {
    const { notifications, unreadCount, loading, markAllRead, dismiss, addNotification } = useNotifications();
    return (
        <div>
            <div data-testid="loading">{String(loading)}</div>
            <div data-testid="unread">{unreadCount}</div>
            <div data-testid="list">{JSON.stringify(notifications)}</div>
            <button onClick={markAllRead}>mark-all-read</button>
            <button onClick={() => dismiss(1)}>dismiss-1</button>
            <button onClick={() => addNotification({ id: 99, is_delivered: false, text: 'из WS' })}>add</button>
        </div>
    );
}

const renderNotifications = () => render(<NotificationsProvider><Harness /></NotificationsProvider>);
const waitLoaded = () => waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

const n1 = { id: 1, is_delivered: false, text: 'A' };
const n2 = { id: 2, is_delivered: true, text: 'B' };

beforeEach(() => {
    vi.clearAllMocks();
});

describe('NotificationsProvider — загрузка при маунте', () => {
    it('загружает уведомления и считает unreadCount только по is_delivered=false', async () => {
        issuesApi.getNotifications.mockResolvedValue({ results: [n1, n2] });
        renderNotifications();

        await waitLoaded();
        expect(screen.getByTestId('unread')).toHaveTextContent('1');
        expect(JSON.parse(screen.getByTestId('list').textContent)).toEqual([n1, n2]);
    });

    it('поддерживает как {results: [...]}, так и голый массив в ответе', async () => {
        issuesApi.getNotifications.mockResolvedValue([n1]);
        renderNotifications();

        await waitLoaded();
        expect(JSON.parse(screen.getByTestId('list').textContent)).toEqual([n1]);
    });

    it('ошибка загрузки — молча остаётся пустой список, loading снимается', async () => {
        issuesApi.getNotifications.mockRejectedValue(new Error('network'));
        renderNotifications();

        await waitLoaded();
        expect(screen.getByTestId('list')).toHaveTextContent('[]');
    });
});

describe('NotificationsProvider — действия', () => {
    beforeEach(() => {
        issuesApi.getNotifications.mockResolvedValue({ results: [n1, n2] });
    });

    it('addNotification добавляет запись в начало списка', async () => {
        const user = userEvent.setup();
        renderNotifications();
        await waitLoaded();

        await user.click(screen.getByText('add'));
        const list = JSON.parse(screen.getByTestId('list').textContent);
        expect(list[0]).toEqual({ id: 99, is_delivered: false, text: 'из WS' });
        expect(list).toHaveLength(3);
    });

    it('markAllRead — успех помечает все is_delivered=true', async () => {
        issuesApi.markAllNotificationsRead.mockResolvedValue(null);
        const user = userEvent.setup();
        renderNotifications();
        await waitLoaded();

        await user.click(screen.getByText('mark-all-read'));
        await waitFor(() => expect(screen.getByTestId('unread')).toHaveTextContent('0'));
        const list = JSON.parse(screen.getByTestId('list').textContent);
        expect(list.every(n => n.is_delivered)).toBe(true);
    });

    it('markAllRead — ошибка API не меняет состояние', async () => {
        issuesApi.markAllNotificationsRead.mockRejectedValue(new Error('fail'));
        const user = userEvent.setup();
        renderNotifications();
        await waitLoaded();

        await user.click(screen.getByText('mark-all-read'));
        await waitFor(() => expect(issuesApi.markAllNotificationsRead).toHaveBeenCalled());
        expect(screen.getByTestId('unread')).toHaveTextContent('1');
    });

    it('dismiss убирает уведомление по id локально, без вызова API', async () => {
        const user = userEvent.setup();
        renderNotifications();
        await waitLoaded();

        await user.click(screen.getByText('dismiss-1'));
        const list = JSON.parse(screen.getByTestId('list').textContent);
        expect(list.map(n => n.id)).toEqual([2]);
        expect(issuesApi.markAllNotificationsRead).not.toHaveBeenCalled();
    });
});

describe('useNotifications — без провайдера', () => {
    it('бросает ошибку', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => render(<Harness />)).toThrow('useNotifications must be used inside <NotificationsProvider>');
        spy.mockRestore();
    });
});
