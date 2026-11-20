import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DealersPage from '../DealersPage';
import { dealersApi } from '../../api/dealers';
import { useAuth } from '../../contexts/AuthContext';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../api/dealers', () => ({
    dealersApi: {
        list: vi.fn(),
        groups: vi.fn(),
        get: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        revoke: vi.fn(),
        restore: vi.fn(),
        importXlsx: vi.fn(),
        importStatus: vi.fn(),
    },
}));

// Портал отдаёт список массивом без конверта и без пагинации
const listOk = (rows) => ({ ok: true, status: 200, data: rows });
const ok = (data) => ({ ok: true, status: 200, data: { success: true, data } });
const dealer = (over = {}) => ({
    id: 1,
    inn: '7701234567',
    code: 'D00012',
    name: 'ООО «Тепломаш-Юг»',
    legal_address: 'г. Москва, ул. Тестовая, 1',
    phones: '+7 900 000-00-00',
    director: 'Иванов И. И.',
    website: 'teplomash-yug.ru',
    email: 'dealer@example.ru',
    letter_sent_at: '2026-02-01',
    is_active: true,
    contacts_published: false,
    is_published: true,
    note: '',
    ...over,
});
const asUser = (...perms) => useAuth.mockReturnValue({ user: { id: 1, permissions: perms } });
const lastParams = () => dealersApi.list.mock.calls.at(-1)[0];

// Подписи групп приходят с портала — фронт их не хардкодит
const GROUPS = [
    { value: 'dealer', label: 'Дилер' },
    { value: 'branch', label: 'Филиал' },
    { value: 'distributor', label: 'Дистрибьютор' },
    { value: 'service_center', label: 'Сервисный центр' },
];
const groupsOk = (list = GROUPS) => ({ ok: true, status: 200, data: { success: true, data: list } });

beforeEach(() => {
    vi.clearAllMocks();
    dealersApi.list.mockResolvedValue(listOk([dealer()]));
    dealersApi.groups.mockResolvedValue(groupsOk());
});

