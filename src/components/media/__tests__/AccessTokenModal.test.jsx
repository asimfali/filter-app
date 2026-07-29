import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccessTokenModal from '../AccessTokenModal';
import { mediaApi } from '../../../api/media';
import { apiFetch, authApi } from '../../../api/auth';

vi.mock('../../../api/media', () => ({
    mediaApi: {
        getAccessTokens: vi.fn(),
        createAccessToken: vi.fn(),
        revokeAccessToken: vi.fn(),
    },
}));
vi.mock('../../../api/auth', () => ({ apiFetch: vi.fn(), authApi: { departments: vi.fn() } }));

const ok = (data) => ({ ok: true, data: { success: true, ...data } });
const jsonRes = (body) => ({ json: () => Promise.resolve(body) });

const product = { id: 1, name: 'ВО-3.5' };
const docType = { id: 2, name: 'Паспорт' };

const token1 = {
    id: 10, granted_to_user: 'Иванов И.И.', access_type: 'read',
    expires_at: '2026-08-01T10:00:00Z', comment: 'для проверки',
};

beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockImplementation((url) => {
        if (url.includes('users-list')) return Promise.resolve(jsonRes({ results: [{ id: 1, full_name: 'Петров П.П.' }] }));
        return Promise.resolve(jsonRes({}));
    });
    authApi.departments.mockResolvedValue({ ok: true, data: [{ id: 5, name: 'ОТК' }] });
});

describe('AccessTokenModal — загрузка', () => {
    it('грузит токены + пользователей/отделы при маунте', async () => {
        mediaApi.getAccessTokens.mockResolvedValue(ok({ tokens: [token1] }));
        render(<AccessTokenModal product={product} docType={docType} onClose={vi.fn()} />);
        expect(await screen.findByText('Иванов И.И.')).toBeInTheDocument();
        expect(mediaApi.getAccessTokens).toHaveBeenCalledWith(1, 2);
        expect(screen.getByText('чтение')).toBeInTheDocument();
    });

    it('пустой список — "Активных токенов нет"', async () => {
        mediaApi.getAccessTokens.mockResolvedValue(ok({ tokens: [] }));
        render(<AccessTokenModal product={product} docType={docType} onClose={vi.fn()} />);
        expect(await screen.findByText('Активных токенов нет')).toBeInTheDocument();
    });

    it('тип доступа write рендерится отдельно, дата и комментарий показаны', async () => {
        mediaApi.getAccessTokens.mockResolvedValue(ok({ tokens: [{ ...token1, access_type: 'write' }] }));
        render(<AccessTokenModal product={product} docType={docType} onClose={vi.fn()} />);
        await screen.findByText('Иванов И.И.');
        expect(screen.getByText('запись')).toBeInTheDocument();
        expect(screen.getByText(/для проверки/)).toBeInTheDocument();
    });
});

describe('AccessTokenModal — регрессия на исправленный краш формы (inputCls)', () => {
    it('открытие "+ Выдать доступ" рендерит форму без ReferenceError', async () => {
        const user = userEvent.setup();
        mediaApi.getAccessTokens.mockResolvedValue(ok({ tokens: [] }));
        render(<AccessTokenModal product={product} docType={docType} onClose={vi.fn()} />);
        await screen.findByText('Активных токенов нет');

        await user.click(screen.getByText('+ Выдать доступ'));
        expect(screen.getByText('Новый токен')).toBeInTheDocument();
        expect(await screen.findByText('Петров П.П.')).toBeInTheDocument();
        expect(await screen.findByText('ОТК')).toBeInTheDocument();
    });
});

