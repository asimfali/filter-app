import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IssueThreadPage from '../IssueThreadPage.jsx';
import { useIssues } from '../../contexts/IssuesContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import * as issuesApi from '../../api/issues.js';

vi.mock('../../contexts/IssuesContext.jsx', () => ({ useIssues: vi.fn() }));
vi.mock('../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('../../api/issues.js', () => ({
    closeThread: vi.fn(),
    sendMessageWithFiles: vi.fn(),
}));

Element.prototype.scrollIntoView = vi.fn();

function makeIssuesCtx(overrides = {}) {
    return {
        currentThread: null,
        currentThreadLoading: false,
        fetchThread: vi.fn(),
        leaveThread: vi.fn(),
        threadData: {},
        sendMessage: vi.fn(),
        changeStatus: vi.fn(),
        createIssue: vi.fn(),
        connected: true,
        loadIssueMessages: vi.fn(),
        ...overrides,
    };
}

const thread = (overrides = {}) => ({
    id: 't1',
    title: 'Тред по серии 100',
    created_by: 1,
    is_closed: false,
    product_external_ids: ['a', 'b'],
    assigned_to_department: { name: 'ОТК' },
    issues: [],
    ...overrides,
});

const issue = (overrides = {}) => ({
    id: 1,
    number: 1,
    title: 'Течь',
    status: 'open',
    created_by: 1,
    created_by_name: 'Иван',
    assigned_to_department_name: 'ОТК',
    ...overrides,
});

const msg = (overrides = {}) => ({
    message_id: 'm1',
    issue_id: 1,
    text: 'Привет',
    author_name: 'Иван',
    author_id: '1',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
});

beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 1 } });
});

describe('IssueThreadPage — загрузка треда', () => {
    it('на маунт вызывает fetchThread(threadId), на анмаунт — leaveThread(threadId)', () => {
        const issues = makeIssuesCtx({ currentThread: thread() });
        useIssues.mockReturnValue(issues);
        const { unmount } = render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        expect(issues.fetchThread).toHaveBeenCalledWith('t1');

        unmount();
        expect(issues.leaveThread).toHaveBeenCalledWith('t1');
    });

    it('currentThreadLoading — "Загрузка..."', () => {
        useIssues.mockReturnValue(makeIssuesCtx({ currentThreadLoading: true }));
        render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        expect(screen.getByText('Загрузка...')).toBeInTheDocument();
    });

    it('нет currentThread — "Тред не найден"', () => {
        useIssues.mockReturnValue(makeIssuesCtx({ currentThread: null }));
        render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        expect(screen.getByText('Тред не найден')).toBeInTheDocument();
    });
});

describe('IssueThreadPage — шапка', () => {
    it('показывает заголовок, число изделий/замечаний, отдел и live-индикатор', () => {
        useIssues.mockReturnValue(makeIssuesCtx({
            currentThread: thread({ issues: [issue()] }),
            connected: true,
        }));
        render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        expect(screen.getByText('Тред по серии 100')).toBeInTheDocument();
        expect(screen.getByText(/2 изделий/)).toBeInTheDocument();
        expect(screen.getByText(/1 замечаний/)).toBeInTheDocument();
        expect(screen.getByText('ОТК')).toBeInTheDocument();
        expect(screen.getByText('Live')).toBeInTheDocument();
    });

    it('connected=false — "Офлайн"', () => {
        useIssues.mockReturnValue(makeIssuesCtx({ currentThread: thread(), connected: false }));
        render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        expect(screen.getByText('Офлайн')).toBeInTheDocument();
    });

    it('"+ Замечание" disabled если тред закрыт', () => {
        useIssues.mockReturnValue(makeIssuesCtx({ currentThread: thread({ is_closed: true }) }));
        render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);

        expect(screen.getByText('+ Замечание')).toBeDisabled();
    });

    it('"+ Замечание" (тред открыт) рендерит модалку создания замечания', async () => {
        useIssues.mockReturnValue(makeIssuesCtx({ currentThread: thread() }));
        const user = userEvent.setup();
        render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);

        await user.click(screen.getByText('+ Замечание'));
        expect(screen.getByText('Новое замечание')).toBeInTheDocument();
    });

    it('"Закрыть тред" виден только автору треда', () => {
        useIssues.mockReturnValue(makeIssuesCtx({ currentThread: thread({ created_by: 999 }) }));
        render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        expect(screen.queryByText('Закрыть тред')).not.toBeInTheDocument();
    });

    it('"Закрыть тред" (автор) вызывает closeThread и onBack', async () => {
        issuesApi.closeThread.mockResolvedValue(null);
        const onBack = vi.fn();
        useIssues.mockReturnValue(makeIssuesCtx({ currentThread: thread({ created_by: 1, id: 't1' }) }));
        const user = userEvent.setup();
        render(<IssueThreadPage threadId="t1" onBack={onBack} />);

        await user.click(screen.getByText('Закрыть тред'));
        await waitFor(() => expect(issuesApi.closeThread).toHaveBeenCalledWith('t1'));
        expect(onBack).toHaveBeenCalled();
    });
});