describe('DealersPage — список', () => {
    it('без portal.dealers.write — сообщение и ни одного запроса', () => {
        asUser('portal.page.dealers');
        render(<DealersPage />);
        expect(screen.getByText(/Недостаточно прав для просмотра партнёров/)).toBeInTheDocument();
        expect(dealersApi.list).not.toHaveBeenCalled();
        expect(dealersApi.groups).not.toHaveBeenCalled();
    });

    it('по умолчанию просит справочник целиком и рисует только активных', async () => {
        asUser('portal.dealers.write');
        render(<DealersPage />);
        expect(await screen.findByText('ООО «Тепломаш-Юг»')).toBeInTheDocument();
        // справочник запрашивается целиком: фильтр, поиск и страницы — на клиенте
        expect(lastParams()).toEqual({});
        expect(screen.getByText('7701234567')).toBeInTheDocument();
        expect(screen.getByText('D00012')).toBeInTheDocument();
        expect(screen.getByText('активен')).toBeInTheDocument();
    });

    it('сегмент «Неактивные» переключает список: активные уходят', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue(listOk([
            dealer(),
            dealer({ id: 2, inn: '5900000001', code: 'D00003', name: 'ООО «Урал-Тепло»', is_active: false }),
        ]));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');
        expect(screen.queryByText('ООО «Урал-Тепло»')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /^Неактивные/ }));

        expect(await screen.findByText('ООО «Урал-Тепло»')).toBeInTheDocument();
        expect(screen.getByText('авторизация отменена')).toBeInTheDocument();
        // активный дилер в этом режиме не показывается
        await waitFor(() => expect(screen.queryByText('ООО «Тепломаш-Юг»')).not.toBeInTheDocument());
    });

    it('сегмент «Все» показывает и активных, и неактивных', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue(listOk([
            dealer(),
            dealer({ id: 2, inn: '5900000001', code: 'D00003', name: 'ООО «Урал-Тепло»', is_active: false }),
        ]));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        fireEvent.click(screen.getByRole('button', { name: /^Все/ }));

        expect(await screen.findByText('ООО «Урал-Тепло»')).toBeInTheDocument();
        expect(screen.getByText('ООО «Тепломаш-Юг»')).toBeInTheDocument();
    });

    it('в режиме «Неактивные» без снятых авторизаций — свой текст пустого списка', async () => {
        asUser('portal.dealers.write');
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        fireEvent.click(screen.getByRole('button', { name: /^Неактивные/ }));

        expect(await screen.findByText('Неактивных партнёров нет')).toBeInTheDocument();
    });

    it('поиск фильтрует список и уходит в запрос с debounce', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue(listOk([
            dealer(),
            dealer({ id: 2, inn: '5900000001', code: 'D00003', name: 'ООО «Урал-Тепло»' }),
        ]));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        fireEvent.change(screen.getByPlaceholderText(/ИНН, код авторизации, название/), { target: { value: ' D00003 ' } });

        // поиск идёт по клиентскому списку, но дебаунс всё равно перезапрашивает справочник
        await waitFor(() => expect(dealersApi.list).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(screen.queryByText('ООО «Тепломаш-Юг»')).not.toBeInTheDocument());
        expect(screen.getByText('ООО «Урал-Тепло»')).toBeInTheDocument();
    });

    it('ошибка показывается текстом detail', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue({ ok: false, status: 403, data: { detail: 'Недостаточно прав' } });
        render(<DealersPage />);
        expect(await screen.findByText('Недостаточно прав')).toBeInTheDocument();
    });

    it('конверт {success, data} вокруг списка тоже поддерживается', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue({
            ok: true, status: 200,
            data: { success: true, data: [dealer()] },
        });
        render(<DealersPage />);
        expect(await screen.findByText('ООО «Тепломаш-Юг»')).toBeInTheDocument();
    });

    it('конверт со страницей {count, results} — серверная пагинация без клиентской нарезки', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue({
            ok: true, status: 200,
            data: { success: true, data: { count: 120, results: [dealer()] } },
        });
        render(<DealersPage />);
        expect(await screen.findByText('ООО «Тепломаш-Юг»')).toBeInTheDocument();
        expect(screen.getByText(/Стр\. 1 из 3/)).toBeInTheDocument();
    });

    it('success:false с кодом 200 — показывает ошибку, а не пустой список', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue({
            ok: true, status: 200,
            data: { success: false, error: { code: 'denied', message: 'Нет доступа к справочнику' } },
        });
        render(<DealersPage />);
        expect(await screen.findByText('Нет доступа к справочнику')).toBeInTheDocument();
    });

    it('пагинация на клиенте, пока бэкенд не режет страницы', async () => {
        asUser('portal.dealers.write');
        const rows = Array.from({ length: 120 }, (_, i) => dealer({ id: i + 1, inn: `77010000${i}` }));
        dealersApi.list.mockResolvedValue(listOk(rows));
        render(<DealersPage />);
        expect(await screen.findByText(/Стр\. 1 из 3/)).toBeInTheDocument();
        expect(screen.getByText(/всего 120/)).toBeInTheDocument();
        expect(screen.getAllByRole('row').length).toBe(51); // шапка + 50 строк

        fireEvent.click(screen.getByRole('button', { name: '→' }));
        expect(await screen.findByText(/Стр\. 2 из 3/)).toBeInTheDocument();
    });
});

