import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SpecEditorPage from '../SpecEditorPage';
import { sessionsApi } from '../../api/sessions';
import { catalogApi } from '../../api/catalog';
import { useAuth } from '../../contexts/AuthContext';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../api/auth', () => ({
  tokenStorage: { getAccess: vi.fn(() => 'fake-token') },
}));
vi.mock('../../api/sessions', () => ({
  sessionsApi: {
    create: vi.fn(),
    update: vi.fn(),
    activate: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock('../../api/catalog', () => ({
  catalogApi: { taskStatus: vi.fn() },
}));

const withPerms = (...perms) => ({ id: 1, permissions: perms });
const jsonResp = (body) => ({ json: () => Promise.resolve(body) });

const def1 = { id: 1, display_name: 'Длина' };
const def2 = { id: 2, display_name: 'Ширина' };

const parent1 = {
  id: 100, name: 'Изделие A', parent_id: null,
  specs: { 1: { spec_id: 10, value: '500', is_manual: false }, 2: { spec_id: 11, value: '', is_manual: false } },
};
const variant1 = {
  id: 101, name: 'Исполнение A1', parent_id: 100,
  specs: { 1: { spec_id: 12, value: '500', is_manual: false }, 2: {} },
};
const single1 = {
  id: 102, name: 'Изделие B', parent_id: null,
  specs: { 1: {}, 2: {} },
};

const makeData = (overrides = {}) => ({
  product_type_id: 5,
  definitions: [def1, def2],
  products: [parent1, variant1, single1],
  ...overrides,
});

// Роутер для сырого fetch: specs-bulk (загрузка), specs-bulk-save, push-to-1c.
const routeFetch = (overrides = {}) => (url) => {
  if (url.includes('specs-bulk-save')) {
    return Promise.resolve(jsonResp(overrides.save ?? { success: true, data: { created: 0, updated: 1, skipped: 0 } }));
  }
  if (url.includes('push-to-1c')) {
    return Promise.resolve(jsonResp(overrides.push ?? { success: true, data: { task_id: 'task-1', total: 2 } }));
  }
  if (url.includes('specs-bulk')) {
    return Promise.resolve(jsonResp(overrides.load ?? { success: true, data: makeData() }));
  }
  return Promise.resolve(jsonResp({}));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn(routeFetch()));
  useAuth.mockReturnValue({ user: withPerms() });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('SpecEditorPage — загрузка', () => {
  it('показывает загрузку, затем таблицу товаров/характеристик', async () => {
    let resolveFetch;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(r => { resolveFetch = r; })));
    render(<SpecEditorPage productIds={[100, 101, 102]} onBack={vi.fn()} />);
    expect(screen.getByText('Загрузка...')).toBeInTheDocument();

    resolveFetch(jsonResp({ success: true, data: makeData() }));
    expect(await screen.findByText('Изделие A')).toBeInTheDocument();
    expect(screen.getByText('Изделие B')).toBeInTheDocument();
    expect(screen.getByText('Длина')).toBeInTheDocument();
    expect(screen.getByText('Ширина')).toBeInTheDocument();
    expect(screen.getByText('3 изделий · 2 характеристик')).toBeInTheDocument();
  });

  it('ошибка загрузки (success:false) показывает сообщение', async () => {
    vi.stubGlobal('fetch', vi.fn(routeFetch({ load: { success: false, error: 'Нет доступа' } })));
    render(<SpecEditorPage productIds={[100]} onBack={vi.fn()} />);
    expect(await screen.findByText('Нет доступа')).toBeInTheDocument();
  });

  it('сетевая ошибка показывает "Ошибка сети"', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network'))));
    render(<SpecEditorPage productIds={[100]} onBack={vi.fn()} />);
    expect(await screen.findByText('Ошибка сети')).toBeInTheDocument();
  });

  it('сворачивание/разворачивание строк исполнений у родителя', async () => {
    const user = userEvent.setup();
    render(<SpecEditorPage productIds={[100, 101, 102]} onBack={vi.fn()} />);
    await screen.findByText('Изделие A');
    expect(screen.queryByText('Исполнение A1')).not.toBeInTheDocument();

    await user.click(screen.getByText('+'));
    expect(screen.getByText('Исполнение A1')).toBeInTheDocument();

    await user.click(screen.getByText('−'));
    expect(screen.queryByText('Исполнение A1')).not.toBeInTheDocument();
  });
});

describe('SpecEditorPage — редактирование ячейки', () => {
  it('правка ячейки помечает её изменённой и включает счётчик изменений', async () => {
    const user = userEvent.setup();
    render(<SpecEditorPage productIds={[100, 101, 102]} onBack={vi.fn()} />);
    await screen.findByText('Изделие A');
    // "Заполнять исполнения" включена по умолчанию — выключаем, чтобы проверить только
    // редактируемую ячейку без пропагации (она отдельно покрыта следующими тестами)
    await user.click(screen.getByText('Заполнять исполнения'));

    const input = screen.getAllByDisplayValue('500')[0];
    await user.clear(input);
    await user.type(input, '600');

    expect(await screen.findByText('Сохранить всё (1)')).toBeInTheDocument();
  });

  it('"Заполнять исполнения" копирует значение в исполнения родителя', async () => {
    const user = userEvent.setup();
    render(<SpecEditorPage productIds={[100, 101, 102]} onBack={vi.fn()} />);
    await screen.findByText('Изделие A');
    await user.click(screen.getByText('+'));
    await screen.findByText('Исполнение A1');

    const parentLengthInput = screen.getAllByDisplayValue('500')[0];
    await user.clear(parentLengthInput);
    await user.type(parentLengthInput, '700');

    // изменение и родителя, и исполнения (пропагация) — 2 записи в changes
    expect(await screen.findByText('Сохранить всё (2)')).toBeInTheDocument();
  });

  it('без галочки "Заполнять исполнения" правка родителя не трогает исполнения', async () => {
    const user = userEvent.setup();
    render(<SpecEditorPage productIds={[100, 101, 102]} onBack={vi.fn()} />);
    await screen.findByText('Изделие A');
    await user.click(screen.getByText('Заполнять исполнения'));
    await user.click(screen.getByText('+'));
    await screen.findByText('Исполнение A1');

    const parentLengthInput = screen.getAllByDisplayValue('500')[0];
    await user.clear(parentLengthInput);
    await user.type(parentLengthInput, '700');

    expect(await screen.findByText('Сохранить всё (1)')).toBeInTheDocument();
  });
});

describe('SpecEditorPage — сохранение всех изменений', () => {
  const makeChange = async (user) => {
    const input = screen.getAllByDisplayValue('500')[0];
    await user.clear(input);
    await user.type(input, '600');
    await screen.findByText(/Сохранить всё \(/);
  };

  it('кнопка задизейблена без изменений', async () => {
    render(<SpecEditorPage productIds={[100, 101, 102]} onBack={vi.fn()} />);
    await screen.findByText('Изделие A');
    expect(screen.getByText('Сохранить всё')).toBeDisabled();
  });

  it('успех: обновляет specs, показывает результат, сбрасывает изменения', async () => {
    const user = userEvent.setup();
    render(<SpecEditorPage productIds={[100, 101, 102]} onBack={vi.fn()} />);
    await screen.findByText('Изделие A');
    await makeChange(user);

    await user.click(screen.getByText(/Сохранить всё \(/));
    expect(await screen.findByText(/✓ Сохранено: 0 создано, 1 обновлено/)).toBeInTheDocument();
    expect(screen.getByText('Сохранить всё')).toBeDisabled();
  });

  it('ошибка (json error) показывает сообщение', async () => {
    vi.stubGlobal('fetch', vi.fn(routeFetch({ save: { success: false, error: 'Валидация не пройдена' } })));
    const user = userEvent.setup();
    render(<SpecEditorPage productIds={[100, 101, 102]} onBack={vi.fn()} />);
    await screen.findByText('Изделие A');
    await makeChange(user);
    await user.click(screen.getByText(/Сохранить всё \(/));
    expect(await screen.findByText('Валидация не пройдена')).toBeInTheDocument();
  });

  it('сетевая ошибка при сохранении показывает "Ошибка сети"', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.includes('specs-bulk-save')) return Promise.reject(new Error('down'));
      return routeFetch()(url);
    }));
    const user = userEvent.setup();
    render(<SpecEditorPage productIds={[100, 101, 102]} onBack={vi.fn()} />);
    await screen.findByText('Изделие A');
    await makeChange(user);
    await user.click(screen.getByText(/Сохранить всё \(/));
    expect(await screen.findByText('Ошибка сети')).toBeInTheDocument();
  });
});

