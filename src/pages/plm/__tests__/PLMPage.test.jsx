import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PLMPage from '../PLMPage';
import { plmApi } from '../../../api/plm';
import { authApi } from '../../../api/auth';
import { catalogApi } from '../../../api/catalog';
import { useAuth } from '../../../contexts/AuthContext';

vi.mock('../../../api/plm', () => ({
    plmApi: {
        getLiteras: vi.fn(),
        getVisibilityGroups: vi.fn(),
        getPresets: vi.fn(),
        getGroups: vi.fn(),
        getGroup: vi.fn(),
        getApprovals: vi.fn(),
        batchSubmit: vi.fn(),
        batchApprove: vi.fn(),
        approve: vi.fn(),
        reject: vi.fn(),
        deleteGroup: vi.fn(),
        removeStagesFromGroup: vi.fn(),
        deleteStage: vi.fn(),
    },
}));
vi.mock('../../../api/auth', () => ({ authApi: { departments: vi.fn() } }));
vi.mock('../../../api/catalog', () => ({ catalogApi: { searchProducts: vi.fn() } }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../components/plm/BatchCreateForm', () => ({
    default: ({ productIds, onCreated, onCancel }) => (
        <div data-testid="batch-create-form-stub" data-product-ids={JSON.stringify(productIds)}>
            <button onClick={() => onCreated({ id: 1 })}>create-group</button>
            <button onClick={onCancel}>cancel-create</button>
        </div>
    ),
}));

const ok = (data) => ({ ok: true, data: { success: true, data } });
const withPerms = (...perms) => ({ id: 1, permissions: perms });

const stageDraft = { id: 21, product_id: 5, product_name: 'Изделие Х', status: 'draft' };
const stagePending = { id: 23, product_id: 7, product_name: 'Изделие Z', status: 'pending_approval' };

const group1 = {
    id: 1, name: 'Группа А', stages_count: 2,
    status_summary: { draft: 1, pending_approval: 1 }, created_by_name: 'Иванов',
};

beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: withPerms() });
    plmApi.getLiteras.mockResolvedValue(ok([]));
    plmApi.getVisibilityGroups.mockResolvedValue(ok([]));
    plmApi.getPresets.mockResolvedValue(ok([]));
    authApi.departments.mockResolvedValue({ ok: true, data: [] });
});

describe('PLMPage — переключение вкладок', () => {
    it('по умолчанию открыта вкладка "Группы", переключение на "Изделия" меняет контент', async () => {
        const user = userEvent.setup();
        plmApi.getGroups.mockResolvedValue(ok([]));
        render(<PLMPage onOpenProduct={vi.fn()} />);
        expect(await screen.findByText(/Групп нет/)).toBeInTheDocument();
        await user.click(screen.getByText('Изделия'));
        expect(screen.getByPlaceholderText(/Найти изделие/)).toBeInTheDocument();
    });
});

describe('PLMPage — GroupsTab: загрузка и список', () => {
    it('loading → пусто → список групп с summary', async () => {
        let resolveGroups;
        plmApi.getGroups.mockReturnValue(new Promise(r => { resolveGroups = r; }));
        render(<PLMPage onOpenProduct={vi.fn()} />);
        expect(screen.getByText('Загрузка...')).toBeInTheDocument();

        resolveGroups(ok([group1]));
        expect(await screen.findByText('Группа А')).toBeInTheDocument();
        expect(screen.getByText('2 изд.')).toBeInTheDocument();
        expect(screen.getByText('Иванов')).toBeInTheDocument();
    });

    it('пустой список — "Групп нет"', async () => {
        plmApi.getGroups.mockResolvedValue(ok([]));
        render(<PLMPage onOpenProduct={vi.fn()} />);
        expect(await screen.findByText(/Групп нет/)).toBeInTheDocument();
    });

    it('разворачивание группы грузит getGroup и инициализирует выбор всех стадий', async () => {
        useAuth.mockReturnValue({ user: withPerms('plm.stage.manage') }); // "Выбрано:" виден только canManage
        const user = userEvent.setup();
        plmApi.getGroups.mockResolvedValue(ok([group1]));
        plmApi.getGroup.mockResolvedValue(ok({ stages: [stageDraft, stagePending], status_summary: group1.status_summary }));
        render(<PLMPage onOpenProduct={vi.fn()} />);
        await user.click(await screen.findByText('Группа А'));

        await waitFor(() => expect(plmApi.getGroup).toHaveBeenCalledWith(1));
        expect(await screen.findByText('Изделие Х')).toBeInTheDocument();
        expect(screen.getByText('Изделие Z')).toBeInTheDocument();
        expect(screen.getByText('Выбрано: 2 из 2')).toBeInTheDocument();
    });
});

