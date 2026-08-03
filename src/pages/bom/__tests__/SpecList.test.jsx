import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SpecList from '../SpecList';
import { bomApi } from '../../../api/bom';

vi.mock('../../../api/bom', () => ({
  bomApi: { updateSpec: vi.fn(), cloneSpec: vi.fn(), deleteSpec: vi.fn() },
}));

vi.mock('../../../components/bom/CreateSpecModal', () => ({
  default: ({ onClose, onCreated }) => (
    <div data-testid="create-spec-modal-stub">
      <button onClick={() => onCreated({ id: 100 })}>create-created</button>
      <button onClick={onClose}>create-close</button>
    </div>
  ),
}));
vi.mock('../../../components/bom/ImportExcelModal', () => ({
  default: ({ onClose, onImported }) => (
    <div data-testid="import-excel-modal-stub">
      <button onClick={() => onImported({ id: 200 }, false)}>import-simple</button>
      <button onClick={() => onImported({ id: 201 }, true)}>import-split</button>
      <button onClick={onClose}>import-close</button>
    </div>
  ),
}));
vi.mock('../../../components/bom/MaterialGroupsModal', () => ({
  default: ({ onClose }) => <div data-testid="material-groups-modal-stub"><button onClick={onClose}>close</button></div>,
}));
vi.mock('../../../components/bom/PackagingModal', () => ({
  default: ({ onClose }) => <div data-testid="packaging-modal-stub"><button onClick={onClose}>close</button></div>,
}));
vi.mock('../../../components/bom/UnitWeightModal', () => ({
  default: ({ onClose }) => <div data-testid="unit-weight-modal-stub"><button onClick={onClose}>close</button></div>,
}));
vi.mock('../../../components/bom/PullModal', () => ({
  default: ({ onClose, onPulled }) => (
    <div data-testid="pull-modal-stub">
      <button onClick={onPulled}>pull-pulled</button>
      <button onClick={onClose}>pull-close</button>
    </div>
  ),
}));
vi.mock('../../../components/bom/SyncModal', () => ({
  default: ({ onClose }) => <div data-testid="bom-sync-modal-stub"><button onClick={onClose}>close</button></div>,
}));

const spec = (overrides = {}) => ({
  id: 1, onec_name: 'КЭВ-1 узел', part_name: 'КЭВ-1', process_type: 'Сборка',
  status: 'draft', created_at: '2026-01-15T10:00:00Z', ...overrides,
});

const baseProps = {
  specs: [spec()],
  loading: false,
  canWrite: true,
  canView: true,
  onOpen: vi.fn(),
  onRefresh: vi.fn(),
  onSearch: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SpecList — состояния списка', () => {
  it('показывает "Загрузка..." при loading', () => {
    render(<SpecList {...baseProps} loading specs={[]} />);
    expect(screen.getByText('Загрузка...')).toBeInTheDocument();
  });

  it('показывает заглушку для пустого списка', () => {
    render(<SpecList {...baseProps} specs={[]} />);
    expect(screen.getByText('Нет спецификаций. Загрузите из 1С или создайте новую.')).toBeInTheDocument();
  });

  it('рендерит строку: имя, изделие, тип процесса, статус, дату; "—" для пустого типа процесса', () => {
    render(<SpecList {...baseProps} specs={[spec({ process_type: null })]} />);
    expect(screen.getByText('КЭВ-1 узел')).toBeInTheDocument();
    expect(screen.getByText('КЭВ-1')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Черновик')).toBeInTheDocument();
  });

  it('показывает индикатор блокировки с именем, если spec.locked_by задан', () => {
    render(<SpecList {...baseProps} specs={[spec({ locked_by: 5, locked_by_name: 'Иванов' })]} />);
    expect(screen.getByText(/Иванов/)).toBeInTheDocument();
  });

  it('клик по строке вызывает onOpen(spec.id)', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<SpecList {...baseProps} onOpen={onOpen} />);
    await user.click(screen.getByText('КЭВ-1 узел'));
    expect(onOpen).toHaveBeenCalledWith(1);
  });

  it('поиск вызывает onSearch с введённым значением', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SpecList {...baseProps} onSearch={onSearch} />);
    await user.type(screen.getByPlaceholderText('Поиск по названию спецификации или изделия...'), 'КЭВ');
    expect(onSearch).toHaveBeenLastCalledWith('КЭВ');
  });
});

