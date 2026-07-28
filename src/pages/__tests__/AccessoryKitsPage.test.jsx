import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccessoryKitsPage from '../AccessoryKitsPage';
import { mediaApi } from '../../api/media';
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
