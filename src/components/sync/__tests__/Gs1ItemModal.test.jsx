import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Gs1ItemModal from '../Gs1ItemModal';
import { externalApi } from '../../../api/external';

vi.mock('../../../api/external', () => ({
    externalApi: { getGs1Item: vi.fn(), resolveGs1Item: vi.fn() },
}));
vi.mock('../../common/SmartSelect', () => ({
    default: ({ onSelect, value }) => (
        <div>
            {value && <span>chosen:{value.name}</span>}
            <button onClick={() => onSelect({ id: 77, name: 'Ручной товар' })}>pick-product</button>
        </div>
    ),
}));

const NEW_GTIN = '4600000000002';
const OLD_GTIN = '4600000000001';
const item = (over = {}) => ({
    id: 1, gtin: NEW_GTIN, prod_desc: 'Завеса', prod_desc_full: 'Завеса полное', prod_regdate: '2026-03-05T10:00:00Z',
    is_active_in_gs1: true, status: 'conflict', reason: 'ambiguous', product: null, product_name: null,
    candidates: [{ id: 10, name: 'Завеса А', sku: 'A-1', is_active: true, gtin: '' }],
    raw: { 1: 'x' }, ...over,
});
const ok = (data) => ({ ok: true, status: 200, data: { success: true, data } });
const conflict409 = (code, extra = {}) => ({ ok: false, status: 409, data: { success: false, error: { code, message: 'm', ...extra } } });

beforeEach(() => {
    vi.clearAllMocks();
});

