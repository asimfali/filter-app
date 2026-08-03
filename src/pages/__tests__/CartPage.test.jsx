import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CartPage from '../CartPage';
import { useCart } from '../../contexts/CartContext';
import { salesApi } from '../../api/sales';

vi.mock('../../contexts/CartContext', () => ({ useCart: vi.fn() }));
vi.mock('../../api/sales', () => ({
  salesApi: {
    getCart: vi.fn(),
    deleteCart: vi.fn(),
    deleteItem: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    refreshGroup: vi.fn(),
    updateGroupAccessory: vi.fn(),
    deleteGroupAccessory: vi.fn(),
  },
}));
vi.mock('../../components/common/SmartSelect', () => ({
  default: ({ placeholder, onSelect }) => (
    <div>
      <input placeholder={placeholder} readOnly />
      <button onClick={() => onSelect({ id: 77, name: 'Товар X' })}>select-product</button>
    </div>
  ),
}));

const baseCartCtx = (overrides = {}) => ({
  carts: [],
  activeCartId: null,
  cartsNext: null,
  cartsLoading: false,
  loadCarts: vi.fn(),
  loadMoreCarts: vi.fn(),
  searchCarts: vi.fn(),
  selectCart: vi.fn(),
  createCart: vi.fn(),
  refreshCount: vi.fn(),
  ...overrides,
});

const cart1 = { id: 1, name: 'Корзина А', client_name: 'Иванов И.И.', items_count: 2, updated_at: '2026-07-01T10:00:00Z' };
const cart2 = { id: 2, name: 'Корзина Б', items_count: 0, updated_at: '2026-07-02T10:00:00Z' };

const row = (text) => screen.getByText(text).closest('.flex.items-center.gap-3');

beforeEach(() => {
  vi.clearAllMocks();
  useCart.mockReturnValue(baseCartCtx());
  salesApi.getCart.mockResolvedValue({ ok: true, data: null });
});

describe('CartPage — левая панель: список корзин', () => {
  it('пустой список — заглушка', () => {
    render(<CartPage onNavigate={vi.fn()} />);
    expect(screen.getByText('Нет корзин. Создайте первую.')).toBeInTheDocument();
  });

  it('рендерит корзины из контекста, клик по карточке вызывает selectCart', async () => {
    const selectCart = vi.fn();
    useCart.mockReturnValue(baseCartCtx({ carts: [cart1, cart2], selectCart }));
    const user = userEvent.setup();
    render(<CartPage onNavigate={vi.fn()} />);

    expect(screen.getByText('Корзина А')).toBeInTheDocument();
    expect(screen.getByText('Иванов И.И.')).toBeInTheDocument();
    expect(screen.getByText(/^2 поз\./)).toBeInTheDocument();

    await user.click(screen.getByText('Корзина А'));
    expect(selectCart).toHaveBeenCalledWith(1);
  });

  it('удаление корзины: подтверждение вызывает deleteCart (+selectCart(null), т.к. активна) и loadCarts; отмена — no-op', async () => {
    const selectCart = vi.fn();
    const loadCarts = vi.fn();
    useCart.mockReturnValue(baseCartCtx({ carts: [cart1, cart2], activeCartId: 1, selectCart, loadCarts }));
    salesApi.deleteCart.mockResolvedValue({ ok: true, data: {} });
    const user = userEvent.setup();
    render(<CartPage onNavigate={vi.fn()} />);

    const removeButtons = screen.getAllByText('✕');
    await user.click(removeButtons[0]);
    expect(screen.getByText('Удалить корзину? Все позиции будут потеряны.')).toBeInTheDocument();
    await user.click(screen.getByText('Отмена'));
    expect(salesApi.deleteCart).not.toHaveBeenCalled();

    await user.click(removeButtons[0]);
    await user.click(screen.getByText('Подтвердить'));
    expect(salesApi.deleteCart).toHaveBeenCalledWith(1);
    expect(selectCart).toHaveBeenCalledWith(null);
    expect(loadCarts).toHaveBeenCalled();
  });
});

describe('CartPage — поиск (дебаунс 300мс)', () => {
  it('вызывает searchCarts с последним введённым значением через 300мс', async () => {
    vi.useFakeTimers();
    const searchCarts = vi.fn();
    useCart.mockReturnValue(baseCartCtx({ searchCarts }));
    render(<CartPage onNavigate={vi.fn()} />);

    const input = screen.getByPlaceholderText('Поиск по названию, клиенту...');
    fireEvent.change(input, { target: { value: 'а' } });
    fireEvent.change(input, { target: { value: 'ав' } });
    fireEvent.change(input, { target: { value: 'авт' } });

    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(searchCarts).toHaveBeenCalledTimes(1);
    expect(searchCarts).toHaveBeenCalledWith('авт');
    vi.useRealTimers();
  });
});

