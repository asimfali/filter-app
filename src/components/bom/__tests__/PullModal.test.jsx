import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PullModal from '../PullModal';
import { bomApi } from '../../../api/bom';
import { catalogApi } from '../../../api/catalog';

vi.mock('../../../api/bom', () => ({ bomApi: { pullSpec: vi.fn() } }));
vi.mock('../../../api/catalog', () => ({ catalogApi: { searchProducts: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PullModal — режим "по изделию" (поиск в каталоге)', () => {
  it('запрос короче 2 символов не ищет', async () => {
    vi.useFakeTimers();
    render(<PullModal onClose={vi.fn()} onPulled={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('КЭВ-4П1141Е'), { target: { value: 'К' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(catalogApi.searchProducts).not.toHaveBeenCalled();
  });

  it('debounce 250мс, показывает подсказки, "···" пока идёт поиск', async () => {
    vi.useFakeTimers();
    catalogApi.searchProducts.mockResolvedValue({ ok: true, data: { data: [{ id: 1, name: 'КЭВ-4П1141Е', sku: 'A1' }] } });
    render(<PullModal onClose={vi.fn()} onPulled={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('КЭВ-4П1141Е'), { target: { value: 'КЭВ' } });
    expect(screen.getByText('···')).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(250); });

    expect(catalogApi.searchProducts).toHaveBeenCalledWith('КЭВ', { limit: 10 });
    expect(screen.getByText('КЭВ-4П1141Е')).toBeInTheDocument();
    expect(screen.getByText('A1')).toBeInTheDocument();
  });

  it('выбор подсказки заполняет значение и скрывает список', async () => {
    vi.useFakeTimers();
    catalogApi.searchProducts.mockResolvedValue({ ok: true, data: { data: [{ id: 1, name: 'КЭВ-4П1141Е' }] } });
    render(<PullModal onClose={vi.fn()} onPulled={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('КЭВ-4П1141Е'), { target: { value: 'КЭВ' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });

    fireEvent.click(screen.getByText('КЭВ-4П1141Е'));

    expect(screen.getByPlaceholderText('КЭВ-4П1141Е')).toHaveValue('КЭВ-4П1141Е');
    expect(screen.queryByRole('button', { name: 'КЭВ-4П1141Е' })).not.toBeInTheDocument();
  });

  it('переключение режима сбрасывает значение/подсказки/ошибку', async () => {
    const user = userEvent.setup();
    render(<PullModal onClose={vi.fn()} onPulled={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('КЭВ-4П1141Е'), 'КЭВ');

    await user.click(screen.getByText('По имени спецификации'));

    expect(screen.getByPlaceholderText('КЭВ-4П1141Е(Сборка)')).toHaveValue('');
  });
});

describe('PullModal — загрузка спецификации', () => {
  it('кнопка "Загрузить" задизейблена без значения', () => {
    render(<PullModal onClose={vi.fn()} onPulled={vi.fn()} />);
    expect(screen.getByText('Загрузить')).toBeDisabled();
  });

  it('режим "по изделию" шлёт {product_name}; успех вызывает onPulled', async () => {
    const user = userEvent.setup();
    const onPulled = vi.fn();
    bomApi.pullSpec.mockResolvedValue({ ok: true, data: { success: true, data: { id: 7 } } });
    render(<PullModal onClose={vi.fn()} onPulled={onPulled} />);

    await user.type(screen.getByPlaceholderText('КЭВ-4П1141Е'), 'КЭВ-4П1141Е');
    await user.click(screen.getByText('Загрузить'));

    expect(bomApi.pullSpec).toHaveBeenCalledWith({ product_name: 'КЭВ-4П1141Е' });
    expect(onPulled).toHaveBeenCalledWith({ id: 7 });
  });

  it('режим "по имени спецификации" шлёт {name}', async () => {
    const user = userEvent.setup();
    bomApi.pullSpec.mockResolvedValue({ ok: true, data: { success: true, data: {} } });
    render(<PullModal onClose={vi.fn()} onPulled={vi.fn()} />);

    await user.click(screen.getByText('По имени спецификации'));
    await user.type(screen.getByPlaceholderText('КЭВ-4П1141Е(Сборка)'), 'КЭВ-4П1141Е(Сборка)');
    await user.click(screen.getByText('Загрузить'));

    expect(bomApi.pullSpec).toHaveBeenCalledWith({ name: 'КЭВ-4П1141Е(Сборка)' });
  });

  it('неудача показывает ошибку (фолбэк "Ошибка загрузки")', async () => {
    const user = userEvent.setup();
    bomApi.pullSpec.mockResolvedValue({ ok: false, data: {} });
    render(<PullModal onClose={vi.fn()} onPulled={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('КЭВ-4П1141Е'), 'X');
    await user.click(screen.getByText('Загрузить'));

    expect(await screen.findByText('Ошибка загрузки')).toBeInTheDocument();
  });

  it('Enter отправляет форму, только если список подсказок пуст', async () => {
    vi.useFakeTimers();
    catalogApi.searchProducts.mockResolvedValue({ ok: true, data: { data: [{ id: 1, name: 'КЭВ-подсказка' }] } });
    bomApi.pullSpec.mockResolvedValue({ ok: true, data: { success: true, data: {} } });
    render(<PullModal onClose={vi.fn()} onPulled={vi.fn()} />);
    const input = screen.getByPlaceholderText('КЭВ-4П1141Е');

    fireEvent.change(input, { target: { value: 'КЭ' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(screen.getByText('КЭВ-подсказка')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(bomApi.pullSpec).not.toHaveBeenCalled(); // подсказки ещё показаны

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('КЭВ-подсказка')).not.toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Enter' });
    await act(async () => { await Promise.resolve(); });
    expect(bomApi.pullSpec).toHaveBeenCalledWith({ product_name: 'КЭ' });
  });

  it('"×" вызывает onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PullModal onClose={onClose} onPulled={vi.fn()} />);
    await user.click(screen.getByText('×'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