describe('DealersPage — панель со счётчиками', () => {
    it('показывает всего / активных / неактивных по всему справочнику', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue(listOk([
            dealer(),
            dealer({ id: 2, inn: '5900000001', code: 'D00003', name: 'ООО «Урал-Тепло»', is_active: false }),
            dealer({ id: 3, inn: '5900000002', code: 'D00004', name: 'ООО «Север-Тепло»' }),
        ]));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        expect(screen.getByRole('button', { name: 'Все 3' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Активные 2' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Неактивные 1' })).toBeInTheDocument();
        // по умолчанию выбран сегмент «Активные»
        expect(screen.getByRole('button', { name: 'Активные 2' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('счётчики не зависят от поиска: ищем одного, цифры остаются по всему справочнику', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue(listOk([
            dealer(),
            dealer({ id: 2, inn: '5900000001', code: 'D00003', name: 'ООО «Урал-Тепло»' }),
        ]));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        fireEvent.change(screen.getByPlaceholderText(/ИНН, код авторизации, название/), { target: { value: 'D00003' } });
        await waitFor(() => expect(screen.queryByText('ООО «Тепломаш-Юг»')).not.toBeInTheDocument());

        expect(screen.getByRole('button', { name: 'Все 2' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Активные 2' })).toBeInTheDocument();
    });
});

describe('DealersPage — группа контрагента', () => {
    const rowOf = async (name) => (await screen.findByText(name)).closest('tr');

    it('в строке бейдж с подписью из group_label', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue(listOk([
            dealer({ group: 'branch', group_label: 'Филиал' }),
            dealer({ id: 2, inn: '5900000001', name: 'ООО «Урал-Тепло»', group: 'distributor', group_label: 'Дистрибьютор' }),
        ]));
        render(<DealersPage />);

        expect(within(await rowOf('ООО «Тепломаш-Юг»')).getByText('Филиал')).toBeInTheDocument();
        expect(within(await rowOf('ООО «Урал-Тепло»')).getByText('Дистрибьютор')).toBeInTheDocument();
    });

    it('фильтр по группе берёт варианты из /groups/ и сужает список', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue(listOk([
            dealer({ group: 'dealer', group_label: 'Дилер' }),
            dealer({ id: 2, inn: '5900000001', name: 'ООО «Урал-Тепло»', group: 'branch', group_label: 'Филиал' }),
        ]));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        const select = screen.getByLabelText('Фильтр по группе');
        await waitFor(() => expect(select).toContainElement(
            screen.getByRole('option', { name: 'Сервисный центр' }),
        ));
        expect(screen.getByRole('option', { name: 'Все группы' })).toBeInTheDocument();

        await userEvent.selectOptions(select, 'branch');

        expect(await screen.findByText('ООО «Урал-Тепло»')).toBeInTheDocument();
        expect(screen.queryByText('ООО «Тепломаш-Юг»')).not.toBeInTheDocument();

        await userEvent.selectOptions(select, '');

        expect(await screen.findByText('ООО «Тепломаш-Юг»')).toBeInTheDocument();
        expect(screen.getByText('ООО «Урал-Тепло»')).toBeInTheDocument();
    });

    it('создание: группа по умолчанию «Дилер», выбранная уходит в POST', async () => {
        asUser('portal.dealers.write');
        dealersApi.create.mockResolvedValue(ok({ inn: '7709999999', code: 'D10001' }));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        await userEvent.click(screen.getByRole('button', { name: 'Добавить партнёра' }));
        const group = screen.getByLabelText('Группа');
        expect(group).toHaveValue('dealer');

        await userEvent.type(screen.getByLabelText('ИНН *'), '7709999999');
        await userEvent.type(screen.getByLabelText('Название *'), 'ООО «Север»');
        await userEvent.selectOptions(group, 'distributor');
        await userEvent.click(screen.getByRole('button', { name: 'Создать' }));

        await waitFor(() => expect(dealersApi.create).toHaveBeenCalledTimes(1));
        expect(dealersApi.create.mock.calls[0][0]).toMatchObject({ group: 'distributor' });
    });

    it('редактирование: в селекте текущая группа, PATCH её сохраняет', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue(listOk([dealer({ group: 'service_center', group_label: 'Сервисный центр' })]));
        dealersApi.update.mockResolvedValue(ok({}));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        await userEvent.click(screen.getByRole('button', { name: 'Редактировать' }));
        const group = await screen.findByLabelText('Группа');
        await waitFor(() => expect(group).toHaveValue('service_center'));

        await userEvent.selectOptions(group, 'branch');
        await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

        await waitFor(() => expect(dealersApi.update).toHaveBeenCalledTimes(1));
        expect(dealersApi.update.mock.calls[0][1]).toMatchObject({ group: 'branch' });
    });
});

describe('DealersPage — сортировка по свежести', () => {
    const names = () => screen.getAllByRole('row').slice(1).map(row => row.textContent);

    it('по умолчанию свежие сверху, дилеры без даты — в конце', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue(listOk([
            dealer({ id: 1, inn: '7701000001', name: 'СТАРЫЙ', letter_sent_at: '2024-01-10' }),
            dealer({ id: 2, inn: '7701000002', name: 'БЕЗ-ДАТЫ', letter_sent_at: null }),
            dealer({ id: 3, inn: '7701000003', name: 'СВЕЖИЙ', letter_sent_at: '2026-05-20' }),
            dealer({ id: 4, inn: '7701000004', name: 'СРЕДНИЙ', letter_sent_at: '2025-09-01' }),
        ]));
        render(<DealersPage />);
        await screen.findByText('СВЕЖИЙ');

        const order = names().map(text => ['СВЕЖИЙ', 'СРЕДНИЙ', 'СТАРЫЙ', 'БЕЗ-ДАТЫ'].find(n => text.includes(n)));
        expect(order).toEqual(['СВЕЖИЙ', 'СРЕДНИЙ', 'СТАРЫЙ', 'БЕЗ-ДАТЫ']);
    });

    it('дата записи (created_at/updated_at) важнее даты письма', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue(listOk([
            dealer({ id: 1, inn: '7701000001', name: 'ПО-ПИСЬМУ', letter_sent_at: '2026-05-20', created_at: '2024-01-01' }),
            dealer({ id: 2, inn: '7701000002', name: 'ПО-ЗАПИСИ', letter_sent_at: '2024-01-01', created_at: '2026-05-20' }),
        ]));
        render(<DealersPage />);
        await screen.findByText('ПО-ЗАПИСИ');

        const order = names().map(text => ['ПО-ЗАПИСИ', 'ПО-ПИСЬМУ'].find(n => text.includes(n)));
        expect(order).toEqual(['ПО-ЗАПИСИ', 'ПО-ПИСЬМУ']);
    });
});

describe('DealersPage — права на запись', () => {
    it('с portal.dealers.write кнопки есть', async () => {
        asUser('portal.dealers.write');
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');
        expect(screen.getByRole('button', { name: 'Добавить партнёра' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Редактировать' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Отменить авторизацию' })).toBeInTheDocument();
    });
});

describe('DealersPage — адаптивная строка', () => {
    it('в строке видны все поля дилера, включая юр. адрес и сайт', async () => {
        asUser('portal.dealers.write');
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        expect(screen.getByText('7701234567')).toBeInTheDocument();
        expect(screen.getByText('D00012')).toBeInTheDocument();
        expect(screen.getByText('г. Москва, ул. Тестовая, 1')).toBeInTheDocument();
        expect(screen.getByText('Иванов И. И.')).toBeInTheDocument();
        expect(screen.getByText('+7 900 000-00-00')).toBeInTheDocument();
        expect(screen.getByText('dealer@example.ru')).toBeInTheDocument();
        expect(screen.getByText('teplomash-yug.ru')).toBeInTheDocument();
    });

    it('действия — только иконки, название остаётся в title и aria-label', async () => {
        asUser('portal.dealers.write');
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        const edit = screen.getByRole('button', { name: 'Редактировать' });
        const revoke = screen.getByRole('button', { name: 'Отменить авторизацию' });
        // текстовых подписей в кнопках нет — колонка не занимает место
        expect(edit.textContent).toBe('');
        expect(revoke.textContent).toBe('');
        expect(edit.querySelector('svg')).not.toBeNull();
        expect(revoke.querySelector('svg')).not.toBeNull();
        expect(edit).toHaveAttribute('title', 'Редактировать');
        expect(revoke).toHaveAttribute('title', 'Отменить авторизацию');
    });

    it('неактивный дилер: иконка восстановления вместо отмены', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue(listOk([dealer({ is_active: false })]));
        render(<DealersPage />);
        fireEvent.click(await screen.findByRole('button', { name: /^Неактивные/ }));

        const restore = await screen.findByRole('button', { name: 'Восстановить' });
        expect(restore.textContent).toBe('');
        expect(screen.queryByRole('button', { name: 'Отменить авторизацию' })).not.toBeInTheDocument();
    });
});