describe('SpecEditorPage — черновик сессии', () => {
  it('без sessionId создаёт новую сессию, активирует и вызывает onSessionSaved', async () => {
    sessionsApi.create.mockResolvedValue({ id: 55 });
    sessionsApi.activate.mockResolvedValue({});
    const onSessionSaved = vi.fn();
    const user = userEvent.setup();
    render(<SpecEditorPage productIds={[100, 101, 102]} onBack={vi.fn()} onSessionSaved={onSessionSaved} />);
    await screen.findByText('Изделие A');

    await user.click(screen.getByText(/Сохранить черновик/));
    await waitFor(() => expect(sessionsApi.create).toHaveBeenCalledWith(
      'spec_editor', expect.any(String), expect.objectContaining({ page: 'spec-editor', product_ids: [100, 101, 102] })
    ));
    expect(sessionsApi.activate).toHaveBeenCalledWith(55);
    expect(onSessionSaved).toHaveBeenCalledWith(55);
    expect(await screen.findByText('✓ Черновик сохранён')).toBeInTheDocument();
  });

  it('с sessionId обновляет существующую сессию, не создаёт новую', async () => {
    sessionsApi.update.mockResolvedValue({});
    const user = userEvent.setup();
    render(<SpecEditorPage productIds={[100, 101, 102]} sessionId={77} onBack={vi.fn()} />);
    await screen.findByText('Изделие A');
    await user.click(screen.getByText(/Сохранить черновик/));

    await waitFor(() => expect(sessionsApi.update).toHaveBeenCalledWith(77, expect.objectContaining({
      data: expect.objectContaining({ page: 'spec-editor' }),
    })));
    expect(sessionsApi.create).not.toHaveBeenCalled();
  });
});

