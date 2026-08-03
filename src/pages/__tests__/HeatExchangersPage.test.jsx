import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeatExchangersPage from '../HeatExchangersPage';
import { mediaApi } from '../../api/media';
import { useAuth } from '../../contexts/AuthContext';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../api/media', () => ({
  mediaApi: {
    getHeatExchangers: vi.fn(),
    createHeatExchanger: vi.fn(),
    updateHeatExchanger: vi.fn(),
    bulkCreateHeatExchangers: vi.fn(),
    uploadHeatExchangerDrawing: vi.fn(),
    searchDocuments: vi.fn(),
    downloadFile: vi.fn(),
    getFormData: vi.fn(),
  },
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
vi.mock('../../components/common/SmartSelect', () => ({
  default: ({ endpoint, placeholder, onSelect }) => (
    <div data-testid="smart-select" data-endpoint={endpoint}>
      <input placeholder={placeholder} readOnly />
      <button onClick={() => onSelect({ id: 900, external_id: 'DOC-1', name: 'Чертёж' })}>select-doc</button>
    </div>
  ),
}));

const withPerms = (...perms) => ({ id: 1, permissions: perms });
const ok = (data) => ({ ok: true, data });

const he1 = {
  id: 10, mark: 'ТЕРМА 01', configuration: 'S22-10', collector_type: 'L',
  overall_dimensions: '100x200x300', body_dimensions: '90x190',
  water_volume: 1.5, row_count: 2, tube_thickness: 0.5, fin_pitch: 2.5, fin_thickness: 0.2,
  circuit_count: 1, filters: [], drawing_files: [],
};
const he2 = {
  id: 11, mark: 'ТЕРМА 02', configuration: 'S30-05', collector_type: 'R',
  overall_dimensions: '110x210x310', body_dimensions: '100x200',
  water_volume: 2, row_count: 3, tube_thickness: 0.6, fin_pitch: 2.6, fin_thickness: 0.3,
  circuit_count: 2, filters: [], drawing_files: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ user: withPerms('portal.heat_exchanger.write') });
  mediaApi.getHeatExchangers.mockResolvedValue(ok({ data: [] }));
  mediaApi.getFormData.mockResolvedValue(ok({ axes: [], doc_types: [] }));
});

describe('HeatExchangersPage — список/загрузка/права', () => {
  it('показывает индикатор загрузки, затем пустой список с кнопкой создания', async () => {
    let resolveLoad;
    mediaApi.getHeatExchangers.mockReturnValue(new Promise(r => { resolveLoad = r; }));
    render(<HeatExchangersPage />);
    expect(screen.getByText('Загрузка...')).toBeInTheDocument();

    resolveLoad(ok({ data: [] }));
    expect(await screen.findByText('Теплообменников пока нет')).toBeInTheDocument();
    expect(screen.getByText('+ Добавить первый')).toBeInTheDocument();
  });

  it('ошибка загрузки показывает сообщение об ошибке', async () => {
    mediaApi.getHeatExchangers.mockResolvedValue({ ok: false, data: {} });
    render(<HeatExchangersPage />);
    expect(await screen.findByText('Ошибка загрузки')).toBeInTheDocument();
  });

  it('рендерит список со счётчиком', async () => {
    mediaApi.getHeatExchangers.mockResolvedValue(ok({ data: [he1, he2] }));
    render(<HeatExchangersPage />);
    expect(await screen.findByText('ТЕРМА 01')).toBeInTheDocument();
    expect(screen.getByText('ТЕРМА 02')).toBeInTheDocument();
    expect(screen.getByText('2 теплообменников')).toBeInTheDocument();
  });

  it('поиск фильтрует по марке и конфигурации, "Сбросить ×" очищает', async () => {
    mediaApi.getHeatExchangers.mockResolvedValue(ok({ data: [he1, he2] }));
    const user = userEvent.setup();
    render(<HeatExchangersPage />);
    await screen.findByText('ТЕРМА 01');

    await user.type(screen.getByPlaceholderText('Поиск по марке, конфигурации...'), 's30');
    expect(screen.queryByText('ТЕРМА 01')).not.toBeInTheDocument();
    expect(screen.getByText('ТЕРМА 02')).toBeInTheDocument();

    await user.click(screen.getByText('Сбросить ×'));
    expect(screen.getByText('ТЕРМА 01')).toBeInTheDocument();
  });

  it('пустой результат поиска показывает "Ничего не найдено" без кнопки создания', async () => {
    mediaApi.getHeatExchangers.mockResolvedValue(ok({ data: [he1] }));
    const user = userEvent.setup();
    render(<HeatExchangersPage />);
    await screen.findByText('ТЕРМА 01');
    await user.type(screen.getByPlaceholderText('Поиск по марке, конфигурации...'), 'zzz');
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
    expect(screen.queryByText('+ Добавить первый')).not.toBeInTheDocument();
  });

  it('без права portal.heat_exchanger.write: нет кнопки добавления нигде', async () => {
    useAuth.mockReturnValue({ user: withPerms() });
    render(<HeatExchangersPage />);
    await screen.findByText('Теплообменников пока нет');
    expect(screen.queryByText('+ Добавить')).not.toBeInTheDocument();
    expect(screen.queryByText('+ Добавить первый')).not.toBeInTheDocument();
  });
});