describe('DealersPage — публикация записи на сайте', () => {
    const box = (name = 'ООО «Тепломаш-Юг»') => screen.getByRole('checkbox', {
        name: `Показывать на сайте: ${name}`,
    });

    it('галочка повторяет is_published, а не contacts_published', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue(listOk([
            // запись опубликована, контакты скрыты
            dealer({ is_published: true, contacts_published: false }),
            dealer({
                id: 2, inn: '5900000001', code: 'D00003', name: 'ООО «Урал-Тепло»',
                is_published: false, contacts_published: true,
            }),
        ]));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        expect(box()).toBeChecked();
        expect(box('ООО «Урал-Тепло»')).not.toBeChecked();
    });

    it('клик ставит галочку сразу и шлёт PATCH по одному полю, список не перезагружается', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue(listOk([dealer({ is_published: false })]));
        dealersApi.update.mockResolvedValue(ok({}));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');
        expect(dealersApi.list).toHaveBeenCalledTimes(1);

        fireEvent.click(box());

        expect(box()).toBeChecked();
        await waitFor(() => expect(dealersApi.update).toHaveBeenCalledWith(1, { is_published: true }));
        expect(dealersApi.list).toHaveBeenCalledTimes(1);
    });

    it('снятие галочки — PATCH с false', async () => {
        asUser('portal.dealers.write');
        dealersApi.update.mockResolvedValue(ok({}));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        fireEvent.click(box());

        expect(box()).not.toBeChecked();
        await waitFor(() => expect(dealersApi.update).toHaveBeenCalledWith(1, { is_published: false }));
    });

    it('ошибка портала — галочка откатывается, показывается текст ошибки', async () => {
        asUser('portal.dealers.write');
        dealersApi.update.mockResolvedValue({
            ok: false, status: 400, data: { detail: 'Нет такого дилера' },
        });
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        fireEvent.click(box());

        expect(await screen.findByText('Нет такого дилера')).toBeInTheDocument();
        expect(box()).toBeChecked();
    });

    it('портал не отдаёт is_published — галочка недоступна, PATCH не шлётся', async () => {
        asUser('portal.dealers.write');
        const legacyDealer = { ...dealer() };
        delete legacyDealer.is_published; // старый портал поле не отдаёт
        dealersApi.list.mockResolvedValue(listOk([legacyDealer]));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        expect(box()).toBeDisabled();
        fireEvent.click(box());
        expect(dealersApi.update).not.toHaveBeenCalled();
    });

    it('у неактивного дилера обе галочки недоступны: сайт получает только активных', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue(listOk([dealer({ is_active: false })]));
        render(<DealersPage />);
        fireEvent.click(await screen.findByRole('button', { name: /^Неактивные/ }));

        expect(await screen.findByRole('checkbox', { name: /^Показывать на сайте:/ })).toBeDisabled();
        expect(screen.getByRole('checkbox', { name: /^Публиковать контакты:/ })).toBeDisabled();
        expect(dealersApi.update).not.toHaveBeenCalled();
    });

    it('вторая галочка — контакты: своё состояние и свой PATCH', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue(listOk([
            dealer({ is_published: true, contacts_published: false }),
        ]));
        dealersApi.update.mockResolvedValue(ok({}));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        const contacts = screen.getByRole('checkbox', { name: 'Публиковать контакты: ООО «Тепломаш-Юг»' });
        expect(contacts).not.toBeChecked();
        expect(box()).toBeChecked();

        fireEvent.click(contacts);

        expect(contacts).toBeChecked();
        await waitFor(() => expect(dealersApi.update).toHaveBeenCalledWith(1, { contacts_published: true }));
        // публикацию записи не трогали
        expect(dealersApi.update).toHaveBeenCalledTimes(1);
    });

    it('галочки независимы: снятие публикации записи не снимает контакты', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue(listOk([dealer({ is_published: true, contacts_published: true })]));
        dealersApi.update.mockResolvedValue(ok({}));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        fireEvent.click(box());

        await waitFor(() => expect(dealersApi.update).toHaveBeenCalledWith(1, { is_published: false }));
        expect(screen.getByRole('checkbox', { name: 'Публиковать контакты: ООО «Тепломаш-Юг»' })).toBeChecked();
    });
});

