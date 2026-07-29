import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BatchCreateForm from '../BatchCreateForm';
import { plmApi } from '../../../api/plm';

vi.mock('../../../api/plm', () => ({
    plmApi: {
        getLiteras: vi.fn(),
        getVisibilityGroups: vi.fn(),
        batchCreate: vi.fn(),
    },
}));

const ok = (data) => ({ ok: true, data: { success: true, data } });

const litera1 = { id: 1, code: 'А', name: 'Опытная' };
const vis1 = { id: 10, name: 'Только менеджеры' };

beforeEach(() => {
    vi.clearAllMocks();
    plmApi.getLiteras.mockResolvedValue(ok([litera1]));
    plmApi.getVisibilityGroups.mockResolvedValue(ok([vis1]));
});

describe('BatchCreateForm', () => {
    it('грузит литеры/группы видимости при маунте и рендерит опции', async () => {
        render(<BatchCreateForm productIds={[1, 2]} onCreated={vi.fn()} onCancel={vi.fn()} />);
        expect(screen.getByText('Создать группу стадий (2 изд.)')).toBeInTheDocument();
        expect(await screen.findByText('Лит.А — Опытная')).toBeInTheDocument();
        expect(screen.getByText('Только менеджеры')).toBeInTheDocument();
    });

    it('валидация: пустое имя группы блокирует сабмит без вызова API', async () => {
        const user = userEvent.setup();
        render(<BatchCreateForm productIds={[1]} onCreated={vi.fn()} onCancel={vi.fn()} />);
        await user.click(screen.getByText('Создать'));
        expect(await screen.findByText('Введите название группы')).toBeInTheDocument();
        expect(plmApi.batchCreate).not.toHaveBeenCalled();
    });

    it('валидация: не выбрана литера блокирует сабмит', async () => {
        const user = userEvent.setup();
        render(<BatchCreateForm productIds={[1]} onCreated={vi.fn()} onCancel={vi.fn()} />);
        await user.type(screen.getByPlaceholderText('Название группы'), 'Группа А');
        await user.click(screen.getByText('Создать'));
        expect(await screen.findByText('Выберите литеру')).toBeInTheDocument();
        expect(plmApi.batchCreate).not.toHaveBeenCalled();
    });

    it('успешный сабмит вызывает batchCreate с payload и onCreated(data)', async () => {
        const user = userEvent.setup();
        const onCreated = vi.fn();
        plmApi.batchCreate.mockResolvedValue(ok({ id: 500 }));
        render(<BatchCreateForm productIds={[1, 2]} onCreated={onCreated} onCancel={vi.fn()} />);
        await screen.findByText('Лит.А — Опытная');

        await user.type(screen.getByPlaceholderText('Название группы'), '  Группа А  ');
        await user.selectOptions(screen.getByText('Выберите...').closest('select'), '1');
        await user.selectOptions(screen.getByText('По умолчанию').closest('select'), '10');
        await user.type(screen.getByPlaceholderText('Примечания'), 'срочно');
        await user.click(screen.getByText('Создать'));

        await waitFor(() => expect(plmApi.batchCreate).toHaveBeenCalledWith({
            product_ids: [1, 2],
            litera_id: 1,
            visibility_id: 10,
            group_name: 'Группа А',
            notes: 'срочно',
        }));
        expect(onCreated).toHaveBeenCalledWith({ id: 500 });
    });

    it('ошибка API (строка) показывает сообщение', async () => {
        const user = userEvent.setup();
        plmApi.batchCreate.mockResolvedValue({ ok: false, data: { success: false, error: 'Дубликат имени' } });
        render(<BatchCreateForm productIds={[1]} onCreated={vi.fn()} onCancel={vi.fn()} />);
        await screen.findByText('Лит.А — Опытная');
        await user.type(screen.getByPlaceholderText('Название группы'), 'Группа А');
        await user.selectOptions(screen.getByText('Выберите...').closest('select'), '1');
        await user.click(screen.getByText('Создать'));
        expect(await screen.findByText('Дубликат имени')).toBeInTheDocument();
    });

    it('ошибка API (объект) сериализуется в JSON-строку', async () => {
        const user = userEvent.setup();
        plmApi.batchCreate.mockResolvedValue({ ok: false, data: { success: false, error: { group_name: ['уже занято'] } } });
        render(<BatchCreateForm productIds={[1]} onCreated={vi.fn()} onCancel={vi.fn()} />);
        await screen.findByText('Лит.А — Опытная');
        await user.type(screen.getByPlaceholderText('Название группы'), 'Группа А');
        await user.selectOptions(screen.getByText('Выберите...').closest('select'), '1');
        await user.click(screen.getByText('Создать'));
        expect(await screen.findByText(JSON.stringify({ group_name: ['уже занято'] }))).toBeInTheDocument();
    });

    it('"Отмена" вызывает onCancel', async () => {
        const user = userEvent.setup();
        const onCancel = vi.fn();
        render(<BatchCreateForm productIds={[1]} onCreated={vi.fn()} onCancel={onCancel} />);
        await user.click(screen.getByText('Отмена'));
        expect(onCancel).toHaveBeenCalled();
    });
});
