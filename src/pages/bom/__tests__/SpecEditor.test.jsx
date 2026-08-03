import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SpecEditor from '../SpecEditor';
import { bomApi } from '../../../api/bom';

vi.mock('../../../api/bom', () => ({
  bomApi: {
    getStagePresets: vi.fn(),
    getSheetMappings: vi.fn(),
    getSpec: vi.fn(),
    updateSpec: vi.fn(),
    updateMaterials: vi.fn(),
    validateSpec: vi.fn(),
    pushSpec: vi.fn(),
    createDetails: vi.fn(),
    updateDetails: vi.fn(),
    cloneSpec: vi.fn(),
  },
}));

vi.mock('../SpecHeaderForm', () => ({
  default: ({ onSave, onDirtyChange }) => (
    <div data-testid="spec-header-form-stub">
      <button onClick={() => onSave({ onec_name: 'Новое имя' })}>header-save</button>
      <button onClick={() => onDirtyChange(true)}>header-mark-dirty</button>
      <button onClick={() => onDirtyChange(false)}>header-mark-clean</button>
    </div>
  ),
}));
vi.mock('../MaterialsPanel', () => ({
  default: ({ materials, canWrite, onSave }) => (
    <div data-testid="materials-panel-stub" data-count={materials.length} data-can-write={String(canWrite)}>
      <button
        onClick={() => onSave([
          { part: null, in_process: false, source_material_id: 5, source_material_name: 'Лист 1.5', part_name: '' },
          { part: 10, in_process: true, source_material_id: null, part_name: 'Готовая деталь' },
        ])}
      >
        materials-save
      </button>
    </div>
  ),
}));
vi.mock('../../../components/bom/ValidationReport', () => ({
  default: ({ result }) => <div data-testid="validation-report-stub">{JSON.stringify(result)}</div>,
}));
vi.mock('../../../components/bom/MergeExcelModal', () => ({
  default: ({ onClose, onMerged }) => (
    <div data-testid="merge-excel-modal-stub">
      <button onClick={() => onMerged({ id: 1, onec_name: 'После мержа' })}>merge-done</button>
      <button onClick={onClose}>merge-close</button>
    </div>
  ),
}));
vi.mock('../../../components/bom/ImportJsonModal', () => ({
  default: ({ onClose, onMerged }) => (
    <div data-testid="import-json-modal-stub">
      <button onClick={() => onMerged({ id: 1, onec_name: 'После JSON' })}>json-done</button>
      <button onClick={onClose}>json-close</button>
    </div>
  ),
}));

const baseSpec = {
  id: 1,
  onec_name: 'КЭВ-1 узел',
  status: 'draft',
  materials: [],
  default_nomenclature_folder: null,
  folder: null,
  assembly_nomenclature_folder: null,
};

const okEnvelope = (data) => ({ ok: true, data: { success: true, data } });

const renderEditor = (props = {}) =>
  render(
    <SpecEditor
      spec={baseSpec}
      onClose={vi.fn()}
      onSaved={vi.fn()}
      canWrite
      canView
      canPush
      {...props}
    />
  );

beforeEach(() => {
  vi.clearAllMocks();
  bomApi.getStagePresets.mockResolvedValue(okEnvelope([]));
  bomApi.getSheetMappings.mockResolvedValue(okEnvelope([]));
  bomApi.getSpec.mockResolvedValue(okEnvelope(baseSpec));
});

