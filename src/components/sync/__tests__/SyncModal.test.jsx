import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SyncModal from '../SyncModal';
import { externalApi } from '../../../api/external';
import { selectionApi } from '../../../api/selection';

vi.mock('../../../api/external', () => ({
  externalApi: {
    getSyncConfigs: vi.fn(),
    syncPrices: vi.fn(),
    syncCatalog: vi.fn(),
    getVariantRules: vi.fn(),
    applyVariantRules: vi.fn(),
    getRsyncFolders: vi.fn(),
    rsyncMedia: vi.fn(),
    pushFanCharts: vi.fn(),
    taskStatus: vi.fn(),
  },
}));
vi.mock('../../../api/media', () => ({
  mediaApi: { syncMediaToS3: vi.fn() },
}));
vi.mock('../../../api/selection', () => ({
  selectionApi: {
    extractUpload: vi.fn(),
    extractApply: vi.fn(),
    extractStatus: vi.fn(),
    dxfImportUpload: vi.fn(),
    dxfImportStatus: vi.fn(),
    dxfCheckExists: vi.fn(),
  },
}));

const userWith = (...perms) => ({ id: 1, permissions: perms });
const respOk = (data) => ({ ok: true, data });

// микрозадачи для .then()-цепочек, не завязанные на fake/real timers
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  // страховка от протечки fake timers между тестами (см. коммит ProfileModal)
  vi.useRealTimers();
});

