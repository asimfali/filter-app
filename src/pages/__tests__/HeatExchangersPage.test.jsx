import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
  default: ({ placeholder, onSelect }) => (
    <div>
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