describe('IssueThreadPage — слияние REST/WS замечаний', () => {
    it('нет замечаний — "Замечаний пока нет"', () => {
        useIssues.mockReturnValue(makeIssuesCtx({ currentThread: thread({ issues: [] }) }));
        render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        expect(screen.getByText('Замечаний пока нет')).toBeInTheDocument();
    });

    it('WS-статус перекрывает статус REST-замечания с тем же id', () => {
        useIssues.mockReturnValue(makeIssuesCtx({
            currentThread: thread({ issues: [issue({ id: 1, status: 'open' })] }),
            threadData: { t1: { messages: [], issues: [{ id: 1, status: 'resolved' }] } },
        }));
        render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        expect(screen.getByText('Решено')).toBeInTheDocument();
    });

    it('WS-only замечание (ещё нет в REST-списке) добавляется в конец', () => {
        useIssues.mockReturnValue(makeIssuesCtx({
            currentThread: thread({ issues: [] }),
            threadData: { t1: { messages: [], issues: [{ id: 55, status: 'open', title: 'Новое из WS' }] } },
        }));
        render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        expect(screen.getByText('Новое из WS')).toBeInTheDocument();
    });
});

describe('IssueThreadPage — IssuePanel: разворачивание и подгрузка сообщений', () => {
    it('раскрытие по клику на заголовок вызывает loadIssueMessages один раз, дальнейшие сворачивания/разворачивания — нет', async () => {
        const issues = makeIssuesCtx({
            currentThread: thread({ issues: [issue()] }),
            threadData: { t1: { messages: [msg()], issues: [] } },
        });
        useIssues.mockReturnValue(issues);
        const user = userEvent.setup();
        render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);

        await user.click(screen.getByText('Течь'));
        expect(issues.loadIssueMessages).toHaveBeenCalledWith(1);
        expect(issues.loadIssueMessages).toHaveBeenCalledTimes(1);

        await user.click(screen.getByText('Течь'));
        await user.click(screen.getByText('Течь'));
        expect(issues.loadIssueMessages).toHaveBeenCalledTimes(1);
    });

    it('свёрнутая панель с сообщением показывает превью автор+текст', () => {
        useIssues.mockReturnValue(makeIssuesCtx({
            currentThread: thread({ issues: [issue()] }),
            threadData: { t1: { messages: [msg({ text: 'Есть протечка' })], issues: [] } },
        }));
        render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        expect(screen.getByText('Иван: Есть протечка')).toBeInTheDocument();
    });

    it('развёрнутая панель без сообщений — "Нет сообщений"', async () => {
        useIssues.mockReturnValue(makeIssuesCtx({ currentThread: thread({ issues: [issue()] }) }));
        const user = userEvent.setup();
        render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);

        await user.click(screen.getByText('Течь'));
        expect(screen.getByText('Нет сообщений')).toBeInTheDocument();
    });
});