describe('HeatExchangersPage — переключатель режима создания', () => {
  it('"+ Добавить" открывает форму, по умолчанию режим "Добавить вручную"', async () => {
    const user = userEvent.setup();
    render(<HeatExchangersPage />);
    await screen.findByText('Теплообменников пока нет');
    await user.click(screen.getByText('+ Добавить'));

    expect(screen.getByText('Добавить вручную')).toHaveClass('bg-white');
    expect(screen.queryByPlaceholderText('Поиск по марке, конфигурации...')).not.toBeInTheDocument();
  });

  it('переключение на "Импорт JSON" показывает BulkImportForm', async () => {
    const user = userEvent.setup();
    render(<HeatExchangersPage />);
    await screen.findByText('Теплообменников пока нет');
    await user.click(screen.getByText('+ Добавить'));
    await user.click(screen.getByText('Импорт JSON'));
    expect(screen.getByText('JSON файл')).toBeInTheDocument();
  });

  it('"← Назад" закрывает форму', async () => {
    const user = userEvent.setup();
    render(<HeatExchangersPage />);
    await screen.findByText('Теплообменников пока нет');
    await user.click(screen.getByText('+ Добавить'));
    await user.click(screen.getByText('← Назад'));
    expect(screen.getByPlaceholderText('Поиск по марке, конфигурации...')).toBeInTheDocument();
  });
});

describe('HeatExchangersPage — HeatExchangerForm (создание)', () => {
  const openForm = async () => {
    const user = userEvent.setup();
    render(<HeatExchangersPage />);
    await screen.findByText('Теплообменников пока нет');
    await user.click(screen.getByText('+ Добавить'));
    return user;
  };

  it('успешное создание отправляет все поля и перезагружает список', async () => {
    mediaApi.createHeatExchanger.mockResolvedValue({ ok: true, data: { success: true, data: he1 } });
    const user = await openForm();

    const inputs = document.querySelectorAll('form input[required]');
    const values = ['ТЕРМА 01', '100', '200', '300', '90', '190', '1.5', '2', '0.5', '2.5', '0.2', '1', 'L', 'S22-10'];
    for (let i = 0; i < inputs.length; i++) {
      await user.type(inputs[i], values[i]);
    }

    mediaApi.getHeatExchangers.mockResolvedValue(ok({ data: [he1] }));
    await user.click(screen.getByText('Создать'));

    await waitFor(() => expect(mediaApi.createHeatExchanger).toHaveBeenCalledWith(expect.objectContaining({
      mark: 'ТЕРМА 01', collector_type: 'L', configuration: 'S22-10',
    })));
    expect(await screen.findByText('ТЕРМА 01')).toBeInTheDocument();
    expect(screen.queryByText('Добавить вручную')).not.toBeInTheDocument();
  });

  it('ошибка сохранения показывает data.error или дефолтный текст', async () => {
    mediaApi.createHeatExchanger.mockResolvedValue({ ok: true, data: { success: false, error: 'Марка уже существует' } });
    const user = await openForm();
    const inputs = document.querySelectorAll('form input[required]');
    for (const input of inputs) await user.type(input, '1');
    await user.click(screen.getByText('Создать'));
    expect(await screen.findByText('Марка уже существует')).toBeInTheDocument();

    mediaApi.createHeatExchanger.mockResolvedValue({ ok: false, data: {} });
    await user.click(screen.getByText('Создать'));
    expect(await screen.findByText('Ошибка сохранения')).toBeInTheDocument();
  });

  it('"Отмена" закрывает форму без сохранения', async () => {
    const user = await openForm();
    await user.click(screen.getByText('Отмена'));
    expect(screen.getByPlaceholderText('Поиск по марке, конфигурации...')).toBeInTheDocument();
    expect(mediaApi.createHeatExchanger).not.toHaveBeenCalled();
  });
});

