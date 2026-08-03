import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import PackagingModal from '../PackagingModal';
import { bomApi } from '../../../api/bom';
import { catalogApi } from '../../../api/catalog';

vi.mock('../../../api/bom', () => ({
  bomApi: {
    getPackagingItems: vi.fn(),
    createPackagingItem: vi.fn(),
    updatePackagingItem: vi.fn(),
    deletePackagingItem: vi.fn(),
    getParts: vi.fn(),
    addPackagingMaterial: vi.fn(),
    removePackagingMaterial: vi.fn(),
    syncPackagingItems: vi.fn(),
    importPackagingFrom1C: vi.fn(),
    setPackaging: vi.fn(),
  },
}));
vi.mock('../../../api/catalog', () => ({ catalogApi: { searchProducts: vi.fn() } }));

const okList = (data) => ({ ok: true, data: { success: true, data } });

const item = (overrides = {}) => ({
  id: 1, name: 'Короб 600x400x300', length: 600, width: 400, height: 300,
  weight: 0, package_type: '', qty_on_pallet: 0, qty_in_order: 0, materials: [], ...overrides,
});

// Список тары (loadItems) грузится через setTimeout(300) ДАЖЕ на маунте (нет
// отдельного немедленного вызова) — используем fake timers на весь файл. Из-за
// этого userEvent (внутренне полагается на реальные таймеры) здесь не годится —
// последовательно виснет на каждом взаимодействии; используем fireEvent везде.
vi.useFakeTimers();

const advance300 = () => act(async () => { await vi.advanceTimersByTimeAsync(300); });

const renderModal = async (props = {}) => {
  const utils = render(<PackagingModal onClose={vi.fn()} {...props} />);
  await advance300();
  return utils;
};

const selectItem = async (packItem) => {
  bomApi.getPackagingItems.mockResolvedValue(okList([packItem]));
  await renderModal();
  fireEvent.click(screen.getByText(packItem.name));
};

const setValue = (el, value) => fireEvent.change(el, { target: { value } });

beforeEach(() => {
  vi.clearAllMocks();
  bomApi.getPackagingItems.mockResolvedValue(okList([]));
});

afterEach(() => {
  vi.clearAllTimers();
});

