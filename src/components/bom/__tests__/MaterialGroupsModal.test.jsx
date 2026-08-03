import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MaterialGroupsModal from '../MaterialGroupsModal';
import { bomApi } from '../../../api/bom';

vi.mock('../../../api/bom', () => ({
  bomApi: {
    getMaterialGroups: vi.fn(),
    createMaterialGroup: vi.fn(),
    deleteMaterialGroup: vi.fn(),
    getMaterialGroupDetail: vi.fn(),
    getParts: vi.fn(),
    addPartToGroup: vi.fn(),
    removePartFromGroup: vi.fn(),
    updateMaterialGroup: vi.fn(),
  },
}));
vi.mock('../FolderPicker', () => ({
  default: ({ value, onChange }) => (
    <div data-testid="folder-picker-stub" data-value={value?.path ?? value?.id ?? ''}>
      <button onClick={() => onChange({ id: 42, path: 'выбранная/папка' })}>pick-folder</button>
    </div>
  ),
}));

const ok = (data) => ({ ok: true, data: { success: true, data } });
const group = (overrides = {}) => ({
  id: 1, material_type: 'АЛР оц', thickness: '0.7', parts: [{ id: 1 }], parts_from_folder_count: 0, ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  bomApi.getMaterialGroups.mockResolvedValue(ok([]));
});