describe('HeatExchangersPage — BulkImportForm', () => {
  const openImport = async () => {
    const user = userEvent.setup();
    render(<HeatExchangersPage />);
    await screen.findByText('Теплообменников пока нет');
    await user.click(screen.getByText('+ Добавить'));
    await user.click(screen.getByText('Импорт JSON'));
    return user;
  };

  it('"Импортировать" задизейблена без файла', async () => {
    await openImport();
    expect(screen.getByText('Импортировать')).toBeDisabled();
  });

  const uploadJson = async (user, text) => {
    const file = new File([text], 'items.json', { type: 'application/json' });
    const input = document.querySelector('input[type="file"]');
    await user.upload(input, file);
  };

  it('успешный импорт показывает created/updated/skipped, вызывает onImported при created>0', async () => {
    mediaApi.bulkCreateHeatExchangers.mockResolvedValue(ok({
      success: true, data: { created: 2, updated: 1, skipped: 1, errors: [] },
    }));
    mediaApi.getHeatExchangers.mockResolvedValue(ok({ data: [] }));
    const user = await openImport();
    await uploadJson(user, '[{"mark":"X"}]');
    mediaApi.getHeatExchangers.mockClear();
    await user.click(screen.getByText('Импортировать'));

    await waitFor(() => expect(mediaApi.bulkCreateHeatExchangers).toHaveBeenCalledWith([{ mark: 'X' }], false));
    expect(await screen.findByText(/Создано: 2/)).toBeInTheDocument();
    expect(screen.getByText(/Обновлено: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Пропущено: 1/)).toBeInTheDocument();
    await waitFor(() => expect(mediaApi.getHeatExchangers).toHaveBeenCalled());
  });

  it('errors-массив в успешном ответе рендерится построчно', async () => {
    mediaApi.bulkCreateHeatExchangers.mockResolvedValue(ok({
      success: true, data: { created: 0, updated: 0, skipped: 0, errors: ['Строка 3: нет марки'] },
    }));
    const user = await openImport();
    await uploadJson(user, '[{}]');
    await user.click(screen.getByText('Импортировать'));
    expect(await screen.findByText('✗ Строка 3: нет марки')).toBeInTheDocument();
  });

  it('невалидный JSON показывает сообщение об ошибке парсинга', async () => {
    const user = await openImport();
    await uploadJson(user, 'not json');
    await user.click(screen.getByText('Импортировать'));
    expect(await screen.findByText(/Невалидный JSON/)).toBeInTheDocument();
  });

  it('"Обновить существующие" передаётся вторым аргументом', async () => {
    mediaApi.bulkCreateHeatExchangers.mockResolvedValue(ok({ success: true, data: { created: 0, updated: 0, skipped: 0 } }));
    const user = await openImport();
    await uploadJson(user, '[{"mark":"X"}]');
    await user.click(screen.getByText('Обновить существующие'));
    await user.click(screen.getByText('Импортировать'));
    await waitFor(() => expect(mediaApi.bulkCreateHeatExchangers).toHaveBeenCalledWith([{ mark: 'X' }], true));
  });

  it('ok:false — показывает data.error', async () => {
    mediaApi.bulkCreateHeatExchangers.mockResolvedValue({ ok: false, data: { error: 'Нет прав' } });
    const user = await openImport();
    await uploadJson(user, '[{"mark":"X"}]');
    await user.click(screen.getByText('Импортировать'));
    expect(await screen.findByText('✗ Нет прав')).toBeInTheDocument();
  });
});

// ── Модуль 18 / шаг 2: HeatExchangerCard + DrawingPanel ───────────────────

