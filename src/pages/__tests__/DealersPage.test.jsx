import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DealersPage from '../DealersPage';
import { dealersApi } from '../../api/dealers';
import { useAuth } from '../../contexts/AuthContext';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../api/dealers', () => ({
    dealersApi: {
        list: vi.fn(),
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
    note: '',
    ...over,
});
const asUser = (...perms) => useAuth.mockReturnValue({ user: { id: 1, permissions: perms } });
const lastParams = () => dealersApi.list.mock.calls.at(-1)[0];

beforeEach(() => {
    vi.clearAllMocks();
    dealersApi.list.mockResolvedValue(listOk([dealer()]));
});

describe('DealersPage — список', () => {
    it('без portal.dealers.write — сообщение и ни одного запроса', () => {
        asUser('portal.page.dealers');
        render(<DealersPage />);
        expect(screen.getByText(/Недостаточно прав для просмотра дилеров/)).toBeInTheDocument();
        expect(dealersApi.list).not.toHaveBeenCalled();
    });

    it('по умолчанию просит только активных и рисует строку', async () => {
        asUser('portal.dealers.write');
        render(<DealersPage />);
        expect(await screen.findByText('ООО «Тепломаш-Юг»')).toBeInTheDocument();
        expect(lastParams()).toEqual({ search: '', isActive: true, page: 1, pageSize: 50 });
        expect(screen.getByText('7701234567')).toBeInTheDocument();
        expect(screen.getByText('D00012')).toBeInTheDocument();
        expect(screen.getByText('активен')).toBeInTheDocument();
    });

    it('чекбокс переключает на неактивных: активные уходят из списка', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue(listOk([
            dealer(),
            dealer({ id: 2, inn: '5900000001', code: 'D00003', name: 'ООО «Урал-Тепло»', is_active: false }),
        ]));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');
        expect(screen.queryByText('ООО «Урал-Тепло»')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('checkbox', { name: /Только неактивные/ }));

        expect(await screen.findByText('ООО «Урал-Тепло»')).toBeInTheDocument();
        expect(screen.getByText('авторизация отменена')).toBeInTheDocument();
        // активный дилер в этом режиме не показывается
        await waitFor(() => expect(screen.queryByText('ООО «Тепломаш-Юг»')).not.toBeInTheDocument());
        expect(lastParams().isActive).toBe(false);
    });

    it('в режиме «Только неактивные» без снятых авторизаций — свой текст пустого списка', async () => {
        asUser('portal.dealers.write');
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        fireEvent.click(screen.getByRole('checkbox', { name: /Только неактивные/ }));

        expect(await screen.findByText('Неактивных дилеров нет')).toBeInTheDocument();
    });

    it('поиск фильтрует список и уходит в запрос с debounce', async () => {
        asUser('portal.dealers.write');
        dealersApi.list.mockResolvedValue(listOk([
            dealer(),
            dealer({ id: 2, inn: '5900000001', code: 'D00003', name: 'ООО «Урал-Тепло»' }),
        ]));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        fireEvent.change(screen.getByPlaceholderText(/ИНН, код, название/), { target: { value: ' D00003 ' } });

        await waitFor(() => expect(lastParams().search).toBe('D00003'));
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
        await waitFor(() => expect(lastParams().page).toBe(2));
        expect(await screen.findByText(/Стр\. 2 из 3/)).toBeInTheDocument();
    });
});

describe('DealersPage — права на запись', () => {
    it('с portal.dealers.write кнопки есть', async () => {
        asUser('portal.dealers.write');
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');
        expect(screen.getByRole('button', { name: 'Добавить дилера' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Редактировать' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Отменить авторизацию' })).toBeInTheDocument();
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
        fireEvent.click(await screen.findByRole('checkbox', { name: /Только неактивные/ }));
        expect(await screen.findByText('Отмена авторизации: тест')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Восстановить' }));
        await userEvent.click(await screen.findByRole('button', { name: 'Подтвердить' }));

        await waitFor(() => expect(dealersApi.restore).toHaveBeenCalledWith(1));
    });
});

describe('DealersPage — форма дилера', () => {
    it('создание: код не редактируется, POST уходит с полями формы', async () => {
        asUser('portal.dealers.write');
        dealersApi.create.mockResolvedValue(ok({ inn: '7709999999', code: 'D10001' }));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        await userEvent.click(screen.getByRole('button', { name: 'Добавить дилера' }));
        expect(screen.getByLabelText('Код авторизации')).toBeDisabled();

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

        await userEvent.click(screen.getByRole('button', { name: 'Добавить дилера' }));
        await userEvent.click(screen.getByRole('button', { name: 'Создать' }));

        expect(await screen.findByText('Укажите ИНН')).toBeInTheDocument();
        expect(screen.getByText('Укажите название')).toBeInTheDocument();
        expect(dealersApi.create).not.toHaveBeenCalled();
    });

    it('ИНН короче 4 цифр не проходит мягкую валидацию', async () => {
        asUser('portal.dealers.write');
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        await userEvent.click(screen.getByRole('button', { name: 'Добавить дилера' }));
        await userEvent.type(screen.getByLabelText('ИНН *'), '123');
        await userEvent.type(screen.getByLabelText('Название *'), 'ООО «Север»');
        await userEvent.click(screen.getByRole('button', { name: 'Создать' }));

        expect(await screen.findByText(/ИНН — только цифры, от 4 до 14/)).toBeInTheDocument();
        expect(dealersApi.create).not.toHaveBeenCalled();
    });

    it('редактирование: код показан, ИНН редактируемый, PATCH по id', async () => {
        asUser('portal.dealers.write');
        dealersApi.update.mockResolvedValue(ok({}));
        render(<DealersPage />);
        await screen.findByText('ООО «Тепломаш-Юг»');

        await userEvent.click(screen.getByRole('button', { name: 'Редактировать' }));
        expect(screen.getByLabelText('Код авторизации')).toHaveValue('D00012');
        expect(screen.getByLabelText('ИНН *')).not.toBeDisabled();

        await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

        await waitFor(() => expect(dealersApi.update).toHaveBeenCalledTimes(1));
        expect(dealersApi.update.mock.calls[0][0]).toBe(1);
        expect(dealersApi.update.mock.calls[0][1]).toMatchObject({
            inn: '7701234567',
            name: 'ООО «Тепломаш-Юг»',
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

        await userEvent.click(screen.getByRole('button', { name: 'Добавить дилера' }));
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

        await userEvent.click(screen.getByRole('button', { name: 'Добавить дилера' }));
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
        expect(screen.getByText('Импорт дилеров из xlsx')).toBeInTheDocument();
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