describe('PackagingModal — список тары', () => {
  it('пустой список после начальной загрузки — "Нет тары"', async () => {
    await renderModal();
    expect(screen.getByText(/Нет тары/)).toBeInTheDocument();
  });

  it('изменение поиска перезагружает список с debounce 300мс', async () => {
    await renderModal();
    bomApi.getPackagingItems.mockClear();

    setValue(screen.getByPlaceholderText('Поиск тары...'), 'Короб');
    await advance300();

    expect(bomApi.getPackagingItems).toHaveBeenCalledWith('Короб');
  });

  it('рендерит тару с габаритами/весом/типом и индикатором несинхронизированности', async () => {
    bomApi.getPackagingItems.mockResolvedValue(okList([
      item({ weight: 5.5, package_type: 'Kor', is_dirty: true }),
    ]));
    await renderModal();

    expect(screen.getByText('Короб 600x400x300')).toBeInTheDocument();
    expect(screen.getByText(/600×400×300 мм · 5.5 кг · Kor/)).toBeInTheDocument();
    expect(screen.getByTitle('Не синхронизировано с 1С')).toBeInTheDocument();
  });

  it('без выбора показывает подсказку', async () => {
    await renderModal();
    expect(screen.getByText('Выберите тару или создайте новую')).toBeInTheDocument();
  });

  it('"×" закрывает модалку', async () => {
    const onClose = vi.fn();
    await renderModal({ onClose });
    fireEvent.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('PackagingModal — создание тары (PackagingCreateForm)', () => {
  it('"+ Создать тару" открывает форму, повторный клик закрывает', async () => {
    await renderModal();

    fireEvent.click(screen.getByText('+ Создать тару'));
    expect(screen.getByText('Новая тара')).toBeInTheDocument();

    fireEvent.click(screen.getByText('✕ Отмена'));
    expect(screen.queryByText('Новая тара')).not.toBeInTheDocument();
  });

  it('пустое наименование — ошибка без вызова API', async () => {
    await renderModal();
    fireEvent.click(screen.getByText('+ Создать тару'));

    await act(async () => { fireEvent.click(screen.getByText('Создать')); });

    expect(screen.getByText('Укажите наименование')).toBeInTheDocument();
    expect(bomApi.createPackagingItem).not.toHaveBeenCalled();
  });

  it('успех парсит числовые поля и выбирает созданную тару', async () => {
    bomApi.createPackagingItem.mockResolvedValue(okList(item({ id: 9, name: 'Новая тара X' })));
    const { container } = await renderModal();
    fireEvent.click(screen.getByText('+ Создать тару'));

    setValue(screen.getByPlaceholderText('Точное наименование как в 1С'), 'Новая тара X');
    // label не связан с input через htmlFor — поля идут в фиксированном порядке
    // (длина/ширина/высота/масса/палета/заказ), берём первый number-инпут
    setValue(container.querySelectorAll('input[type="number"]')[0], '500');
    await act(async () => { fireEvent.click(screen.getByText('Создать')); await Promise.resolve(); await Promise.resolve(); });

    expect(bomApi.createPackagingItem).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Новая тара X', length: 500, width: 0, height: 0, weight: 0,
      qty_on_pallet: 0, qty_in_order: 0,
    }));
    await advance300(); // onSaved вызывает loadItems()
    expect(screen.getByText('Новая тара X')).toBeInTheDocument();
    expect(screen.queryByText('Новая тара')).not.toBeInTheDocument(); // форма закрыта
  });

  it('неудача показывает ошибку из ответа', async () => {
    bomApi.createPackagingItem.mockResolvedValue({ ok: false, data: { error: 'Такая тара уже есть' } });
    await renderModal();
    fireEvent.click(screen.getByText('+ Создать тару'));
    setValue(screen.getByPlaceholderText('Точное наименование как в 1С'), 'X');
    await act(async () => { fireEvent.click(screen.getByText('Создать')); await Promise.resolve(); await Promise.resolve(); });

    expect(screen.getByText('Такая тара уже есть')).toBeInTheDocument();
  });
});

describe('PackagingModal — детали тары (PackagingDetail)', () => {
  it('показывает габариты/вес(—)/тип/палета/заказ в режиме просмотра', async () => {
    await selectItem(item());

    expect(screen.getByText('Длина:')).toBeInTheDocument();
    expect(screen.getByText('600 мм')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1); // вес=0 → "—"
  });

  it('"Редактировать" открывает форму; сохранение вызывает updatePackagingItem', async () => {
    bomApi.updatePackagingItem.mockResolvedValue(okList(item({ length: 700 })));
    await selectItem(item());

    fireEvent.click(screen.getByText('Редактировать'));
    const lengthInputs = screen.getAllByDisplayValue('600');
    setValue(lengthInputs[0], '700');
    await act(async () => { fireEvent.click(screen.getByText('Сохранить')); await Promise.resolve(); await Promise.resolve(); });

    expect(bomApi.updatePackagingItem).toHaveBeenCalledWith(1, expect.objectContaining({ length: 700 }));
  });

  it('"Удалить" запрашивает подтверждение через showConfirm, вызывает deletePackagingItem только после подтверждения', async () => {
    bomApi.deletePackagingItem.mockResolvedValue(okList({}));
    await selectItem(item());

    fireEvent.click(screen.getByText('Удалить'));
    expect(bomApi.deletePackagingItem).not.toHaveBeenCalled();
    expect(screen.getByText('Удалить тару «Короб 600x400x300»?')).toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByText('Подтвердить')); await Promise.resolve(); await Promise.resolve(); });
    expect(bomApi.deletePackagingItem).toHaveBeenCalledWith(1);
    await advance300(); // onDeleted вызывает loadItems()
    expect(screen.getByText('Выберите тару или создайте новую')).toBeInTheDocument();
  });

  it('материалы: список explicit, поиск+добавление', async () => {
    bomApi.getParts.mockResolvedValue(okList([{ id: 5, onec_name: 'Скотч' }]));
    bomApi.addPackagingMaterial.mockResolvedValue(okList(item({ materials: [{ id: 1, part_name: 'Скотч', quantity: 1, unit: 'шт.' }] })));
    await selectItem(item({ materials: [] }));
    expect(screen.getByText('Нет материалов')).toBeInTheDocument();

    await act(async () => {
      setValue(screen.getByPlaceholderText('Добавить материал...'), 'Ско');
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(bomApi.getParts).toHaveBeenCalledWith({ q: 'Ско', limit: 10, is_synced: true });

    // Dropdown выбирает пункт через onMouseDown, а не onClick
    await act(async () => { fireEvent.mouseDown(screen.getByText('Скотч')); await Promise.resolve(); await Promise.resolve(); });

    expect(bomApi.addPackagingMaterial).toHaveBeenCalledWith(1, { part_id: 5 });
    await advance300(); // onUpdated вызывает loadItems()
    expect(screen.getByText('Материалы упаковки (1)')).toBeInTheDocument();
  });

  it('удаление материала вызывает removePackagingMaterial', async () => {
    bomApi.removePackagingMaterial.mockResolvedValue(okList(item({ materials: [] })));
    await selectItem(item({ materials: [{ id: 2, part_name: 'Плёнка', quantity: 3, unit: 'м' }] }));

    await act(async () => { fireEvent.click(screen.getByText('×')); await Promise.resolve(); });

    expect(bomApi.removePackagingMaterial).toHaveBeenCalledWith(1, 2);
  });
});