describe('HeatExchangersPage — HeatExchangerCard', () => {
  const gotoCard = async (item = he1) => {
    mediaApi.getHeatExchangers.mockResolvedValue(ok({ data: [item] }));
    const user = userEvent.setup();
    render(<HeatExchangersPage />);
    await screen.findByText(item.mark);
    return user;
  };

  it('рендерит марку и все характеристики', async () => {
    await gotoCard();
    expect(screen.getByText('ТЕРМА 01')).toBeInTheDocument();
    expect(screen.getByText('100x200x300')).toBeInTheDocument();
    expect(screen.getByText('90x190')).toBeInTheDocument();
    expect(screen.getByText('1.5 л')).toBeInTheDocument();
    expect(screen.getByText('0.5 мм')).toBeInTheDocument();
    expect(screen.getByText('2.5 мм')).toBeInTheDocument();
    expect(screen.getByText('0.2 мм')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.getByText('S22-10')).toBeInTheDocument();
  });

  it('рендерит замоканные FiltersPanel/DirectProductsPanel с entityType="heat-exchanger"', async () => {
    await gotoCard();
    const filtersPanel = screen.getByTestId('filters-panel');
    expect(filtersPanel).toHaveAttribute('data-entity-id', '10');
    expect(filtersPanel).toHaveAttribute('data-entity-type', 'heat-exchanger');
    expect(filtersPanel).toHaveAttribute('data-can-write', 'true');
    expect(screen.getByTestId('direct-products-panel')).toHaveAttribute('data-entity-type', 'heat-exchanger');
  });

  it('находка: нет кнопок редактирования/удаления в DOM (editing/confirming недостижимы из UI)', async () => {
    await gotoCard();
    expect(screen.queryByText('✎')).not.toBeInTheDocument();
    expect(screen.queryByText('Удалить?')).not.toBeInTheDocument();
    // единственная "✕" на странице без чертежа — не из карточки/удаления, а её просто нет
    expect(screen.queryByText('✕')).not.toBeInTheDocument();
  });
});

