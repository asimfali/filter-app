import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartProvider, useCart } from '../CartContext';
import { salesApi } from '../../api/sales';

vi.mock('../../api/sales', () => ({
  salesApi: {
    listCarts: vi.fn(),
    listCartsUrl: vi.fn(),
    createCart: vi.fn(),
    getCart: vi.fn(),
    addItem: vi.fn(),
  },
}));

function Harness() {
  const cart = useCart();
  const [actionResult, setActionResult] = useState(null);

  return (
    <div>
      <div data-testid="carts">{JSON.stringify(cart.carts)}</div>
      <div data-testid="active-cart-id">{String(cart.activeCartId)}</div>
      <div data-testid="items-count">{cart.itemsCount}</div>
      <div data-testid="carts-next">{String(cart.cartsNext)}</div>
      <div data-testid="carts-loading">{String(cart.cartsLoading)}</div>
      <div data-testid="carts-search">{cart.cartsSearch}</div>
      <div data-testid="action-result">{actionResult ? JSON.stringify(actionResult) : ''}</div>
      <button onClick={() => cart.loadMoreCarts()}>load-more</button>
      <button onClick={() => cart.searchCarts('фильтр')}>search</button>
      <button onClick={() => cart.selectCart(1)}>select-1</button>
      <button onClick={() => cart.selectCart(null)}>select-null</button>
      <button onClick={async () => setActionResult(await cart.createCart({ name: 'Новая' }))}>create</button>
      <button onClick={async () => setActionResult(await cart.addToCart(5, 1))}>add-to-cart</button>
      <button onClick={() => cart.refreshCount()}>refresh-count</button>
    </div>
  );
}

const renderCart = () => render(<CartProvider><Harness /></CartProvider>);
const okList = (results, next = null) => ({ ok: true, data: { results, next } });
const waitLoaded = () => waitFor(() => expect(screen.getByTestId('carts-loading')).toHaveTextContent('false'));

const cart1 = { id: 1, name: 'A', items_count: 3, updated_at: '2026-07-01T00:00:00Z' };
const cart2 = { id: 2, name: 'B', items_count: 5, updated_at: '2026-07-02T00:00:00Z' };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  salesApi.listCarts.mockResolvedValue(okList([]));
});

describe('CartProvider — маунт', () => {
  it('без сохранённого activeCartId вызывает loadCarts() и остаётся без активной корзины', async () => {
    renderCart();
    await waitFor(() => expect(salesApi.listCarts).toHaveBeenCalledWith({ search: '', page: 1 }));
    expect(screen.getByTestId('active-cart-id')).toHaveTextContent('null');
  });

  it('восстанавливает activeCartId из localStorage', async () => {
    localStorage.setItem('activeCartId', '7');
    renderCart();
    expect(screen.getByTestId('active-cart-id')).toHaveTextContent('7');
    await waitLoaded();
  });
});

describe('CartProvider — loadCarts', () => {
  it('успех кладёт carts/cartsNext и обновляет itemsCount активной корзины', async () => {
    localStorage.setItem('activeCartId', '1');
    salesApi.listCarts.mockResolvedValue(okList([cart1, cart2], 'http://next'));
    renderCart();
    await waitFor(() => expect(screen.getByTestId('carts-next')).toHaveTextContent('http://next'));
    expect(screen.getByTestId('items-count')).toHaveTextContent('3');
  });

  it('ok:false не падает, просто снимает loading', async () => {
    salesApi.listCarts.mockResolvedValue({ ok: false, data: {} });
    renderCart();
    await waitLoaded();
    expect(screen.getByTestId('carts')).toHaveTextContent('[]');
  });
});

describe('CartProvider — loadMoreCarts', () => {
  it('no-op без cartsNext', async () => {
    const user = userEvent.setup();
    renderCart();
    await waitLoaded();
    await user.click(screen.getByText('load-more'));
    expect(salesApi.listCartsUrl).not.toHaveBeenCalled();
  });

  it('успех дописывает результаты к списку и обновляет cartsNext; повторный клик, пока первый запрос не завершён, не дублируется', async () => {
    salesApi.listCarts.mockResolvedValue(okList([cart1], 'http://next1'));
    let resolveMore;
    salesApi.listCartsUrl.mockReturnValue(new Promise((r) => { resolveMore = r; }));
    const user = userEvent.setup();
    renderCart();
    await waitFor(() => expect(screen.getByTestId('carts-next')).toHaveTextContent('http://next1'));

    await user.click(screen.getByText('load-more'));
    await user.click(screen.getByText('load-more'));
    expect(salesApi.listCartsUrl).toHaveBeenCalledTimes(1);

    resolveMore(okList([cart2], null));
    await waitFor(() => expect(screen.getByTestId('carts-next')).toHaveTextContent('null'));
    expect(screen.getByTestId('carts')).toHaveTextContent('"id":1');
    expect(screen.getByTestId('carts')).toHaveTextContent('"id":2');
  });
});

describe('CartProvider — searchCarts', () => {
  it('обновляет cartsSearch и перезагружает список с этим поиском', async () => {
    const user = userEvent.setup();
    renderCart();
    await waitLoaded();
    salesApi.listCarts.mockClear();
    salesApi.listCarts.mockResolvedValue(okList([cart2]));

    await user.click(screen.getByText('search'));

    expect(screen.getByTestId('carts-search')).toHaveTextContent('фильтр');
    await waitFor(() => expect(salesApi.listCarts).toHaveBeenCalledWith({ search: 'фильтр', page: 1 }));
  });
});

