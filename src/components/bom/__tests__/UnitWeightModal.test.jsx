import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UnitWeightModal from '../UnitWeightModal';
import { bomApi } from '../../../api/bom';

vi.mock('../../../api/bom', () => ({
  bomApi: { searchPartsUnitWeight: vi.fn(), savePartsUnitWeight: vi.fn() },
}));

const okList = (data) => ({ ok: true, data: { success: true, data } });

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('UnitWeightModal — поиск', () => {
  it('изначально предлагает ввести название для поиска', () => {
    render(<UnitWeightModal onClose={vi.fn()} />);
    expect(screen.getByText('Введите название для поиска')).toBeInTheDocument();
  });

  it('запрос короче 2 символов не ищет', async () => {
    vi.useFakeTimers();
    render(<UnitWeightModal onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Введите 2+ символа для поиска...'), { target: { value: 'А' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(bomApi.searchPartsUnitWeight).not.toHaveBeenCalled();
  });

  it('debounce 300мс, показывает "Поиск..." пока запрос не завершится, затем таблицу', async () => {
    vi.useFakeTimers();
    let resolveSearch;
    bomApi.searchPartsUnitWeight.mockReturnValue(new Promise((r) => { resolveSearch = r; }));
    render(<UnitWeightModal onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('Введите 2+ символа для поиска...'), { target: { value: 'Лист' } });
    // setSearching(true) выставляется внутри самого таймера (в момент старта запроса
    // спустя 300мс), не сразу по вводу — поэтому "Поиск..." появляется только после advance
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(bomApi.searchPartsUnitWeight).toHaveBeenCalledWith('Лист');
    expect(screen.getByText('Поиск...')).toBeInTheDocument();

    await act(async () => {
      resolveSearch(okList([{ id: 1, onec_name: 'Лист АЛР', unit: 'кг', unit_weight: 1.5 }]));
    });

    expect(screen.queryByText('Поиск...')).not.toBeInTheDocument();
    expect(screen.getByText('Лист АЛР')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1.5')).toBeInTheDocument();
  });

  it('пустой результат после поиска показывает "Ничего не найдено"', async () => {
    vi.useFakeTimers();
    bomApi.searchPartsUnitWeight.mockResolvedValue(okList([]));
    render(<UnitWeightModal onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Введите 2+ символа для поиска...'), { target: { value: 'ХХХ' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
  });

  it('показывает "—" для строки без base_unit/unit', async () => {
    vi.useFakeTimers();
    bomApi.searchPartsUnitWeight.mockResolvedValue(okList([{ id: 1, onec_name: 'X', unit_weight: null }]));
    render(<UnitWeightModal onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Введите 2+ символа для поиска...'), { target: { value: 'X' + 'X' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('UnitWeightModal — редактирование и сохранение', () => {
  const withResults = async () => {
    bomApi.searchPartsUnitWeight.mockResolvedValue(
      okList([{ id: 1, onec_name: 'Лист АЛР', unit: 'кг', unit_weight: null }])
    );
    render(<UnitWeightModal onClose={vi.fn()} />);
    await userEvent.setup().type(screen.getByPlaceholderText('Введите 2+ символа для поиска...'), 'Лист');
  };

  it('"Сохранить" задизейблена без изменений', async () => {
    await withResults();
    expect(await screen.findByText('Сохранить')).toBeDisabled();
  });

  it('изменение массы делает форму dirty и включает "Сохранить"', async () => {
    const user = userEvent.setup();
    await withResults();
    const weightInput = await screen.findByPlaceholderText('0.000000');

    await user.type(weightInput, '2.5');

    expect(screen.getByText('Сохранить')).toBeEnabled();
  });

  it('сохранение шлёт {id, unit_weight} (null для пустой строки), показывает "✓ Сохранено"', async () => {
    const user = userEvent.setup();
    bomApi.savePartsUnitWeight.mockResolvedValue({ ok: true, data: { success: true } });
    await withResults();
    const weightInput = await screen.findByPlaceholderText('0.000000');
    await user.type(weightInput, '2.5');

    await user.click(screen.getByText('Сохранить'));

    expect(bomApi.savePartsUnitWeight).toHaveBeenCalledWith([{ id: 1, unit_weight: 2.5 }]);
    expect(screen.getByText('✓ Сохранено')).toBeInTheDocument();
    expect(screen.getByText('Сохранить')).toBeDisabled(); // dirty сброшен
  });

  it('дальнейшее редактирование после сохранения сбрасывает "✓ Сохранено"', async () => {
    const user = userEvent.setup();
    bomApi.savePartsUnitWeight.mockResolvedValue({ ok: true, data: { success: true } });
    await withResults();
    const weightInput = await screen.findByPlaceholderText('0.000000');
    await user.type(weightInput, '2.5');
    await user.click(screen.getByText('Сохранить'));
    await screen.findByText('✓ Сохранено');

    await user.type(screen.getByPlaceholderText('0.000000'), '1');

    expect(screen.queryByText('✓ Сохранено')).not.toBeInTheDocument();
  });

  it('"×"/"Закрыть" вызывают onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<UnitWeightModal onClose={onClose} />);
    await user.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByText('Закрыть'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
