import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SyncModal from '../SyncModal';
import { bomApi } from '../../../api/bom';

vi.mock('../../../api/bom', () => ({
  bomApi: {
    getSyncConfigs: vi.fn(),
    getTaskStatus: vi.fn(),
    syncBomConfig: vi.fn(),
    syncParts: vi.fn(),
    syncNomenclatureFolders: vi.fn(),
    syncFolders: vi.fn(),
    syncFolder: vi.fn(),
  },
}));

const okList = (data) => ({ ok: true, data: { success: true, data } });
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  vi.clearAllMocks();
  bomApi.getSyncConfigs.mockResolvedValue(okList([]));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SyncModal (bom) — статические синхронизации', () => {
  it('рендерит три базовые кнопки и кнопку полной синхронизации', async () => {
    render(<SyncModal onClose={vi.fn()} onRefresh={vi.fn()} />);
    await flush();
    ['Номенклатура (Детали/Материалы)', 'Пути производства', 'Папки спецификаций', 'Полная синхронизация']
      .forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
  });

  it('nomenclature: успех без task_id — сразу success + onRefresh', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    bomApi.syncParts.mockResolvedValue({ ok: true, data: { success: true, data: {} } });
    render(<SyncModal onClose={vi.fn()} onRefresh={onRefresh} />);
    await flush();

    await user.click(screen.getByText('Номенклатура (Детали/Материалы)'));

    expect(bomApi.syncParts).toHaveBeenCalledWith('', 100);
    // сообщение дублируется у кнопки и в общем баннере снизу — оба читают globalMessage
    expect((await screen.findAllByText('Синхронизация номенклатуры завершена')).length).toBeGreaterThanOrEqual(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('production_folders: вызывает syncNomenclatureFolders("ПРОИЗВОДСТВО")', async () => {
    const user = userEvent.setup();
    bomApi.syncNomenclatureFolders.mockResolvedValue({ ok: true, data: { success: true, data: {} } });
    render(<SyncModal onClose={vi.fn()} onRefresh={vi.fn()} />);
    await flush();
    await user.click(screen.getByText('Пути производства'));
    expect(bomApi.syncNomenclatureFolders).toHaveBeenCalledWith('ПРОИЗВОДСТВО');
  });

  it('spec_folders: вызывает syncFolders()', async () => {
    const user = userEvent.setup();
    bomApi.syncFolders.mockResolvedValue({ ok: true, data: { success: true, data: {} } });
    render(<SyncModal onClose={vi.fn()} onRefresh={vi.fn()} />);
    await flush();
    await user.click(screen.getByText('Папки спецификаций'));
    expect(bomApi.syncFolders).toHaveBeenCalled();
  });

  it('all_bom: успех без task_id показывает "завершена" и очищается через 2с', async () => {
    vi.useFakeTimers();
    bomApi.syncFolder.mockResolvedValue({ ok: true, data: { success: true, data: {} } });
    render(<SyncModal onClose={vi.fn()} onRefresh={vi.fn()} />);
    await flush();

    await act(async () => {
      fireEvent.click(screen.getByText('Полная синхронизация'));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(bomApi.syncFolder).toHaveBeenCalledWith({});
    expect(screen.getAllByText('Полная синхронизация завершена').length).toBeGreaterThanOrEqual(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(screen.queryByText('Полная синхронизация завершена')).not.toBeInTheDocument();
  });

  it('неудача статической синхронизации показывает ошибку (фолбэк "Ошибка при запуске")', async () => {
    const user = userEvent.setup();
    bomApi.syncParts.mockResolvedValue({ ok: false, data: {} });
    render(<SyncModal onClose={vi.fn()} onRefresh={vi.fn()} />);
    await flush();
    await user.click(screen.getByText('Номенклатура (Детали/Материалы)'));
    expect((await screen.findAllByText('Ошибка при запуске')).length).toBeGreaterThanOrEqual(1);
  });

  it('anyPending блокирует статические кнопки, пока что-то выполняется', async () => {
    let resolveSync;
    bomApi.syncParts.mockReturnValue(new Promise((r) => { resolveSync = r; }));
    render(<SyncModal onClose={vi.fn()} onRefresh={vi.fn()} />);
    await flush();

    fireEvent.click(screen.getByText('Номенклатура (Детали/Материалы)'));
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText('Пути производства').closest('button')).toBeDisabled();
    expect(screen.getByText('Полная синхронизация').closest('button')).toBeDisabled();

    resolveSync({ ok: true, data: { success: true, data: {} } });
    await flush();
  });
});

describe('SyncModal (bom) — асинхронные задачи (task_id + поллинг)', () => {
  it('глобальное действие с task_id поллит getTaskStatus каждые 2с до готовности', async () => {
    vi.useFakeTimers();
    bomApi.syncParts.mockResolvedValue({ ok: true, data: { success: true, data: { task_id: 't1' } } });
    bomApi.getTaskStatus.mockResolvedValue({ ok: true, data: { success: true, data: { ready: true } } });
    const onRefresh = vi.fn();
    render(<SyncModal onClose={vi.fn()} onRefresh={onRefresh} />);
    await flush();

    await act(async () => {
      fireEvent.click(screen.getByText('Номенклатура (Детали/Материалы)'));
      await Promise.resolve();
      await Promise.resolve();
    });
    // handleSyncAction не обновляет globalMessage на "Выполняется..." для async-ветки —
    // сообщение остаётся тем же, что при запуске, пока поллинг не завершится.
    // Сообщение дублируется у кнопки и в общем баннере снизу — оба читают globalMessage
    expect(screen.getAllByText('Запуск: Синхронизация номенклатуры...').length).toBeGreaterThanOrEqual(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    expect(bomApi.getTaskStatus).toHaveBeenCalledWith('t1');
    expect(screen.getAllByText('Синхронизация номенклатуры завершена').length).toBeGreaterThanOrEqual(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // и она же самоочищается через 2с, как и синхронная ветка
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(screen.queryByText('Синхронизация номенклатуры завершена')).not.toBeInTheDocument();
  });

  it('FAILURE при поллинге показывает "Ошибка выполнения"', async () => {
    vi.useFakeTimers();
    bomApi.syncParts.mockResolvedValue({ ok: true, data: { success: true, data: { task_id: 't1' } } });
    bomApi.getTaskStatus.mockResolvedValue({ ok: true, data: { success: true, data: { ready: false, status: 'FAILURE' } } });
    render(<SyncModal onClose={vi.fn()} onRefresh={vi.fn()} />);
    await flush();

    await act(async () => {
      fireEvent.click(screen.getByText('Номенклатура (Детали/Материалы)'));
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    // текст дублируется у самой кнопки (globalStatus ? globalMessage : '') и в
    // общем баннере снизу ({globalMessage && ...}) — оба читают globalMessage
    expect(screen.getAllByText('Ошибка выполнения').length).toBeGreaterThanOrEqual(1);
  });

  it('не готово — продолжает опрашивать', async () => {
    vi.useFakeTimers();
    bomApi.syncParts.mockResolvedValue({ ok: true, data: { success: true, data: { task_id: 't1' } } });
    bomApi.getTaskStatus.mockResolvedValue({ ok: true, data: { success: true, data: { ready: false } } });
    render(<SyncModal onClose={vi.fn()} onRefresh={vi.fn()} />);
    await flush();

    await act(async () => {
      fireEvent.click(screen.getByText('Номенклатура (Детали/Материалы)'));
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(bomApi.getTaskStatus).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(bomApi.getTaskStatus).toHaveBeenCalledTimes(2);
  });
});

describe('SyncModal (bom) — динамические конфиги по папкам', () => {
  it('рендерит конфиги, гейтит запуск конкретного конфига независимо от anyPending статических кнопок', async () => {
    const user = userEvent.setup();
    bomApi.getSyncConfigs.mockResolvedValue(okList([
      { id: 1, name: 'Папка А', sync_type: 'bom_production' },
      { id: 2, name: 'Папка Б', sync_type: 'bom_materials' },
    ]));
    let resolveA;
    bomApi.syncBomConfig.mockImplementation((id) => id === 1 ? new Promise((r) => { resolveA = r; }) : Promise.resolve({ ok: true, data: { success: true, data: {} } }));
    const onRefresh = vi.fn();
    render(<SyncModal onClose={vi.fn()} onRefresh={onRefresh} />);
    await flush();

    expect(screen.getByText('Папка А')).toBeInTheDocument();
    expect(screen.getByText('Папка производства')).toBeInTheDocument();
    expect(screen.getByText('Папка Б')).toBeInTheDocument();
    expect(screen.getByText('Папка комплектации')).toBeInTheDocument();

    await user.click(screen.getByText('Папка А'));
    // Папка А "висит" в pending, но статические кнопки блокируются через anyPending —
    // проверим, что это действительно так (anyPending включает indiv. статусы конфигов)
    expect(screen.getByText('Пути производства').closest('button')).toBeDisabled();

    resolveA({ ok: true, data: { success: true, data: {} } });
    await flush();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('конфиг с task_id поллит статус так же, как глобальные действия', async () => {
    vi.useFakeTimers();
    bomApi.getSyncConfigs.mockResolvedValue(okList([{ id: 5, name: 'Папка В', sync_type: 'bom_materials' }]));
    bomApi.syncBomConfig.mockResolvedValue({ ok: true, data: { success: true, data: { task_id: 'tc5' } } });
    bomApi.getTaskStatus.mockResolvedValue({ ok: true, data: { success: true, data: { ready: true } } });
    render(<SyncModal onClose={vi.fn()} onRefresh={vi.fn()} />);
    await flush();

    await act(async () => {
      fireEvent.click(screen.getByText('Папка В'));
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    expect(bomApi.getTaskStatus).toHaveBeenCalledWith('tc5');
    expect(screen.getByText('✓ Завершено')).toBeInTheDocument();
  });

  it('неудачный запуск конкретного конфига показывает ошибку у этой кнопки', async () => {
    const user = userEvent.setup();
    bomApi.getSyncConfigs.mockResolvedValue(okList([{ id: 1, name: 'Папка А', sync_type: 'bom_production' }]));
    bomApi.syncBomConfig.mockResolvedValue({ ok: false, data: { error: 'Папка недоступна' } });
    render(<SyncModal onClose={vi.fn()} onRefresh={vi.fn()} />);
    await flush();

    await user.click(screen.getByText('Папка А'));
    expect(await screen.findByText('Папка недоступна')).toBeInTheDocument();
  });
});

describe('SyncModal (bom) — закрытие', () => {
  it('"✕" вызывает onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SyncModal onClose={onClose} onRefresh={vi.fn()} />);
    await flush();
    await user.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
