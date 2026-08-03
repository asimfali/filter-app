import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CartKPPage from '../CartKPPage';
import { salesApi } from '../../api/sales';

vi.mock('../../api/sales', () => ({
  salesApi: { getKP: vi.fn() },
}));

const kpFull = {
  cart: { name: 'Корзина А', client_name: 'Иванов И.И.', notes: 'Примечание' },
  manager: { name: 'Петров П.П.', phone: '+7 900 000-00-00', email: 'petrov@example.com' },
  items: [
    {
      id: 1, product_name: 'Изделие 1', product_sku: 'SKU-1', quantity: 2,
      price: 250, line_total: 500, parameters: { Тип: 'А' },
      children: [
        { id: 11, product_name: 'Комплект 1', product_sku: 'SKU-11', quantity: 1, price: 100, line_total: 100, suggested_by_rule: true },
      ],
    },
    { id: 2, product_name: 'Изделие 2', quantity: 1, price: null, line_total: null, children: [] },
  ],
  totals: {},
};

const kpNoPrices = {
  cart: { name: 'Корзина Б', client_name: '', notes: '' },
  manager: { name: 'Петров П.П.', phone: '', email: 'petrov@example.com' },
  items: [
    { id: 1, product_name: 'Изделие 1', quantity: 1, price: null, line_total: null, children: [] },
  ],
  totals: {},
};

const okKp = (data) => ({ ok: true, data: { success: true, data } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CartKPPage — загрузка', () => {
  it('показывает индикатор до ответа', () => {
    salesApi.getKP.mockReturnValue(new Promise(() => {}));
    render(<CartKPPage cartId={1} onBack={vi.fn()} />);
    expect(screen.getByText('Загрузка...')).toBeInTheDocument();
  });
});

describe('CartKPPage — успех', () => {
  it('рендерит шапку/менеджера/таблицу с комплектующими, считает итог по позициям и детям, кнопки работают', async () => {
    salesApi.getKP.mockResolvedValue(okKp(kpFull));
    const onBack = vi.fn();
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<CartKPPage cartId={1} onBack={onBack} />);

    expect(await screen.findByText('Корзина А')).toBeInTheDocument();
    expect(screen.getByText('Иванов И.И.')).toBeInTheDocument();
    expect(screen.getByText('Примечание')).toBeInTheDocument();
    expect(screen.getByText('Петров П.П.')).toBeInTheDocument();
    expect(screen.getByText('+7 900 000-00-00')).toBeInTheDocument();
    expect(screen.getByText('petrov@example.com')).toBeInTheDocument();

    expect(screen.getByText('Изделие 1')).toBeInTheDocument();
    expect(screen.getByText('SKU-1')).toBeInTheDocument();
    expect(within(screen.getByText('Тип:').closest('span')).getByText('А')).toBeInTheDocument();
    expect(screen.getByText('Комплект 1')).toBeInTheDocument();
    expect(screen.getByText('авто')).toBeInTheDocument();

    // Изделие 1 (500) + Комплект 1 (100), Изделие 2 без цены не участвует
    expect(screen.getByText('600 ₽')).toBeInTheDocument();

    await user.click(screen.getByText('← Назад'));
    expect(onBack).toHaveBeenCalled();

    await user.click(screen.getByText('🖨 Печать'));
    expect(printSpy).toHaveBeenCalled();
  });

  it('без цен: ячейки — "—", итог — "Цены не указаны"', async () => {
    salesApi.getKP.mockResolvedValue(okKp(kpNoPrices));
    render(<CartKPPage cartId={1} onBack={vi.fn()} />);

    await screen.findByText('Корзина Б');
    expect(screen.getByText('Цены не указаны')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});

describe('CartKPPage — ошибки', () => {
  it('ok:false показывает "Ошибка загрузки КП" с кнопкой назад', async () => {
    salesApi.getKP.mockResolvedValue({ ok: false, data: {} });
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<CartKPPage cartId={1} onBack={onBack} />);

    expect(await screen.findByText('Ошибка загрузки КП')).toBeInTheDocument();
    await user.click(screen.getByText('← Назад'));
    expect(onBack).toHaveBeenCalled();
  });

  it('отклонённый промис показывает "Ошибка сети"', async () => {
    salesApi.getKP.mockRejectedValue(new Error('network'));
    render(<CartKPPage cartId={1} onBack={vi.fn()} />);
    expect(await screen.findByText('Ошибка сети')).toBeInTheDocument();
  });
});