describe('HeatExchangersPage — DrawingPanel', () => {
  const gotoCard = async (item = he1, overrides = {}) => {
    mediaApi.getHeatExchangers.mockResolvedValue(ok({ data: [item] }));
    mediaApi.getFormData.mockResolvedValue(ok({ axes: [], doc_types: [{ id: 5, code: 'heart_exchanger' }], ...overrides }));
    const user = userEvent.setup();
    render(<HeatExchangersPage />);
    await screen.findByText(item.mark);
    return user;
  };

  it('пустое состояние — "Перетащите файл", при dragover — "Отпустите для загрузки"', async () => {
    await gotoCard();
    expect(screen.getByText('Перетащите файл')).toBeInTheDocument();

    const dropzone = screen.getByText('Чертёж').closest('div');
    fireEvent.dragOver(dropzone);
    expect(await screen.findByText('Отпустите для загрузки')).toBeInTheDocument();
  });

  it('drag&drop загружает файл и обновляет список чертежей', async () => {
    mediaApi.uploadHeatExchangerDrawing.mockResolvedValue({ ok: true, data: { success: true } });
    mediaApi.getHeatExchangers.mockResolvedValueOnce(ok({ data: [he1] }));
    await gotoCard();

    mediaApi.getHeatExchangers.mockResolvedValue(ok({
      data: [{ ...he1, drawing_files: [{ rel_path: 'a/b.pdf', name: 'b.pdf', size: '12 KB' }] }],
    }));
    const dropzone = screen.getByText('Чертёж').closest('div');
    const file = new File(['x'], 'b.pdf', { type: 'application/pdf' });
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    await waitFor(() => expect(mediaApi.uploadHeatExchangerDrawing).toHaveBeenCalledWith(10, file));
    expect(await screen.findByText('b.pdf')).toBeInTheDocument();
    expect(screen.getByText('12 KB')).toBeInTheDocument();
    expect(screen.getByText('✓ Загружен')).toBeInTheDocument();
  });

  it('ошибка загрузки показывает data.error', async () => {
    mediaApi.uploadHeatExchangerDrawing.mockResolvedValue({ ok: false, data: { error: 'Слишком большой файл' } });
    await gotoCard();
    const dropzone = screen.getByText('Чертёж').closest('div');
    fireEvent.drop(dropzone, { dataTransfer: { files: [new File(['x'], 'b.pdf')] } });
    expect(await screen.findByText('Слишком большой файл')).toBeInTheDocument();
  });

  it('файл в списке: клик скачивает через blob-URL, ✕ отвязывает (только при canWrite)', async () => {
    const withDrawing = { ...he1, drawing_files: [{ rel_path: 'a/b.pdf', name: 'b.pdf', size: '12 KB' }] };
    const blob = new Blob(['x']);
    mediaApi.downloadFile.mockResolvedValue({ blob: () => Promise.resolve(blob) });
    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});

    const user = await gotoCard(withDrawing);
    await user.click(screen.getByText('b.pdf'));
    await waitFor(() => expect(mediaApi.downloadFile).toHaveBeenCalledWith('a/b.pdf'));
    expect(openSpy).toHaveBeenCalledWith('blob:mock-url', '_blank');

    vi.restoreAllMocks();
  });

  it('updateHeatExchanger(drawing_id: null) отвязывает чертёж', async () => {
    const withDrawing = { ...he1, drawing_files: [{ rel_path: 'a/b.pdf', name: 'b.pdf', size: '12 KB' }] };
    mediaApi.updateHeatExchanger.mockResolvedValue({ ok: true, data: { success: true } });
    const user = await gotoCard(withDrawing);
    await user.click(screen.getByText('✕'));
    await waitFor(() => expect(mediaApi.updateHeatExchanger).toHaveBeenCalledWith(10, { drawing_id: null }));
    expect(await screen.findByText('✓ Чертёж отвязан')).toBeInTheDocument();
    expect(screen.getByText('Перетащите файл')).toBeInTheDocument();
  });

  it('без canWrite: нет кнопки отвязки и "Привязать существующий"', async () => {
    useAuth.mockReturnValue({ user: withPerms() });
    const withDrawing = { ...he1, drawing_files: [{ rel_path: 'a/b.pdf', name: 'b.pdf', size: '12 KB' }] };
    await gotoCard(withDrawing);
    expect(screen.queryByText('✕')).not.toBeInTheDocument();
    expect(screen.queryByText(/Привязать существующий/)).not.toBeInTheDocument();
  });

  it('поиск SmartSelect идёт по своему endpoint, а не через mediaApi.searchDocuments', async () => {
    // Реальный поиск полностью делает SmartSelect через свой endpoint (см.
    // components/common/SmartSelect.jsx — там свой fetch по endpoint+q). DrawingPanel раньше
    // держал собственный мёртвый searchQuery/searchResults/searching + эффект на
    // mediaApi.searchDocuments, который никогда не вызывался из реального UI — блок удалён
    // при уборке мёртвого кода, mediaApi.searchDocuments в этом компоненте больше не используется.
    const user = await gotoCard();
    await user.click(screen.getByText(/Привязать существующий/));
    expect(screen.getByTestId('smart-select')).toHaveAttribute(
      'data-endpoint', '/api/v1/media/documents/search/?doc_type_id=5'
    );
    expect(mediaApi.searchDocuments).not.toHaveBeenCalled();
  });

  it('привязка существующего документа вызывает updateHeatExchanger с drawing_id', async () => {
    mediaApi.updateHeatExchanger.mockResolvedValue({ ok: true, data: { success: true } });
    mediaApi.getHeatExchangers.mockResolvedValueOnce(ok({ data: [he1] }));
    const user = await gotoCard();
    await user.click(screen.getByText(/Привязать существующий/));

    mediaApi.getHeatExchangers.mockResolvedValue(ok({
      data: [{ ...he1, drawing_files: [{ rel_path: 'x/doc.pdf', name: 'doc.pdf', size: '1 KB' }] }],
    }));
    await user.click(screen.getByText('select-doc'));

    await waitFor(() => expect(mediaApi.updateHeatExchanger).toHaveBeenCalledWith(10, { drawing_id: 900 }));
    expect(await screen.findByText(/✓ Привязан: DOC-1/)).toBeInTheDocument();
  });

  it('без doc_type "heart_exchanger" в конфиге drawingDocTypeId — endpoint SmartSelect с undefined', async () => {
    const user = await gotoCard(he1, { doc_types: [] });
    await user.click(screen.getByText(/Привязать существующий/));
    expect(screen.getByTestId('smart-select')).toHaveAttribute(
      'data-endpoint', '/api/v1/media/documents/search/?doc_type_id=undefined'
    );
  });
});