describe('SpecEditorPage — сброс сессии', () => {
  it('confirm() отклонён — onBack не вызывается, сессия не удаляется', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<SpecEditorPage productIds={[100]} sessionId={77} onBack={onBack} />);
    await screen.findByText('Изделие A');
    await user.click(screen.getByText('✕ Сбросить сессию'));
    expect(onBack).not.toHaveBeenCalled();
    expect(sessionsApi.remove).not.toHaveBeenCalled();
  });

  it('подтверждение удаляет черновик-сессию и вызывает onBack', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    sessionsApi.remove.mockResolvedValue({});
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<SpecEditorPage productIds={[100]} sessionId={77} onBack={onBack} />);
    await screen.findByText('Изделие A');
    await user.click(screen.getByText('✕ Сбросить сессию'));
    await waitFor(() => expect(sessionsApi.remove).toHaveBeenCalledWith(77));
    expect(onBack).toHaveBeenCalled();
  });

  it('кнопка сброса не показывается без активной сессии (draftSessionId)', async () => {
    render(<SpecEditorPage productIds={[100]} onBack={vi.fn()} />);
    await screen.findByText('Изделие A');
    expect(screen.queryByText('✕ Сбросить сессию')).not.toBeInTheDocument();
  });
});

describe('SpecEditorPage — выгрузка в 1С', () => {
  it('кнопка не видна без права catalog.push_to_1c', async () => {
    render(<SpecEditorPage productIds={[100]} onBack={vi.fn()} />);
    await screen.findByText('Изделие A');
    expect(screen.queryByText(/Выгрузить в 1С/)).not.toBeInTheDocument();
  });

  it('confirm() отклонён — запрос не отправляется', async () => {
    useAuth.mockReturnValue({ user: withPerms('catalog.push_to_1c') });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.stubGlobal('fetch', vi.fn(routeFetch()));
    const user = userEvent.setup();
    render(<SpecEditorPage productIds={[100, 101, 102]} onBack={vi.fn()} />);
    await screen.findByText('Изделие A');
    await user.click(screen.getByText(/Выгрузить в 1С/));
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('push-to-1c'), expect.anything());
  });

  it('успешный запуск поллит задачу до готовности и показывает результат', async () => {
    useAuth.mockReturnValue({ user: withPerms('catalog.push_to_1c') });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.stubGlobal('fetch', vi.fn(routeFetch()));
    catalogApi.taskStatus
      .mockResolvedValueOnce({ ok: true, data: { success: true, data: { ready: false } } })
      .mockResolvedValueOnce({
        ok: true,
        data: { success: true, data: { ready: true, result: { success: true, pushed: 2, total: 2, errors: [] } } },
      });

    render(<SpecEditorPage productIds={[100, 101, 102]} onBack={vi.fn()} />);
    await screen.findByText('Изделие A');

    // fake timers должны быть активны ДО клика — именно клик планирует setInterval,
    // а переключать реальный уже запланированный таймер на фейковый нельзя.
    // Once fake timers включены — весь ввод только через fireEvent (userEvent виснет).
    vi.useFakeTimers();
    fireEvent.click(screen.getByText(/Выгрузить в 1С/));

    await vi.waitFor(() => expect(screen.getByText(/Выгрузка запущена/)).toBeInTheDocument());
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.waitFor(() => expect(screen.getByText(/✓ Выгружено 2 из 2 товаров/)).toBeInTheDocument());
  });

  it('ошибка запуска показывает сообщение без поллинга', async () => {
    useAuth.mockReturnValue({ user: withPerms('catalog.push_to_1c') });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.stubGlobal('fetch', vi.fn(routeFetch({ push: { success: false, error: 'Нет связи с 1С' } })));
    const user = userEvent.setup();
    render(<SpecEditorPage productIds={[100, 101, 102]} onBack={vi.fn()} />);
    await screen.findByText('Изделие A');
    await user.click(screen.getByText(/Выгрузить в 1С/));
    expect(await screen.findByText('Нет связи с 1С')).toBeInTheDocument();
    expect(catalogApi.taskStatus).not.toHaveBeenCalled();
  });
});