describe('SpecEditor — шапка и права', () => {
  it('показывает название, статус и подсказку 1С-статуса, если задана', () => {
    renderEditor({ spec: { ...baseSpec, onec_status: 'Проведён' } });
    expect(screen.getByText('КЭВ-1 узел')).toBeInTheDocument();
    expect(screen.getByText('Черновик')).toBeInTheDocument();
    expect(screen.getByText('· 1С: Проведён')).toBeInTheDocument();
  });

  it('без canWrite скрывает Копировать/Excel/JSON и футер SpecHeaderForm-сохранения не влияет', () => {
    renderEditor({ canWrite: false });
    expect(screen.queryByText('⎘ Копировать')).not.toBeInTheDocument();
    expect(screen.queryByText('↑ Excel')).not.toBeInTheDocument();
  });

  it('без canPush скрывает все кнопки пуша/создания деталей', () => {
    renderEditor({ canPush: false });
    expect(screen.queryByText('⚙ Создать детали')).not.toBeInTheDocument();
    expect(screen.queryByText('↑ Загрузить сборку')).not.toBeInTheDocument();
  });

  it('"Загрузить сборку" превращается в "Обновить сборку" при status=pushed', () => {
    renderEditor({ spec: { ...baseSpec, status: 'pushed' } });
    expect(screen.getByText('↑ Обновить сборку')).toBeInTheDocument();
  });

  it('"Создать детали" видна, если есть in_process материал без detail_spec', () => {
    renderEditor({ spec: { ...baseSpec, materials: [{ in_process: true, detail_spec: null }] } });
    expect(screen.getByText('⚙ Создать детали')).toBeInTheDocument();
  });

  it('"Создать детали" скрыта, если у всех in_process материалов уже есть detail_spec', () => {
    renderEditor({ spec: { ...baseSpec, materials: [{ in_process: true, detail_spec: 7 }] } });
    expect(screen.queryByText('⚙ Создать детали')).not.toBeInTheDocument();
  });

  it('"Обновить детали" видна, если хотя бы у одного материала есть detail_spec', () => {
    renderEditor({ spec: { ...baseSpec, materials: [{ in_process: true, detail_spec: 7 }] } });
    expect(screen.getByText('↺ Обновить детали')).toBeInTheDocument();
  });

  it('headerDirty блокирует Проверить/Создать/Обновить/Push', async () => {
    const user = userEvent.setup();
    renderEditor({ spec: { ...baseSpec, materials: [{ in_process: true, detail_spec: 7 }] } });
    await user.click(screen.getByText('header-mark-dirty'));

    expect(screen.getByText('✓ Проверить')).toBeDisabled();
    expect(screen.getByText('↺ Обновить детали')).toBeDisabled();
    expect(screen.getByText('↑ Загрузить сборку')).toBeDisabled();
  });

  it('"Загрузить сборку" задизейблена без folder/assembly_nomenclature_folder', () => {
    renderEditor();
    expect(screen.getByText('↑ Загрузить сборку')).toBeDisabled();
  });

  it('spec_stages рендерятся чипами', () => {
    renderEditor({ spec: { ...baseSpec, spec_stages: [{ id: 1, name: 'Сварка' }, { id: 2, name: 'Покраска' }] } });
    expect(screen.getByText('Сварка')).toBeInTheDocument();
    expect(screen.getByText('Покраска')).toBeInTheDocument();
  });
});

describe('SpecEditor — действия с перезагрузкой спецификации', () => {
  it('handleValidate: вызывает validateSpec, рендерит ValidationReport, обновляет spec через onSaved', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    bomApi.validateSpec.mockResolvedValue(okEnvelope({ is_valid: false, errors: [{ message: 'Нет материала' }] }));
    bomApi.getSpec.mockResolvedValue(okEnvelope({ ...baseSpec, onec_name: 'После проверки' }));
    renderEditor({ onSaved });

    await user.click(screen.getByText('✓ Проверить'));

    expect(bomApi.validateSpec).toHaveBeenCalledWith(1);
    expect(await screen.findByTestId('validation-report-stub')).toHaveTextContent('Нет материала');
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ onec_name: 'После проверки' }));
  });

  it('handleCreateDetails: шлёт default_nomenclature_folder, показывает ошибки из data.data.errors', async () => {
    const user = userEvent.setup();
    bomApi.createDetails.mockResolvedValue({
      ok: true,
      data: { success: false, data: { errors: [{ message: 'Не хватает чертежа' }] } },
    });
    renderEditor({ spec: { ...baseSpec, default_nomenclature_folder: 55, materials: [{ in_process: true, detail_spec: null }] } });

    await user.click(screen.getByText('⚙ Создать детали'));

    expect(bomApi.createDetails).toHaveBeenCalledWith(1, 55);
    expect(await screen.findByTestId('validation-report-stub')).toHaveTextContent('Не хватает чертежа');
  });

  it('handleUpdateDetails: вызывает updateDetails(spec.id)', async () => {
    const user = userEvent.setup();
    bomApi.updateDetails.mockResolvedValue({ ok: true, data: { success: true, data: {} } });
    renderEditor({ spec: { ...baseSpec, materials: [{ in_process: true, detail_spec: 7 }] } });

    await user.click(screen.getByText('↺ Обновить детали'));

    expect(bomApi.updateDetails).toHaveBeenCalledWith(1);
  });

  it('handlePushAssembly: неуспешный data.data → показывает validation', async () => {
    const user = userEvent.setup();
    bomApi.pushSpec.mockResolvedValue({ ok: true, data: { data: { success: false, errors: [{ message: 'Нет папки' }] } } });
    renderEditor({ spec: { ...baseSpec, folder: 1, assembly_nomenclature_folder: 2 } });

    await user.click(screen.getByText('↑ Загрузить сборку'));

    expect(bomApi.pushSpec).toHaveBeenCalledWith(1);
    expect(await screen.findByTestId('validation-report-stub')).toHaveTextContent('Нет папки');
  });
});