describe('CartProvider — selectCart', () => {
  it('пишет/чистит localStorage и выставляет itemsCount из списка carts (или 0, если корзина снята)', async () => {
    salesApi.listCarts.mockResolvedValue(okList([cart1, cart2]));
    const user = userEvent.setup();
    renderCart();
    await waitFor(() => expect(screen.getByTestId('carts')).toHaveTextContent('"id":1'));

    await user.click(screen.getByText('select-1'));
    expect(screen.getByTestId('active-cart-id')).toHaveTextContent('1');
    expect(screen.getByTestId('items-count')).toHaveTextContent('3');
    expect(localStorage.getItem('activeCartId')).toBe('1');

    await user.click(screen.getByText('select-null'));
    expect(screen.getByTestId('active-cart-id')).toHaveTextContent('null');
    expect(screen.getByTestId('items-count')).toHaveTextContent('0');
    expect(localStorage.getItem('activeCartId')).toBeNull();
  });
});

describe('CartProvider — createCart', () => {
  it('успех: перезагружает список и выбирает новую корзину', async () => {
    salesApi.createCart.mockResolvedValue({ ok: true, data: { id: 9, name: 'Новая' } });
    salesApi.listCarts.mockResolvedValue(okList([{ id: 9, name: 'Новая', items_count: 0 }]));
    const user = userEvent.setup();
    renderCart();
    await waitLoaded();

    await user.click(screen.getByText('create'));

    await waitFor(() => expect(screen.getByTestId('action-result')).toHaveTextContent('"ok":true'));
    expect(screen.getByTestId('active-cart-id')).toHaveTextContent('9');
    expect(localStorage.getItem('activeCartId')).toBe('9');
  });

  it('неудача: не выбирает и не перезагружает список', async () => {
    salesApi.createCart.mockResolvedValue({ ok: false, data: {} });
    const user = userEvent.setup();
    renderCart();
    await waitLoaded();
    salesApi.listCarts.mockClear();

    await user.click(screen.getByText('create'));

    await waitFor(() => expect(screen.getByTestId('action-result')).toHaveTextContent('"ok":false'));
    expect(screen.getByTestId('active-cart-id')).toHaveTextContent('null');
    expect(salesApi.listCarts).not.toHaveBeenCalled();
  });
});

describe('CartProvider — addToCart', () => {
  it('без активной корзины не дёргает api', async () => {
    const user = userEvent.setup();
    renderCart();
    await waitLoaded();

    await user.click(screen.getByText('add-to-cart'));

    expect(screen.getByTestId('action-result')).toHaveTextContent('Нет активной корзины');
    expect(salesApi.addItem).not.toHaveBeenCalled();
  });

  it('успех с data.data.created — увеличивает itemsCount и перезагружает список', async () => {
    localStorage.setItem('activeCartId', '1');
    salesApi.addItem.mockResolvedValue({ ok: true, data: { data: { created: true } } });
    const user = userEvent.setup();
    renderCart();
    await waitLoaded();
    salesApi.listCarts.mockClear();

    await user.click(screen.getByText('add-to-cart'));

    expect(salesApi.addItem).toHaveBeenCalledWith(1, { product: 5, quantity: 1 });
    await waitFor(() => expect(screen.getByTestId('items-count')).toHaveTextContent('1'));
    expect(salesApi.listCarts).toHaveBeenCalled();
  });

  it('успех без created — itemsCount не растёт, но список всё равно перезагружается', async () => {
    localStorage.setItem('activeCartId', '1');
    salesApi.addItem.mockResolvedValue({ ok: true, data: { data: { created: false } } });
    const user = userEvent.setup();
    renderCart();
    await waitLoaded();
    salesApi.listCarts.mockClear();

    await user.click(screen.getByText('add-to-cart'));

    await waitFor(() => expect(salesApi.listCarts).toHaveBeenCalled());
    expect(screen.getByTestId('items-count')).toHaveTextContent('0');
  });

  it('неудача не трогает itemsCount', async () => {
    localStorage.setItem('activeCartId', '1');
    salesApi.addItem.mockResolvedValue({ ok: false, data: {} });
    const user = userEvent.setup();
    renderCart();
    await waitLoaded();

    await user.click(screen.getByText('add-to-cart'));

    await waitFor(() => expect(screen.getByTestId('action-result')).toHaveTextContent('"ok":false'));
    expect(screen.getByTestId('items-count')).toHaveTextContent('0');
  });
});

describe('CartProvider — refreshCount', () => {
  it('no-op без активной корзины', async () => {
    const user = userEvent.setup();
    renderCart();
    await waitLoaded();

    await user.click(screen.getByText('refresh-count'));

    expect(salesApi.getCart).not.toHaveBeenCalled();
  });

  it('успех выставляет itemsCount = items.length', async () => {
    localStorage.setItem('activeCartId', '1');
    salesApi.getCart.mockResolvedValue({ ok: true, data: { items: [{}, {}, {}] } });
    const user = userEvent.setup();
    renderCart();
    await waitLoaded();

    await user.click(screen.getByText('refresh-count'));

    await waitFor(() => expect(screen.getByTestId('items-count')).toHaveTextContent('3'));
  });

  it('неудача не меняет itemsCount', async () => {
    localStorage.setItem('activeCartId', '1');
    salesApi.getCart.mockResolvedValue({ ok: false, data: {} });
    const user = userEvent.setup();
    renderCart();
    await waitLoaded();

    await user.click(screen.getByText('refresh-count'));
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByTestId('items-count')).toHaveTextContent('0');
  });
});

describe('useCart', () => {
  it('вне CartProvider бросает исключение', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Harness />)).toThrow('useCart must be used within CartProvider');
    spy.mockRestore();
  });
});