describe('DealersPage — галочки в шапке (для всей выборки)', () => {
    const headerBox = (name) => screen.getByRole('checkbox', { name });

    it('шапка отражает выборку: все включены → checked, разнобой → indeterminate', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue(listOk([
            dealer({ id: 1, name: 'А' }),
            dealer({ id: 2, inn: '5900000001', code: 'D00003', name: 'Б' }),
        ]));
        render(<DealersPage />);
        await screen.findByText('А');

        const on = headerBox('Поставить «Показывать на сайте» всей выборке');
        expect(on).toBeChecked();
        expect(on.indeterminate).toBe(false);
    });

    it('разнобой по контактам — indeterminate', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue(listOk([
            dealer({ id: 1, name: 'А', contacts_published: true }),
            dealer({ id: 2, inn: '5900000001', code: 'D00003', name: 'Б', contacts_published: false }),
        ]));
        render(<DealersPage />);
        await screen.findByText('А');

        const mixed = headerBox('Поставить «Публиковать контакты» всей выборке');
        expect(mixed).not.toBeChecked();
        expect(mixed.indeterminate).toBe(true);
    });

    it('снятие в шапке: подтверждение → PATCH по каждой записи выборки → список перечитан', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue(listOk([
            dealer({ id: 1, name: 'А' }),
            dealer({ id: 2, inn: '5900000001', code: 'D00003', name: 'Б' }),
        ]));
        dealersApi.update.mockResolvedValue(ok({}));
        render(<DealersPage />);
        await screen.findByText('А');
        expect(dealersApi.list).toHaveBeenCalledTimes(1);

        fireEvent.click(headerBox('Поставить «Показывать на сайте» всей выборке'));

        // массовое действие спрашивает подтверждение и говорит про выборку
        expect(await screen.findByText(/Записи исчезнут с сайта/)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));

        await waitFor(() => expect(dealersApi.update).toHaveBeenCalledTimes(2));
        expect(dealersApi.update).toHaveBeenCalledWith(1, { is_published: false });
        expect(dealersApi.update).toHaveBeenCalledWith(2, { is_published: false });
        await waitFor(() => expect(dealersApi.list).toHaveBeenCalledTimes(2));
    });

    it('«Отмена» в подтверждении ничего не шлёт', async () => {
        asUser('portal.dealers.write');
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        fireEvent.click(headerBox('Поставить «Публиковать контакты» всей выборке'));
        await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));

        expect(dealersApi.update).not.toHaveBeenCalled();
    });
});