describe('SpecList — кнопки шапки по правам', () => {
  it('canWrite=false скрывает write-кнопки, оставляет "Загрузить из 1С"', () => {
    render(<SpecList {...baseProps} canWrite={false} />);
    expect(screen.queryByText('+ Новая спецификация')).not.toBeInTheDocument();
    expect(screen.queryByText('↑ Импорт из Excel')).not.toBeInTheDocument();
    expect(screen.getByText('↓ Загрузить из 1С')).toBeInTheDocument();
  });

  it('canWrite=true показывает все write-кнопки', () => {
    render(<SpecList {...baseProps} />);
    ['+ Новая спецификация', '↻ Синхронизация данных', '⚙ Группы материалов', '↑ Импорт из Excel']
      .forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
  });
});

describe('SpecList — модалки шапки', () => {
  it('открывает/закрывает CreateSpecModal; onCreated обновляет список', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    render(<SpecList {...baseProps} onRefresh={onRefresh} />);

    await user.click(screen.getByText('+ Новая спецификация'));
    expect(screen.getByTestId('create-spec-modal-stub')).toBeInTheDocument();

    await user.click(screen.getByText('create-created'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('create-spec-modal-stub')).not.toBeInTheDocument();
  });

  it('импорт без разбиения: onRefresh + onOpen(spec.id), без алерта', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    const onOpen = vi.fn();
    render(<SpecList {...baseProps} onRefresh={onRefresh} onOpen={onOpen} />);

    await user.click(screen.getByText('↑ Импорт из Excel'));
    await user.click(screen.getByText('import-simple'));

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(200);
    expect(screen.queryByText(/Создано 2 спецификации/)).not.toBeInTheDocument();
  });

  it('импорт с разбиением: показывает алерт и открывает первую спецификацию', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<SpecList {...baseProps} onOpen={onOpen} />);

    await user.click(screen.getByText('↑ Импорт из Excel'));
    await user.click(screen.getByText('import-split'));

    expect(screen.getByText('Создано 2 спецификации по типу материала. Открыта первая.')).toBeInTheDocument();
    expect(onOpen).toHaveBeenCalledWith(201);
  });

  it('Pull-модалка: onPulled закрывает её и обновляет список', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    render(<SpecList {...baseProps} onRefresh={onRefresh} />);

    await user.click(screen.getByText('↓ Загрузить из 1С'));
    await user.click(screen.getByText('pull-pulled'));

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('pull-modal-stub')).not.toBeInTheDocument();
  });

  it('Sync/Groups/Packaging/UnitWeight модалки открываются и закрываются независимо', async () => {
    const user = userEvent.setup();
    render(<SpecList {...baseProps} />);

    await user.click(screen.getByText('↻ Синхронизация данных'));
    expect(screen.getByTestId('bom-sync-modal-stub')).toBeInTheDocument();
    await user.click(screen.getByText('close'));
    expect(screen.queryByTestId('bom-sync-modal-stub')).not.toBeInTheDocument();

    await user.click(screen.getByText('⚙ Группы материалов'));
    expect(screen.getByTestId('material-groups-modal-stub')).toBeInTheDocument();

    await user.click(screen.getByText('⚖ Масса единицы'));
    expect(screen.getByTestId('unit-weight-modal-stub')).toBeInTheDocument();
  });
});