describe('SpecEditor — заголовок и материалы', () => {
  it('handleHeaderSave: updateSpec(id, fields) → reload → onSaved', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    bomApi.updateSpec.mockResolvedValue({ ok: true, data: { success: true } });
    bomApi.getSpec.mockResolvedValue(okEnvelope({ ...baseSpec, onec_name: 'Новое имя' }));
    renderEditor({ onSaved });

    await user.click(screen.getByText('header-save'));

    expect(bomApi.updateSpec).toHaveBeenCalledWith(1, { onec_name: 'Новое имя' });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ onec_name: 'Новое имя' }));
  });

  it('handleMaterialsSave: маппит source_material/stage_preset/part_name/part перед отправкой', async () => {
    const user = userEvent.setup();
    bomApi.updateMaterials.mockResolvedValue({ ok: true, data: { success: true } });
    renderEditor();

    await user.click(screen.getByText('materials-save'));

    expect(bomApi.updateMaterials).toHaveBeenCalledWith(1, [
      expect.objectContaining({
        source_material: 5,
        part_name: 'Лист 1.5', // part_name пуст → берём source_material_name
        part: 5, // part не выбран, in_process=false → используем source_material_id
      }),
      expect.objectContaining({
        source_material: null,
        part_name: 'Готовая деталь',
        part: 10, // part уже выбран явно
      }),
    ]);
  });
});

describe('SpecEditor — копирование', () => {
  it('открывает модалку с предзаполненным именем, успех закрывает редактор', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    bomApi.cloneSpec.mockResolvedValue({ ok: true, data: { success: true } });
    renderEditor({ onClose });

    await user.click(screen.getByText('⎘ Копировать'));
    expect(screen.getByDisplayValue('КЭВ-1 узел (копия)')).toBeInTheDocument();

    await user.click(screen.getByText('Создать копию'));
    expect(bomApi.cloneSpec).toHaveBeenCalledWith(1, 'КЭВ-1 узел (копия)');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('неудача показывает alert через showAlert, редактор не закрывается', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    bomApi.cloneSpec.mockResolvedValue({ ok: false, data: { error: 'Имя уже занято' } });
    renderEditor({ onClose });

    await user.click(screen.getByText('⎘ Копировать'));
    await user.click(screen.getByText('Создать копию'));

    expect(await screen.findByText('Имя уже занято')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('SpecEditor — Excel/JSON merge', () => {
  it('MergeExcelModal.onMerged вызывает onSaved и перезагружает spec', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    bomApi.getSpec.mockResolvedValue(okEnvelope({ ...baseSpec, onec_name: 'После reload' }));
    renderEditor({ onSaved });

    await user.click(screen.getByText('↑ Excel'));
    await user.click(screen.getByText('merge-done'));

    expect(onSaved).toHaveBeenCalledWith({ id: 1, onec_name: 'После мержа' });
    expect(bomApi.getSpec).toHaveBeenCalled();
    expect(screen.queryByTestId('merge-excel-modal-stub')).not.toBeInTheDocument();
  });

  it('ImportJsonModal.onMerged вызывает onSaved и перезагружает spec', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    renderEditor({ onSaved });

    // в JSX кнопка — `{ } JSON`: `{ }` это пустое JS-выражение (ничего не рендерит),
    // реальный текст кнопки — просто "JSON"
    await user.click(screen.getByText('JSON'));
    await user.click(screen.getByText('json-done'));

    expect(onSaved).toHaveBeenCalledWith({ id: 1, onec_name: 'После JSON' });
    expect(screen.queryByTestId('import-json-modal-stub')).not.toBeInTheDocument();
  });
});