describe('DealersPage — отмена и восстановление авторизации', () => {
    it('отмена: подтверждение → revoke по id → перезагрузка списка', async () => {
        asUser('portal.dealers.write');
        dealersApi.revoke.mockResolvedValue(ok({}));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');
        expect(dealersApi.list).toHaveBeenCalledTimes(1);

        await userEvent.click(screen.getByRole('button', { name: 'Отменить авторизацию' }));
        expect(await screen.findByText(/перестанет подтверждаться на сайте/)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));

        await waitFor(() => expect(dealersApi.revoke).toHaveBeenCalledWith(1));
        await waitFor(() => expect(dealersApi.list).toHaveBeenCalledTimes(2));
    });

    it('«Отмена» в подтверждении ничего не шлёт', async () => {
        asUser('portal.dealers.write');
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        await userEvent.click(screen.getByRole('button', { name: 'Отменить авторизацию' }));
        await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));

        expect(dealersApi.revoke).not.toHaveBeenCalled();
    });

    it('ошибка отмены показывается, список не перезагружается', async () => {
        asUser('portal.dealers.write');
        dealersApi.revoke.mockResolvedValue({
            ok: false, status: 400,
            data: { detail: 'Дилер уже неактивен' },
        });
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        await userEvent.click(screen.getByRole('button', { name: 'Отменить авторизацию' }));
        await userEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));

        expect(await screen.findByText('Дилер уже неактивен')).toBeInTheDocument();
        expect(dealersApi.list).toHaveBeenCalledTimes(1);
    });

    it('неактивный: кнопка «Восстановить» → restore по id', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue(listOk([dealer({ is_active: false, note: 'Отмена авторизации: тест' })]));
        dealersApi.restore.mockResolvedValue(ok({}));
        render(<DealersPage />);
        fireEvent.click(await screen.findByRole('button', { name: /^Неактивные/ }));
        expect(await screen.findByText('Отмена авторизации: тест')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Восстановить' }));
        await userEvent.click(await screen.findByRole('button', { name: 'Подтвердить' }));

        await waitFor(() => expect(dealersApi.restore).toHaveBeenCalledWith(1));
    });
});

