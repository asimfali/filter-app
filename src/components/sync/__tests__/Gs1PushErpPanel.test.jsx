import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Gs1PushErpPanel from '../Gs1PushErpPanel';
import { catalogApi } from '../../../api/catalog';

vi.mock('../../../api/catalog', () => ({
    catalogApi: { pushGtinTo1C: vi.fn(), taskStatus: vi.fn() },
}));

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('Gs1PushErpPanel', () => {
    it('кнопка отключена без выбранных товаров', () => {
        render(<Gs1PushErpPanel productIds={[]} />);
        expect(screen.getByRole('button', { name: /Отправить GTIN в 1С/ })).toBeDisabled();
    });

    it('запуск только после подтверждения, показывает прогресс и итог', async () => {
        catalogApi.pushGtinTo1C.mockResolvedValue({
            ok: true, status: 200,
            data: { success: true, data: { task_id: 't1', total: 2, message: 'Запущена отправка GTIN 2 товаров в 1С' } },
        });
        catalogApi.taskStatus
            .mockResolvedValueOnce({ ok: true, data: { success: true, data: { ready: false, status: 'PROGRESS', info: { status: 'Отправляем GTIN: Завеса А' } } } })
            .mockResolvedValueOnce({
                ok: true, data: { success: true, data: {
                    ready: true, status: 'SUCCESS',
                    result: { success: true, total: 2, pushed: 1, errors: [{ product: 'Завеса Б', cause: 'no_gtin', error: 'У товара не заполнен GTIN' }] },
                } },
            });
        const onDone = vi.fn();
        render(<Gs1PushErpPanel productIds={[10, 11]} onDone={onDone} />);

        fireEvent.click(screen.getByRole('button', { name: 'Отправить GTIN в 1С (2)' }));
        expect(catalogApi.pushGtinTo1C).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));
        await flush();
        expect(catalogApi.pushGtinTo1C).toHaveBeenCalledWith([10, 11]);
        expect(screen.getByText('Отправляем GTIN: Завеса А')).toBeInTheDocument();

        await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
        expect(screen.getByText(/Отправлено 1 из 2, ошибок: 1/)).toBeInTheDocument();
        expect(screen.getByText('Завеса Б')).toBeInTheDocument();
        expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ pushed: 1 }));
    });

    it('inactive/not_found — подписи причин для деактивированных/несуществующих товаров', async () => {
        catalogApi.pushGtinTo1C.mockResolvedValue({
            ok: true, status: 200,
            data: { success: true, data: { task_id: 't1', total: 2, message: 'm' } },
        });
        catalogApi.taskStatus.mockResolvedValue({
            ok: true, data: { success: true, data: {
                ready: true, status: 'SUCCESS',
                result: {
                    success: true, total: 2, pushed: 0,
                    errors: [
                        { product: 'КЭВ-70П41410W', cause: 'inactive', error: 'Товар деактивирован в каталоге' },
                        { product: 'id=999', cause: 'not_found', error: 'Товар не найден' },
                    ],
                },
            } },
        });
        render(<Gs1PushErpPanel productIds={[5636, 999]} />);
        fireEvent.click(screen.getByRole('button', { name: 'Отправить GTIN в 1С (2)' }));
        fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));
        await flush();

        expect(screen.getByText('КЭВ-70П41410W')).toBeInTheDocument();
        expect(screen.getByText(/Товар деактивирован в каталоге: Товар деактивирован в каталоге/)).toBeInTheDocument();
        expect(screen.getByText('id=999')).toBeInTheDocument();
        expect(screen.getByText(/Товар не найден: Товар не найден/)).toBeInTheDocument();
    });

    it('ошибка запуска (400 без envelope) показывает data.error как есть', async () => {
        catalogApi.pushGtinTo1C.mockResolvedValue({ ok: false, status: 400, data: { success: false, error: 'product_ids обязателен' } });
        render(<Gs1PushErpPanel productIds={[1]} />);
        fireEvent.click(screen.getByRole('button', { name: /Отправить GTIN в 1С/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));
        await flush();
        expect(screen.getByText('product_ids обязателен')).toBeInTheDocument();
    });

    it('задача завершилась ошибкой (FAILURE)', async () => {
        catalogApi.pushGtinTo1C.mockResolvedValue({ ok: true, status: 200, data: { success: true, data: { task_id: 't1', total: 1, message: 'm' } } });
        catalogApi.taskStatus.mockResolvedValue({ ok: true, data: { success: true, data: { ready: true, status: 'FAILURE', result: null } } });
        render(<Gs1PushErpPanel productIds={[1]} />);
        fireEvent.click(screen.getByRole('button', { name: /Отправить GTIN в 1С/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));
        await flush();
        expect(screen.getByText('Задача завершилась с ошибкой')).toBeInTheDocument();
    });
});