// ── Модуль 20 / шаг 2: выделение/клавиатура/paste ─────────────────────────

// Плоский набор без родитель/исполнение-связей (все _isParent без вариантов) — избегаем
// нюанса, что data.products.length используется для клэмпа rowCount, а не visibleRows.length.
const flatA = { id: 200, name: 'П1', parent_id: null, specs: { 1: { spec_id: 20, value: '', is_manual: false }, 2: {} } };
const flatB = { id: 201, name: 'П2', parent_id: null, specs: { 1: {}, 2: {} } };
const flatC = { id: 202, name: 'П3', parent_id: null, specs: { 1: {}, 2: {} } };
const flatData = { product_type_id: 9, definitions: [def1, def2], products: [flatA, flatB, flatC] };

const getCell = (container, rowIdx, colIdx) =>
  container.querySelectorAll('tbody tr')[rowIdx].querySelectorAll('td')[colIdx + 1];
const isCellSelected = (cell) => cell.className.includes('bg-violet-100');

describe('SpecEditorPage — выделение мышью', () => {
  const gotoFlat = async () => {
    vi.stubGlobal('fetch', vi.fn(routeFetch({ load: { success: true, data: flatData } })));
    const utils = render(<SpecEditorPage productIds={[200, 201, 202]} onBack={vi.fn()} />);
    await screen.findByText('П1');
    return utils;
  };

  it('mouseDown выделяет одну ячейку', async () => {
    const { container } = await gotoFlat();
    fireEvent.mouseDown(getCell(container, 0, 0));
    expect(isCellSelected(getCell(container, 0, 0))).toBe(true);
    expect(await screen.findByText('Выделено: 1 ячеек — скопируйте значение и нажмите Ctrl+V')).toBeInTheDocument();
  });

  it('drag (mouseDown+mouseEnter) в одной колонке выделяет диапазон строк', async () => {
    const { container } = await gotoFlat();
    fireEvent.mouseDown(getCell(container, 0, 0));
    fireEvent.mouseEnter(getCell(container, 2, 0));
    expect(isCellSelected(getCell(container, 0, 0))).toBe(true);
    expect(isCellSelected(getCell(container, 1, 0))).toBe(true);
    expect(isCellSelected(getCell(container, 2, 0))).toBe(true);
    expect(isCellSelected(getCell(container, 2, 1))).toBe(false);
    fireEvent.mouseUp(document);
  });

  it('mouseEnter в другой колонке во время drag игнорируется', async () => {
    const { container } = await gotoFlat();
    fireEvent.mouseDown(getCell(container, 0, 0));
    fireEvent.mouseEnter(getCell(container, 1, 1));
    expect(isCellSelected(getCell(container, 1, 1))).toBe(false);
    expect(isCellSelected(getCell(container, 0, 0))).toBe(true);
  });

  it('Shift-клик расширяет диапазон от anchor в той же колонке', async () => {
    const { container } = await gotoFlat();
    fireEvent.mouseDown(getCell(container, 0, 0));
    fireEvent.mouseUp(document);
    fireEvent.click(getCell(container, 2, 0), { shiftKey: true });
    expect(isCellSelected(getCell(container, 0, 0))).toBe(true);
    expect(isCellSelected(getCell(container, 1, 0))).toBe(true);
    expect(isCellSelected(getCell(container, 2, 0))).toBe(true);
  });

  it('Ctrl-клик добавляет/снимает произвольную ячейку (в т.ч. в другой колонке)', async () => {
    const { container } = await gotoFlat();
    fireEvent.mouseDown(getCell(container, 0, 0));
    fireEvent.mouseUp(document);
    fireEvent.click(getCell(container, 1, 1), { ctrlKey: true });
    expect(isCellSelected(getCell(container, 0, 0))).toBe(true);
    expect(isCellSelected(getCell(container, 1, 1))).toBe(true);

    // повторный ctrl-клик по той же ячейке снимает её
    fireEvent.click(getCell(container, 1, 1), { ctrlKey: true });
    expect(isCellSelected(getCell(container, 1, 1))).toBe(false);
    expect(isCellSelected(getCell(container, 0, 0))).toBe(true);
  });

  it('клик вне таблицы сбрасывает выделение', async () => {
    const { container } = await gotoFlat();
    fireEvent.mouseDown(getCell(container, 0, 0));
    fireEvent.mouseUp(document);
    expect(isCellSelected(getCell(container, 0, 0))).toBe(true);

    fireEvent.mouseDown(document.body);
    expect(isCellSelected(getCell(container, 0, 0))).toBe(false);
  });
});

