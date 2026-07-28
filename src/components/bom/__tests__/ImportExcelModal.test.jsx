import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImportExcelModal from '../ImportExcelModal';
import { bomApi } from '../../../api/bom';

vi.mock('../../../api/bom', () => ({ bomApi: { importFromExcel: vi.fn() } }));

const file = new File(['x'], 'route.xlsx');
const pick = (container) => fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ImportExcelModal', () => {
  it('кнопка "Импортировать" задизейблена без выбранного файла', () => {
    render(<ImportExcelModal onClose={vi.fn()} onImported={vi.fn()} />);
    expect(screen.getByText('Импортировать')).toBeDisabled();
  });

  it('успех без предупреждений и без разбиения вызывает onImported сразу', async () => {
    const onImported = vi.fn();
    bomApi.importFromExcel.mockResolvedValue({ ok: true, data: { success: true, meta: {}, data: { id: 1 } } });
    const { container } = render(<ImportExcelModal onClose={vi.fn()} onImported={onImported} />);
    pick(container);

    fireEvent.click(screen.getByText('Импортировать'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(bomApi.importFromExcel).toHaveBeenCalledWith(file);
    expect(onImported).toHaveBeenCalledWith({ id: 1 });
  });

  it('с предупреждениями показывает их сразу и вызывает onImported только через 2с', async () => {
    vi.useFakeTimers();
    const onImported = vi.fn();
    bomApi.importFromExcel.mockResolvedValue({
      ok: true, data: { success: true, meta: { warnings: ['Строка 3: дубликат'] }, data: { id: 1 } },
    });
    const { container } = render(<ImportExcelModal onClose={vi.fn()} onImported={onImported} />);
    pick(container);

    await act(async () => { fireEvent.click(screen.getByText('Импортировать')); await Promise.resolve(); await Promise.resolve(); });

    expect(screen.getByText('· Строка 3: дубликат')).toBeInTheDocument(); // WarningsList рендерит "· {w}"
    expect(onImported).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(onImported).toHaveBeenCalledWith({ id: 1 });
  });

  it('split=true вызывает onImported(data[0], true) после задержки, зависящей от наличия предупреждений', async () => {
    vi.useFakeTimers();
    const onImported = vi.fn();
    bomApi.importFromExcel.mockResolvedValue({
      ok: true,
      data: { success: true, split: true, meta: {}, data: [{ id: 1 }, { id: 2 }] },
    });
    const { container } = render(<ImportExcelModal onClose={vi.fn()} onImported={onImported} />);
    pick(container);

    await act(async () => { fireEvent.click(screen.getByText('Импортировать')); await Promise.resolve(); await Promise.resolve(); });
    // без предупреждений — задержка 0, но всё равно через таймер
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(onImported).toHaveBeenCalledWith({ id: 1 }, true);
  });

  it('неудача показывает ошибку и предупреждения из data.data.errors', async () => {
    bomApi.importFromExcel.mockResolvedValue({
      ok: true, data: { success: false, error: 'Неверный формат столбца', data: { errors: ['Лист 2: пусто'] } },
    });
    const { container } = render(<ImportExcelModal onClose={vi.fn()} onImported={vi.fn()} />);
    pick(container);

    fireEvent.click(screen.getByText('Импортировать'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(screen.getByText('Неверный формат столбца')).toBeInTheDocument();
    expect(screen.getByText('· Лист 2: пусто')).toBeInTheDocument();
  });

  it('"×" и "Отмена" вызывают onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ImportExcelModal onClose={onClose} onImported={vi.fn()} />);

    await user.click(screen.getByText('×'));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('Отмена'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