describe('PLMPage — GroupsTab: batch-действия внутри группы', () => {
    beforeEach(() => {
        useAuth.mockReturnValue({ user: withPerms('plm.stage.manage') });
        plmApi.getGroups.mockResolvedValue(ok([group1]));
        plmApi.getGroup.mockResolvedValue(ok({ stages: [stageDraft, stagePending], status_summary: group1.status_summary }));
    });

    async function expandGroup(user) {
        render(<PLMPage onOpenProduct={vi.fn()} />);
        await user.click(await screen.findByText('Группа А'));
        await screen.findByText('Изделие Х');
    }

    it('без plm.stage.manage — нет batch-панели/выбора/удаления', async () => {
        useAuth.mockReturnValue({ user: withPerms() });
        const user = userEvent.setup();
        await expandGroup(user);
        expect(screen.queryByText(/Выбрано:/)).not.toBeInTheDocument();
        expect(screen.queryByText('✕')).not.toBeInTheDocument();
    });

    it('batch submit отправляет выбранные draft-стадии и обновляет группу', async () => {
        const user = userEvent.setup();
        plmApi.batchSubmit.mockResolvedValue(ok({ submitted: 1 }));
        plmApi.getGroup
            .mockResolvedValueOnce(ok({ stages: [stageDraft, stagePending], status_summary: group1.status_summary }))
            .mockResolvedValueOnce(ok({ stages: [{ ...stageDraft, status: 'pending_approval' }, stagePending], status_summary: { pending_approval: 2 } }));
        await expandGroup(user);

        await user.click(screen.getByText('На согласование (1)'));
        await waitFor(() => expect(plmApi.batchSubmit).toHaveBeenCalledWith([21], null));
        await waitFor(() => expect(plmApi.getGroup).toHaveBeenCalledTimes(2));
    });

    it('batch approve требует выбранный отдел, вызывает batchApprove и сбрасывает кэш approvals', async () => {
        const user = userEvent.setup();
        authApi.departments.mockResolvedValue({ ok: true, data: [{ id: 9, name: 'ОТК' }] });
        plmApi.getApprovals.mockResolvedValue(ok([{ id: 200, department: 9, department_name: 'ОТК', decision: 'pending' }]));
        plmApi.batchApprove.mockResolvedValue(ok({ approved: 1 }));
        await expandGroup(user);

        const approveBtn = screen.getByText('Одобрить (1)');
        expect(approveBtn).toBeDisabled();
        await user.selectOptions(screen.getByText('Выберите отдел').closest('select'), '9');
        await user.click(approveBtn);
        await waitFor(() => expect(plmApi.batchApprove).toHaveBeenCalledWith([23], 9));
    });

    it('"Исключить из группы" вызывает removeStagesFromGroup для выбранных', async () => {
        const user = userEvent.setup();
        plmApi.removeStagesFromGroup.mockResolvedValue(ok({}));
        await expandGroup(user);
        await user.click(screen.getByText('Исключить из группы (2)'));
        await waitFor(() => expect(plmApi.removeStagesFromGroup).toHaveBeenCalledWith(1, [21, 23]));
    });

    it('удаление группы: confirm-гейт, успех убирает группу из списка', async () => {
        const user = userEvent.setup();
        plmApi.deleteGroup.mockResolvedValue(ok({}));
        render(<PLMPage onOpenProduct={vi.fn()} />);
        await screen.findByText('Группа А');
        await user.click(screen.getByTitle('Удалить группу'));
        await user.click(screen.getByText('Подтвердить'));
        await waitFor(() => expect(plmApi.deleteGroup).toHaveBeenCalledWith(1));
        expect(screen.queryByText('Группа А')).not.toBeInTheDocument();
    });

    it('удаление группы: отмена не вызывает deleteGroup', async () => {
        const user = userEvent.setup();
        render(<PLMPage onOpenProduct={vi.fn()} />);
        await screen.findByText('Группа А');
        await user.click(screen.getByTitle('Удалить группу'));
        await user.click(screen.getByText('Отмена'));
        expect(plmApi.deleteGroup).not.toHaveBeenCalled();
        expect(screen.getByText('Группа А')).toBeInTheDocument();
    });

    it('удаление группы: ошибка API показывает actionError', async () => {
        const user = userEvent.setup();
        plmApi.deleteGroup.mockResolvedValue({ ok: false, data: { success: false, error: 'Нет прав' } });
        render(<PLMPage onOpenProduct={vi.fn()} />);
        await user.click(await screen.findByText('Группа А'));
        await user.click(screen.getByTitle('Удалить группу'));
        await user.click(screen.getByText('Подтвердить'));
        expect(await screen.findByText('Нет прав')).toBeInTheDocument();
    });
});