describe('DealersPage — форма дилера', () => {
    it('создание: кода авторизации в форме нет, POST уходит с полями формы', async () => {
        asUser('portal.dealers.write');
        dealersApi.create.mockResolvedValue(ok({ inn: '7709999999', code: 'D10001' }));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        await userEvent.click(screen.getByRole('button', { name: 'Добавить партнёра' }));
        expect(screen.queryByLabelText('Код авторизации')).not.toBeInTheDocument();

        await userEvent.type(screen.getByLabelText('ИНН *'), '7709999999');
        await userEvent.type(screen.getByLabelText('Название *'), 'ООО «Север»');
        await userEvent.click(screen.getByRole('button', { name: 'Создать' }));

        await waitFor(() => expect(dealersApi.create).toHaveBeenCalledTimes(1));
        expect(dealersApi.create.mock.calls[0][0]).toMatchObject({
            inn: '7709999999',
            name: 'ООО «Север»',
            letter_sent_at: null,
        });
        await waitFor(() => expect(dealersApi.list).toHaveBeenCalledTimes(2));
        expect(screen.queryByLabelText('ИНН *')).not.toBeInTheDocument();
    });

    it('пустой ИНН и название — ошибки полей, запроса нет', async () => {
        asUser('portal.dealers.write');
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        await userEvent.click(screen.getByRole('button', { name: 'Добавить партнёра' }));
        await userEvent.click(screen.getByRole('button', { name: 'Создать' }));

        expect(await screen.findByText('Укажите ИНН')).toBeInTheDocument();
        expect(screen.getByText('Укажите название')).toBeInTheDocument();
        expect(dealersApi.create).not.toHaveBeenCalled();
    });

    it('ИНН короче 4 цифр не проходит мягкую валидацию', async () => {
        asUser('portal.dealers.write');
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        await userEvent.click(screen.getByRole('button', { name: 'Добавить партнёра' }));
        await userEvent.type(screen.getByLabelText('ИНН *'), '123');
        await userEvent.type(screen.getByLabelText('Название *'), 'ООО «Север»');
        await userEvent.click(screen.getByRole('button', { name: 'Создать' }));

        expect(await screen.findByText(/ИНН — только цифры, от 4 до 14/)).toBeInTheDocument();
        expect(dealersApi.create).not.toHaveBeenCalled();
    });

    it('редактирование: кода в форме нет, ИНН редактируемый, PATCH по id', async () => {
        asUser('portal.dealers.write');
        dealersApi.update.mockResolvedValue(ok({}));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        await userEvent.click(screen.getByRole('button', { name: 'Редактировать' }));
        expect(screen.queryByLabelText('Код авторизации')).not.toBeInTheDocument();
        expect(screen.getByLabelText('ИНН *')).not.toBeDisabled();

        await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

        await waitFor(() => expect(dealersApi.update).toHaveBeenCalledTimes(1));
        expect(dealersApi.update.mock.calls[0][0]).toBe(1);
        expect(dealersApi.update.mock.calls[0][1]).toMatchObject({
            inn: '7701234567',
            name: 'ООО «Тепломаш-Юг»',
        });
    });

    it('в форме два флага публикации, оба уходят в PATCH', async () => {
        asUser('portal.dealers.write');
        dealersApi.update.mockResolvedValue(ok({}));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        await userEvent.click(screen.getByRole('button', { name: 'Редактировать' }));
        const contacts = screen.getByRole('checkbox', { name: 'Публиковать контакты' });
        const record = screen.getByRole('checkbox', { name: 'Показывать на сайте' });
        // запись опубликована (как и была), контакты — нет
        expect(record).toBeChecked();
        expect(contacts).not.toBeChecked();

        await userEvent.click(contacts);
        await userEvent.click(record);
        await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

        await waitFor(() => expect(dealersApi.update).toHaveBeenCalledTimes(1));
        expect(dealersApi.update.mock.calls[0][1]).toMatchObject({
            contacts_published: true,
            is_published: false,
        });
    });

    it('ошибки полей DRF раскладываются под поля', async () => {
        asUser('portal.dealers.write');
        dealersApi.create.mockResolvedValue({
            ok: false, status: 400,
            data: { inn: ['Дилер с таким ИНН уже существует.'] },
        });
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        await userEvent.click(screen.getByRole('button', { name: 'Добавить партнёра' }));
        await userEvent.type(screen.getByLabelText('ИНН *'), '7701111111');
        await userEvent.type(screen.getByLabelText('Название *'), 'ООО «Дубль»');
        await userEvent.click(screen.getByRole('button', { name: 'Создать' }));

        expect(await screen.findByText('Дилер с таким ИНН уже существует.')).toBeInTheDocument();
    });

    it('ошибка конверта без fields показывается общим текстом', async () => {
        asUser('portal.dealers.write');
        dealersApi.create.mockResolvedValue({
            ok: false, status: 500,
            data: { success: false, error: { code: 'server_error', message: 'Внутренняя ошибка' } },
        });
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        await userEvent.click(screen.getByRole('button', { name: 'Добавить партнёра' }));
        await userEvent.type(screen.getByLabelText('ИНН *'), '7701111111');
        await userEvent.type(screen.getByLabelText('Название *'), 'ООО «Дубль»');
        await userEvent.click(screen.getByRole('button', { name: 'Создать' }));

        expect(await screen.findByText('Внутренняя ошибка')).toBeInTheDocument();
    });
});