describe('SyncModal — гейт по правам', () => {
  it('без нужного права рендерит null', () => {
    // Хуки (включая useEffect с config.loadItems()) выполняются независимо от
    // permission-гейта — он лишь обрывает JSX-рендер — поэтому loadItems всё
    // равно должен резолвиться, иначе .then() на undefined роняет компонент
    externalApi.getSyncConfigs.mockResolvedValue(respOk({ success: true, data: [] }));
    const { container } = render(<SyncModal user={userWith()} mode="prices" onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('SyncModal — generic async (mode="prices")', () => {
  const user1 = userWith('external.sync_prices');

  it('показывает "Загрузка...", пока список не пришёл', () => {
    externalApi.getSyncConfigs.mockReturnValue(new Promise(() => {}));
    render(<SyncModal user={user1} mode="prices" onClose={vi.fn()} />);
    expect(screen.getByText('Загрузка...')).toBeInTheDocument();
  });

  it('рендерит элементы, полученные из loadItems', async () => {
    externalApi.getSyncConfigs.mockResolvedValue(respOk({ success: true, data: [{ id: 1, name: 'Конфиг А' }] }));
    render(<SyncModal user={user1} mode="prices" onClose={vi.fn()} />);
    expect(await screen.findByText('Конфиг А')).toBeInTheDocument();
  });

  it('"Запустить все" задизейблен при пустом списке', () => {
    externalApi.getSyncConfigs.mockReturnValue(new Promise(() => {}));
    render(<SyncModal user={user1} mode="prices" onClose={vi.fn()} />);
    expect(screen.getByText('Запустить все')).toBeDisabled();
  });

  it('запуск: async-успех → поллинг taskStatus каждые 2с → formatResult при ready', async () => {
    vi.useFakeTimers();
    externalApi.getSyncConfigs.mockResolvedValue(respOk({ success: true, data: [{ id: 1, name: 'Конфиг А' }] }));
    render(<SyncModal user={user1} mode="prices" onClose={vi.fn()} />);
    await flush();

    externalApi.syncPrices.mockResolvedValue(respOk({ success: true, data: { task_id: 't1' } }));
    externalApi.taskStatus.mockResolvedValue(
      respOk({ success: true, data: { ready: true, result: { success: true, created: 3, updated: 5 } } })
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Запустить'));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(externalApi.syncPrices).toHaveBeenCalledWith(1);
    expect(screen.getByText('Выполняется...')).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    expect(externalApi.taskStatus).toHaveBeenCalledWith('t1');
    expect(screen.getByText('✓ Создано: 3, обновлено: 5')).toBeInTheDocument();
  });

  it('formatResult дописывает ", ошибок: N", если result.errors задан', async () => {
    vi.useFakeTimers();
    externalApi.getSyncConfigs.mockResolvedValue(respOk({ success: true, data: [{ id: 1, name: 'A' }] }));
    render(<SyncModal user={user1} mode="prices" onClose={vi.fn()} />);
    await flush();
    externalApi.syncPrices.mockResolvedValue(respOk({ success: true, data: { task_id: 't1' } }));
    externalApi.taskStatus.mockResolvedValue(
      respOk({ success: true, data: { ready: true, result: { success: true, created: 1, updated: 0, errors: 2 } } })
    );

    await act(async () => { fireEvent.click(screen.getByText('Запустить')); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    expect(screen.getByText('✓ Создано: 1, обновлено: 0, ошибок: 2')).toBeInTheDocument();
  });

  it('formatResult показывает ✗, если сама задача завершилась неуспехом', async () => {
    vi.useFakeTimers();
    externalApi.getSyncConfigs.mockResolvedValue(respOk({ success: true, data: [{ id: 1, name: 'A' }] }));
    render(<SyncModal user={user1} mode="prices" onClose={vi.fn()} />);
    await flush();
    externalApi.syncPrices.mockResolvedValue(respOk({ success: true, data: { task_id: 't1' } }));
    externalApi.taskStatus.mockResolvedValue(
      respOk({ success: true, data: { ready: true, result: { success: false, error: 'Нет соединения с 1С' } } })
    );

    await act(async () => { fireEvent.click(screen.getByText('Запустить')); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    expect(screen.getByText('✗ Нет соединения с 1С')).toBeInTheDocument();
  });

  it('продолжает опрашивать, если задача ещё не готова', async () => {
    vi.useFakeTimers();
    externalApi.getSyncConfigs.mockResolvedValue(respOk({ success: true, data: [{ id: 1, name: 'A' }] }));
    render(<SyncModal user={user1} mode="prices" onClose={vi.fn()} />);
    await flush();
    externalApi.syncPrices.mockResolvedValue(respOk({ success: true, data: { task_id: 't1' } }));
    externalApi.taskStatus.mockResolvedValue(respOk({ success: true, data: { ready: false } }));

    await act(async () => { fireEvent.click(screen.getByText('Запустить')); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(externalApi.taskStatus).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(externalApi.taskStatus).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Выполняется...')).toBeInTheDocument();
  });

  it('неудачный запуск (ok:false) сразу показывает "Ошибка", без поллинга', async () => {
    externalApi.getSyncConfigs.mockResolvedValue(respOk({ success: true, data: [{ id: 1, name: 'A' }] }));
    render(<SyncModal user={user1} mode="prices" onClose={vi.fn()} />);
    await flush();
    externalApi.syncPrices.mockResolvedValue({ ok: false, data: {} });

    await act(async () => { fireEvent.click(screen.getByText('Запустить')); await Promise.resolve(); await Promise.resolve(); });

    expect(screen.getByText('Ошибка')).toBeInTheDocument();
    expect(externalApi.taskStatus).not.toHaveBeenCalled();
  });

  it('неудачный запуск использует data.error.message, если он есть', async () => {
    externalApi.getSyncConfigs.mockResolvedValue(respOk({ success: true, data: [{ id: 1, name: 'A' }] }));
    render(<SyncModal user={user1} mode="prices" onClose={vi.fn()} />);
    await flush();
    externalApi.syncPrices.mockResolvedValue({ ok: true, data: { success: false, error: { message: 'Конфиг недоступен' } } });

    await act(async () => { fireEvent.click(screen.getByText('Запустить')); await Promise.resolve(); await Promise.resolve(); });

    expect(screen.getByText('Конфиг недоступен')).toBeInTheDocument();
  });

  it('runAll запускает элементы последовательно и блокирует футер на время выполнения', async () => {
    externalApi.getSyncConfigs.mockResolvedValue(
      respOk({ success: true, data: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] })
    );
    render(<SyncModal user={user1} mode="prices" onClose={vi.fn()} />);
    await flush();

    let resolveFirst;
    externalApi.syncPrices.mockImplementation((id) => {
      if (id === 1) return new Promise((r) => { resolveFirst = r; });
      return Promise.resolve(respOk({ success: true, data: { task_id: 't2' } }));
    });

    fireEvent.click(screen.getByText('Запустить все'));
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText('Запуск всех...')).toBeDisabled();
    expect(externalApi.syncPrices).toHaveBeenCalledTimes(1); // второй ждёт первого

    await act(async () => {
      resolveFirst(respOk({ success: true, data: { task_id: 't1' } }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(externalApi.syncPrices).toHaveBeenCalledTimes(2);
  });
});

describe('SyncModal — закрытие', () => {
  const user1 = userWith('external.sync_prices');

  beforeEach(() => {
    externalApi.getSyncConfigs.mockResolvedValue(respOk({ success: true, data: [] }));
  });

  it('× в шапке вызывает onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SyncModal user={user1} mode="prices" onClose={onClose} />);
    await user.click(screen.getByText('×'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('кнопка "Закрыть" в футере вызывает onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SyncModal user={user1} mode="prices" onClose={onClose} />);
    await user.click(screen.getByText('Закрыть'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('клик по фону вызывает onClose, клик по панели — нет', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<SyncModal user={user1} mode="prices" onClose={onClose} />);
    await user.click(screen.getByText('Обновить цены'));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape закрывает', () => {
    const onClose = vi.fn();
    render(<SyncModal user={user1} mode="prices" onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SyncModal — non-async с extraControls (mode="variants")', () => {
  const user1 = userWith('external.manage_variants');

  it('чекбокс resetFirst включён по умолчанию; успех приходит сразу, без поллинга', async () => {
    externalApi.getVariantRules.mockResolvedValue(respOk({ success: true, data: [{ id: 1, name: 'Правило А' }] }));
    render(<SyncModal user={user1} mode="variants" onClose={vi.fn()} />);
    await screen.findByText('Правило А');
    expect(screen.getByRole('checkbox')).toBeChecked();

    externalApi.applyVariantRules.mockResolvedValue(respOk({ success: true, data: { linked: 5, skipped: 1 } }));
    await act(async () => { fireEvent.click(screen.getByText('Запустить')); await Promise.resolve(); await Promise.resolve(); });

    expect(externalApi.applyVariantRules).toHaveBeenCalledWith(1, true);
    expect(screen.getByText('✓ Привязано: 5, пропущено: 1')).toBeInTheDocument();
    expect(externalApi.taskStatus).not.toHaveBeenCalled();
  });

  it('снятие чекбокса передаёт resetFirst=false в runItem', async () => {
    const user = userEvent.setup();
    externalApi.getVariantRules.mockResolvedValue(respOk({ success: true, data: [{ id: 1, name: 'Правило А' }] }));
    render(<SyncModal user={user1} mode="variants" onClose={vi.fn()} />);
    await screen.findByText('Правило А');
    externalApi.applyVariantRules.mockResolvedValue(respOk({ success: true, data: { linked: 0, skipped: 0 } }));

    await user.click(screen.getByRole('checkbox'));
    await act(async () => { fireEvent.click(screen.getByText('Запустить')); await Promise.resolve(); await Promise.resolve(); });

    expect(externalApi.applyVariantRules).toHaveBeenCalledWith(1, false);
  });

  it('formatResult дописывает ", сброшено: N", если result.data.reset задан', async () => {
    externalApi.getVariantRules.mockResolvedValue(respOk({ success: true, data: [{ id: 1, name: 'A' }] }));
    render(<SyncModal user={user1} mode="variants" onClose={vi.fn()} />);
    await screen.findByText('A');
    externalApi.applyVariantRules.mockResolvedValue(respOk({ success: true, data: { linked: 5, skipped: 1, reset: 10 } }));

    await act(async () => { fireEvent.click(screen.getByText('Запустить')); await Promise.resolve(); await Promise.resolve(); });

    expect(screen.getByText('✓ Привязано: 5, пропущено: 1, сброшено: 10')).toBeInTheDocument();
  });
});

describe('SyncModal — extract mode (PDF)', () => {
  const user1 = userWith('pdf.spec.write');

  const setupWithItem = async () => {
    render(<SyncModal user={user1} mode="extract" onClose={vi.fn()} />);
    await screen.findByText('Воздушные завесы');
  };

  it('выбор PDF-файла показывает имя и кнопку "Обработать"', async () => {
    await setupWithItem();
    const file = new File(['x'], 'passport.pdf', { type: 'application/pdf' });
    fireEvent.change(document.getElementById('extract-file-zavesy'), { target: { files: [file] } });

    expect(screen.getByText('passport.pdf')).toBeInTheDocument();
    expect(screen.getByText('Обработать')).toBeInTheDocument();
  });

  // Поллинг extract/dxf_import идёт через динамический import('../../api/selection')
  // внутри setInterval-колбэка — vi.advanceTimersByTimeAsync не успевает прокачать
  // микротаски динамического импорта и тест виснет до таймаута. Используем реальные
  // таймеры + findByText с увеличенным timeout вместо fake timers (~2с интервал компонента).
  it('успешная обработка: extractUpload → async-задача → поллинг → "✓ Найдено: N моделей"', async () => {
    await setupWithItem();
    const file = new File(['x'], 'p.pdf');
    fireEvent.change(document.getElementById('extract-file-zavesy'), { target: { files: [file] } });

    selectionApi.extractUpload.mockResolvedValue(respOk({ success: true, data: { task_id: 'tE' } }));
    selectionApi.extractStatus.mockResolvedValue(respOk({ success: true, data: { status: 'COMPLETED', items_found: 7 } }));

    await act(async () => {
      fireEvent.click(screen.getByText('Обработать'));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(selectionApi.extractUpload).toHaveBeenCalledWith('zavesy', file);

    expect(await screen.findByText('✓ Найдено: 7 моделей', {}, { timeout: 3000 })).toBeInTheDocument();
  }, 8000);

  it('провал задачи показывает error_log.error с фолбэком "Ошибка"', async () => {
    await setupWithItem();
    fireEvent.change(document.getElementById('extract-file-zavesy'), { target: { files: [new File(['x'], 'p.pdf')] } });
    selectionApi.extractUpload.mockResolvedValue(respOk({ success: true, data: { task_id: 'tE' } }));
    selectionApi.extractStatus.mockResolvedValue(
      respOk({ success: true, data: { status: 'FAILED', error_log: { error: 'Битый PDF' } } })
    );

    await act(async () => { fireEvent.click(screen.getByText('Обработать')); await Promise.resolve(); await Promise.resolve(); });

    expect(await screen.findByText('✗ Битый PDF', {}, { timeout: 3000 })).toBeInTheDocument();
  }, 8000);

  it('после готовности показывает Dry run / Применить, использующие taskId завершённой задачи', async () => {
    await setupWithItem();
    fireEvent.change(document.getElementById('extract-file-zavesy'), { target: { files: [new File(['x'], 'p.pdf')] } });
    selectionApi.extractUpload.mockResolvedValue(respOk({ success: true, data: { task_id: 'tE' } }));
    selectionApi.extractStatus.mockResolvedValue(respOk({ success: true, data: { status: 'COMPLETED', items_found: 3 } }));

    await act(async () => { fireEvent.click(screen.getByText('Обработать')); await Promise.resolve(); await Promise.resolve(); });
    await screen.findByText('✓ Найдено: 3 моделей', {}, { timeout: 3000 });

    selectionApi.extractApply.mockResolvedValue({
      data: { success: true, data: { matched: 3, created: 2, updated: 1 } },
    });
    await act(async () => { fireEvent.click(screen.getByText('Dry run')); await Promise.resolve(); await Promise.resolve(); });

    expect(selectionApi.extractApply).toHaveBeenCalledWith('tE', true);
    // getNodeText учитывает только прямые текстовые узлы элемента — текст span'а
    // "dry run · " не входит в textContent родительского <p> для целей getByText,
    // и сам span после нормализации (trim) теряет конечный пробел
    expect(screen.getByText(/dry run/)).toBeInTheDocument();
    expect(screen.getByText(/найдено 3 · создано 2 · обновлено 1/)).toBeInTheDocument();
  }, 8000);
});

describe('SyncModal — dxf_import mode', () => {
  const user1 = userWith('portal.chart.write');

  const setup = async () => {
    render(<SyncModal user={user1} mode="dxf_import" onClose={vi.fn()} />);
    await screen.findByText('DXF-файлы вентиляторов');
  };

  const attachFile = (name = 'КЭВ-1.dxf') => {
    const file = new File(['x'], name);
    fireEvent.change(document.getElementById('dxf-file-dxf'), { target: { files: [file] } });
    return file;
  };

  it('без выбранных файлов кнопка "Импортировать" не рендерится', async () => {
    await setup();
    expect(screen.queryByText('Импортировать')).not.toBeInTheDocument();
  });

  it('exists=true показывает предупреждение с "Заменить"/"Добавить кривые", импорт ещё не запущен', async () => {
    await setup();
    attachFile();
    selectionApi.dxfCheckExists.mockResolvedValue({ ok: true, data: { results: [{ id: 1 }] } });

    await act(async () => { fireEvent.click(screen.getByText('Импортировать')); await Promise.resolve(); await Promise.resolve(); });

    expect(selectionApi.dxfCheckExists).toHaveBeenCalledWith('КЭВ-1');
    expect(screen.getByText('График уже существует в БД')).toBeInTheDocument();
    expect(selectionApi.dxfImportUpload).not.toHaveBeenCalled();
  });

  it('"Заменить" запускает runDxfImport с merge=false', async () => {
    await setup();
    const file = attachFile();
    selectionApi.dxfCheckExists.mockResolvedValue({ ok: true, data: { results: [{ id: 1 }] } });
    await act(async () => { fireEvent.click(screen.getByText('Импортировать')); await Promise.resolve(); await Promise.resolve(); });

    selectionApi.dxfImportUpload.mockResolvedValue(respOk({ success: true, data: { task_id: 'tD' } }));
    await act(async () => { fireEvent.click(screen.getByText('Заменить')); await Promise.resolve(); await Promise.resolve(); });

    expect(selectionApi.dxfImportUpload).toHaveBeenCalledWith([file], 'КЭВ-1', 20.0, true, false, undefined);
    expect(screen.queryByText('График уже существует в БД')).not.toBeInTheDocument();
  });

  it('"Добавить кривые" запускает runDxfImport с merge=true', async () => {
    await setup();
    const file = attachFile();
    selectionApi.dxfCheckExists.mockResolvedValue({ ok: true, data: { results: [{ id: 1 }] } });
    await act(async () => { fireEvent.click(screen.getByText('Импортировать')); await Promise.resolve(); await Promise.resolve(); });

    selectionApi.dxfImportUpload.mockResolvedValue(respOk({ success: true, data: { task_id: 'tD' } }));
    await act(async () => { fireEvent.click(screen.getByText('Добавить кривые')); await Promise.resolve(); await Promise.resolve(); });

    expect(selectionApi.dxfImportUpload).toHaveBeenCalledWith([file], 'КЭВ-1', 20.0, true, true, undefined);
  });

  it('exists=false запускает импорт напрямую, без предупреждения', async () => {
    await setup();
    const file = attachFile();
    selectionApi.dxfCheckExists.mockResolvedValue({ ok: true, data: { results: [] } });
    selectionApi.dxfImportUpload.mockResolvedValue(respOk({ success: true, data: { task_id: 'tD' } }));

    await act(async () => { fireEvent.click(screen.getByText('Импортировать')); await Promise.resolve(); await Promise.resolve(); });

    expect(screen.queryByText('График уже существует в БД')).not.toBeInTheDocument();
    expect(selectionApi.dxfImportUpload).toHaveBeenCalledWith([file], 'КЭВ-1', 20.0, true, false, undefined);
  });

  it('явно указанный External ID переопределяет имя, взятое из файла', async () => {
    await setup();
    attachFile('some-file.dxf');
    await userEvent.setup().type(
      screen.getByPlaceholderText('External ID (если пусто — из имени файла)'),
      'КЭВ-Кастом'
    );
    selectionApi.dxfCheckExists.mockResolvedValue({ ok: true, data: { results: [] } });
    selectionApi.dxfImportUpload.mockResolvedValue(respOk({ success: true, data: { task_id: 'tD' } }));

    await act(async () => { fireEvent.click(screen.getByText('Импортировать')); await Promise.resolve(); await Promise.resolve(); });

    expect(selectionApi.dxfCheckExists).toHaveBeenCalledWith('КЭВ-Кастом');
  });

  // Реальные таймеры — см. комментарий в блоке extract mode: динамический
  // import() внутри интервала не дружит с vi.advanceTimersByTimeAsync.
  it('поллинг ready: успех → "✓ Файлов: X, ошибок: Y"', async () => {
    await setup();
    attachFile();
    selectionApi.dxfCheckExists.mockResolvedValue({ ok: true, data: { results: [] } });
    selectionApi.dxfImportUpload.mockResolvedValue(respOk({ success: true, data: { task_id: 'tD' } }));
    await act(async () => { fireEvent.click(screen.getByText('Импортировать')); await Promise.resolve(); await Promise.resolve(); });

    selectionApi.dxfImportStatus.mockResolvedValue(
      respOk({ success: true, data: { status: 'COMPLETED', files_done: 4, files_failed: 1 } })
    );

    expect(await screen.findByText('✓ Файлов: 4, ошибок: 1', {}, { timeout: 3000 })).toBeInTheDocument();
  }, 8000);

  it('поллинг ready: провал → "✗ Ошибка импорта"', async () => {
    await setup();
    attachFile();
    selectionApi.dxfCheckExists.mockResolvedValue({ ok: true, data: { results: [] } });
    selectionApi.dxfImportUpload.mockResolvedValue(respOk({ success: true, data: { task_id: 'tD' } }));
    await act(async () => { fireEvent.click(screen.getByText('Импортировать')); await Promise.resolve(); await Promise.resolve(); });

    selectionApi.dxfImportStatus.mockResolvedValue(
      respOk({ success: true, data: { status: 'FAILED' } })
    );

    expect(await screen.findByText('✗ Ошибка импорта', {}, { timeout: 3000 })).toBeInTheDocument();
  }, 8000);
});
