import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccessoryKitsPage from '../AccessoryKitsPage';
import { mediaApi } from '../../api/media';
import { catalogApi } from '../../api/catalog';
import { useAuth } from '../../contexts/AuthContext';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../api/media', () => ({
  mediaApi: {
    getAccessoryKits: vi.fn(),
    createAccessoryKit: vi.fn(),
    updateAccessoryKit: vi.fn(),
    deleteAccessoryKit: vi.fn(),
    getFormData: vi.fn(),
    addAccessoryKitItem: vi.fn(),
    updateAccessoryKitItem: vi.fn(),
    deleteAccessoryKitItem: vi.fn(),
    createAccessoryKitRule: vi.fn(),
    deleteAccessoryKitRule: vi.fn(),
    addAccessoryKitRuleItem: vi.fn(),
    deleteAccessoryKitRuleItem: vi.fn(),
  },
}));
vi.mock('../../api/catalog', () => ({
  catalogApi: { searchProducts: vi.fn() },
}));
vi.mock('../../components/media/FiltersPanel', () => ({
  default: ({ entityId, entityType, canWrite }) => (
    <div data-testid="filters-panel" data-entity-id={entityId} data-entity-type={entityType} data-can-write={String(canWrite)} />
  ),
}));
vi.mock('../../components/media/DirectProductsPanel', () => ({
  default: ({ entityId, entityType, canWrite }) => (
    <div data-testid="direct-products-panel" data-entity-id={entityId} data-entity-type={entityType} data-can-write={String(canWrite)} />
  ),
}));

const withPerms = (...perms) => ({ id: 1, permissions: perms });
const ok = (data) => ({ ok: true, data });

// Фабрики, а не константы: AccessoryKitCard.handleSaveName мутирует item.name напрямую,
// общий объект между тестами протёк бы переименование из одного теста в другой.
const makeKit1 = () => ({ id: 10, name: 'Автоматика базовая', description: 'Базовый набор', items: [], rules: [], filters: [] });
const makeKit2 = () => ({ id: 11, name: 'Насосная группа', description: '', items: [], rules: [], filters: [] });

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ user: withPerms('catalog.accessory.write') });
  mediaApi.getAccessoryKits.mockResolvedValue(ok({ data: [] }));
  mediaApi.getFormData.mockResolvedValue(ok({ axes: [] }));
});

describe('AccessoryKitsPage — список/загрузка/права', () => {
  it('показывает индикатор загрузки, затем пустой список с кнопкой создания', async () => {
    let resolveLoad;
    mediaApi.getAccessoryKits.mockReturnValue(new Promise(r => { resolveLoad = r; }));
    render(<AccessoryKitsPage />);
    expect(screen.getByText('Загрузка...')).toBeInTheDocument();

    resolveLoad(ok({ data: [] }));
    expect(await screen.findByText('Наборов пока нет')).toBeInTheDocument();
    expect(screen.getByText('+ Создать первый набор')).toBeInTheDocument();
  });

  it('ошибка загрузки показывает сообщение об ошибке', async () => {
    mediaApi.getAccessoryKits.mockResolvedValue({ ok: false, data: {} });
    render(<AccessoryKitsPage />);
    expect(await screen.findByText('Ошибка загрузки')).toBeInTheDocument();
  });

  it('рендерит список наборов со счётчиком', async () => {
    mediaApi.getAccessoryKits.mockResolvedValue(ok({ data: [makeKit1(), makeKit2()] }));
    render(<AccessoryKitsPage />);
    expect(await screen.findByText('Автоматика базовая')).toBeInTheDocument();
    expect(screen.getByText('Насосная группа')).toBeInTheDocument();
    expect(screen.getByText('2 наборов')).toBeInTheDocument();
  });

  it('поиск фильтрует по имени и описанию, "Сбросить ×" очищает', async () => {
    mediaApi.getAccessoryKits.mockResolvedValue(ok({ data: [makeKit1(), makeKit2()] }));
    const user = userEvent.setup();
    render(<AccessoryKitsPage />);
    await screen.findByText('Автоматика базовая');

    await user.type(screen.getByPlaceholderText('Поиск по названию...'), 'насос');
    expect(screen.queryByText('Автоматика базовая')).not.toBeInTheDocument();
    expect(screen.getByText('Насосная группа')).toBeInTheDocument();

    await user.click(screen.getByText('Сбросить ×'));
    expect(screen.getByText('Автоматика базовая')).toBeInTheDocument();
  });

  it('пустой результат поиска показывает "Ничего не найдено" без кнопки создания', async () => {
    mediaApi.getAccessoryKits.mockResolvedValue(ok({ data: [makeKit1()] }));
    const user = userEvent.setup();
    render(<AccessoryKitsPage />);
    await screen.findByText('Автоматика базовая');
    await user.type(screen.getByPlaceholderText('Поиск по названию...'), 'zzz');
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
    expect(screen.queryByText('+ Создать первый набор')).not.toBeInTheDocument();
  });

  it('без права catalog.accessory.write: нет кнопки создания нигде', async () => {
    useAuth.mockReturnValue({ user: withPerms() });
    mediaApi.getAccessoryKits.mockResolvedValue(ok({ data: [] }));
    render(<AccessoryKitsPage />);
    await screen.findByText('Наборов пока нет');
    expect(screen.queryByText('+ Создать набор')).not.toBeInTheDocument();
    expect(screen.queryByText('+ Создать первый набор')).not.toBeInTheDocument();
  });
});