describe('DealersPage — импорт из xlsx', () => {
    const openImport = async () => {
        await userEvent.click(await screen.findByRole('button', { name: 'Импорт из xlsx' }));
        const input = document.querySelector('input[type="file"]');
        await userEvent.upload(input, new File(['xlsx'], 'dealers.xlsx'));
        await userEvent.click(screen.getByRole('button', { name: 'Импортировать' }));
    };

    const started = () => ({
        ok: true, status: 201,
        data: { success: true, data: { task_id: 12 } },
    });
    const finished = (over = {}) => ({
        ok: true, status: 200,
        data: {
            success: true,
            data: {
                task_id: 12,
                status: 'COMPLETED',
                rows_total: 418,
                created: 5,
                updated: 396,
                revoked: 17,
                errors: [],
                result: { errors_count: 0 },
                ...over,
            },
        },
    });

    it('без права записи кнопки импорта нет', async () => {
        asUser('portal.page.dealers');
        render(<DealersPage />);
        expect(screen.queryByRole('button', { name: 'Импорт из xlsx' })).not.toBeInTheDocument();
    });

    it('файл уходит на портал, статус опрашивается, итог показывается, список перезагружается', async () => {
        asUser('portal.dealers.write');
        dealersApi.importXlsx.mockResolvedValue(started());
        dealersApi.importStatus.mockResolvedValue(finished());
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        const file = new File(['xlsx'], 'dealers.xlsx');
        await userEvent.click(screen.getByRole('button', { name: 'Импорт из xlsx' }));
        expect(screen.getByText('Импорт партнёров из xlsx')).toBeInTheDocument();
        await userEvent.upload(document.querySelector('input[type="file"]'), file);
        await userEvent.click(screen.getByRole('button', { name: 'Импортировать' }));

        expect(dealersApi.importXlsx).toHaveBeenCalledWith(file);
        expect(await screen.findByText('Строк в файле')).toBeInTheDocument();
        expect(dealersApi.importStatus).toHaveBeenCalledWith(12);
        expect(screen.getByText('418')).toBeInTheDocument();
        expect(screen.getByText('396')).toBeInTheDocument();
        expect(screen.getByText('17')).toBeInTheDocument();
        expect(screen.getByText(/Все строки применены без ошибок/)).toBeInTheDocument();
        // импорт закончился — список перезапрошен (первый вызов был при монтировании)
        await waitFor(() => expect(dealersApi.list).toHaveBeenCalledTimes(2));
    });

    it('битые строки показываются таблицей, импорт при этом успешен', async () => {
        asUser('portal.dealers.write');
        dealersApi.importXlsx.mockResolvedValue(started());
        dealersApi.importStatus.mockResolvedValue(finished({
            rows_total: 3, created: 0, updated: 1, revoked: 0,
            errors: [{ row: 7, inn: '9999999999', error: 'Не удалось восстановить код дилера' }],
            result: { errors_count: 1 },
        }));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');
        await openImport();

        expect(await screen.findByText('Строки с ошибками (1) — остальные применены')).toBeInTheDocument();
        expect(screen.getByText('Не удалось восстановить код дилера')).toBeInTheDocument();
        expect(screen.getByText('9999999999')).toBeInTheDocument();
    });

    it('FAILED показывает причину из result.error', async () => {
        asUser('portal.dealers.write');
        dealersApi.importXlsx.mockResolvedValue(started());
        dealersApi.importStatus.mockResolvedValue(finished({
            status: 'FAILED', result: { error: 'Нет листа «Лист1»' },
        }));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');
        await openImport();

        expect(await screen.findByText('Нет листа «Лист1»')).toBeInTheDocument();
    });

    it('ошибка загрузки файла показывается текстом конверта и не запускает опрос', async () => {
        asUser('portal.dealers.write');
        dealersApi.importXlsx.mockResolvedValue({
            ok: false, status: 400,
            data: { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ожидался файл .xlsx' } },
        });
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');
        await openImport();

        expect(await screen.findByText('Ожидался файл .xlsx')).toBeInTheDocument();
        expect(dealersApi.importStatus).not.toHaveBeenCalled();
    });
});