describe('PackagingModal — назначение тары на номенклатуру', () => {
  it('дебаунс 300мс на поиск номенклатуры, множественный выбор, удаление одной, очистка списка', async () => {
    catalogApi.searchProducts.mockResolvedValue({ ok: true, data: { success: true, data: [{ id: 1, name: 'КЭВ-1' }] } });
    await selectItem(item());

    setValue(screen.getByPlaceholderText('Начните вводить название...'), 'КЭ');
    await advance300();

    expect(catalogApi.searchProducts).toHaveBeenCalledWith('КЭ', { limit: 15 });
    fireEvent.mouseDown(screen.getByText('КЭВ-1')); // Dropdown выбирает через onMouseDown

    expect(screen.getByText('КЭВ-1', { selector: 'span' })).toBeInTheDocument(); // чип выбранной позиции

    fireEvent.click(screen.getByText('Очистить список'));
    // сама кнопка "Назначить тару" всегда в DOM (меняется только счётчик) —
    // пропадает список чипов вместе с кнопкой "Очистить список"
    expect(screen.queryByText('Очистить список')).not.toBeInTheDocument();
  });

  it('handleAssign вызывает setPackaging для каждой позиции, агрегирует успех/ошибки', async () => {
    catalogApi.searchProducts.mockResolvedValue({ ok: true, data: { success: true, data: [{ id: 1, name: 'КЭВ-1' }, { id: 2, name: 'КЭВ-2' }] } });
    bomApi.setPackaging.mockImplementation((name) =>
      Promise.resolve(name === 'КЭВ-1' ? okList({}) : { ok: false, data: { error: 'Не найдено' } })
    );
    await selectItem(item({ name: 'Короб A' }));

    setValue(screen.getByPlaceholderText('Начните вводить название...'), 'КЭ');
    await advance300();
    fireEvent.mouseDown(screen.getByText('КЭВ-1')); // Dropdown выбирает через onMouseDown

    setValue(screen.getByPlaceholderText('Начните вводить название...'), 'КЭ2');
    await advance300();
    fireEvent.mouseDown(screen.getByText('КЭВ-2'));

    await act(async () => {
      fireEvent.click(screen.getByText('Назначить тару (2)'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(bomApi.setPackaging).toHaveBeenCalledWith('КЭВ-1', 'Короб A');
    expect(bomApi.setPackaging).toHaveBeenCalledWith('КЭВ-2', 'Короб A');
    expect(screen.getByText('✓ 1 назначено, ✗ 1 ошибок')).toBeInTheDocument();
  });
});

describe('PackagingModal — синхронизация с 1С', () => {
  it('handleSync запрашивает подтверждение, вызывает sync+import, показывает сводку', async () => {
    bomApi.syncPackagingItems.mockResolvedValue({ ok: true, data: { data: { synced: 3 } } });
    bomApi.importPackagingFrom1C.mockResolvedValue({ ok: true, data: { data: { created: 2, updated: 1 } } });
    await renderModal();

    fireEvent.click(screen.getByText('⟳ Синхронизировать'));
    expect(bomApi.syncPackagingItems).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByText('Подтвердить'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(bomApi.syncPackagingItems).toHaveBeenCalled();
    expect(bomApi.importPackagingFrom1C).toHaveBeenCalled();
    expect(screen.getByText('Синхронизировано: 3 → 1С, импортировано: 2 новых, обновлено: 1')).toBeInTheDocument();
  });
});
