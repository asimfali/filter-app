import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SpecHeaderForm from '../SpecHeaderForm';

// ВАЖНО: в текущем коде SpecHeaderForm сетка полей (название/этап/тип
// процесса/дата/количество) отсутствует — виден только комментарий
// "грид полей без изменений" и три FolderPicker. Поля form.onec_name и
// т.д. ни на что не влияют, т.к. нет input'ов, вызывающих set(). Это
// подтверждённое (не наше) поведение — см. коммит; тестируем как есть,
// без "восстановления" недостающей вёрстки.
vi.mock('../../../components/bom/FolderPicker', () => ({
  default: ({ value, onChange, folderType }) => (
    <div data-testid={`folder-picker-${folderType}`} data-value={value?.id ?? ''}>
      <button onClick={() => onChange({ id: 900 + folderType.length, path: `${folderType}/новая` })}>
        pick-{folderType}
      </button>
    </div>
  ),
}));

const baseSpec = {
  id: 1,
  onec_name: 'КЭВ-1',
  stage_name: 'Этап 1',
  process_type: 'Сборка',
  date_from: '2026-01-01',
  quantity: 1,
  default_nomenclature_folder: null,
  folder: null,
  assembly_nomenclature_folder: null,
};

describe('SpecHeaderForm — видимость и текущее поведение', () => {
  it('без canWrite не рендерит ни FolderPicker, ни кнопку сохранения', () => {
    render(<SpecHeaderForm spec={baseSpec} onSave={vi.fn()} saving={false} canWrite={false} />);
    expect(screen.queryByTestId('folder-picker-manufacture')).not.toBeInTheDocument();
    expect(screen.queryByText('Сохранить')).not.toBeInTheDocument();
  });

  it('с canWrite рендерит три FolderPicker (manufacture/spec/nomenclature) и предупреждения для незаполненных', () => {
    render(<SpecHeaderForm spec={baseSpec} onSave={vi.fn()} saving={false} canWrite />);
    expect(screen.getByTestId('folder-picker-manufacture')).toBeInTheDocument();
    expect(screen.getByTestId('folder-picker-spec')).toBeInTheDocument();
    expect(screen.getByTestId('folder-picker-nomenclature')).toBeInTheDocument();
    expect(screen.getByText('⚠ Не выбрана')).toBeInTheDocument();
    // одинаковый текст предупреждения у папки спецификации сборки и папки номенклатуры изделия
    expect(screen.getAllByText('⚠ Не выбрана — «Загрузить сборку» недоступно')).toHaveLength(2);
  });

  it('без предупреждения, если папки уже заполнены в spec', () => {
    render(
      <SpecHeaderForm
        spec={{ ...baseSpec, default_nomenclature_folder: 5, folder: 6, assembly_nomenclature_folder: 7 }}
        onSave={vi.fn()} saving={false} canWrite
      />
    );
    expect(screen.queryByText('⚠ Не выбрана')).not.toBeInTheDocument();
    expect(screen.queryByText(/«Загрузить сборку» недоступно/)).not.toBeInTheDocument();
  });

  it('выбор папки в FolderPicker сразу вызывает onSave (минуя dirty/кнопку "Сохранить")', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<SpecHeaderForm spec={baseSpec} onSave={onSave} saving={false} canWrite onDirtyChange={vi.fn()} />);

    await user.click(screen.getByText('pick-manufacture'));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ default_nomenclature_folder: 911 }));
    // кнопка "Сохранить" не появляется — FolderPicker не проходит через set()/dirty
    expect(screen.queryByText('Сохранить')).not.toBeInTheDocument();
  });

  it('кнопка "Сохранить" никогда не появляется в текущем UI — set() недостижим без сетки полей', async () => {
    const user = userEvent.setup();
    render(<SpecHeaderForm spec={baseSpec} onSave={vi.fn()} saving={false} canWrite />);

    await user.click(screen.getByText('pick-spec'));
    await user.click(screen.getByText('pick-nomenclature'));

    expect(screen.queryByText('Сохранить')).not.toBeInTheDocument();
  });

  it('смена spec.id сбрасывает выбранные папки и вызывает onDirtyChange(false)', () => {
    const onDirtyChange = vi.fn();
    const { rerender } = render(
      <SpecHeaderForm spec={{ ...baseSpec, folder: 6, folder_path: 'spec/a' }} onSave={vi.fn()} saving={false} canWrite onDirtyChange={onDirtyChange} />
    );
    expect(screen.getByTestId('folder-picker-spec')).toHaveAttribute('data-value', '6');

    rerender(
      <SpecHeaderForm spec={{ ...baseSpec, id: 2, folder: null }} onSave={vi.fn()} saving={false} canWrite onDirtyChange={onDirtyChange} />
    );
    expect(screen.getByTestId('folder-picker-spec')).toHaveAttribute('data-value', '');
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });
});
