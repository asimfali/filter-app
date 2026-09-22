import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Gs1Page from '../Gs1Page';
import { externalApi } from '../../api/external';
import { useAuth } from '../../contexts/AuthContext';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../api/external', () => ({
    externalApi: { getGs1Items: vi.fn(), getGs1Summary: vi.fn() },
}));
vi.mock('../../components/sync/Gs1RunPanel', () => ({ default: () => <div data-testid="run-panel" /> }));
vi.mock('../../components/sync/Gs1ItemModal', () => ({
    default: ({ itemId }) => <div data-testid="item-modal">item:{itemId}</div>,
}));
vi.mock('../../components/sync/Gs1PushErpPanel', () => ({
    default: ({ productIds, onDone }) => (
        <div data-testid="push-erp-panel">
            ids:{productIds.join(',')}
            <button onClick={() => onDone({ pushed: productIds.length })}>done-push</button>
        </div>
    ),
}));

const ok = (data) => ({ ok: true, status: 200, data: { success: true, data } });
const row = (over = {}) => ({
    id: 1, gtin: '4600000000002', prod_desc: 'Завеса тепловая', prod_regdate: '2026-03-05T10:00:00Z',
    is_active_in_gs1: true, status: 'conflict', reason: 'ambiguous', product: null, product_name: null,
    candidates_count: 2, ...over,
});
const summary = {
    by_status: { conflict: 3, new: 7 }, proposals: 4, conflicts_by_reason: { ambiguous: 2, gtin_taken: 1 }, last_run: null,
};
const asUser = (...perms) => useAuth.mockReturnValue({ user: { id: 1, permissions: perms } });
const lastParams = () => externalApi.getGs1Items.mock.calls.at(-1)[0];

beforeEach(() => {
    vi.clearAllMocks();
    externalApi.getGs1Items.mockResolvedValue(ok({ count: 1, results: [row()] }));
    externalApi.getGs1Summary.mockResolvedValue(ok(summary));
});