describe('AccessoryKitsPage — KitCreateForm', () => {
  const openForm = async () => {
    const user = userEvent.setup();
    render(<AccessoryKitsPage />);
    await screen.findByText('Наборов пока нет');
    await user.click(screen.getByText('+ Создать набор'));
    return user;
  };

  it('кнопка "Создать" задизейблена без имени', async () => {
    await openForm();
    expect(screen.getByText('Создать')).toBeDisabled();
  });

  it('успешное создание вызывает reload и закрывает форму', async () => {
    mediaApi.createAccessoryKit.mockResolvedValue({ ok: true, data: { success: true, data: { id: 20, name: 'Новый' } } });
    mediaApi.getAccessoryKits.mockResolvedValueOnce(ok({ data: [] }));
    const user = await openForm();
    await user.type(screen.getByPlaceholderText('Автоматика базовая серия 100 E'), 'Новый набор');

    mediaApi.getAccessoryKits.mockResolvedValue(ok({ data: [{ id: 20, name: 'Новый набор', items: [], rules: [], filters: [] }] }));
    await user.click(screen.getByText('Создать'));

    await waitFor(() => expect(mediaApi.createAccessoryKit).toHaveBeenCalledWith({ name: 'Новый набор', description: '' }));
    expect(await screen.findByText('Новый набор')).toBeInTheDocument();
    expect(screen.queryByText('Новый набор комплектующих')).not.toBeInTheDocument();
  });

  it('ошибка сохранения показывает data.error или дефолтный текст', async () => {
    mediaApi.createAccessoryKit.mockResolvedValue({ ok: true, data: { success: false, error: 'Уже существует' } });
    const user = await openForm();
    await user.type(screen.getByPlaceholderText('Автоматика базовая серия 100 E'), 'X');
    await user.click(screen.getByText('Создать'));
    expect(await screen.findByText('Уже существует')).toBeInTheDocument();

    mediaApi.createAccessoryKit.mockResolvedValue({ ok: false, data: {} });
    await user.click(screen.getByText('Создать'));
    expect(await screen.findByText('Ошибка сохранения')).toBeInTheDocument();
  });

  it('"Отмена" закрывает форму без сохранения', async () => {
    const user = await openForm();
    await user.click(screen.getByText('Отмена'));
    expect(screen.queryByText('Новый набор комплектующих')).not.toBeInTheDocument();
    expect(mediaApi.createAccessoryKit).not.toHaveBeenCalled();
  });
});

