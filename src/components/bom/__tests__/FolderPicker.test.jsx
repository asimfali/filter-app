import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FolderPicker from '../FolderPicker';
import { bomApi } from '../../../api/bom';

vi.mock('../../../api/bom', () => ({
  bomApi: { searchFolders: vi.fn(), getFolders: vi.fn(), createFolder: vi.fn() },
}));

const okList = (data) => ({ ok: true, data: { success: true, data } });
const PLACEHOLDER = 'Введите 2+ символа для поиска или полный путь для создания';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FolderPicker — nomenclature/manufacture (поиск через API)', () => {
  it('запрос короче 2 символов не ищет', async () => {
    const user = userEvent.setup();
    render(<FolderPicker value={null} onChange={vi.fn()} />);
    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'А');
    expect(bomApi.searchFolders).not.toHaveBeenCalled();
  });

  it('nomenclature: ищет с rootPath как есть', async () => {
    const user = userEvent.setup();
    bomApi.searchFolders.mockResolvedValue(okList([{ id: 1, path: 'ГОТОВАЯ ПРОДУКЦИЯ / КЭВ' }]));
    render(<FolderPicker value={null} onChange={vi.fn()} folderType="nomenclature" rootPath="ГОТОВАЯ ПРОДУКЦИЯ" />);

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'КЭВ');

    expect(bomApi.searchFolders).toHaveBeenCalledWith('nomenclature', 'КЭВ', 'ГОТОВАЯ ПРОДУКЦИЯ');
    expect(await screen.findByText('ГОТОВАЯ ПРОДУКЦИЯ / КЭВ')).toBeInTheDocument();
  });

  it('manufacture: всегда использует "ПРОИЗВОДСТВО" как root, игнорируя rootPath', async () => {
    const user = userEvent.setup();
    bomApi.searchFolders.mockResolvedValue(okList([]));
    render(<FolderPicker value={null} onChange={vi.fn()} folderType="manufacture" rootPath="ИГНОРИРУЕТСЯ" />);

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'Цех');

    expect(bomApi.searchFolders).toHaveBeenCalledWith('manufacture', 'Цех', 'ПРОИЗВОДСТВО');
  });

  it('выбор папки из списка вызывает onChange и закрывает список', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    bomApi.searchFolders.mockResolvedValue(okList([{ id: 1, path: 'Цех №1' }]));
    render(<FolderPicker value={null} onChange={onChange} folderType="manufacture" />);

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'Цех');
    await user.click(await screen.findByText('Цех №1'));

    expect(onChange).toHaveBeenCalledWith({ id: 1, path: 'Цех №1' });
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue('Цех №1');
  });
});

describe('FolderPicker — spec (локальный кэш всех папок)', () => {
  it('грузит все папки один раз при монтировании, фильтрует по rootPath', async () => {
    bomApi.getFolders.mockResolvedValue(okList([
      { id: 1, path: 'spec/КЭВ' }, { id: 2, path: 'other/X' },
    ]));
    render(<FolderPicker value={null} onChange={vi.fn()} folderType="spec" rootPath="spec" />);
    await act(async () => { await Promise.resolve(); });

    fireEvent.focus(screen.getByPlaceholderText(PLACEHOLDER));
    expect(screen.getByText('spec/КЭВ')).toBeInTheDocument();
    expect(screen.queryByText('other/X')).not.toBeInTheDocument();
    expect(bomApi.searchFolders).not.toHaveBeenCalled(); // локальная фильтрация, не через API
  });

  it('фильтрует локально по подстроке пути без учёта регистра', async () => {
    const user = userEvent.setup();
    bomApi.getFolders.mockResolvedValue(okList([
      { id: 1, path: 'spec/КЭВ-1' }, { id: 2, path: 'spec/КЭП-2' },
    ]));
    render(<FolderPicker value={null} onChange={vi.fn()} folderType="spec" />);
    await act(async () => { await Promise.resolve(); });

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'кэв');

    expect(screen.getByText('spec/КЭВ-1')).toBeInTheDocument();
    expect(screen.queryByText('spec/КЭП-2')).not.toBeInTheDocument();
  });
});