describe('CartPage — «Показать ещё»', () => {
  it('видна только при cartsNext, задизейблена при cartsLoading, зовёт loadMoreCarts', async () => {
    const loadMoreCarts = vi.fn();
    useCart.mockReturnValue(baseCartCtx({ carts: [cart1], cartsNext: 'http://x', loadMoreCarts }));
    const user = userEvent.setup();
    const { rerender } = render(<CartPage onNavigate={vi.fn()} />);

    await user.click(screen.getByText('Показать ещё'));
    expect(loadMoreCarts).toHaveBeenCalled();

    useCart.mockReturnValue(baseCartCtx({ carts: [cart1], cartsNext: 'http://x', cartsLoading: true, loadMoreCarts }));
    rerender(<CartPage onNavigate={vi.fn()} />);
    expect(screen.getByText('Загрузка...')).toBeDisabled();
  });

  it('не видна без cartsNext', () => {
    useCart.mockReturnValue(baseCartCtx({ carts: [cart1], cartsNext: null }));
    render(<CartPage onNavigate={vi.fn()} />);
    expect(screen.queryByText('Показать ещё')).not.toBeInTheDocument();
  });
});

describe('CartPage — создание корзины', () => {
  it('открывается по "+ Новая", "Создать" задизейблена при пустом имени, Enter сабмитит форму', async () => {
    const createCart = vi.fn().mockResolvedValue({ ok: true, cart: { id: 3 } });
    useCart.mockReturnValue(baseCartCtx({ createCart }));
    const user = userEvent.setup();
    render(<CartPage onNavigate={vi.fn()} />);

    await user.click(screen.getByText('+ Новая'));
    expect(screen.getByText('Новая корзина')).toBeInTheDocument();
    expect(screen.getByText('Создать')).toBeDisabled();

    await user.type(screen.getByPlaceholderText('ТЦ Магнит — 2026'), 'Клиент №1{Enter}');

    expect(createCart).toHaveBeenCalledWith(expect.objectContaining({ name: 'Клиент №1' }));
    await waitFor(() => expect(screen.queryByText('Новая корзина')).not.toBeInTheDocument());
  });
});

describe('CartPage — правая панель без активной корзины', () => {
  it('показывает заглушку', () => {
    render(<CartPage onNavigate={vi.fn()} />);
    expect(screen.getByText('Выберите корзину слева')).toBeInTheDocument();
  });
});