describe('AccessoryKitsPage — AccessoryKitCard', () => {
  const gotoCard = async () => {
    mediaApi.getAccessoryKits.mockResolvedValue(ok({ data: [makeKit1()] }));
    const user = userEvent.setup();
    render(<AccessoryKitsPage />);
    await screen.findByText('Автоматика базовая');
    return user;
  };

  it('рендерит замоканные FiltersPanel/DirectProductsPanel с корректными пропсами', async () => {
    await gotoCard();
    const filtersPanel = screen.getByTestId('filters-panel');
    expect(filtersPanel).toHaveAttribute('data-entity-id', '10');
    expect(filtersPanel).toHaveAttribute('data-entity-type', 'accessory-kit');
    expect(filtersPanel).toHaveAttribute('data-can-write', 'true');

    const directPanel = screen.getByTestId('direct-products-panel');
    expect(directPanel).toHaveAttribute('data-entity-id', '10');
    expect(directPanel).toHaveAttribute('data-entity-type', 'accessory-kit');
  });

  it('редактирование названия: Enter сохраняет через updateAccessoryKit', async () => {
    mediaApi.updateAccessoryKit.mockResolvedValue({ ok: true });
    const user = await gotoCard();
    await user.click(screen.getByText('✎'));
    const input = screen.getByDisplayValue('Автоматика базовая');
    await user.clear(input);
    await user.type(input, 'Новое имя{enter}');

    await waitFor(() => expect(mediaApi.updateAccessoryKit).toHaveBeenCalledWith(10, { name: 'Новое имя' }));
  });

  it('Escape отменяет редактирование без сохранения', async () => {
    const user = await gotoCard();
    await user.click(screen.getByText('✎'));
    const input = screen.getByDisplayValue('Автоматика базовая');
    await user.type(input, '2{escape}');
    expect(screen.queryByDisplayValue(/Автоматика базовая2/)).not.toBeInTheDocument();
    expect(mediaApi.updateAccessoryKit).not.toHaveBeenCalled();
  });

  it('пустое/неизменённое имя не сохраняет (закрывает редактирование без запроса)', async () => {
    const user = await gotoCard();
    await user.click(screen.getByText('✎'));
    expect(screen.getByDisplayValue('Автоматика базовая')).toBeInTheDocument();
    await user.click(screen.getByText('✓'));
    expect(mediaApi.updateAccessoryKit).not.toHaveBeenCalled();
  });

  it('двухшаговое удаление: первый клик просит подтверждение, "Отмена" отменяет', async () => {
    const user = await gotoCard();
    const deleteButtons = screen.getAllByText('✕');
    await user.click(deleteButtons[0]);
    expect(screen.getByText('Удалить?')).toBeInTheDocument();

    await user.click(screen.getByText('Отмена'));
    expect(screen.queryByText('Удалить?')).not.toBeInTheDocument();
    expect(mediaApi.deleteAccessoryKit).not.toHaveBeenCalled();
  });

  it('второй клик подтверждает удаление, успех вызывает reload', async () => {
    mediaApi.deleteAccessoryKit.mockResolvedValue({ ok: true });
    mediaApi.getAccessoryKits.mockResolvedValueOnce(ok({ data: [makeKit1()] }));
    const user = await gotoCard();
    await user.click(screen.getAllByText('✕')[0]);
    mediaApi.getAccessoryKits.mockResolvedValue(ok({ data: [] }));
    await user.click(screen.getByText('Удалить?'));

    await waitFor(() => expect(mediaApi.deleteAccessoryKit).toHaveBeenCalledWith(10));
    expect(await screen.findByText('Наборов пока нет')).toBeInTheDocument();
  });

  it('неуспешное удаление сбрасывает подтверждение (карточка остаётся)', async () => {
    mediaApi.deleteAccessoryKit.mockResolvedValue({ ok: false });
    const user = await gotoCard();
    await user.click(screen.getAllByText('✕')[0]);
    await user.click(screen.getByText('Удалить?'));

    await waitFor(() => expect(screen.queryByText('Удалить?')).not.toBeInTheDocument());
    expect(screen.getByText('Автоматика базовая')).toBeInTheDocument();
  });

  it('без права catalog.accessory.write: нет ✎/✕ на карточке', async () => {
    useAuth.mockReturnValue({ user: withPerms() });
    await gotoCard();
    expect(screen.queryByText('✎')).not.toBeInTheDocument();
    expect(screen.queryByText('✕')).not.toBeInTheDocument();
  });
});

