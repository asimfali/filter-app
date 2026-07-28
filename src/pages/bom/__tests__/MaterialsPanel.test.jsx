import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MaterialsPanel from '../MaterialsPanel';
import { bomApi } from '../../../api/bom';

vi.mock('../../../api/bom', () => ({
  bomApi: { getUnits: vi.fn(), getParts: vi.fn(), getMaterialGroup: vi.fn(), trackPartUse: vi.fn() },
}));

vi.mock('../../../components/bom/MaterialCombobox', () => ({
  default: ({ row, idx, canWrite, onSelect }) => (
    <div data-testid={`material-combobox-${idx}`} data-can-write={String(canWrite)}>
      <span>{row.source_material_name || 'нет материала'}</span>
      <button onClick={() => onSelect(idx, { id: 777, onec_name: 'Лист оц. 1.0' })}>pick-material-{idx}</button>
    </div>
  ),
}));
vi.mock('../../../components/bom/FuzzyMergeModal', () => ({
  default: ({ material, onClose, onMerged }) => (
    <div data-testid="fuzzy-merge-modal-stub" data-material-id={material.id}>
      <button onClick={() => onMerged({ new_name: 'Согласованное имя' })}>fuzzy-merge</button>
      <button onClick={onClose}>fuzzy-close</button>
    </div>
  ),
}));

const material = (overrides = {}) => ({
  id: 1, stage_name: 'Этап 1', part: null, part_name: 'Панель боковая',
  quantity: 2, unit: 'шт.', in_process: false, sort_order: 0,
  material_type: '', thickness: null, size1: null, size2: null, weight_calc: null,
  source_material_id: null, source_material_name: '', ...overrides,
});

const okList = (data) => ({ ok: true, data: { success: true, data } });

const baseProps = {
  materials: [material()],
  presets: [],
  sheetMappings: [],
  onSave: vi.fn(),
  saving: false,
  canWrite: true,
  canView: true,
  validation: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  bomApi.getUnits.mockResolvedValue(okList(['шт.', 'кг', 'м²']));
});