describe('PLMPage — StageRowInGroup', () => {
    beforeEach(() => {
        useAuth.mockReturnValue({ user: withPerms('plm.stage.manage') });
        plmApi.getGroups.mockResolvedValue(ok([group1]));
        plmApi.getGroup.mockResolvedValue(ok({ stages: [stageDraft, stagePending], status_summary: {} }));
    });

    it('чекбокс выбора не триггерит разворот (approvals не грузятся)', async () => {
        const user = userEvent.setup();
        render(<PLMPage onOpenProduct={vi.fn()} />);
        await user.click(await screen.findByText('Группа А'));
        const row = await screen.findByText('Изделие Х');
        const checkbox = row.closest('div').parentElement.querySelector('input[type="checkbox"]');
        await user.click(checkbox);
        expect(plmApi.getApprovals).not.toHaveBeenCalled();
        expect(screen.getByText('Выбрано: 1 из 2')).toBeInTheDocument();
    });

    it('клик по названию изделия разворачивает и грузит approvals один раз', async () => {
        const user = userEvent.setup();
        plmApi.getApprovals.mockResolvedValue(ok([{ id: 1, department: 5, department_name: 'ОТК', decision: 'pending' }]));
        render(<PLMPage onOpenProduct={vi.fn()} />);
        await user.click(await screen.findByText('Группа А'));
        await user.click(await screen.findByText('Изделие Х'));
        await waitFor(() => expect(plmApi.getApprovals).toHaveBeenCalledWith(21));
        expect(await screen.findByText('Одобрить')).toBeInTheDocument();

        await user.click(screen.getByText('Изделие Х')); // свернуть
        await user.click(screen.getByText('Изделие Х')); // развернуть снова
        expect(plmApi.getApprovals).toHaveBeenCalledTimes(1);
    });

    it('"→" вызывает onOpenProduct с product_id', async () => {
        const user = userEvent.setup();
        const onOpenProduct = vi.fn();
        render(<PLMPage onOpenProduct={onOpenProduct} />);
        await user.click(await screen.findByText('Группа А'));
        await screen.findByText('Изделие Х');
        await user.click(screen.getAllByText('→')[0]);
        expect(onOpenProduct).toHaveBeenCalledWith(5);
    });
});

