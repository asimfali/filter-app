import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PassportSyncModal from '../PassportSyncModal';
import { mediaApi } from '../../../api/media';

vi.mock('../../../api/media', () => ({
  mediaApi: {
    passportImportPreview: vi.fn(),
    passportImportApply: vi.fn(),
    passportExportUpdate: vi.fn(),
  },
}));

vi.mock('../../common/SmartSelect', () => ({
  default: ({ onSelect, placeholder }) => (
    <input
      placeholder={placeholder}
      data-testid="smart-select-stub"
      onChange={(e) => { if (e.target.value === 'PICK') onSelect({ id: 1, name: 'КЭВ-1 паспорт' }); }}
    />
  ),
}));

const userWith = (...perms) => ({ id: 1, permissions: perms });

const pickDocument = (container) => {
  fireEvent.change(container.querySelector('[data-testid="smart-select-stub"]'), { target: { value: 'PICK' } });
};

const attachJson = (container, name = 'data.json') => {
  const file = new File(['{}'], name, { type: 'application/json' });
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
  return file;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PassportSyncModal — гейт по правам', () => {
  it('без upload и update прав рендерит null', () => {
    const { container } = render(<PassportSyncModal user={userWith()} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('только с upload — нет кнопки экспорта', () => {
    render(<PassportSyncModal user={userWith('passport.documents.upload')} onClose={vi.fn()} />);
    expect(screen.queryByText('Обновить паспорт')).not.toBeInTheDocument();
  });

  it('только с update — нет кнопки "Проверить" (импорт недоступен)', () => {
    render(<PassportSyncModal user={userWith('passport.documents.update')} onClose={vi.fn()} />);
    expect(screen.queryByText('Проверить')).not.toBeInTheDocument();
    expect(screen.getByText('Обновить паспорт')).toBeInTheDocument();
  });
});

describe('PassportSyncModal — выбор документа и файла', () => {
  const user1 = userWith('passport.documents.upload');

  it('выбор документа через SmartSelect показывает чип с именем; "Сменить" сбрасывает', async () => {
    const user = userEvent.setup();
    const { container } = render(<PassportSyncModal user={user1} onClose={vi.fn()} />);

    pickDocument(container);
    expect(screen.getByText('КЭВ-1 паспорт')).toBeInTheDocument();
    expect(screen.queryByTestId('smart-select-stub')).not.toBeInTheDocument();

    await user.click(screen.getByText('Сменить'));
    expect(screen.queryByText('КЭВ-1 паспорт')).not.toBeInTheDocument();
    expect(screen.getByTestId('smart-select-stub')).toBeInTheDocument();
  });

  it('поле выбора JSON-файла появляется только после выбора документа', () => {
    const { container } = render(<PassportSyncModal user={user1} onClose={vi.fn()} />);
    expect(container.querySelector('input[type="file"]')).toBeNull();

    pickDocument(container);
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
  });

  it('выбор файла показывает его имя вместо "Выбрать файл"', () => {
    const { container } = render(<PassportSyncModal user={user1} onClose={vi.fn()} />);
    pickDocument(container);
    expect(screen.getByText('Выбрать файл')).toBeInTheDocument();

    attachJson(container, 'passport.json');
    expect(screen.getByText('passport.json')).toBeInTheDocument();
  });

  it('"Проверить" задизейблена, пока не выбраны и документ, и файл', () => {
    const { container } = render(<PassportSyncModal user={user1} onClose={vi.fn()} />);
    expect(screen.getByText('Проверить')).toBeDisabled();

    pickDocument(container);
    expect(screen.getByText('Проверить')).toBeDisabled(); // файла ещё нет

    attachJson(container);
    expect(screen.getByText('Проверить')).toBeEnabled();
  });
});

describe('PassportSyncModal — предпросмотр (handlePreview)', () => {
  const user1 = userWith('passport.documents.upload');

  const setupWithFile = (container) => {
    pickDocument(container);
    return attachJson(container);
  };

  it('успех: рендерит unmatched_models и карточки items, переключает кнопку на "Применить"', async () => {
    const user = userEvent.setup();
    const { container } = render(<PassportSyncModal user={user1} onClose={vi.fn()} />);
    const file = setupWithFile(container);

    mediaApi.passportImportPreview.mockResolvedValue({
      ok: true,
      data: {
        success: true,
        data: {
          unmatched_models: ['XYZ-1'],
          items: [{
            model_code: 'КЭВ-1', matched_products: ['12345'],
            written: ['power'], skipped_manual: ['weight'], unmatched_keys: ['color'],
          }],
        },
      },
    });

    await user.click(screen.getByText('Проверить'));

    expect(mediaApi.passportImportPreview).toHaveBeenCalledWith(1, file);
    expect(await screen.findByText('Не найдены товары для: XYZ-1')).toBeInTheDocument();
    expect(screen.getByText('КЭВ-1')).toBeInTheDocument();
    expect(screen.getByText('→ 12345')).toBeInTheDocument();
    expect(screen.getByText('Записано: 1, защищено: 1, не размечено: 1')).toBeInTheDocument();
    expect(screen.getByText('Применить')).toBeInTheDocument();
    expect(screen.queryByText('Проверить')).not.toBeInTheDocument();
  });

  it('неудача: показывает data.error (фолбэк "Ошибка предпросмотра") и возвращает стадию к "Проверить"', async () => {
    const user = userEvent.setup();
    const { container } = render(<PassportSyncModal user={user1} onClose={vi.fn()} />);
    setupWithFile(container);
    mediaApi.passportImportPreview.mockResolvedValue({ ok: false, data: {} });

    await user.click(screen.getByText('Проверить'));

    expect(await screen.findByText('Ошибка предпросмотра')).toBeInTheDocument();
    expect(screen.getByText('Проверить')).toBeInTheDocument();
  });

  it('неудача с явным data.error показывает его вместо дефолта', async () => {
    const user = userEvent.setup();
    const { container } = render(<PassportSyncModal user={user1} onClose={vi.fn()} />);
    setupWithFile(container);
    mediaApi.passportImportPreview.mockResolvedValue({ ok: true, data: { success: false, error: 'Битый JSON' } });

    await user.click(screen.getByText('Проверить'));

    expect(await screen.findByText('Битый JSON')).toBeInTheDocument();
  });

  it('без защищённых/неразмеченных полей строка "Записано" не добавляет лишних сегментов', async () => {
    const user = userEvent.setup();
    const { container } = render(<PassportSyncModal user={user1} onClose={vi.fn()} />);
    setupWithFile(container);
    mediaApi.passportImportPreview.mockResolvedValue({
      ok: true,
      data: { success: true, data: { items: [{ model_code: 'A', matched_products: [], written: ['x', 'y'] }] } },
    });

    await user.click(screen.getByText('Проверить'));

    expect(await screen.findByText('Записано: 2')).toBeInTheDocument();
  });
});

describe('PassportSyncModal — применение (handleApply)', () => {
  const user1 = userWith('passport.documents.upload');

  const toPreview = async (user, container) => {
    pickDocument(container);
    attachJson(container);
    mediaApi.passportImportPreview.mockResolvedValue({
      ok: true, data: { success: true, data: { items: [{ model_code: 'A', matched_products: ['1'] }] } },
    });
    await user.click(screen.getByText('Проверить'));
    await screen.findByText('Применить');
  };

  it('во время запроса показывает disabled "Применение..."', async () => {
    const user = userEvent.setup();
    const { container } = render(<PassportSyncModal user={user1} onClose={vi.fn()} />);
    await toPreview(user, container);

    let resolveApply;
    mediaApi.passportImportApply.mockReturnValue(new Promise((r) => { resolveApply = r; }));
    await user.click(screen.getByText('Применить'));

    expect(screen.getByText('Применение...')).toBeDisabled();
    resolveApply({ ok: true, data: { success: true, data: { items: [] } } });
    await screen.findByText('✓ Применено');
  });

  it('успех переводит стадию в done — вместо кнопки статичная плашка "✓ Применено"', async () => {
    const user = userEvent.setup();
    const { container } = render(<PassportSyncModal user={user1} onClose={vi.fn()} />);
    await toPreview(user, container);
    mediaApi.passportImportApply.mockResolvedValue({ ok: true, data: { success: true, data: { items: [] } } });

    await user.click(screen.getByText('Применить'));

    expect(await screen.findByText('✓ Применено')).toBeInTheDocument();
    expect(screen.queryByText('Применить')).not.toBeInTheDocument();
  });

  it('неудача возвращает стадию в "preview" (кнопка "Применить" остаётся) и показывает ошибку', async () => {
    const user = userEvent.setup();
    const { container } = render(<PassportSyncModal user={user1} onClose={vi.fn()} />);
    await toPreview(user, container);
    mediaApi.passportImportApply.mockResolvedValue({ ok: false, data: {} });

    await user.click(screen.getByText('Применить'));

    expect(await screen.findByText('Ошибка применения')).toBeInTheDocument();
    expect(screen.getByText('Применить')).toBeInTheDocument();
  });
});

describe('PassportSyncModal — экспорт (handleExport)', () => {
  const user1 = userWith('passport.documents.update');

  beforeEach(() => {
    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('задизейблена, пока не выбраны документ и файл', () => {
    const { container } = render(<PassportSyncModal user={user1} onClose={vi.fn()} />);
    expect(screen.getByText('Обновить паспорт')).toBeDisabled();
    pickDocument(container);
    expect(screen.getByText('Обновить паспорт')).toBeDisabled();
    attachJson(container);
    expect(screen.getByText('Обновить паспорт')).toBeEnabled();
  });

  it('успех скачивает blob через синтетическую ссылку и подчищает URL', async () => {
    const user = userEvent.setup();
    const { container } = render(<PassportSyncModal user={user1} onClose={vi.fn()} />);
    pickDocument(container);
    const file = attachJson(container);
    const blob = new Blob(['x']);
    mediaApi.passportExportUpdate.mockResolvedValue({ ok: true, blob, filename: 'passport-updated.json' });

    await user.click(screen.getByText('Обновить паспорт'));

    expect(mediaApi.passportExportUpdate).toHaveBeenCalledWith(1, file);
    expect(window.URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('показывает "Подготовка..." во время запроса', async () => {
    const user = userEvent.setup();
    const { container } = render(<PassportSyncModal user={user1} onClose={vi.fn()} />);
    pickDocument(container);
    attachJson(container);
    let resolveExport;
    mediaApi.passportExportUpdate.mockReturnValue(new Promise((r) => { resolveExport = r; }));

    await user.click(screen.getByText('Обновить паспорт'));
    expect(screen.getByText('Подготовка...')).toBeDisabled();

    resolveExport({ ok: true, blob: new Blob(['x']), filename: 'p.json' });
    await screen.findByText('Обновить паспорт');
  });

  it('неудача показывает result.error (фолбэк "Ошибка обновления паспорта"), без скачивания', async () => {
    const user = userEvent.setup();
    const { container } = render(<PassportSyncModal user={user1} onClose={vi.fn()} />);
    pickDocument(container);
    attachJson(container);
    mediaApi.passportExportUpdate.mockResolvedValue({ ok: false, error: 'Паспорт не найден на сайте' });

    await user.click(screen.getByText('Обновить паспорт'));

    expect(await screen.findByText('Паспорт не найден на сайте')).toBeInTheDocument();
    expect(window.URL.createObjectURL).not.toHaveBeenCalled();
  });
});

describe('PassportSyncModal — закрытие', () => {
  const user1 = userWith('passport.documents.upload');

  it('× в шапке, кнопка "Закрыть" и клик по фону вызывают onClose; клик по панели — нет', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<PassportSyncModal user={user1} onClose={onClose} />);

    await user.click(screen.getByText('Синхронизация паспортов'));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('кнопка "Закрыть" в футере вызывает onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PassportSyncModal user={user1} onClose={onClose} />);
    await user.click(screen.getByText('Закрыть'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