describe('SpecEditorPage — выделение с клавиатуры (регрессия бывшего краша)', () => {
  const gotoFlat = async () => {
    vi.stubGlobal('fetch', vi.fn(routeFetch({ load: { success: true, data: flatData } })));
    const utils = render(<SpecEditorPage productIds={[200, 201, 202]} onBack={vi.fn()} />);
    await screen.findByText('П1');
    return utils;
  };

  it('регрессия: клик по ячейке, затем ArrowDown/Up/Escape не крашат таблицу', async () => {
    const { container } = await gotoFlat();
    fireEvent.mouseDown(getCell(container, 0, 0));
    fireEvent.mouseUp(document);

    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(await screen.findByText('П3')).toBeInTheDocument(); // рендер не упал
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByText('Выделено: 0 ячеек — скопируйте значение и нажмите Ctrl+V')).toBeInTheDocument();
  });

  it('ArrowDown без Shift двигает курсор на одну ячейку вниз (клэмп на границе)', async () => {
    const { container } = await gotoFlat();
    fireEvent.mouseDown(getCell(container, 0, 0));
    fireEvent.mouseUp(document);

    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(isCellSelected(getCell(container, 0, 0))).toBe(false);
    expect(isCellSelected(getCell(container, 1, 0))).toBe(true);

    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'ArrowDown' }); // за границей (rowIdx=2 — последняя)
    expect(isCellSelected(getCell(container, 2, 0))).toBe(true);
  });

  it('Shift+ArrowDown расширяет диапазон от anchor', async () => {
    const { container } = await gotoFlat();
    fireEvent.mouseDown(getCell(container, 0, 0));
    fireEvent.mouseUp(document);

    fireEvent.keyDown(document, { key: 'ArrowDown', shiftKey: true });
    expect(isCellSelected(getCell(container, 0, 0))).toBe(true);
    expect(isCellSelected(getCell(container, 1, 0))).toBe(true);
    expect(isCellSelected(getCell(container, 2, 0))).toBe(false);

    fireEvent.keyDown(document, { key: 'ArrowDown', shiftKey: true });
    expect(isCellSelected(getCell(container, 2, 0))).toBe(true);
  });

  it('ArrowRight/Left переходят в соседнюю колонку, схлопывая в одну ячейку', async () => {
    const { container } = await gotoFlat();
    fireEvent.mouseDown(getCell(container, 1, 0));
    fireEvent.mouseUp(document);

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(isCellSelected(getCell(container, 1, 1))).toBe(true);
    expect(isCellSelected(getCell(container, 1, 0))).toBe(false);

    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(isCellSelected(getCell(container, 1, 0))).toBe(true);

    // за левой границей (только 2 колонки, defIdx=0) — no-op
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(isCellSelected(getCell(container, 1, 0))).toBe(true);
  });

  it('клавиатура игнорируется при фокусе в input', async () => {
    const { container } = await gotoFlat();
    fireEvent.mouseDown(getCell(container, 0, 0));
    fireEvent.mouseUp(document);

    const input = getCell(container, 1, 0).querySelector('input');
    input.focus();
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    // выделение не изменилось (клавиатура проигнорирована — фокус в input)
    expect(isCellSelected(getCell(container, 0, 0))).toBe(true);
  });
});