describe('FolderPicker — хлебные крошки', () => {
  it('рендерит крошки из value.path и позволяет навигацию без onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FolderPicker value={{ id: 1, path: 'Металл / АЛР / оц' }} onChange={onChange} />);

    expect(screen.getByText('Металл')).toBeInTheDocument();
    expect(screen.getByText('АЛР')).toBeInTheDocument();
    expect(screen.getByText('оц')).toBeInTheDocument();

    await user.click(screen.getByText('Металл'));
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue('Металл');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('FolderPicker — создание папки', () => {
  it('кнопка "+ Создать папку" задизейблена без текста', () => {
    render(<FolderPicker value={null} onChange={vi.fn()} />);
    expect(screen.getByText('+ Создать папку')).toBeDisabled();
  });

  it('без вложенности (без " / ") создаёт папку с пустым parent_path/parent_code', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    bomApi.createFolder.mockResolvedValue(okList({ id: 9, path: 'НоваяПапка' }));
    render(<FolderPicker value={null} onChange={onChange} folderType="nomenclature" />);

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'НоваяПапка');
    await user.click(screen.getByText('+ Создать папку'));

    expect(bomApi.createFolder).toHaveBeenCalledWith({
      name: 'НоваяПапка', parent_path: '', parent_code: '', folder_type: 'nomenclature',
    });
    expect(onChange).toHaveBeenCalledWith({ id: 9, path: 'НоваяПапка' });
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue('НоваяПапка');
  });

  it('с вложенным путём ищет parent_code по parentPath перед созданием', async () => {
    const user = userEvent.setup();
    bomApi.searchFolders.mockResolvedValue(okList([{ path: 'Металл / АЛР', onec_code: 'C-123' }]));
    bomApi.createFolder.mockResolvedValue(okList({ id: 10, path: 'Металл / АЛР / оц' }));
    render(<FolderPicker value={null} onChange={vi.fn()} folderType="nomenclature" />);

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'Металл / АЛР / оц' } });
    await user.click(screen.getByText('+ Создать папку'));

    expect(bomApi.searchFolders).toHaveBeenCalledWith('nomenclature', 'Металл / АЛР');
    expect(bomApi.createFolder).toHaveBeenCalledWith({
      name: 'оц', parent_path: 'Металл / АЛР', parent_code: 'C-123', folder_type: 'nomenclature',
    });
  });

  it('после успешного создания кнопка остаётся задизейбленной (created=true), пока текст не изменится', async () => {
    const user = userEvent.setup();
    bomApi.createFolder.mockResolvedValue(okList({ id: 9, path: 'X' }));
    render(<FolderPicker value={null} onChange={vi.fn()} folderType="nomenclature" />);

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'X');
    await user.click(screen.getByText('+ Создать папку'));

    expect(screen.getByText('+ Создать папку')).toBeDisabled();
  });
});

describe('FolderPicker — закрытие списка', () => {
  it('клик снаружи закрывает список результатов', async () => {
    const user = userEvent.setup();
    bomApi.searchFolders.mockResolvedValue(okList([{ id: 1, path: 'Цех №1' }]));
    render(
      <div>
        <div data-testid="outside" />
        <FolderPicker value={null} onChange={vi.fn()} folderType="manufacture" />
      </div>
    );
    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'Цех');
    expect(await screen.findByText('Цех №1')).toBeInTheDocument();

    await user.click(screen.getByTestId('outside'));
    expect(screen.queryByText('Цех №1')).not.toBeInTheDocument();
  });

  it('scroll на window не падает (e.target без closest)', async () => {
    const user = userEvent.setup();
    bomApi.searchFolders.mockResolvedValue(okList([{ id: 1, path: 'Цех №1' }]));
    render(<FolderPicker value={null} onChange={vi.fn()} folderType="manufacture" />);
    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'Цех');
    await screen.findByText('Цех №1');

    expect(() => fireEvent.scroll(window)).not.toThrow();
  });
});