// ── Модуль 17 / шаг 2: QuantityEditor + KitItemsPanel + Rules ─────────────

const product1 = { id: 500, name: 'Термостат комнатный', sku: 'TH-01' };

const makeKitWithItem = (overrides = {}) => ({
  id: 10, name: 'Автоматика базовая', description: '', filters: [],
  items: [{ id: 100, name: 'Термостат', sku: 'TH-1', quantity: 2, is_required: true, notes: '' }],
  rules: [],
  ...overrides,
});

describe('AccessoryKitsPage — KitItemsPanel', () => {
  const gotoItems = async (kit = makeKitWithItem()) => {
    mediaApi.getAccessoryKits.mockResolvedValue(ok({ data: [kit] }));
    const user = userEvent.setup();
    render(<AccessoryKitsPage />);
    await screen.findByText('Автоматика базовая');
    return user;
  };

  it('пустой список позиций показывает подсказку', async () => {
    await gotoItems(makeKitWithItem({ items: [] }));
    expect(screen.getByText('Позиций пока нет')).toBeInTheDocument();
  });

  it('без права: нет "+ Добавить изделие", удаления и редактирования количества', async () => {
    useAuth.mockReturnValue({ user: withPerms() });
    await gotoItems();
    expect(screen.queryByText('+ Добавить изделие')).not.toBeInTheDocument();
    expect(screen.getByText('×2')).toBeDisabled();
  });

  it('поиск (от 2 символов) находит изделие и добавляет его в набор', async () => {
    catalogApi.searchProducts.mockResolvedValue(ok({ data: [product1] }));
    mediaApi.addAccessoryKitItem.mockResolvedValue({
      ok: true,
      data: { success: true, item: { id: 101, name: 'Термостат комнатный', sku: 'TH-01', quantity: 1, is_required: true } },
    });
    const user = await gotoItems();
    await user.click(screen.getByText('+ Добавить изделие'));
    await user.type(screen.getByPlaceholderText('Поиск изделия...'), 'терм');

    expect(await screen.findByText('Термостат комнатный')).toBeInTheDocument();
    await user.click(screen.getByText('Термостат комнатный'));

    await waitFor(() => expect(mediaApi.addAccessoryKitItem).toHaveBeenCalledWith(10, {
      accessory_id: 500, quantity: 1, is_required: true,
    }));
    expect(await screen.findByText('TH-01')).toBeInTheDocument();
  });

  it('одна буква не запускает поиск', async () => {
    const user = await gotoItems();
    await user.click(screen.getByText('+ Добавить изделие'));
    await user.type(screen.getByPlaceholderText('Поиск изделия...'), 'т');
    expect(catalogApi.searchProducts).not.toHaveBeenCalled();
  });

  it('"Отмена" в форме добавления закрывает её', async () => {
    const user = await gotoItems();
    await user.click(screen.getByText('+ Добавить изделие'));
    await user.click(screen.getByText('Отмена'));
    expect(screen.queryByPlaceholderText('Поиск изделия...')).not.toBeInTheDocument();
  });

  it('удаление позиции вызывает deleteAccessoryKitItem и убирает из списка', async () => {
    mediaApi.deleteAccessoryKitItem.mockResolvedValue({ ok: true });
    const user = await gotoItems();
    // "✕" неоднозначен: [0] — удаление всего набора (шапка карточки), [1] — удаление позиции
    await user.click(screen.getAllByText('✕')[1]);
    await waitFor(() => expect(mediaApi.deleteAccessoryKitItem).toHaveBeenCalledWith(10, 100));
    expect(screen.queryByText('Термостат')).not.toBeInTheDocument();
  });

  it('QuantityEditor: Enter сохраняет изменённое количество', async () => {
    mediaApi.updateAccessoryKitItem.mockResolvedValue({
      ok: true, data: { success: true, item: { id: 100, name: 'Термостат', sku: 'TH-1', quantity: 5, is_required: true } },
    });
    const user = await gotoItems();
    await user.click(screen.getByText('×2'));
    const input = screen.getByDisplayValue('2');
    await user.clear(input);
    await user.type(input, '5{enter}');

    await waitFor(() => expect(mediaApi.updateAccessoryKitItem).toHaveBeenCalledWith(10, 100, { quantity: 5 }));
    expect(await screen.findByText('×5')).toBeInTheDocument();
  });

  it('QuantityEditor: Escape отменяет без вызова onSave', async () => {
    const user = await gotoItems();
    await user.click(screen.getByText('×2'));
    const input = screen.getByDisplayValue('2');
    await user.type(input, '9{escape}');
    expect(screen.getByText('×2')).toBeInTheDocument();
    expect(mediaApi.updateAccessoryKitItem).not.toHaveBeenCalled();
  });

  it('QuantityEditor: сохранение без изменения значения не отправляет запрос', async () => {
    const user = await gotoItems();
    await user.click(screen.getByText('×2'));
    const input = screen.getByDisplayValue('2');
    await user.type(input, '{enter}');
    expect(mediaApi.updateAccessoryKitItem).not.toHaveBeenCalled();
  });
});

