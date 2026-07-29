import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateIssueModal from '../CreateIssueModal.jsx';
import { useIssues } from '../../../contexts/IssuesContext.jsx';

vi.mock('../../../contexts/IssuesContext.jsx', () => ({ useIssues: vi.fn() }));

const thread = { id: 7, assigned_to_department: { name: 'ОТК' } };

beforeEach(() => {
    vi.clearAllMocks();
});

describe('CreateIssueModal', () => {
    it('показывает отдел-исполнитель треда', () => {
        useIssues.mockReturnValue({ createIssue: vi.fn() });
        render(<CreateIssueModal thread={thread} onClose={vi.fn()} />);
        expect(screen.getByText('Исполнитель: ОТК')).toBeInTheDocument();
    });

    it('кнопка "Создать" недоступна, пока заголовок пуст', () => {
        useIssues.mockReturnValue({ createIssue: vi.fn() });
        render(<CreateIssueModal thread={thread} onClose={vi.fn()} />);
        expect(screen.getByText('Создать')).toBeDisabled();
    });

    it('успешный сабмит вызывает createIssue с обрезанными полями и закрывает модалку', async () => {
        const createIssue = vi.fn().mockResolvedValue({ id: 1 });
        const onClose = vi.fn();
        useIssues.mockReturnValue({ createIssue });
        const user = userEvent.setup();
        render(<CreateIssueModal thread={thread} onClose={onClose} />);

        await user.type(screen.getByPlaceholderText('Кратко опишите замечание'), '  Течь  ');
        await user.type(screen.getByPlaceholderText('Подробности...'), '  детали  ');
        await user.click(screen.getByText('Создать'));

        await waitFor(() => expect(createIssue).toHaveBeenCalledWith(7, { title: 'Течь', description: 'детали' }));
        expect(onClose).toHaveBeenCalled();
    });

    it('ошибка API показывает текст ошибки, не закрывая модалку', async () => {
        const createIssue = vi.fn().mockRejectedValue({ error: 'Нет прав' });
        const onClose = vi.fn();
        useIssues.mockReturnValue({ createIssue });
        const user = userEvent.setup();
        render(<CreateIssueModal thread={thread} onClose={onClose} />);

        await user.type(screen.getByPlaceholderText('Кратко опишите замечание'), 'Течь');
        await user.click(screen.getByText('Создать'));

        expect(await screen.findByText('Нет прав')).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('ошибка без .error — дефолтный текст', async () => {
        const createIssue = vi.fn().mockRejectedValue(new Error('boom'));
        useIssues.mockReturnValue({ createIssue });
        const user = userEvent.setup();
        render(<CreateIssueModal thread={thread} onClose={vi.fn()} />);

        await user.type(screen.getByPlaceholderText('Кратко опишите замечание'), 'Течь');
        await user.click(screen.getByText('Создать'));

        expect(await screen.findByText('Ошибка при создании замечания')).toBeInTheDocument();
    });

    it('кнопка "Отмена" и клик по фону вызывают onClose', async () => {
        useIssues.mockReturnValue({ createIssue: vi.fn() });
        const onClose = vi.fn();
        const user = userEvent.setup();
        const { container } = render(<CreateIssueModal thread={thread} onClose={onClose} />);

        await user.click(screen.getByText('Отмена'));
        expect(onClose).toHaveBeenCalledTimes(1);

        await user.click(container.firstChild);
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('во время загрузки кнопка показывает "Создание..." и остаётся disabled', async () => {
        let resolveCreate;
        const createIssue = vi.fn(() => new Promise(res => { resolveCreate = res; }));
        useIssues.mockReturnValue({ createIssue });
        const user = userEvent.setup();
        render(<CreateIssueModal thread={thread} onClose={vi.fn()} />);

        await user.type(screen.getByPlaceholderText('Кратко опишите замечание'), 'Течь');
        await user.click(screen.getByText('Создать'));

        expect(screen.getByText('Создание...')).toBeDisabled();
        resolveCreate({ id: 1 });
        await waitFor(() => expect(createIssue).toHaveBeenCalled());
    });
});