describe('SpecEditorPage — paste в выделенные ячейки', () => {
  const gotoFlat = async () => {
    vi.stubGlobal('fetch', vi.fn(routeFetch({ load: { success: true, data: flatData } })));
    const utils = render(<SpecEditorPage productIds={[200, 201, 202]} onBack={vi.fn()} />);
    await screen.findByText('П1');
    return utils;
  };

  it('вставка применяет буфер обмена ко всем выделенным ячейкам', async () => {
    const { container } = await gotoFlat();
    fireEvent.mouseDown(getCell(container, 0, 0));
    fireEvent.mouseEnter(getCell(container, 1, 0));
    fireEvent.mouseUp(document);

    fireEvent.paste(document, { clipboardData: { getData: () => '123' } });

    const row0Input = getCell(container, 0, 0).querySelector('input');
    const row1Input = getCell(container, 1, 0).querySelector('input');
    expect(row0Input).toHaveValue('123');
    expect(row1Input).toHaveValue('123');
    expect(await screen.findByText('Сохранить всё (2)')).toBeInTheDocument();
  });

  it('пустой буфер обмена — no-op', async () => {
    const { container } = await gotoFlat();
    fireEvent.mouseDown(getCell(container, 0, 0));
    fireEvent.mouseUp(document);
    fireEvent.paste(document, { clipboardData: { getData: () => '   ' } });
    expect(screen.getByText('Сохранить всё')).toBeDisabled();
  });

  it('без выделения — paste ничего не делает', async () => {
    await gotoFlat();
    fireEvent.paste(document, { clipboardData: { getData: () => '999' } });
    expect(screen.getByText('Сохранить всё')).toBeDisabled();
  });
});
