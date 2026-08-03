import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateThreadModal from '../CreateThreadModal.jsx';
import { useIssues } from '../../../contexts/IssuesContext.jsx';
import { authApi } from '../../../api/auth.js';

vi.mock('../../../contexts/IssuesContext.jsx', () => ({ useIssues: vi.fn() }));
vi.mock('../../../api/auth.js', () => ({ authApi: { departments: vi.fn() } }));

const departments = [{ id: 1, name: 'ОТК' }, { id: 2, name: 'Сборка' }];

beforeEach(() => {
    vi.clearAllMocks();
});

describe('CreateThreadModal — загрузка отделов', () => {
    it('показывает "Загрузка..." пока список отделов не пришёл, затем select с опциями', async () => {
        authApi.departments.mockResolvedValue({ ok: true, data: departments });
        useIssues.mockReturnValue({ createThread: vi.fn() });
        render(<CreateThreadModal productIds={['a']} onClose={vi.fn()} onCreated={vi.fn()} />);

        expect(screen.getByText('Загрузка...')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByText('ОТК')).toBeInTheDocument());
        expect(screen.getByText('Сборка')).toBeInTheDocument();
    });

    it('поддерживает как голый массив, так и {results: [...]} в ответе', async () => {
        authApi.departments.mockResolvedValue({ ok: true, data: { results: departments } });
        useIssues.mockReturnValue({ createThread: vi.fn() });
        render(<CreateThreadModal productIds={['a']} onClose={vi.fn()} onCreated={vi.fn()} />);
        await waitFor(() => expect(screen.getByText('ОТК')).toBeInTheDocument());
    });

    it('ошибка загрузки отделов — молча остаётся пустой select, без краша', async () => {
        authApi.departments.mockRejectedValue(new Error('network'));
        useIssues.mockReturnValue({ createThread: vi.fn() });
        render(<CreateThreadModal productIds={['a']} onClose={vi.fn()} onCreated={vi.fn()} />);

        await waitFor(() => expect(screen.queryByText('Загрузка...')).not.toBeInTheDocument());
        expect(screen.getByText('Выберите подразделение')).toBeInTheDocument();
    });
});