describe('MaterialGroupsModal — список групп', () => {
  it('показывает "Загрузка..." затем список; пустой список — "Нет групп"', async () => {
    render(<MaterialGroupsModal onClose={vi.fn()} />);
    expect(screen.getByText('Загрузка...')).toBeInTheDocument();
    expect(await screen.findByText('Нет групп')).toBeInTheDocument();
  });

  it('рендерит группу с толщиной, счётчиком явных/из папки, путём папки', async () => {
    bomApi.getMaterialGroups.mockResolvedValue(ok([
      group({ parts: [{ id: 1 }, { id: 2 }], parts_from_folder_count: 3, folder_path: 'Металл / АЛР / оц' }),
    ]));
    render(<MaterialGroupsModal onClose={vi.fn()} />);

    expect(await screen.findByText('0.7мм')).toBeInTheDocument();
    expect(screen.getByText(/2 явных/)).toBeInTheDocument();
    expect(screen.getByText(/\+ 3 из папки/)).toBeInTheDocument();
  });

  it('без выбранной/создаваемой группы показывает подсказку', async () => {
    render(<MaterialGroupsModal onClose={vi.fn()} />);
    expect(await screen.findByText('Выберите группу или создайте новую')).toBeInTheDocument();
  });

  it('"×" на группе удаляет через showConfirm, не открывая саму группу', async () => {
    const user = userEvent.setup();
    bomApi.getMaterialGroups.mockResolvedValue(ok([group()]));
    bomApi.deleteMaterialGroup.mockResolvedValue({});
    render(<MaterialGroupsModal onClose={vi.fn()} />);
    await screen.findByText('0.7мм');

    await user.click(screen.getByText('×'));
    expect(bomApi.deleteMaterialGroup).not.toHaveBeenCalled();
    expect(screen.getByText('Удалить группу?')).toBeInTheDocument();

    await user.click(screen.getByText('Подтвердить'));
    expect(bomApi.deleteMaterialGroup).toHaveBeenCalledWith(1);
  });

  it('"Закрыть" (✕) вызывает onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<MaterialGroupsModal onClose={onClose} />);
    await user.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('MaterialGroupsModal — создание группы (GroupForm)', () => {
  it('пустой material_type показывает ошибку без вызова API', async () => {
    const user = userEvent.setup();
    render(<MaterialGroupsModal onClose={vi.fn()} />);
    await user.click(screen.getByText('+ Новая группа'));

    await user.click(screen.getByText('Создать'));

    expect(screen.getByText('Укажите тип материала')).toBeInTheDocument();
    expect(bomApi.createMaterialGroup).not.toHaveBeenCalled();
  });

  it('успех создаёт группу, шлёт folder_id из FolderPicker, обновляет список и открывает созданную группу', async () => {
    const user = userEvent.setup();
    bomApi.createMaterialGroup.mockResolvedValue(ok({ id: 9, material_type: 'Нерж', thickness: '1.0', parts: [] }));
    bomApi.getMaterialGroupDetail.mockResolvedValue(ok({ material_type: 'Нерж', all_parts: [] }));
    render(<MaterialGroupsModal onClose={vi.fn()} />);
    await user.click(screen.getByText('+ Новая группа'));

    await user.type(screen.getByPlaceholderText('АЛР оц, Нерж, Труба...'), 'Нерж');
    await user.type(screen.getByPlaceholderText('0.70 (пусто = любая)'), '1.0');
    await user.click(screen.getByText('pick-folder'));
    await user.click(screen.getByText('Создать'));

    expect(bomApi.createMaterialGroup).toHaveBeenCalledWith({
      material_type: 'Нерж', thickness: '1.0', folder_id: 42, notes: '',
    });
    expect(await screen.findByText('Нерж')).toBeInTheDocument(); // заголовок GroupDetail открытой группы
  });

  it('неудача показывает ошибку из ответа API', async () => {
    const user = userEvent.setup();
    bomApi.createMaterialGroup.mockResolvedValue({ ok: false, data: { error: 'Такая группа уже есть' } });
    render(<MaterialGroupsModal onClose={vi.fn()} />);
    await user.click(screen.getByText('+ Новая группа'));

    await user.type(screen.getByPlaceholderText('АЛР оц, Нерж, Труба...'), 'Нерж');
    await user.click(screen.getByText('Создать'));

    expect(await screen.findByText('Такая группа уже есть')).toBeInTheDocument();
  });

  it('"Отмена" закрывает форму создания', async () => {
    const user = userEvent.setup();
    render(<MaterialGroupsModal onClose={vi.fn()} />);
    await user.click(screen.getByText('+ Новая группа'));
    await user.click(screen.getByText('Отмена'));
    expect(screen.queryByText('Новая группа материалов')).not.toBeInTheDocument();
  });
});

describe('MaterialGroupsModal — детали группы (GroupDetail)', () => {
  const detail = (overrides = {}) => ({
    material_type: 'АЛР оц', thickness: '0.7', notes: 'Основной металл',
    folder_path: null,
    all_parts: [{ id: 1, onec_name: 'Лист явный', from_folder: false }, { id: 2, onec_name: 'Лист из папки', from_folder: true }],
    ...overrides,
  });

  const openGroup = async (user, detailOverrides = {}) => {
    bomApi.getMaterialGroups.mockResolvedValue(ok([group()]));
    bomApi.getMaterialGroupDetail.mockResolvedValue(ok(detail(detailOverrides)));
    render(<MaterialGroupsModal onClose={vi.fn()} />);
    await user.click(await screen.findByText('0.7мм'));
    await screen.findByText('Основной металл');
  };

  it('показывает материалы группы: explicit (★) и from_folder (папка), с кнопкой удаления только у явных', async () => {
    const user = userEvent.setup();
    await openGroup(user);

    const section = screen.getByText(/Все материалы группы/).closest('div').parentElement;
    expect(within(section).getByText('Лист явный')).toBeInTheDocument();
    expect(within(section).getByText('Лист из папки')).toBeInTheDocument();
    // только у "Лист явный" есть кнопка ×; у "Лист из папки" — нет (плюс есть
    // ещё одна "×" у группы в левом сайдбаре — она вне этой секции)
    expect(within(section).getAllByText('×')).toHaveLength(1);
  });

  it('удаление явного материала вызывает removePartFromGroup и обновляет данные', async () => {
    const user = userEvent.setup();
    bomApi.removePartFromGroup.mockResolvedValue(ok({ id: 1 }));
    await openGroup(user);
    bomApi.getMaterialGroupDetail.mockResolvedValue(ok(detail({ all_parts: [{ id: 2, onec_name: 'Лист из папки', from_folder: true }] })));

    const section = screen.getByText(/Все материалы группы/).closest('div').parentElement;
    await user.click(within(section).getByText('×'));

    expect(bomApi.removePartFromGroup).toHaveBeenCalledWith(1, 1);
    await screen.findByText('Все материалы группы (1)');
  });

  it('поиск и добавление материала явно', async () => {
    const user = userEvent.setup();
    await openGroup(user);
    bomApi.getParts.mockResolvedValue(ok([{ id: 3, onec_name: 'Новый лист' }]));
    bomApi.addPartToGroup.mockResolvedValue(ok({ id: 1 }));
    bomApi.getMaterialGroupDetail.mockResolvedValue(ok(detail({
      all_parts: [{ id: 1, onec_name: 'Лист явный', from_folder: false }, { id: 3, onec_name: 'Новый лист', from_folder: false }],
    })));

    await user.type(screen.getByPlaceholderText('Поиск по номенклатуре 1С...'), 'Нов');
    expect(bomApi.getParts).toHaveBeenCalledWith({ q: 'Нов', limit: 10, is_synced: true });
    await user.click(await screen.findByText('Новый лист'));

    expect(bomApi.addPartToGroup).toHaveBeenCalledWith(1, 3);
    await screen.findByText('Все материалы группы (2)');
  });

  it('без папки показывает "Не задана"; "Изменить" открывает FolderPicker и сохраняет', async () => {
    const user = userEvent.setup();
    await openGroup(user);
    expect(screen.getByText('Не задана')).toBeInTheDocument();

    bomApi.updateMaterialGroup.mockResolvedValue(ok({ id: 1, folder_path: 'выбранная/папка' }));
    await user.click(screen.getByText('Изменить'));
    await user.click(screen.getByText('pick-folder'));
    await user.click(screen.getByText('Сохранить папку'));

    expect(bomApi.updateMaterialGroup).toHaveBeenCalledWith(1, { folder_id: 42 });
  });

  it('с уже заданной папкой показывает её путь', async () => {
    const user = userEvent.setup();
    await openGroup(user, { folder_path: 'Металл / АЛР' });
    expect(screen.getByText(/Металл \/ АЛР/)).toBeInTheDocument();
  });
});