describe('Gs1ItemModal', () => {
    it('«Назначить» кандидата вызывает resolve assign и сообщает об изменении', async () => {
        const onChanged = vi.fn();
        externalApi.getGs1Item.mockResolvedValue(ok(item()));
        externalApi.resolveGs1Item.mockResolvedValue(ok(item({ status: 'matched', reason: '', product: 10, candidates: [] })));
        const user = userEvent.setup();
        render(<Gs1ItemModal itemId={1} onClose={vi.fn()} onChanged={onChanged} />);

        await user.click((await screen.findAllByRole('button', { name: 'Назначить' }))[0]); // кнопка кандидата

        await waitFor(() => expect(externalApi.resolveGs1Item).toHaveBeenCalledWith(1, 'assign', 10));
        expect(onChanged).toHaveBeenCalled();
        expect(await screen.findByText('Сопоставлена')).toBeInTheDocument();
    });

    it('у кандидата другой GTIN: замена только после подтверждения, видны старый и новый', async () => {
        externalApi.getGs1Item.mockResolvedValue(ok(item({
            reason: 'product_has_other_gtin',
            candidates: [{ id: 10, name: 'Завеса А', sku: 'A-1', is_active: true, gtin: OLD_GTIN, current_gtin_regdate: '2024-01-02T00:00:00Z' }],
        })));
        externalApi.resolveGs1Item.mockResolvedValue(ok(item({ status: 'matched' })));
        const user = userEvent.setup();
        render(<Gs1ItemModal itemId={1} onClose={vi.fn()} />);

        expect(await screen.findByText(/02\.01\.2024/)).toBeInTheDocument(); // дата регистрации текущего GTIN
        await user.click(await screen.findByRole('button', { name: 'Заменить GTIN' }));
        expect(externalApi.resolveGs1Item).not.toHaveBeenCalled();
        expect(screen.getByText(/Старый:/).textContent).toContain(OLD_GTIN);
        expect(screen.getByText(/Новый:/).textContent).toContain(NEW_GTIN);

        await user.click(screen.getByRole('button', { name: 'Подтвердить' }));
        await waitFor(() => expect(externalApi.resolveGs1Item).toHaveBeenCalledWith(1, 'replace', 10));
    });

    it('unmatched с подсказками: кандидаты показаны, «Назначить» вызывает assign', async () => {
        externalApi.getGs1Item.mockResolvedValue(ok(item({
            status: 'unmatched', reason: 'no_match',
            candidates: [{ id: 21, name: 'Завеса Б', sku: 'B-2', is_active: true, gtin: '' }],
        })));
        externalApi.resolveGs1Item.mockResolvedValue(ok(item({ status: 'matched', reason: '', candidates: [] })));
        const user = userEvent.setup();
        render(<Gs1ItemModal itemId={1} onClose={vi.fn()} />);

        expect(await screen.findByText(/только подсказки/)).toBeInTheDocument();
        await user.click(screen.getAllByRole('button', { name: 'Назначить' })[0]);
        await waitFor(() => expect(externalApi.resolveGs1Item).toHaveBeenCalledWith(1, 'assign', 21));
    });

    it('дата регистрации текущего GTIN неизвестна (null) — так и пишем', async () => {
        externalApi.getGs1Item.mockResolvedValue(ok(item({
            reason: 'product_has_other_gtin',
            candidates: [{ id: 10, name: 'Завеса А', gtin: OLD_GTIN, current_gtin_regdate: null }],
        })));
        render(<Gs1ItemModal itemId={1} onClose={vi.fn()} />);
        expect(await screen.findByText(/дата неизвестна/)).toBeInTheDocument();
    });

    it('409 product_has_other_gtin на assign открывает подтверждение замены', async () => {
        externalApi.getGs1Item.mockResolvedValue(ok(item({ status: 'unmatched', reason: 'no_match', candidates: [] })));
        externalApi.resolveGs1Item.mockResolvedValueOnce(conflict409('product_has_other_gtin', { current_gtin: OLD_GTIN }));
        const user = userEvent.setup();
        render(<Gs1ItemModal itemId={1} onClose={vi.fn()} />);

        await user.click(await screen.findByText('pick-product'));
        await user.click(screen.getByRole('button', { name: 'Назначить' }));

        expect(await screen.findByText(/Старый:/)).toHaveTextContent(OLD_GTIN);
        expect(externalApi.resolveGs1Item).toHaveBeenCalledWith(1, 'assign', 77);
    });

    it('409 gtin_taken показывает сообщение бэкенда', async () => {
        externalApi.getGs1Item.mockResolvedValue(ok(item()));
        externalApi.resolveGs1Item.mockResolvedValue({
            ok: false, status: 409,
            data: { success: false, error: { code: 'gtin_taken', message: 'GTIN уже занят', other_product_id: 3 } },
        });
        const user = userEvent.setup();
        render(<Gs1ItemModal itemId={1} onClose={vi.fn()} />);

        await user.click((await screen.findAllByRole('button', { name: 'Назначить' }))[0]); // кнопка кандидата
        expect(await screen.findByText('GTIN уже занят')).toBeInTheDocument();
    });

    it('игнорируемая запись: только «Вернуть в очередь»', async () => {
        externalApi.getGs1Item.mockResolvedValue(ok(item({ status: 'ignored', reason: '', candidates: [] })));
        externalApi.resolveGs1Item.mockResolvedValue(ok(item({ status: 'new', reason: '', candidates: [] })));
        const user = userEvent.setup();
        render(<Gs1ItemModal itemId={1} onClose={vi.fn()} />);

        const reopen = await screen.findByRole('button', { name: 'Вернуть в очередь' });
        expect(screen.queryByRole('button', { name: 'Игнорировать' })).not.toBeInTheDocument();
        await user.click(reopen);
        expect(externalApi.resolveGs1Item).toHaveBeenCalledWith(1, 'reopen', undefined);
    });

    it('сопоставленная запись: действий разбора нет', async () => {
        externalApi.getGs1Item.mockResolvedValue(ok(item({ status: 'matched', reason: '', candidates: [], product: 10, product_name: 'Завеса А' })));
        render(<Gs1ItemModal itemId={1} onClose={vi.fn()} />);
        await screen.findByText('Сопоставлена');
        expect(screen.queryByRole('button', { name: 'Игнорировать' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Назначить' })).not.toBeInTheDocument();
    });

    it('ошибка загрузки (403 в формате detail)', async () => {
        externalApi.getGs1Item.mockResolvedValue({ ok: false, status: 403, data: { detail: 'Нет прав' } });
        render(<Gs1ItemModal itemId={1} onClose={vi.fn()} />);
        expect(await screen.findByText('Нет прав')).toBeInTheDocument();
    });
});