describe('IssueThreadPage — IssuePanel: отправка сообщений', () => {
    async function expandIssue(user) {
        await user.click(screen.getByText('Течь'));
    }

    it('отправка текстового сообщения вызывает sendMessage и очищает поле', async () => {
        const issues = makeIssuesCtx({ currentThread: thread({ issues: [issue()] }) });
        useIssues.mockReturnValue(issues);
        const user = userEvent.setup();
        const { container } = render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        await expandIssue(user);

        const textarea = container.querySelector('textarea');
        fireEvent.change(textarea, { target: { value: 'Новое сообщение' } });
        fireEvent.click(screen.getByText('↑'));

        expect(issues.sendMessage).toHaveBeenCalledWith(1, 'Новое сообщение');
        expect(textarea.value).toBe('');
    });

    it('Enter без Shift отправляет сообщение', async () => {
        const issues = makeIssuesCtx({ currentThread: thread({ issues: [issue()] }) });
        useIssues.mockReturnValue(issues);
        const user = userEvent.setup();
        const { container } = render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        await expandIssue(user);

        const textarea = container.querySelector('textarea');
        fireEvent.change(textarea, { target: { value: 'Через Enter' } });
        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

        expect(issues.sendMessage).toHaveBeenCalledWith(1, 'Через Enter');
    });

    it('Shift+Enter не отправляет сообщение', async () => {
        const issues = makeIssuesCtx({ currentThread: thread({ issues: [issue()] }) });
        useIssues.mockReturnValue(issues);
        const user = userEvent.setup();
        const { container } = render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        await expandIssue(user);

        const textarea = container.querySelector('textarea');
        fireEvent.change(textarea, { target: { value: 'многострочно' } });
        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

        expect(issues.sendMessage).not.toHaveBeenCalled();
    });

    it('пустой текст без файлов — отправка не происходит', async () => {
        const issues = makeIssuesCtx({ currentThread: thread({ issues: [issue()] }) });
        useIssues.mockReturnValue(issues);
        const user = userEvent.setup();
        render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        await expandIssue(user);

        fireEvent.click(screen.getByText('↑'));
        expect(issues.sendMessage).not.toHaveBeenCalled();
    });

    it('отправка с вложениями идёт через sendMessageWithFiles, а не через sendMessage', async () => {
        issuesApi.sendMessageWithFiles.mockResolvedValue({});
        const issues = makeIssuesCtx({ currentThread: thread({ issues: [issue()] }) });
        useIssues.mockReturnValue(issues);
        const user = userEvent.setup();
        const { container } = render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        await expandIssue(user);

        const file = new File(['x'], 'photo.png', { type: 'image/png' });
        const fileInput = container.querySelector('input[type="file"]');
        await user.upload(fileInput, file);
        expect(screen.getByText('photo.png')).toBeInTheDocument();

        const textarea = container.querySelector('textarea');
        fireEvent.change(textarea, { target: { value: 'см. фото' } });
        fireEvent.click(screen.getByText('↑'));

        await waitFor(() => expect(issuesApi.sendMessageWithFiles)
            .toHaveBeenCalledWith('t1', 1, 'см. фото', [file]));
        expect(issues.sendMessage).not.toHaveBeenCalled();
    });

    it('можно убрать выбранный файл до отправки', async () => {
        const issues = makeIssuesCtx({ currentThread: thread({ issues: [issue()] }) });
        useIssues.mockReturnValue(issues);
        const user = userEvent.setup();
        const { container } = render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        await expandIssue(user);

        const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
        const fileInput = container.querySelector('input[type="file"]');
        await user.upload(fileInput, file);
        expect(screen.getByText('doc.pdf')).toBeInTheDocument();

        await user.click(screen.getByText('✕'));
        expect(screen.queryByText('doc.pdf')).not.toBeInTheDocument();
    });

    it('замечание в статусе verified не показывает поле ввода', async () => {
        useIssues.mockReturnValue(makeIssuesCtx({
            currentThread: thread({ issues: [issue({ status: 'verified' })] }),
        }));
        const user = userEvent.setup();
        const { container } = render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        await expandIssue(user);

        expect(container.querySelector('textarea')).not.toBeInTheDocument();
    });
});