describe('AccessTokenModal — создание токена', () => {
    async function openForm(user) {
        mediaApi.getAccessTokens.mockResolvedValue(ok({ tokens: [] }));
        render(<AccessTokenModal product={product} docType={docType} onClose={vi.fn()} />);
        await screen.findByText('Активных токенов нет');
        await user.click(screen.getByText('+ Выдать доступ'));
        await screen.findByText('Петров П.П.');
    }

    it('без получателя (ни пользователь, ни отдел) — alert, без вызова API', async () => {
        const user = userEvent.setup();
        vi.spyOn(window, 'alert').mockImplementation(() => {});
        await openForm(user);
        await user.click(screen.getByText('Выдать доступ'));
        expect(window.alert).toHaveBeenCalledWith('Укажите получателя — пользователя или подразделение');
        expect(mediaApi.createAccessToken).not.toHaveBeenCalled();
        vi.restoreAllMocks();
    });

    it('успешное создание с пользователем добавляет токен в список и закрывает форму', async () => {
        const user = userEvent.setup();
        mediaApi.createAccessToken.mockResolvedValue(ok({ token: { ...token1, id: 20, granted_to_user: 'Петров П.П.' } }));
        await openForm(user);

        const selects = document.querySelectorAll('select');
        // селекты: срок действия, пользователь, подразделение (в этом порядке)
        await user.selectOptions(selects[1], '1');
        await user.click(screen.getByText('Выдать доступ'));

        await waitFor(() => expect(mediaApi.createAccessToken).toHaveBeenCalledWith(expect.objectContaining({
            product_id: 1, doc_type_id: 2, access_type: 'read', granted_to_user_id: '1', granted_to_department_id: null,
        })));
        expect(await screen.findAllByText('Петров П.П.')).not.toHaveLength(0);
        expect(screen.queryByText('Новый токен')).not.toBeInTheDocument();
    });

    it('переключение типа доступа на "запись" передаётся в payload', async () => {
        const user = userEvent.setup();
        mediaApi.createAccessToken.mockResolvedValue(ok({ token: { ...token1, id: 21 } }));
        await openForm(user);
        await user.click(screen.getByText('✎ Запись'));
        const selects = document.querySelectorAll('select');
        await user.selectOptions(selects[1], '1');
        await user.click(screen.getByText('Выдать доступ'));
        await waitFor(() => expect(mediaApi.createAccessToken).toHaveBeenCalledWith(expect.objectContaining({ access_type: 'write' })));
    });

    it('выбор подразделения сбрасывает выбор пользователя (взаимоисключение)', async () => {
        const user = userEvent.setup();
        mediaApi.createAccessToken.mockResolvedValue(ok({ token: { ...token1, id: 22 } }));
        await openForm(user);
        const selects = document.querySelectorAll('select');
        await user.selectOptions(selects[1], '1'); // пользователь
        await user.selectOptions(selects[2], '5'); // подразделение
        await user.click(screen.getByText('Выдать доступ'));
        await waitFor(() => expect(mediaApi.createAccessToken).toHaveBeenCalledWith(expect.objectContaining({
            granted_to_user_id: null, granted_to_department_id: '5',
        })));
    });

    it('"Отмена" закрывает форму без создания', async () => {
        const user = userEvent.setup();
        await openForm(user);
        await user.click(screen.getByText('Отмена'));
        expect(screen.queryByText('Новый токен')).not.toBeInTheDocument();
        expect(mediaApi.createAccessToken).not.toHaveBeenCalled();
    });
});

describe('AccessTokenModal — отзыв токена', () => {
    it('"Отозвать" вызывает revokeAccessToken и убирает токен из списка', async () => {
        const user = userEvent.setup();
        mediaApi.getAccessTokens.mockResolvedValue(ok({ tokens: [token1] }));
        mediaApi.revokeAccessToken.mockResolvedValue({ ok: true });
        render(<AccessTokenModal product={product} docType={docType} onClose={vi.fn()} />);
        await screen.findByText('Иванов И.И.');
        await user.click(screen.getByText('Отозвать'));
        await waitFor(() => expect(mediaApi.revokeAccessToken).toHaveBeenCalledWith(10));
        expect(screen.queryByText('Иванов И.И.')).not.toBeInTheDocument();
    });
});

describe('AccessTokenModal — закрытие', () => {
    it('✕ вызывает onClose', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        mediaApi.getAccessTokens.mockResolvedValue(ok({ tokens: [] }));
        render(<AccessTokenModal product={product} docType={docType} onClose={onClose} />);
        await screen.findByText('Активных токенов нет');
        await user.click(screen.getByText('✕'));
        expect(onClose).toHaveBeenCalled();
    });
});
