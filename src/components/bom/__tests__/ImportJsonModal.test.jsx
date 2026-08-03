import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImportJsonModal from '../ImportJsonModal';
import { bomApi } from '../../../api/bom';

vi.mock('../../../api/bom', () => ({ bomApi: { mergeJson: vi.fn() } }));

const file = new File(['{}'], 'data.json');
const pick = (container) => fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ImportJsonModal — без ошибок в meta', () => {
  it('успех без meta.errors: сводка + автозакрытие через onMerged(data) за 1.5с', async () => {
    vi.useFakeTimers();
    const onMerged = vi.fn();
    bomApi.mergeJson.mockResolvedValue({
      ok: true, data: { success: true, meta: { added: 2, updated: 1, skipped: 0 }, data: { id: 3 } },
    });
    const { container } = render(<ImportJsonModal specId={3} onClose={vi.fn()} onMerged={onMerged} />);
    pick(container);

    await act(async () => { fireEvent.click(screen.getByText('Импортировать')); await Promise.resolve(); await Promise.resolve(); });

    expect(bomApi.mergeJson).toHaveBeenCalledWith(3, file);
    expect(screen.getByText('✓ Добавлено: 2')).toBeInTheDocument();
    expect(onMerged).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(onMerged).toHaveBeenCalledWith({ id: 3 });
  });
});

describe('ImportJsonModal — с ошибками в meta (не закрывается автоматически)', () => {
  const withErrors = () => ({
    ok: true,
    data: {
      success: true,
      meta: { added: 1, updated: 0, skipped: 0, errors: ['КЭВ-999: не найден в номенклатуре'] },
      data: { id: 4 },
    },
  });

  it('не вызывает onMerged автоматически, скрывает кнопку импорта, меняет closeLabel на "Закрыть"', async () => {
    const onMerged = vi.fn();
    bomApi.mergeJson.mockResolvedValue(withErrors());
    const { container } = render(<ImportJsonModal specId={4} onClose={vi.fn()} onMerged={onMerged} />);
    pick(container);
    fireEvent.click(screen.getByText('Импортировать'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(screen.getByText('Не найдено в номенклатуре (1):')).toBeInTheDocument();
    expect(screen.getByText('· КЭВ-999: не найден в номенклатуре')).toBeInTheDocument();
    expect(screen.queryByText('Импортировать')).not.toBeInTheDocument();
    expect(screen.getByText('Закрыть')).toBeInTheDocument();
    expect(onMerged).not.toHaveBeenCalled();
  });

  it('клик "Закрыть" вызывает onMerged(null), если что-то реально добавилось/обновилось, затем onClose', async () => {
    const user = userEvent.setup();
    const onMerged = vi.fn();
    const onClose = vi.fn();
    bomApi.mergeJson.mockResolvedValue(withErrors()); // added: 1
    const { container } = render(<ImportJsonModal specId={4} onClose={onClose} onMerged={onMerged} />);
    pick(container);
    await user.click(screen.getByText('Импортировать'));
    await screen.findByText('Закрыть');

    await user.click(screen.getByText('Закрыть'));

    expect(onMerged).toHaveBeenCalledWith(null);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('клик "Закрыть" не вызывает onMerged, если added=0 и updated=0', async () => {
    const user = userEvent.setup();
    const onMerged = vi.fn();
    bomApi.mergeJson.mockResolvedValue({
      ok: true,
      data: { success: true, meta: { added: 0, updated: 0, errors: ['Ничего не подошло'] }, data: {} },
    });
    const { container } = render(<ImportJsonModal specId={4} onClose={vi.fn()} onMerged={onMerged} />);
    pick(container);
    await user.click(screen.getByText('Импортировать'));
    await screen.findByText('Закрыть');

    await user.click(screen.getByText('Закрыть'));

    expect(onMerged).not.toHaveBeenCalled();
  });
});

describe('ImportJsonModal — до отправки и ошибка запроса', () => {
  it('до submit — closeLabel="Отмена", клик просто закрывает без onMerged', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMerged = vi.fn();
    render(<ImportJsonModal specId={1} onClose={onClose} onMerged={onMerged} />);

    await user.click(screen.getByText('Отмена'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMerged).not.toHaveBeenCalled();
  });

  it('неудачный запрос показывает ошибку, meta не выставляется (кнопка импорта остаётся)', async () => {
    bomApi.mergeJson.mockResolvedValue({ ok: true, data: { success: false, error: 'Битый JSON' } });
    const { container } = render(<ImportJsonModal specId={1} onClose={vi.fn()} onMerged={vi.fn()} />);
    pick(container);
    fireEvent.click(screen.getByText('Импортировать'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(screen.getByText('Битый JSON')).toBeInTheDocument();
    expect(screen.getByText('Импортировать')).toBeInTheDocument();
    expect(screen.getByText('Отмена')).toBeInTheDocument();
  });
});