describe('CartPage — правая панель с активной корзиной', () => {
  const cartDetail = { name: 'Корзина А', client_name: 'Иванов И.И.', groups: [], ungrouped_items: [], totals: {} };

  it('грузит деталь по activeCartId, рендерит шапку, "КП →" вызывает onNavigate', async () => {
    const onNavigate = vi.fn();
    useCart.mockReturnValue(baseCartCtx({ carts: [cart1], activeCartId: 1 }));
    salesApi.getCart.mockResolvedValue({ ok: true, data: cartDetail });
    const user = userEvent.setup();
    render(<CartPage onNavigate={onNavigate} />);

    await screen.findByRole('heading', { name: 'Корзина А' });
    expect(salesApi.getCart).toHaveBeenCalledWith(1);

    await user.click(screen.getByText('КП →'));
    expect(onNavigate).toHaveBeenCalledWith('cart-kp', 1);
  });

  it('добавление товара через SmartSelect зовёт addItem, перезагружает деталь и refreshCount', async () => {
    const refreshCount = vi.fn();
    useCart.mockReturnValue(baseCartCtx({ carts: [cart1], activeCartId: 1, refreshCount }));
    salesApi.getCart.mockResolvedValue({ ok: true, data: cartDetail });
    salesApi.addItem.mockResolvedValue({ ok: true, data: {} });
    const user = userEvent.setup();
    render(<CartPage onNavigate={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Корзина А' });
    salesApi.getCart.mockClear();

    await user.click(screen.getByText('select-product'));

    expect(salesApi.addItem).toHaveBeenCalledWith(1, { product: 77, quantity: 1 });
    await waitFor(() => expect(salesApi.getCart).toHaveBeenCalledWith(1));
    expect(refreshCount).toHaveBeenCalled();
  });

  it('итоговая сумма рендерится только при totals.has_price', async () => {
    useCart.mockReturnValue(baseCartCtx({ carts: [cart1], activeCartId: 1 }));
    salesApi.getCart.mockResolvedValue({ ok: true, data: { ...cartDetail, totals: { has_price: true, total: 500 } } });
    render(<CartPage onNavigate={vi.fn()} />);
    expect(await screen.findByText('Итого: 500 ₽')).toBeInTheDocument();
  });
});

describe('CartPage — позиция вне групп', () => {
  const ungroupedDetail = {
    name: 'Корзина А', groups: [], totals: {},
    ungrouped_items: [{ id: 300, product_name: 'Изделие вне групп', quantity: 1, price: 200, line_total: 200 }],
  };

  it('уменьшение ниже 1 не вызывает api; иначе +/- вызывает updateItem', async () => {
    useCart.mockReturnValue(baseCartCtx({ carts: [cart1], activeCartId: 1 }));
    salesApi.getCart.mockResolvedValue({ ok: true, data: ungroupedDetail });
    const user = userEvent.setup();
    render(<CartPage onNavigate={vi.fn()} />);
    await screen.findByText('Изделие вне групп');

    await user.click(within(row('Изделие вне групп')).getByText('−'));
    expect(salesApi.updateItem).not.toHaveBeenCalled();

    salesApi.updateItem.mockResolvedValue({ ok: true, data: {} });
    await user.click(within(row('Изделие вне групп')).getByText('+'));
    expect(salesApi.updateItem).toHaveBeenCalledWith(1, 300, { quantity: 2 });
  });

  it('удаление позиции: подтверждение зовёт deleteItem, обновляет деталь и счётчик', async () => {
    const refreshCount = vi.fn();
    useCart.mockReturnValue(baseCartCtx({ carts: [cart1], activeCartId: 1, refreshCount }));
    salesApi.getCart.mockResolvedValue({ ok: true, data: ungroupedDetail });
    salesApi.deleteItem.mockResolvedValue({ ok: true, data: {} });
    const user = userEvent.setup();
    render(<CartPage onNavigate={vi.fn()} />);
    await screen.findByText('Изделие вне групп');
    salesApi.getCart.mockClear();

    await user.click(within(row('Изделие вне групп')).getByText('✕'));
    expect(screen.getByText('Удалить позицию?')).toBeInTheDocument();
    await user.click(screen.getByText('Подтвердить'));

    expect(salesApi.deleteItem).toHaveBeenCalledWith(1, 300);
    await waitFor(() => expect(salesApi.getCart).toHaveBeenCalledWith(1));
    expect(refreshCount).toHaveBeenCalled();
  });
});

describe('CartPage — позиции в группе', () => {
  const groupItemDetail = {
    name: 'Корзина А', totals: {}, ungrouped_items: [],
    groups: [{
      id: 10, group_key: 'series:АГТ|dn:200', total_quantity: 2,
      items: [{ id: 100, product_name: 'Изделие 1', quantity: 2, price: 500, line_total: 1000 }],
      accessories: [],
    }],
  };

  it('groupLabel парсится из group_key; +/- у позиции группы вызывает updateItem+refreshGroup и перезагружает деталь', async () => {
    const refreshCount = vi.fn();
    useCart.mockReturnValue(baseCartCtx({ carts: [cart1], activeCartId: 1, refreshCount }));
    salesApi.getCart.mockResolvedValue({ ok: true, data: groupItemDetail });
    salesApi.updateItem.mockResolvedValue({ ok: true, data: {} });
    salesApi.refreshGroup.mockResolvedValue({ ok: true, data: {} });
    const user = userEvent.setup();
    render(<CartPage onNavigate={vi.fn()} />);
    await screen.findByText('АГТ · 200');
    salesApi.getCart.mockClear();

    await user.click(within(row('Изделие 1')).getByText('+'));

    expect(salesApi.updateItem).toHaveBeenCalledWith(1, 100, { quantity: 3 });
    expect(salesApi.refreshGroup).toHaveBeenCalledWith(1, 10);
    await waitFor(() => expect(salesApi.getCart).toHaveBeenCalledWith(1));
    expect(refreshCount).toHaveBeenCalled();
  });
});

describe('CartPage — комплектующие группы', () => {
  const accessoryDetail = {
    name: 'Корзина А', totals: {}, ungrouped_items: [],
    groups: [{
      id: 10, group_key: 'series:АГТ|dn:200', total_quantity: 3,
      items: [{ id: 100, product_name: 'Изделие 1', quantity: 2 }],
      accessories: [{ id: 200, product_name: 'Комплект 1', quantity: 1, price: 100, line_total: 100 }],
    }],
  };

  it('+/- у комплектующей вызывает updateGroupAccessory; ✕ вызывает deleteGroupAccessory(cartId, accId)', async () => {
    useCart.mockReturnValue(baseCartCtx({ carts: [cart1], activeCartId: 1 }));
    salesApi.getCart.mockResolvedValue({ ok: true, data: accessoryDetail });
    salesApi.updateGroupAccessory.mockResolvedValue({ ok: true, data: {} });
    salesApi.deleteGroupAccessory.mockResolvedValue({ ok: true, data: {} });
    const user = userEvent.setup();
    render(<CartPage onNavigate={vi.fn()} />);
    await screen.findByText('Комплект 1');

    await user.click(within(row('Комплект 1')).getByText('+'));
    expect(salesApi.updateGroupAccessory).toHaveBeenCalledWith(1, 10, 200, { quantity: 2 });

    await user.click(within(row('Комплект 1')).getByText('✕'));
    expect(salesApi.deleteGroupAccessory).toHaveBeenCalledWith(1, 200);
  });
});