describe('PLMPage — ProductsTab', () => {
    it('поиск заблокирован при <2 символах', async () => {
        const user = userEvent.setup();
        render(<PLMPage onOpenProduct={vi.fn()} />);
        await user.click(screen.getByText('Изделия'));
        const input = screen.getByPlaceholderText(/Найти изделие/);
        await user.type(input, 'а');
        expect(screen.getByRole('button', { name: 'Найти' })).toBeDisabled();
    });

    it('успешный поиск рендерит список изделий', async () => {
        const user = userEvent.setup();
        catalogApi.searchProducts.mockResolvedValue({
            ok: true,
            data: { success: true, data: [{ id: 5, name: 'Калорифер КЭВ-1', product_type: 'Калорифер' }] },
        });
        render(<PLMPage onOpenProduct={vi.fn()} />);
        await user.click(screen.getByText('Изделия'));
        await user.type(screen.getByPlaceholderText(/Найти изделие/), 'Калорифер');
        await user.click(screen.getByRole('button', { name: 'Найти' }));

        expect(await screen.findByText('Калорифер КЭВ-1')).toBeInTheDocument();
        expect(screen.getByText('Калорифер')).toBeInTheDocument();
    });

    it('пустой результат — "Ничего не найдено"', async () => {
        const user = userEvent.setup();
        catalogApi.searchProducts.mockResolvedValue({ ok: true, data: { success: true, data: [] } });
        render(<PLMPage onOpenProduct={vi.fn()} />);
        await user.click(screen.getByText('Изделия'));
        await user.type(screen.getByPlaceholderText(/Найти изделие/), 'нетнигде');
        await user.click(screen.getByRole('button', { name: 'Найти' }));
        expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument();
    });

    it('выбор изделий + "Создать группу стадий" открывает форму с выбранными id, после создания сбрасывает выбор', async () => {
        useAuth.mockReturnValue({ user: withPerms('plm.stage.manage') });
        const user = userEvent.setup();
        catalogApi.searchProducts.mockResolvedValue({
            ok: true,
            data: {
                success: true,
                data: [
                    { id: 5, name: 'Калорифер А', product_type: 'Калорифер' },
                    { id: 6, name: 'Калорифер Б', product_type: 'Калорифер' },
                ],
            },
        });
        render(<PLMPage onOpenProduct={vi.fn()} />);
        await user.click(screen.getByText('Изделия'));
        await user.type(screen.getByPlaceholderText(/Найти изделие/), 'Калорифер');
        await user.click(screen.getByRole('button', { name: 'Найти' }));
        await screen.findByText('Калорифер А');

        await user.click(screen.getByText('Все'));
        expect(screen.getByText('Выбрано: 2 из 2')).toBeInTheDocument();
        await user.click(screen.getByText('Создать группу стадий (2)'));

        const stub = await screen.findByTestId('batch-create-form-stub');
        expect(stub.dataset.productIds).toBe(JSON.stringify([5, 6]));

        await user.click(screen.getByText('create-group'));
        expect(screen.queryByTestId('batch-create-form-stub')).not.toBeInTheDocument();
        // Тулбар "Выбрано: N из M" остаётся (список изделий никуда не делся), но счётчик обнулился
        expect(screen.getByText('Выбрано: 0 из 2')).toBeInTheDocument();
        expect(screen.queryByText(/Создать группу стадий \(/)).not.toBeInTheDocument();
    });

    it('без plm.stage.manage — нет тулбара выбора/создания группы', async () => {
        const user = userEvent.setup();
        catalogApi.searchProducts.mockResolvedValue({
            ok: true,
            data: { success: true, data: [{ id: 5, name: 'АБ', product_type: 'Т' }] },
        });
        render(<PLMPage onOpenProduct={vi.fn()} />);
        await user.click(screen.getByText('Изделия'));
        await user.type(screen.getByPlaceholderText(/Найти изделие/), 'АБ');
        await user.click(screen.getByRole('button', { name: 'Найти' }));
        await screen.findByText('АБ');
        expect(screen.queryByText(/Выбрано:/)).not.toBeInTheDocument();
    });
});