const makeKitWithRule = (ruleOverrides = {}) => ({
  id: 10, name: 'Автоматика базовая', description: '', filters: [], items: [],
  rules: [{
    id: 200, quantity_from: null, quantity_to: null, is_manual: null,
    power_from: null, power_to: null, priority: 0,
    rule_items: [{ id: 300, name: 'Реле давления', sku: 'RD-1', quantity: 1 }],
    ...ruleOverrides,
  }],
});

describe('AccessoryKitsPage — RulesPanel', () => {
  const gotoRules = async (kit = makeKitWithRule()) => {
    mediaApi.getAccessoryKits.mockResolvedValue(ok({ data: [kit] }));
    const user = userEvent.setup();
    render(<AccessoryKitsPage />);
    await screen.findByText('Реле давления');
    return user;
  };

  it('пустой список правил показывает подсказку', async () => {
    mediaApi.getAccessoryKits.mockResolvedValue(ok({ data: [makeKitWithItem({ items: [], rules: [] })] }));
    render(<AccessoryKitsPage />);
    await screen.findByText('Правила подбора');
    expect(screen.getByText('Правил нет')).toBeInTheDocument();
  });

  it('метка правила: "Всегда" при отсутствии условий', async () => {
    await gotoRules();
    expect(screen.getByText('Всегда')).toBeInTheDocument();
  });

  it('метка правила: количество/управление/мощность/приоритет собираются вместе', async () => {
    await gotoRules(makeKitWithRule({
      quantity_from: 2, quantity_to: 5, is_manual: false, power_from: 1, power_to: 10, priority: 3,
    }));
    expect(screen.getByText('Кол-во: 2–5')).toBeInTheDocument();
    expect(screen.getByText('Авто')).toBeInTheDocument();
    expect(screen.getByText('Мощность: 1–10 кВт')).toBeInTheDocument();
    expect(screen.getByText('приор. 3')).toBeInTheDocument();
  });

  it('"+ Добавить правило" создаёт правило с преобразованным payload', async () => {
    mediaApi.createAccessoryKitRule.mockResolvedValue({
      ok: true, data: { success: true, rule: { id: 201, priority: 5, rule_items: [] } },
    });
    mediaApi.getAccessoryKits.mockResolvedValue(ok({ data: [makeKitWithItem({ items: [], rules: [] })] }));
    const user = userEvent.setup();
    render(<AccessoryKitsPage />);
    await screen.findByText('Правила подбора');
    await user.click(screen.getByText('+ Добавить правило'));

    await user.type(screen.getAllByPlaceholderText('—')[0], '2');
    await user.selectOptions(screen.getByDisplayValue('Любое'), 'true');
    await user.type(screen.getAllByPlaceholderText('—')[1], '1.5');
    const priorityInput = screen.getByDisplayValue('0');
    await user.clear(priorityInput);
    await user.type(priorityInput, '5');

    await user.click(screen.getByText('Создать'));
    await waitFor(() => expect(mediaApi.createAccessoryKitRule).toHaveBeenCalledWith(10, {
      quantity_from: '2', quantity_to: null, is_manual: true, power_from: '1.5', power_to: null, priority: 5,
    }));
    expect(screen.queryByText('Правил нет')).not.toBeInTheDocument();
  });

  it('удаление правила вызывает deleteAccessoryKitRule и убирает карточку', async () => {
    mediaApi.deleteAccessoryKitRule.mockResolvedValue({ ok: true });
    const user = await gotoRules();
    // "✕": [0] — удаление набора, [1] — удаление правила, [2] — удаление позиции правила
    await user.click(screen.getAllByText('✕')[1]);
    await waitFor(() => expect(mediaApi.deleteAccessoryKitRule).toHaveBeenCalledWith(10, 200));
    expect(screen.queryByText('Реле давления')).not.toBeInTheDocument();
  });

  it('добавление изделия в правило вызывает addAccessoryKitRuleItem', async () => {
    catalogApi.searchProducts.mockResolvedValue(ok({ data: [product1] }));
    mediaApi.addAccessoryKitRuleItem.mockResolvedValue({
      ok: true, data: { success: true, item: { id: 301, name: 'Термостат комнатный', sku: 'TH-01', quantity: 1 } },
    });
    const user = await gotoRules();
    // "+ Добавить изделие": [0] — KitItemsPanel (набор пуст), [1] — внутри правила
    await user.click(screen.getAllByText('+ Добавить изделие')[1]);
    await user.type(screen.getByPlaceholderText('Поиск изделия...'), 'терм');
    await user.click(await screen.findByText('Термостат комнатный'));

    await waitFor(() => expect(mediaApi.addAccessoryKitRuleItem).toHaveBeenCalledWith(10, 200, {
      accessory_id: 500, quantity: 1,
    }));
  });

  describe('RuleItem — починенный баг (ReferenceError на setItems)', () => {
    it('изменение количества позиции правила вызывает onUpdated, не падает, обновляет бейдж', async () => {
      mediaApi.updateAccessoryKitItem.mockResolvedValue({
        ok: true, data: { success: true, item: { id: 300, name: 'Реле давления', sku: 'RD-1', quantity: 9 } },
      });
      const user = await gotoRules();
      await user.click(screen.getByText('×1'));
      const input = screen.getByDisplayValue('1');
      await user.clear(input);
      await user.type(input, '9{enter}');

      await waitFor(() => expect(mediaApi.updateAccessoryKitItem).toHaveBeenCalledWith(10, 300, { quantity: 9 }));
      expect(await screen.findByText('×9')).toBeInTheDocument();
    });

    it('удаление позиции правила вызывает deleteAccessoryKitRuleItem', async () => {
      mediaApi.deleteAccessoryKitRuleItem.mockResolvedValue({ ok: true });
      const user = await gotoRules();
      const removeButtons = screen.getAllByText('✕');
      // "✕": [0] — удаление набора, [1] — удаление правила, [2] — удаление позиции правила
      await user.click(removeButtons[2]);
      await waitFor(() => expect(mediaApi.deleteAccessoryKitRuleItem).toHaveBeenCalledWith(10, 200, 300));
      expect(screen.queryByText('Реле давления')).not.toBeInTheDocument();
    });
  });
});