describe('CreateThreadModal — валидация и отправка', () => {
    beforeEach(() => authApi.departments.mockResolvedValue({ ok: true, data: departments }));

    it('кнопка "Создать тред" недоступна без заголовка/отдела', async () => {
        useIssues.mockReturnValue({ createThread: vi.fn() });
        render(<CreateThreadModal productIds={['a', 'b']} onClose={vi.fn()} onCreated={vi.fn()} />);
        await waitFor(() => expect(screen.getByText('ОТК')).toBeInTheDocument());

        expect(screen.getByRole('button', { name: 'Создать тред' })).toBeDisabled();
    });

    it('успешный сабмит формирует корректный payload и вызывает onCreated+onClose', async () => {
        const created = { id: 5, title: 'Серия 100' };
        const createThread = vi.fn().mockResolvedValue(created);
        const onCreated = vi.fn();
        const onClose = vi.fn();
        useIssues.mockReturnValue({ createThread });
        const user = userEvent.setup();
        render(<CreateThreadModal productIds={['a', 'b']} graphContext={{ axis: 1 }} onClose={onClose} onCreated={onCreated} />);
        await waitFor(() => expect(screen.getByText('ОТК')).toBeInTheDocument());

        await user.type(screen.getByPlaceholderText('Например: Замечания по серии 100'), '  Серия 100  ');
        await user.type(screen.getByPlaceholderText('Контекст для участников...'), '  описание  ');
        await user.selectOptions(screen.getByRole('combobox'), '2');
        await user.click(screen.getByRole('button', { name: 'Создать тред' }));

        await waitFor(() => expect(createThread).toHaveBeenCalledWith({
            title: 'Серия 100',
            description: 'описание',
            product_external_ids: ['a', 'b'],
            graph_context: { axis: 1 },
            visibility: 'restricted',
            assigned_to_department_id: 2,
        }));
        expect(onCreated).toHaveBeenCalledWith(created);
        expect(onClose).toHaveBeenCalled();
    });

    it('без graphContext отправляется пустой объект', async () => {
        const createThread = vi.fn().mockResolvedValue({ id: 1 });
        useIssues.mockReturnValue({ createThread });
        const user = userEvent.setup();
        render(<CreateThreadModal productIds={['a']} onClose={vi.fn()} onCreated={vi.fn()} />);
        await waitFor(() => expect(screen.getByText('ОТК')).toBeInTheDocument());

        await user.type(screen.getByPlaceholderText('Например: Замечания по серии 100'), 'X');
        await user.selectOptions(screen.getByRole('combobox'), '1');
        await user.click(screen.getByRole('button', { name: 'Создать тред' }));

        await waitFor(() => expect(createThread).toHaveBeenCalledWith(
            expect.objectContaining({ graph_context: {} }),
        ));
    });

    it('переключение видимости на "Публичный" отражается в payload', async () => {
        const createThread = vi.fn().mockResolvedValue({ id: 1 });
        useIssues.mockReturnValue({ createThread });
        const user = userEvent.setup();
        render(<CreateThreadModal productIds={['a']} onClose={vi.fn()} onCreated={vi.fn()} />);
        await waitFor(() => expect(screen.getByText('ОТК')).toBeInTheDocument());

        await user.type(screen.getByPlaceholderText('Например: Замечания по серии 100'), 'X');
        await user.selectOptions(screen.getByRole('combobox'), '1');
        await user.click(screen.getByText('Публичный'));
        await user.click(screen.getByRole('button', { name: 'Создать тред' }));

        await waitFor(() => expect(createThread).toHaveBeenCalledWith(
            expect.objectContaining({ visibility: 'public' }),
        ));
    });

    it('ошибка API показывает err.error, не закрывая модалку', async () => {
        const createThread = vi.fn().mockRejectedValue({ error: 'Нет доступа' });
        const onClose = vi.fn();
        useIssues.mockReturnValue({ createThread });
        const user = userEvent.setup();
        render(<CreateThreadModal productIds={['a']} onClose={onClose} onCreated={vi.fn()} />);
        await waitFor(() => expect(screen.getByText('ОТК')).toBeInTheDocument());

        await user.type(screen.getByPlaceholderText('Например: Замечания по серии 100'), 'X');
        await user.selectOptions(screen.getByRole('combobox'), '1');
        await user.click(screen.getByRole('button', { name: 'Создать тред' }));

        expect(await screen.findByText('Нет доступа')).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('ошибка без .error — дефолтный текст', async () => {
        const createThread = vi.fn().mockRejectedValue(new Error('boom'));
        useIssues.mockReturnValue({ createThread });
        const user = userEvent.setup();
        render(<CreateThreadModal productIds={['a']} onClose={vi.fn()} onCreated={vi.fn()} />);
        await waitFor(() => expect(screen.getByText('ОТК')).toBeInTheDocument());

        await user.type(screen.getByPlaceholderText('Например: Замечания по серии 100'), 'X');
        await user.selectOptions(screen.getByRole('combobox'), '1');
        await user.click(screen.getByRole('button', { name: 'Создать тред' }));

        expect(await screen.findByText('Ошибка при создании треда')).toBeInTheDocument();
    });

    it('"Отмена" закрывает модалку без вызова createThread', async () => {
        const createThread = vi.fn();
        const onClose = vi.fn();
        useIssues.mockReturnValue({ createThread });
        const user = userEvent.setup();
        render(<CreateThreadModal productIds={['a']} onClose={onClose} onCreated={vi.fn()} />);
        await waitFor(() => expect(screen.getByText('ОТК')).toBeInTheDocument());

        await user.click(screen.getByText('Отмена'));
        expect(onClose).toHaveBeenCalled();
        expect(createThread).not.toHaveBeenCalled();
    });
});