describe('Gs1Page', () => {
    it('без external.gs1_resolve — сообщение и ни одного запроса', () => {
        asUser('external.gs1_sync');
        render(<Gs1Page />);
        expect(screen.getByText(/Недостаточно прав/)).toBeInTheDocument();
        expect(externalApi.getGs1Items).not.toHaveBeenCalled();
    });

    it('блок запуска показан только с external.gs1_sync', async () => {
        asUser('external.gs1_resolve');
        const { unmount } = render(<Gs1Page />);
        await screen.findByText('Завеса тепловая');
        expect(screen.queryByTestId('run-panel')).not.toBeInTheDocument();
        unmount();

        asUser('external.gs1_resolve', 'external.gs1_sync');
        render(<Gs1Page />);
        expect(await screen.findByTestId('run-panel')).toBeInTheDocument();
    });

    it('по умолчанию: вкладка «Конфликты», только активные в ГС1', async () => {
        asUser('external.gs1_resolve');
        render(<Gs1Page />);
        await screen.findByText('Завеса тепловая');
        expect(lastParams()).toMatchObject({ status: 'conflict', is_active_in_gs1: 'true', page: 1, page_size: 50 });
        expect(screen.getByText('Несколько подходящих товаров')).toBeInTheDocument();
        expect(await screen.findByText('3')).toBeInTheDocument(); // бейдж вкладки из summary
    });

    it('«Предложено» и «Новые» различаются has_candidates, счётчик предложений из summary', async () => {
        asUser('external.gs1_resolve');
        render(<Gs1Page />);
        await screen.findByText('Завеса тепловая');
        expect(await screen.findByRole('button', { name: /Предложено\s*4/ })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Предложено/ }));
        await waitFor(() => expect(lastParams()).toMatchObject({ status: 'new', has_candidates: 'true' }));
        fireEvent.click(screen.getByRole('button', { name: /^Новые/ }));
        await waitFor(() => expect(lastParams()).toMatchObject({ status: 'new', has_candidates: 'false' }));
    });

    it('переключатель «деактивированные» снимает фильтр активности', async () => {
        asUser('external.gs1_resolve');
        render(<Gs1Page />);
        await screen.findByText('Завеса тепловая');
        await userEvent.setup().click(screen.getByLabelText('Показать деактивированные в ГС1'));
        await waitFor(() => expect(lastParams().is_active_in_gs1).toBe(''));
    });

    it('смена вкладки меняет status и сбрасывает причину', async () => {
        asUser('external.gs1_resolve');
        render(<Gs1Page />);
        await screen.findByText('Завеса тепловая');
        fireEvent.change(await screen.findByDisplayValue('Все причины'), { target: { value: 'gtin_taken' } });
        await waitFor(() => expect(lastParams().reason).toBe('gtin_taken'));

        fireEvent.click(screen.getByRole('button', { name: /Не найдены/ }));
        await waitFor(() => expect(lastParams()).toMatchObject({ status: 'unmatched', reason: '' }));
    });

    it('поиск уходит в запрос с debounce и сбрасывает страницу', async () => {
        asUser('external.gs1_resolve');
        render(<Gs1Page />);
        await screen.findByText('Завеса тепловая');
        fireEvent.change(screen.getByPlaceholderText(/GTIN, описание/), { target: { value: ' 4600000000002 ' } });
        await waitFor(() => expect(lastParams().search).toBe('4600000000002'));
    });

    it('пагинация: следующая страница', async () => {
        asUser('external.gs1_resolve');
        externalApi.getGs1Items.mockResolvedValue(ok({ count: 120, results: [row()] }));
        render(<Gs1Page />);
        expect(await screen.findByText(/Стр\. 1 из 3/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '→' }));
        await waitFor(() => expect(lastParams().page).toBe(2));
    });

    it('в строке unmatched видно число подсказок', async () => {
        asUser('external.gs1_resolve');
        externalApi.getGs1Items.mockResolvedValue(ok({ count: 1, results: [row({ status: 'unmatched', reason: 'no_match', candidates_count: 3 })] }));
        render(<Gs1Page />);
        expect(await screen.findByText('подсказок: 3')).toBeInTheDocument();
    });

    it('клик по строке открывает разбор записи', async () => {
        asUser('external.gs1_resolve');
        render(<Gs1Page />);
        fireEvent.click(await screen.findByText('Завеса тепловая'));
        expect(screen.getByTestId('item-modal')).toHaveTextContent('item:1');
    });

    it('ошибка загрузки показывается текстом', async () => {
        asUser('external.gs1_resolve');
        externalApi.getGs1Items.mockResolvedValue({ ok: false, status: 403, data: { detail: 'Нет прав' } });
        render(<Gs1Page />);
        expect(await screen.findByText('Нет прав')).toBeInTheDocument();
    });

    describe('отправка GTIN в 1С', () => {
        const matchedRow = (over = {}) => row({ id: 5, status: 'matched', reason: '', product: 55, product_name: 'Завеса А', candidates_count: 0, ...over });

        it('без catalog.push_gtin_to_1c — ни чекбоксов, ни панели, но статус «GTIN в 1С» всё равно виден', async () => {
            asUser('external.gs1_resolve');
            externalApi.getGs1Items.mockResolvedValue(ok({ count: 1, results: [matchedRow({ gtin_pushed_at: null })] }));
            render(<Gs1Page />);
            fireEvent.click(await screen.findByRole('button', { name: /Сопоставленные/ }));
            await waitFor(() => expect(lastParams().status).toBe('matched'));
            expect(screen.queryByTestId('push-erp-panel')).not.toBeInTheDocument();
            expect(within(screen.getByRole('table')).queryAllByRole('checkbox').length).toBe(0);
            expect(screen.getByText('не отправлен')).toBeInTheDocument();
        });

        it('gtin_pushed_at — дата отправки в 1С отмечена галочкой', async () => {
            asUser('external.gs1_resolve');
            externalApi.getGs1Items.mockResolvedValue(ok({ count: 1, results: [matchedRow({ gtin_pushed_at: '2026-09-22T10:15:00Z' })] }));
            render(<Gs1Page />);
            fireEvent.click(await screen.findByRole('button', { name: /Сопоставленные/ }));
            expect(await screen.findByText(/✓ 22\.09\.2026/)).toBeInTheDocument();
        });

        it('«Скрыть уже отправленные в 1С» — только на «Сопоставленные», шлёт gtin_pushed_to_1c=false', async () => {
            asUser('external.gs1_resolve');
            externalApi.getGs1Items.mockResolvedValue(ok({ count: 1, results: [row()] }));
            render(<Gs1Page />);
            await screen.findByText('Завеса тепловая');
            expect(screen.queryByLabelText('Скрыть уже отправленные в 1С')).not.toBeInTheDocument();

            externalApi.getGs1Items.mockResolvedValue(ok({ count: 1, results: [matchedRow()] }));
            fireEvent.click(screen.getByRole('button', { name: /Сопоставленные/ }));
            await screen.findByText('Завеса А');
            await userEvent.setup().click(screen.getByLabelText('Скрыть уже отправленные в 1С'));
            await waitFor(() => expect(lastParams().gtin_pushed_to_1c).toBe('false'));

            fireEvent.click(screen.getByRole('button', { name: /Конфликты/ }));
            await waitFor(() => expect(lastParams().gtin_pushed_to_1c).toBeUndefined());
        });

        it('с правом на «Сопоставленные»: выбор строк передаётся в панель как product id', async () => {
            asUser('external.gs1_resolve', 'catalog.push_gtin_to_1c');
            externalApi.getGs1Items.mockResolvedValue(ok({ count: 2, results: [matchedRow(), matchedRow({ id: 6, product: 66, product_name: 'Завеса Б' })] }));
            render(<Gs1Page />);
            fireEvent.click(await screen.findByRole('button', { name: /Сопоставленные/ }));
            await screen.findByText('Завеса А');

            expect(screen.getByTestId('push-erp-panel')).toHaveTextContent('ids:');
            const [selectAllCb, row0Cb] = within(screen.getByRole('table')).getAllByRole('checkbox');
            fireEvent.click(row0Cb);
            expect(screen.getByTestId('push-erp-panel')).toHaveTextContent('ids:55');

            fireEvent.click(selectAllCb); // выбрать все на странице
            expect(screen.getByTestId('push-erp-panel')).toHaveTextContent('ids:55,66');
        });

        it('панель и чекбоксы видны только на «Сопоставленные», выбор сбрасывается при смене вкладки', async () => {
            asUser('external.gs1_resolve', 'catalog.push_gtin_to_1c');
            externalApi.getGs1Items.mockResolvedValue(ok({ count: 1, results: [matchedRow()] }));
            render(<Gs1Page />);
            fireEvent.click(await screen.findByRole('button', { name: /Сопоставленные/ }));
            await screen.findByText('Завеса А');
            fireEvent.click(within(screen.getByRole('table')).getAllByRole('checkbox')[1]); // чекбокс строки
            expect(screen.getByTestId('push-erp-panel')).toHaveTextContent('ids:55');

            externalApi.getGs1Items.mockResolvedValue(ok({ count: 1, results: [row()] }));
            fireEvent.click(screen.getByRole('button', { name: /Конфликты/ }));
            await screen.findByText('Завеса тепловая');
            expect(screen.queryByTestId('push-erp-panel')).not.toBeInTheDocument();

            externalApi.getGs1Items.mockResolvedValue(ok({ count: 1, results: [matchedRow()] }));
            fireEvent.click(screen.getByRole('button', { name: /Сопоставленные/ }));
            await screen.findByText('Завеса А');
            expect(screen.getByTestId('push-erp-panel')).toHaveTextContent('ids:'); // выбор не сохранился
        });
    });
});
