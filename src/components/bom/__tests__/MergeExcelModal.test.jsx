import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MergeExcelModal from '../MergeExcelModal';
import { bomApi } from '../../../api/bom';

vi.mock('../../../api/bom', () => ({ bomApi: { mergeExcel: vi.fn() } }));

const file = new File(['x'], 'merge.xlsx');
const pick = (container) => fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MergeExcelModal', () => {
  it('вызывает mergeExcel(specId, file), показывает сводку и вызывает onMerged через 1.5с', async () => {
    vi.useFakeTimers();
    const onMerged = vi.fn();
    bomApi.mergeExcel.mockResolvedValue({
      ok: true, data: { success: true, meta: { added: 3, updated: 2, skipped: 1 }, data: { id: 5 } },
    });
    const { container } = render(<MergeExcelModal specId={5} onClose={vi.fn()} onMerged={onMerged} />);
    pick(container);

    await act(async () => { fireEvent.click(screen.getByText('Обновить')); await Promise.resolve(); await Promise.resolve(); });

    expect(bomApi.mergeExcel).toHaveBeenCalledWith(5, file);
    expect(screen.getByText('✓ Добавлено: 3')).toBeInTheDocument();
    expect(screen.getByText('↻ Обновлено: 2')).toBeInTheDocument();
    expect(screen.getByText('— Без изменений: 1')).toBeInTheDocument();
    expect(onMerged).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(onMerged).toHaveBeenCalledWith({ id: 5 });
  });

  it('показывает предупреждения из meta.warnings', async () => {
    bomApi.mergeExcel.mockResolvedValue({
      ok: true, data: { success: true, meta: { added: 0, updated: 0, skipped: 0, warnings: ['Дубликат строки'] }, data: {} },
    });
    const { container } = render(<MergeExcelModal specId={1} onClose={vi.fn()} onMerged={vi.fn()} />);
    pick(container);
    fireEvent.click(screen.getByText('Обновить'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(screen.getByText('· Дубликат строки')).toBeInTheDocument();
  });

  it('неудача показывает ошибку, не вызывает onMerged', async () => {
    const onMerged = vi.fn();
    bomApi.mergeExcel.mockResolvedValue({ ok: true, data: { success: false, error: 'Файл повреждён' } });
    const { container } = render(<MergeExcelModal specId={1} onClose={vi.fn()} onMerged={onMerged} />);
    pick(container);
    fireEvent.click(screen.getByText('Обновить'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(screen.getByText('Файл повреждён')).toBeInTheDocument();
    expect(onMerged).not.toHaveBeenCalled();
  });

  it('"×" вызывает onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<MergeExcelModal specId={1} onClose={onClose} onMerged={vi.fn()} />);
    await user.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