describe('IssueThreadPage — MessageBubble', () => {
    it('чужое сообщение показывает имя автора, своё — нет', async () => {
        useIssues.mockReturnValue(makeIssuesCtx({
            currentThread: thread({ issues: [issue()] }),
            threadData: { t1: { messages: [msg({ author_id: '1', author_name: 'Иван', text: 'от себя' })], issues: [] } },
        }));
        const user = userEvent.setup();
        render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        await user.click(screen.getByText('Течь'));

        expect(screen.getByText('от себя')).toBeInTheDocument();
        expect(screen.queryByText('Иван')).not.toBeInTheDocument();
    });

    it('системное сообщение рендерится по центру без пузыря', async () => {
        useIssues.mockReturnValue(makeIssuesCtx({
            currentThread: thread({ issues: [issue()] }),
            threadData: { t1: { messages: [msg({ is_system: true, text: 'Статус изменён' })], issues: [] } },
        }));
        const user = userEvent.setup();
        render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        await user.click(screen.getByText('Течь'));

        expect(screen.getByText('Статус изменён')).toBeInTheDocument();
    });

    it('изображение-вложение рендерится как img, файл — как ссылка с именем', async () => {
        useIssues.mockReturnValue(makeIssuesCtx({
            currentThread: thread({ issues: [issue()] }),
            threadData: {
                t1: {
                    messages: [msg({
                        author_id: '2',
                        attachments: [
                            { id: 'a1', file: '/media/photo.png', file_name: 'photo.png', mime_type: 'image/png' },
                            { id: 'a2', file: '/media/doc.pdf', file_name: 'doc.pdf', mime_type: 'application/pdf' },
                        ],
                    })],
                    issues: [],
                },
            },
        }));
        const user = userEvent.setup();
        const { container } = render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        await user.click(screen.getByText('Течь'));

        expect(container.querySelector('img[alt="photo.png"]')).toBeInTheDocument();
        expect(screen.getByText('doc.pdf')).toBeInTheDocument();
    });
});

describe('IssueThreadPage — StatusDropdown', () => {
    it('status=open, не создатель треда/замечания — кнопка "Взять в работу"', () => {
        useIssues.mockReturnValue(makeIssuesCtx({
            currentThread: thread({ created_by: 999, issues: [issue({ status: 'open', created_by: 999 })] }),
        }));
        useAuth.mockReturnValue({ user: { id: 1 } });
        render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        expect(screen.getByText('Взять в работу')).toBeInTheDocument();
    });

    it('status=open, создатель треда — кнопка скрыта', () => {
        useIssues.mockReturnValue(makeIssuesCtx({
            currentThread: thread({ created_by: 1, issues: [issue({ status: 'open' })] }),
        }));
        render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        expect(screen.queryByText('Взять в работу')).not.toBeInTheDocument();
    });

    it('клик по кнопке следующего статуса вызывает changeStatus', async () => {
        const issues = makeIssuesCtx({
            currentThread: thread({ created_by: 999, issues: [issue({ status: 'open', created_by: 999 })] }),
        });
        useIssues.mockReturnValue(issues);
        const user = userEvent.setup();
        render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);

        await user.click(screen.getByText('Взять в работу'));
        expect(issues.changeStatus).toHaveBeenCalledWith(1, 'in_progress');
    });

    it('status=resolved — создатель замечания видит "Подтвердить"/"Отклонить"', () => {
        useIssues.mockReturnValue(makeIssuesCtx({
            currentThread: thread({ created_by: 999, issues: [issue({ status: 'resolved', created_by: 1 })] }),
        }));
        render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        expect(screen.getByText('Подтвердить ✓')).toBeInTheDocument();
        expect(screen.getByText('Отклонить')).toBeInTheDocument();
    });

    it('status=resolved — посторонний (не автор треда и не автор замечания) ничего не видит', () => {
        useIssues.mockReturnValue(makeIssuesCtx({
            currentThread: thread({ created_by: 999, issues: [issue({ status: 'resolved', created_by: 888 })] }),
        }));
        render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        expect(screen.queryByText('Подтвердить ✓')).not.toBeInTheDocument();
        expect(screen.queryByText('Отклонить')).not.toBeInTheDocument();
    });

    it('status=verified — дропдаун полностью скрыт', () => {
        useIssues.mockReturnValue(makeIssuesCtx({
            currentThread: thread({ issues: [issue({ status: 'verified' })] }),
        }));
        render(<IssueThreadPage threadId="t1" onBack={vi.fn()} />);
        expect(screen.queryByText('Подтвердить ✓')).not.toBeInTheDocument();
        expect(screen.queryByText('Взять в работу')).not.toBeInTheDocument();
    });
});