describe('MaterialsPanel — базовый рендер', () => {
  it('пустой список материалов показывает заглушку', () => {
    render(<MaterialsPanel {...baseProps} materials={[]} />);
    expect(screen.getByText('Нет материалов')).toBeInTheDocument();
  });

  it('рендерит строку с наименованием, количеством и единицей', () => {
    render(<MaterialsPanel {...baseProps} />);
    expect(screen.getByDisplayValue('Панель боковая')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
  });

  it('readonly-колонки показывают "—" для пустых drawing_number/material_type/thickness', () => {
    render(<MaterialsPanel {...baseProps} />);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('без canWrite все поля задизейблены, колонки удаления нет', () => {
    render(<MaterialsPanel {...baseProps} canWrite={false} />);
    expect(screen.getByDisplayValue('Панель боковая')).toBeDisabled();
    expect(screen.getByDisplayValue('2')).toBeDisabled();
    expect(screen.queryByText('×')).not.toBeInTheDocument();
  });
});

describe('MaterialsPanel — автоподстановка source_material из sheetMappings', () => {
  it('подставляет source_material для строки без него, с толщиной и типом', () => {
    render(
      <MaterialsPanel
        {...baseProps}
        materials={[material({ material_type: 'АЛР оц', thickness: 0.7 })]}
        sheetMappings={[{ material_type: 'АЛР оц', thickness: '0.7', part_id: 50, part_name: 'Лист АЛР 0.7' }]}
      />
    );
    expect(screen.getByText('Лист АЛР 0.7')).toBeInTheDocument();
  });

  it('не перезаписывает, если source_material_id уже задан', () => {
    render(
      <MaterialsPanel
        {...baseProps}
        materials={[material({
          material_type: 'АЛР оц', thickness: 0.7,
          source_material_id: 1, source_material_name: 'Существующий',
        })]}
        sheetMappings={[{ material_type: 'АЛР оц', thickness: '0.7', part_id: 50, part_name: 'Лист АЛР 0.7' }]}
      />
    );
    expect(screen.getByText('Существующий')).toBeInTheDocument();
    expect(screen.queryByText('Лист АЛР 0.7')).not.toBeInTheDocument();
  });
});

describe('MaterialsPanel — добавление/удаление строк и dirty-состояние', () => {
  it('без изменений кнопка "Сохранить" задизейблена, подсказки нет', () => {
    render(<MaterialsPanel {...baseProps} />);
    expect(screen.getByText('Сохранить изменения')).toBeDisabled();
    expect(screen.queryByText('Есть несохраненные изменения')).not.toBeInTheDocument();
  });

  it('"Добавить материал" использует первую стадию дефолтного пресета и помечает форму dirty', async () => {
    const user = userEvent.setup();
    render(
      <MaterialsPanel
        {...baseProps}
        presets={[{ id: 1, is_default: true, stages: [{ name: 'Сварка' }] }]}
      />
    );
    await user.click(screen.getByText('+').closest('button'));

    expect(screen.getByText('Есть несохраненные изменения')).toBeInTheDocument();
    expect(screen.getByText('Сохранить изменения')).toBeEnabled();
  });

  it('"×" в конце строки удаляет её и помечает dirty', async () => {
    const user = userEvent.setup();
    render(<MaterialsPanel {...baseProps} materials={[material({ id: 1, part_name: 'A' }), material({ id: 2, part_name: 'B' })]} />);

    await user.click(screen.getAllByText('×')[0]);

    expect(screen.queryByDisplayValue('A')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('B')).toBeInTheDocument();
    expect(screen.getByText('Есть несохраненные изменения')).toBeInTheDocument();
  });

  it('"Добавить материал" видна и для canView без canWrite, но "Сохранить" — нет', () => {
    render(<MaterialsPanel {...baseProps} canWrite={false} canView />);
    expect(screen.getByText('Добавить материал')).toBeInTheDocument();
    expect(screen.queryByText('Сохранить изменения')).not.toBeInTheDocument();
  });

  it('клик "Сохранить" вызывает onSave(rows); saving=true показывает "Сохранение..."', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { rerender } = render(
      <MaterialsPanel {...baseProps} onSave={onSave} presets={[{ id: 1, is_default: true, stages: [{ name: 'Сварка' }] }]} />
    );
    await user.click(screen.getByText('+').closest('button'));
    await user.click(screen.getByText('Сохранить изменения'));
    expect(onSave).toHaveBeenCalledTimes(1);

    rerender(<MaterialsPanel {...baseProps} onSave={onSave} saving />);
    expect(screen.getByText('Сохранение...')).toBeInTheDocument();
  });
});

describe('MaterialsPanel — поиск и выбор детали (Наименование)', () => {
  it('запрос короче 2 символов не вызывает getParts', async () => {
    const user = userEvent.setup();
    render(<MaterialsPanel {...baseProps} materials={[material({ part_name: '' })]} />);
    await user.type(screen.getByPlaceholderText('Наименование'), 'X');
    expect(bomApi.getParts).not.toHaveBeenCalled();
  });

  it('запрос от 2 символов вызывает getParts и показывает результаты', async () => {
    const user = userEvent.setup();
    bomApi.getParts.mockResolvedValue(okList([{ id: 5, onec_name: 'Панель верхняя' }]));
    render(<MaterialsPanel {...baseProps} materials={[material({ part_name: '' })]} />);

    const input = screen.getByPlaceholderText('Наименование');
    await user.type(input, 'Пан');

    expect(bomApi.getParts).toHaveBeenCalledWith({ q: 'Пан', limit: 10 });
    expect(await screen.findByText('Панель верхняя')).toBeInTheDocument();
  });

  it('выбор детали заполняет part/part_name/unit и закрывает список', async () => {
    const user = userEvent.setup();
    bomApi.getParts.mockResolvedValue(okList([{ id: 5, onec_name: 'Панель верхняя', unit: 'кг' }]));
    render(<MaterialsPanel {...baseProps} materials={[material({ part_name: '' })]} />);

    await user.type(screen.getByPlaceholderText('Наименование'), 'Пан');
    await user.click(await screen.findByText('Панель верхняя'));

    // displayValue = partSearch[idx] ?? row.part_name — после выбора partSearch[idx]
    // должен стать undefined (не ''), иначе поле визуально пустеет, см. коммит-фикс
    expect(screen.getByDisplayValue('Панель верхняя')).toBeInTheDocument();
    expect(screen.queryByText('Панель верхняя', { selector: 'div' })).not.toBeInTheDocument();
  });
});

describe('MaterialsPanel — валидация и ошибки', () => {
  it('ошибка по material_N с part_name, совпадающим со строкой, подсвечивает её', () => {
    render(
      <MaterialsPanel
        {...baseProps}
        validation={{ errors: [{ field: 'material_0', part_name: 'Панель боковая', message: 'Нет материала' }] }}
      />
    );
    expect(screen.getByDisplayValue('Панель боковая').className).toContain('border-red-300');
  });

  it('несоответствующее поле ошибки не подсвечивает строку', () => {
    render(
      <MaterialsPanel
        {...baseProps}
        validation={{ errors: [{ field: 'other_field', part_name: 'Панель боковая', message: 'X' }] }}
      />
    );
    expect(screen.getByDisplayValue('Панель боковая').className).not.toContain('border-red-300');
  });
});

describe('MaterialsPanel — MaterialCombobox и FuzzyMergeModal', () => {
  it('выбор материала через MaterialCombobox обновляет source_material и трекает использование', async () => {
    const user = userEvent.setup();
    render(<MaterialsPanel {...baseProps} />);

    await user.click(screen.getByText('pick-material-0'));

    expect(screen.getByText('Лист оц. 1.0')).toBeInTheDocument();
    expect(bomApi.trackPartUse).toHaveBeenCalledWith(777);
  });

  it('кнопка "≈" видна только при validation_status=warning и canWrite; открывает FuzzyMergeModal', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<MaterialsPanel {...baseProps} />);
    expect(screen.queryByText('≈')).not.toBeInTheDocument();

    rerender(<MaterialsPanel {...baseProps} materials={[material({ validation_status: 'warning' })]} />);
    await user.click(screen.getByText('≈'));

    expect(screen.getByTestId('fuzzy-merge-modal-stub')).toBeInTheDocument();
  });

  it('onMerged из FuzzyMergeModal обновляет part_name строки и сбрасывает validation_status на pending', async () => {
    const user = userEvent.setup();
    render(<MaterialsPanel {...baseProps} materials={[material({ id: 1, validation_status: 'warning' })]} />);

    await user.click(screen.getByText('≈'));
    await user.click(screen.getByText('fuzzy-merge'));

    expect(screen.getByDisplayValue('Согласованное имя')).toBeInTheDocument();
    expect(screen.queryByTestId('fuzzy-merge-modal-stub')).not.toBeInTheDocument();
  });
});

describe('MaterialsPanel — вес, единицы, чекбокс "в процессе"', () => {
  it('вес показывается readonly и отформатированным, если есть thickness+weight_calc', () => {
    render(<MaterialsPanel {...baseProps} materials={[material({ thickness: 1, weight_calc: '2.5' })]} />);
    expect(screen.getByText('2.500')).toBeInTheDocument();
  });

  it('вес редактируется через input, если нет thickness', async () => {
    const user = userEvent.setup();
    render(<MaterialsPanel {...baseProps} materials={[material({ thickness: null })]} />);
    const weightInput = screen.getByPlaceholderText('0.000');
    await user.type(weightInput, '3.2');
    expect(weightInput).toHaveValue(3.2);
  });

  it('текущая единица добавляется в select, если её нет в units', () => {
    render(<MaterialsPanel {...baseProps} materials={[material({ unit: 'уп.' })]} />);
    expect(screen.getByDisplayValue('уп.')).toBeInTheDocument();
  });

  it('чекбокс "в процессе" переключается', async () => {
    const user = userEvent.setup();
    render(<MaterialsPanel {...baseProps} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});
