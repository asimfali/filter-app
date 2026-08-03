import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IssuesPage from '../IssuesPage.jsx';
import { useIssues } from '../../contexts/IssuesContext.jsx';

vi.mock('../../contexts/IssuesContext.jsx', () => ({ useIssues: vi.fn() }));

function makeIssues(overrides = {}) {
    return {
        threadList: [],
        threadListLoading: false,
        fetchThreads: vi.fn(),
        error: null,
        connected: true,
        ...overrides,
    };
}

const thread = (overrides = {}) => ({
    id: 1,
    title: 'Тред по серии 100',
    visibility: 'RESTRICTED',
    product_external_ids: ['a', 'b'],
    assigned_to_department: { name: 'ОТК' },
    open_issues_count: 1,
    issues_count: 2,
    is_closed: false,
    created_at: '2026-01-05T00:00:00Z',
    ...overrides,
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe('IssuesPage — загрузка', () => {
    it('вызывает fetchThreads при маунте', () => {
        const issues = makeIssues();
        useIssues.mockReturnValue(issues);
        render(<IssuesPage onOpenThread={vi.fn()} />);
        expect(issues.fetchThreads).toHaveBeenCalledTimes(1);
    });

    it('показывает индикатор загрузки', () => {
        useIssues.mockReturnValue(makeIssues({ threadListLoading: true }));
        render(<IssuesPage onOpenThread={vi.fn()} />);
        expect(screen.getByText('Загрузка...')).toBeInTheDocument();
    });

    it('показывает ошибку загрузки', () => {
        useIssues.mockReturnValue(makeIssues({ error: new Error('fail') }));
        render(<IssuesPage onOpenThread={vi.fn()} />);
        expect(screen.getByText('Ошибка загрузки. Попробуйте обновить страницу.')).toBeInTheDocument();
    });

    it('пустой активный список — сообщение "Нет активных тредов"', () => {
        useIssues.mockReturnValue(makeIssues({ threadList: [] }));
        render(<IssuesPage onOpenThread={vi.fn()} />);
        expect(screen.getByText('Нет активных тредов')).toBeInTheDocument();
    });
});

describe('IssuesPage — фильтр', () => {
    it('по умолчанию показывает только активные', () => {
        useIssues.mockReturnValue(makeIssues({
            threadList: [thread({ id: 1, title: 'Активный', is_closed: false }), thread({ id: 2, title: 'Закрытый', is_closed: true })],
        }));
        render(<IssuesPage onOpenThread={vi.fn()} />);
        expect(screen.getByText('Активный')).toBeInTheDocument();
        expect(screen.queryByText('Закрытый')).not.toBeInTheDocument();
    });

    it('переключение на "Закрытые" показывает только закрытые', async () => {
        useIssues.mockReturnValue(makeIssues({
            threadList: [thread({ id: 1, title: 'Активный', is_closed: false }), thread({ id: 2, title: 'Закрытый', is_closed: true })],
        }));
        const user = userEvent.setup();
        render(<IssuesPage onOpenThread={vi.fn()} />);

        await user.click(screen.getByText('Закрытые'));
        expect(screen.getByText('Закрытый')).toBeInTheDocument();
        expect(screen.queryByText('Активный')).not.toBeInTheDocument();
    });

    it('переключение на "Все" показывает оба', async () => {
        useIssues.mockReturnValue(makeIssues({
            threadList: [thread({ id: 1, title: 'Активный', is_closed: false }), thread({ id: 2, title: 'Закрытый', is_closed: true })],
        }));
        const user = userEvent.setup();
        render(<IssuesPage onOpenThread={vi.fn()} />);

        await user.click(screen.getByText('Все'));
        expect(screen.getByText('Активный')).toBeInTheDocument();
        expect(screen.getByText('Закрытый')).toBeInTheDocument();
    });

    it('фильтр "Все" без совпадений — "Ничего не найдено"', async () => {
        useIssues.mockReturnValue(makeIssues({ threadList: [] }));
        const user = userEvent.setup();
        render(<IssuesPage onOpenThread={vi.fn()} />);

        await user.click(screen.getByText('Все'));
        expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
    });
});

describe('IssuesPage — карточка треда', () => {
    it('клик по карточке вызывает onOpenThread с id треда', async () => {
        const onOpenThread = vi.fn();
        useIssues.mockReturnValue(makeIssues({ threadList: [thread({ id: 42, title: 'Клик сюда' })] }));
        const user = userEvent.setup();
        render(<IssuesPage onOpenThread={onOpenThread} />);

        await user.click(screen.getByText('Клик сюда'));
        expect(onOpenThread).toHaveBeenCalledWith(42);
    });

    it('показывает количество открытых замечаний и отдел-исполнитель', () => {
        useIssues.mockReturnValue(makeIssues({
            threadList: [thread({ open_issues_count: 3, issues_count: 5, assigned_to_department: { name: 'Сборка' } })],
        }));
        render(<IssuesPage onOpenThread={vi.fn()} />);
        expect(screen.getByText('(3 открытых)')).toBeInTheDocument();
        expect(screen.getByText('→ Сборка')).toBeInTheDocument();
    });

    it('публичный тред помечен "Публичный", закрытый — "Закрыт"', async () => {
        useIssues.mockReturnValue(makeIssues({
            threadList: [thread({ visibility: 'PUBLIC', is_closed: true })],
        }));
        const user = userEvent.setup();
        render(<IssuesPage onOpenThread={vi.fn()} />);
        await user.click(screen.getByText('Все'));
        expect(screen.getByText('Публичный')).toBeInTheDocument();
        expect(screen.getByText('Закрыт')).toBeInTheDocument();
    });
});

describe('IssuesPage — live-индикатор', () => {
    it('connected=true — "Live"', () => {
        useIssues.mockReturnValue(makeIssues({ connected: true }));
        render(<IssuesPage onOpenThread={vi.fn()} />);
        expect(screen.getByText('Live')).toBeInTheDocument();
    });

    it('connected=false — "Офлайн"', () => {
        useIssues.mockReturnValue(makeIssues({ connected: false }));
        render(<IssuesPage onOpenThread={vi.fn()} />);
        expect(screen.getByText('Офлайн')).toBeInTheDocument();
    });
});