describe('SpecList — контекстное меню', () => {
  it('открывается по правому клику; закрывается по клику вне', async () => {
    const user = userEvent.setup();
    render(<SpecList {...baseProps} />);

    fireEvent.contextMenu(screen.getByText('КЭВ-1 узел'));
    expect(screen.getByText('✎ Переименовать')).toBeInTheDocument();

    await user.click(document.body);
    expect(screen.queryByText('✎ Переименовать')).not.toBeInTheDocument();
  });

  it('пункт "Удалить" виден только при canWrite', () => {
    const { rerender } = render(<SpecList {...baseProps} canWrite={false} />);
    fireEvent.contextMenu(screen.getByText('КЭВ-1 узел'));
    expect(screen.queryByText('✕ Удалить')).not.toBeInTheDocument();

    rerender(<SpecList {...baseProps} canWrite />);
    fireEvent.contextMenu(screen.getByText('КЭВ-1 узел'));
    expect(screen.getByText('✕ Удалить')).toBeInTheDocument();
  });

  it('переименование: успех сохраняет и обновляет список', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    bomApi.updateSpec.mockResolvedValue({ ok: true, data: { success: true } });
    render(<SpecList {...baseProps} onRefresh={onRefresh} />);

    fireEvent.contextMenu(screen.getByText('КЭВ-1 узел'));
    await user.click(screen.getByText('✎ Переименовать'));
    const input = screen.getByDisplayValue('КЭВ-1 узел');
    await user.clear(input);
    await user.type(input, 'Новое имя');
    await user.click(screen.getByText('Сохранить'));

    expect(bomApi.updateSpec).toHaveBeenCalledWith(1, { onec_name: 'Новое имя' });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Переименовать спецификацию')).not.toBeInTheDocument();
  });

  it('переименование: неудача показывает alert через showAlert, модалка остаётся открытой', async () => {
    const user = userEvent.setup();
    bomApi.updateSpec.mockResolvedValue({ ok: false, data: { error: 'Занято другим пользователем' } });
    render(<SpecList {...baseProps} />);

    fireEvent.contextMenu(screen.getByText('КЭВ-1 узел'));
    await user.click(screen.getByText('✎ Переименовать'));
    await user.click(screen.getByText('Сохранить'));

    expect(await screen.findByText('Занято другим пользователем')).toBeInTheDocument();
    expect(screen.getByText('Переименовать спецификацию')).toBeInTheDocument();
  });

  it('копирование: предзаполняет имя суффиксом "(копия)", успешно клонирует', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    bomApi.cloneSpec.mockResolvedValue({ ok: true, data: { success: true } });
    render(<SpecList {...baseProps} onRefresh={onRefresh} />);

    fireEvent.contextMenu(screen.getByText('КЭВ-1 узел'));
    await user.click(screen.getByText('⎘ Копировать'));
    expect(screen.getByDisplayValue('КЭВ-1 узел (копия)')).toBeInTheDocument();

    await user.click(screen.getByText('Создать копию'));
    expect(bomApi.cloneSpec).toHaveBeenCalledWith(1, 'КЭВ-1 узел (копия)');
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('удаление: запрашивает подтверждение через showConfirm, вызывает deleteSpec только после подтверждения', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    bomApi.deleteSpec.mockResolvedValue({ ok: true, data: { success: true } });
    render(<SpecList {...baseProps} onRefresh={onRefresh} />);

    fireEvent.contextMenu(screen.getByText('КЭВ-1 узел'));
    await user.click(screen.getByText('✕ Удалить'));

    expect(bomApi.deleteSpec).not.toHaveBeenCalled();
    expect(screen.getByText('Удалить спецификацию?')).toBeInTheDocument();

    await user.click(screen.getByText('Подтвердить'));
    expect(bomApi.deleteSpec).toHaveBeenCalledWith(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('удаление: отмена в ConfirmModal не вызывает deleteSpec', async () => {
    const user = userEvent.setup();
    render(<SpecList {...baseProps} />);

    fireEvent.contextMenu(screen.getByText('КЭВ-1 узел'));
    await user.click(screen.getByText('✕ Удалить'));
    await user.click(screen.getByText('Отмена'));

    expect(bomApi.deleteSpec).not.toHaveBeenCalled();
  });
});
