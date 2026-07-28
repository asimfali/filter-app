import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ParameterEditorPage from '../ParameterEditorPage';
import { apiFetch } from '../../api/auth';

vi.mock('../../api/auth', () => ({ apiFetch: vi.fn() }));

const resp = (data, ok = true) => ({ ok, json: () => Promise.resolve(data) });

const pt1 = { id: 1, name: 'Калорифер' };
const pt2 = { id: 2, name: 'Приточная установка' };

const axis1 = { id: 10, name: 'Дизайн', code: 'design', order: 1, axis_type: 'classifier', values_count: 3 };
const axis2 = { id: 11, name: 'Мощность', code: 'power', order: 2, axis_type: 'reference', values_count: 0 };

// Роутер по умолчанию: пустые значения там, где не важно для конкретного теста.
const routeFetch = (overrides = {}) => (url, opts = {}) => {
  const method = opts.method || 'GET';
  if (url.includes('/product-types/')) return Promise.resolve(resp(overrides.productTypes ?? [pt1, pt2]));
  if (url.includes('/parameter-axes/') && (method === 'POST' || method === 'PATCH')) {
    return Promise.resolve((overrides.saveAxis || (() => resp({ id: 99, order: 0 })))());
  }
  if (url.includes('/force-delete/') && method === 'DELETE') {
    return Promise.resolve((overrides.forceDelete || (() => resp({ success: true })))());
  }
  if (url.includes('/parameter-axes/') && method === 'DELETE') {
    return Promise.resolve((overrides.deleteAxis || (() => resp({}, true)))());
  }
  if (url.includes('/parameter-axes/')) return Promise.resolve(resp(overrides.axes ?? [axis2, axis1]));
  if (url.includes('/parameter-values/') && (method === 'POST' || method === 'PATCH')) {
    return Promise.resolve((overrides.saveValue || (() => resp({ id: 999 })))());
  }
  if (url.includes('/parameter-values/')) return Promise.resolve(resp(overrides.values ?? []));
  if (url.includes('/axis-orders/') && method === 'POST') {
    return Promise.resolve((overrides.saveAxisOrder || (() => resp({ id: 999 })))());
  }
  if (url.includes('/axis-orders/')) return Promise.resolve(resp(overrides.axisOrders ?? []));
  return Promise.resolve(resp({}));
};

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockImplementation(routeFetch());
});

// Опции <select> появляются только после резолва product-types — ждём их перед выбором.
const selectProductType = async (user, id = '1') => {
  await screen.findByRole('option', { name: 'Калорифер' });
  await user.selectOptions(screen.getByDisplayValue('— выберите —'), id);
};

describe('ParameterEditorPage — режимы и загрузка осей', () => {
  it('в режиме "по типу продукции" без выбранного типа показывает заглушку', async () => {
    render(<ParameterEditorPage />);
    expect(await screen.findByText('Выберите тип продукции')).toBeInTheDocument();
    expect(screen.queryByText('Оси параметров')).not.toBeInTheDocument();
  });

  it('выбор типа продукции подгружает оси с фильтром ?product_type=<id>, отсортированные по order', async () => {
    const user = userEvent.setup();
    render(<ParameterEditorPage />);
    await screen.findByText('Выберите тип продукции');

    await selectProductType(user);
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/parameter-axes/?product_type=1')));

    const names = (await screen.findAllByText(/Дизайн|Мощность/)).map(n => n.textContent);
    expect(names).toEqual(['Дизайн', 'Мощность']);
  });

  it('режим "Общие оси" запрашивает ?product_type=global без селектора типа', async () => {
    const user = userEvent.setup();
    render(<ParameterEditorPage />);
    await user.click(screen.getByText('Общие оси'));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/parameter-axes/?product_type=global')));
    expect(screen.queryByText('Тип продукции')).not.toBeInTheDocument();
    expect(await screen.findByText('Дизайн')).toBeInTheDocument();
  });

  it('пустой список осей и клик по оси подсвечивает её / показывает панель значений', async () => {
    apiFetch.mockImplementation(routeFetch({ axes: [] }));
    const user = userEvent.setup();
    render(<ParameterEditorPage />);
    await selectProductType(user);
    expect(await screen.findByText('Нет осей')).toBeInTheDocument();
    expect(screen.getByText('Выберите ось для редактирования значений')).toBeInTheDocument();
  });

  it('клик по оси открывает панель значений с её именем', async () => {
    const user = userEvent.setup();
    render(<ParameterEditorPage />);
    await selectProductType(user);
    await user.click(await screen.findByText('Дизайн'));
    expect(await screen.findByText(/«Дизайн»/)).toBeInTheDocument();
  });
});

describe('ParameterEditorPage — AxisForm (создание/редактирование)', () => {
  const gotoTyped = async () => {
    const user = userEvent.setup();
    render(<ParameterEditorPage />);
    await selectProductType(user);
    await screen.findByText('Дизайн');
    return user;
  };

  it('"+ Ось" открывает модалку создания, автогенерирует code из name', async () => {
    const user = await gotoTyped();
    await user.click(screen.getByText('+ Ось'));
    expect(screen.getByText('Новая ось параметра')).toBeInTheDocument();

    // code — латиница/цифры/подчёркивание; кириллица отфильтровывается regex'ом на приведение
    await user.type(screen.getByPlaceholderText('Дизайн'), 'Mount Type!');
    expect(screen.getByPlaceholderText('design')).toHaveValue('mount_type');
  });

  it('переключение типа оси на "Справочная" показывает FilterRulesEditor', async () => {
    const user = await gotoTyped();
    await user.click(screen.getByText('+ Ось'));
    expect(screen.queryByText('Правила фильтрации')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByDisplayValue('Классификационная (граф)'), 'reference');
    expect(screen.getByText('Правила фильтрации')).toBeInTheDocument();
  });

  it('успешное создание отправляет POST и добавляет ось в список с сортировкой по order', async () => {
    apiFetch.mockImplementation(routeFetch({ saveAxis: () => resp({ id: 20, name: 'Новая', code: 'new', order: 0, axis_type: 'classifier' }) }));
    const user = await gotoTyped();
    await user.click(screen.getByText('+ Ось'));
    await user.type(screen.getByPlaceholderText('Дизайн'), 'Новая');
    await user.clear(screen.getByPlaceholderText('design'));
    await user.type(screen.getByPlaceholderText('design'), 'new');

    await user.click(screen.getByText('Создать'));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/v1/catalog/parameter-axes/', expect.objectContaining({
      method: 'POST',
    })));
    expect(await screen.findByText('Новая')).toBeInTheDocument();
    expect(screen.queryByText('Новая ось параметра')).not.toBeInTheDocument();
  });

  it('ошибка создания (403) показывает сообщение о правах', async () => {
    apiFetch.mockImplementation(routeFetch({ saveAxis: () => resp({ detail: 'no' }, false) }));
    apiFetch.mockImplementation((url, opts = {}) => {
      const method = opts.method || 'GET';
      if (url.includes('/parameter-axes/') && method === 'POST') {
        return Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({}) });
      }
      return routeFetch()(url, opts);
    });
    const user = await gotoTyped();
    await user.click(screen.getByText('+ Ось'));
    await user.type(screen.getByPlaceholderText('Дизайн'), 'X');
    await user.click(screen.getByText('Создать'));
    expect(await screen.findByText('Недостаточно прав для выполнения операции')).toBeInTheDocument();
  });

  it('ошибка создания (объект полей) джойнит значения через запятую', async () => {
    apiFetch.mockImplementation((url, opts = {}) => {
      const method = opts.method || 'GET';
      if (url.includes('/parameter-axes/') && method === 'POST') {
        return Promise.resolve(resp({ code: ['Уже существует'], name: ['Обязательное поле'] }, false));
      }
      return routeFetch()(url, opts);
    });
    const user = await gotoTyped();
    await user.click(screen.getByText('+ Ось'));
    await user.type(screen.getByPlaceholderText('Дизайн'), 'X');
    await user.click(screen.getByText('Создать'));
    expect(await screen.findByText('Уже существует, Обязательное поле')).toBeInTheDocument();
  });

  it('"✎" открывает редактирование без изменения code при правке name', async () => {
    const user = await gotoTyped();
    // список отсортирован по order: [0]=Дизайн(1), [1]=Мощность(2)
    await user.click(screen.getAllByTitle('Редактировать')[1]);
    expect(screen.getByText('Редактировать ось')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Мощность')).toBeInTheDocument();

    const nameInput = screen.getByDisplayValue('Мощность');
    await user.type(nameInput, '2');
    expect(screen.getByDisplayValue('power')).toBeInTheDocument();
  });

  it('редактирование существующей оси отправляет PATCH на её id', async () => {
    apiFetch.mockImplementation(routeFetch({ saveAxis: () => resp({ id: 11, name: 'Мощность 2', code: 'power', order: 2, axis_type: 'reference' }) }));
    const user = await gotoTyped();
    await user.click(screen.getAllByTitle('Редактировать')[1]);
    await user.click(screen.getByText('Сохранить'));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/v1/catalog/parameter-axes/11/', expect.objectContaining({
      method: 'PATCH',
    })));
  });
});

describe('ParameterEditorPage — удаление оси', () => {
  const gotoTyped = async () => {
    const user = userEvent.setup();
    render(<ParameterEditorPage />);
    await selectProductType(user);
    await screen.findByText('Дизайн');
    return user;
  };

  it('успешное удаление (ok) убирает ось из списка и сбрасывает выбор, если она была выбрана', async () => {
    const user = await gotoTyped();
    await user.click(screen.getByText('Дизайн'));
    expect(await screen.findByText(/«Дизайн»/)).toBeInTheDocument();

    await user.click(screen.getAllByTitle('Удалить')[0]);
    await waitFor(() => expect(screen.queryByText('Дизайн')).not.toBeInTheDocument());
    expect(screen.queryByText(/«Дизайн»/)).not.toBeInTheDocument();
  });

  it('конфликт (не ok): подтверждение через confirm() запускает force-delete', async () => {
    apiFetch.mockImplementation(routeFetch({
      deleteAxis: () => resp({ error: 'conflict' }, false),
      forceDelete: () => resp({ success: true }),
    }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = await gotoTyped();
    await user.click(screen.getAllByTitle('Удалить')[0]);

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      expect.stringContaining('/force-delete/'), expect.objectContaining({ method: 'DELETE' })
    ));
    await waitFor(() => expect(screen.queryByText('Дизайн')).not.toBeInTheDocument());
  });

  it('конфликт: отказ в confirm() не отправляет force-delete', async () => {
    apiFetch.mockImplementation(routeFetch({ deleteAxis: () => resp({ error: 'conflict' }, false) }));
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = await gotoTyped();
    apiFetch.mockClear();
    apiFetch.mockImplementation(routeFetch({ deleteAxis: () => resp({ error: 'conflict' }, false) }));
    await user.click(screen.getAllByTitle('Удалить')[0]);

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/parameter-axes/10/'), expect.objectContaining({ method: 'DELETE' })));
    expect(apiFetch).not.toHaveBeenCalledWith(expect.stringContaining('/force-delete/'), expect.anything());
    expect(await screen.findByText('Дизайн')).toBeInTheDocument();
  });

  it('force-delete неуспешен (success: false) — ось остаётся в списке', async () => {
    apiFetch.mockImplementation(routeFetch({
      deleteAxis: () => resp({ error: 'conflict' }, false),
      forceDelete: () => resp({ success: false }),
    }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = await gotoTyped();
    await user.click(screen.getAllByTitle('Удалить')[0]);
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/force-delete/'), expect.anything()));
    expect(screen.getByText('Дизайн')).toBeInTheDocument();
  });
});

// ── Модуль 15 / шаг 2: значения оси + доп. панели ─────────────────────────

const value1 = { id: 200, axis: 10, value: 'Комфорт', sort_order: 2 };
const value2 = { id: 201, axis: 10, value: 'Эконом', sort_order: 1 };

describe('ParameterEditorPage — ValuesPanel / ValueForm', () => {
  const gotoValues = async (overrides = {}) => {
    apiFetch.mockImplementation(routeFetch(overrides));
    const user = userEvent.setup();
    render(<ParameterEditorPage />);
    await selectProductType(user);
    await user.click(await screen.findByText('Дизайн'));
    await screen.findByText(/«Дизайн»/);
    return user;
  };

  it('сортирует значения по sort_order, затем по алфавиту', async () => {
    await gotoValues({ values: [value1, value2] });
    const names = (await screen.findAllByText(/Комфорт|Эконом/)).map(n => n.textContent);
    expect(names).toEqual(['Эконом', 'Комфорт']);
  });

  it('пустой список значений показывает подсказку', async () => {
    await gotoValues({ values: [] });
    expect(await screen.findByText('Нет значений. Добавьте первое.')).toBeInTheDocument();
  });

  it('"+ Добавить значение" создаёт новое значение (POST) и перезагружает список', async () => {
    const user = await gotoValues({ values: [] });
    apiFetch.mockImplementation(routeFetch({
      values: [],
      saveValue: () => resp({ id: 202, axis: 10, value: 'Премиум', sort_order: 0 }),
    }));
    await user.click(screen.getByText('+ Добавить значение'));
    expect(screen.getByText('Новое значение')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Комфорт'), 'Премиум');
    apiFetch.mockImplementation(routeFetch({
      values: [{ id: 202, axis: 10, value: 'Премиум', sort_order: 0 }],
      saveValue: () => resp({ id: 202, axis: 10, value: 'Премиум', sort_order: 0 }),
    }));
    await user.click(screen.getByText('Добавить'));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/v1/catalog/parameter-values/', expect.objectContaining({
      method: 'POST',
    })));
    expect(await screen.findByText('Премиум')).toBeInTheDocument();
    expect(screen.queryByText('Новое значение')).not.toBeInTheDocument();
  });

  it('редактирование значения отправляет PATCH на его id', async () => {
    const user = await gotoValues({ values: [value1] });
    await screen.findByText('Комфорт');
    apiFetch.mockImplementation(routeFetch({
      values: [value1],
      saveValue: () => resp({ ...value1, value: 'Комфорт+' }),
    }));
    await user.click(screen.getByText('Изменить'));
    await user.click(screen.getByText('Сохранить'));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/v1/catalog/parameter-values/200/', expect.objectContaining({
      method: 'PATCH',
    })));
  });

  it('ошибка сохранения значения показывает parseApiError', async () => {
    const user = await gotoValues({ values: [] });
    apiFetch.mockImplementation(routeFetch({ values: [], saveValue: () => resp({ detail: 'Дубликат значения' }, false) }));
    await user.click(screen.getByText('+ Добавить значение'));
    await user.type(screen.getByPlaceholderText('Комфорт'), 'X');
    await user.click(screen.getByText('Добавить'));
    expect(await screen.findByText('Дубликат значения')).toBeInTheDocument();
  });

  it('удаление значения запрашивает confirm() и убирает его из списка', async () => {
    const user = await gotoValues({ values: [value1] });
    await screen.findByText('Комфорт');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByText('Удалить'));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      expect.stringContaining('/parameter-values/200/'), expect.objectContaining({ method: 'DELETE' })
    ));
    expect(screen.queryByText('Комфорт')).not.toBeInTheDocument();
  });

  it('отказ в confirm() не отправляет DELETE', async () => {
    const user = await gotoValues({ values: [value1] });
    await screen.findByText('Комфорт');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    apiFetch.mockClear();
    await user.click(screen.getByText('Удалить'));
    expect(apiFetch).not.toHaveBeenCalledWith(expect.stringContaining('/parameter-values/200/'), expect.anything());
    expect(screen.getByText('Комфорт')).toBeInTheDocument();
  });
});

describe('ParameterEditorPage — BulkAddValues', () => {
  const gotoValues = async (overrides = {}) => {
    apiFetch.mockImplementation(routeFetch({ values: [], ...overrides }));
    const user = userEvent.setup();
    render(<ParameterEditorPage />);
    await selectProductType(user);
    await user.click(await screen.findByText('Дизайн'));
    await screen.findByText('Нет значений. Добавьте первое.');
    await user.click(screen.getByText('Добавить несколько значений сразу'));
    return user;
  };

  it('парсит построчно, шлёт по одному POST на строку, считает created/errors', async () => {
    const user = await gotoValues();
    // мок для подсчёта ставим ПОСЛЕ навигации — gotoValues() сам переустанавливает apiFetch.mockImplementation
    let call = 0;
    apiFetch.mockImplementation((url, opts = {}) => {
      const method = opts.method || 'GET';
      if (url.includes('/parameter-values/') && method === 'POST') {
        call += 1;
        return Promise.resolve(call === 2 ? resp({ detail: 'дубликат' }, false) : resp({ id: 300 + call }));
      }
      return routeFetch({ values: [] })(url, opts);
    });
    const textarea = screen.getByPlaceholderText(/Комфорт/);
    await user.type(textarea, 'Комфорт{enter}Оптима{enter}Премиум');
    await user.click(screen.getByText('Добавить 3 значений'));

    expect(await screen.findByText('✓ Добавлено: 2')).toBeInTheDocument();
    expect(screen.getByText('✗ Ошибок: 1 — дубликат')).toBeInTheDocument();
    expect(textarea).toHaveValue('');
  });

  it('пустой текст (только пробелы) ничего не отправляет', async () => {
    const user = await gotoValues();
    const textarea = screen.getByPlaceholderText(/Комфорт/);
    await user.type(textarea, '   ');
    apiFetch.mockClear();
    await user.click(screen.getByText('Добавить 0 значений'));
    expect(apiFetch).not.toHaveBeenCalledWith(expect.stringContaining('/parameter-values/'), expect.objectContaining({ method: 'POST' }));
  });

  it('если все строки ошибочны — текст не очищается и onAdded не вызывается (список не перезагружается)', async () => {
    const user = await gotoValues();
    apiFetch.mockImplementation((url, opts = {}) => {
      const method = opts.method || 'GET';
      if (url.includes('/parameter-values/') && method === 'POST') return Promise.resolve(resp({ detail: 'ошибка' }, false));
      return routeFetch({ values: [] })(url, opts);
    });
    const textarea = screen.getByPlaceholderText(/Комфорт/);
    await user.type(textarea, 'X');
    apiFetch.mockClear();
    await user.click(screen.getByText('Добавить 1 значений'));

    expect(await screen.findByText('✗ Ошибок: 1 — ошибка')).toBeInTheDocument();
    expect(textarea).toHaveValue('X');
    expect(apiFetch).not.toHaveBeenCalledWith(expect.stringContaining('/parameter-values/?axis='), expect.anything());
  });

  it('крестик сворачивает панель и сбрасывает result', async () => {
    const user = await gotoValues();
    const bulkPanel = screen.getByText(/Массовое добавление/).parentElement;
    await user.click(within(bulkPanel).getByText('✕'));
    expect(screen.queryByPlaceholderText(/Комфорт/)).not.toBeInTheDocument();
    expect(screen.getByText('Добавить несколько значений сразу')).toBeInTheDocument();
  });
});

describe('ParameterEditorPage — AxisOrderPanel', () => {
  const axisOrder1 = { id: 300, product_type: 1, product_type_name: 'Калорифер', order: 5 };

  const gotoValues = async (overrides = {}) => {
    apiFetch.mockImplementation(routeFetch({ values: [], axisOrders: [axisOrder1], ...overrides }));
    const user = userEvent.setup();
    render(<ParameterEditorPage />);
    await selectProductType(user);
    await user.click(await screen.findByText('Дизайн'));
    await screen.findByText('Привязка к типам продукции (AxisOrder)');
    return user;
  };

  // "Калорифер"/"+ Добавить"/'✕' также встречаются в верхнем селекторе типа продукции и
  // в списке осей — скоупим запросы контейнером самой панели AxisOrder.
  const getPanel = () => screen.getByText('Привязка к типам продукции (AxisOrder)').parentElement;

  it('показывает существующие привязки и order', async () => {
    await gotoValues();
    await screen.findByText('Привязка к типам продукции (AxisOrder)');
    expect(within(getPanel()).getByText('Калорифер')).toBeInTheDocument();
    expect(within(getPanel()).getByText('order: 5')).toBeInTheDocument();
  });

  it('в дропдауне добавления скрыт уже привязанный тип продукции', async () => {
    await gotoValues();
    await screen.findByText('Привязка к типам продукции (AxisOrder)');
    const typeSelect = within(getPanel()).getByRole('combobox');
    expect(within(typeSelect).queryByText('Калорифер')).not.toBeInTheDocument();
    expect(within(typeSelect).getByText('Приточная установка')).toBeInTheDocument();
  });

  it('пустой список привязок показывает "Нет привязок"', async () => {
    await gotoValues({ axisOrders: [] });
    expect(await screen.findByText('Нет привязок')).toBeInTheDocument();
  });

  it('добавление привязки отправляет POST с product_type/axis/order и перезагружает', async () => {
    const user = await gotoValues({ axisOrders: [] });
    await screen.findByText('Нет привязок');
    const typeSelect = within(getPanel()).getByRole('combobox');
    await user.selectOptions(typeSelect, '2');

    apiFetch.mockImplementation(routeFetch({ values: [], axisOrders: [{ id: 301, product_type: 2, product_type_name: 'Приточная установка', order: 0 }] }));
    await user.click(within(getPanel()).getByText('+ Добавить'));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/v1/catalog/axis-orders/', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ product_type: '2', axis: 10, order: 0 }),
    })));
    await waitFor(() => expect(within(getPanel()).getByText('Приточная установка')).toBeInTheDocument());
  });

  it('удаление привязки отправляет DELETE и перезагружает', async () => {
    const user = await gotoValues();
    await screen.findByText('Привязка к типам продукции (AxisOrder)');
    apiFetch.mockImplementation(routeFetch({ values: [], axisOrders: [] }));
    await user.click(within(getPanel()).getByText('✕'));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      expect.stringContaining('/axis-orders/300/'), expect.objectContaining({ method: 'DELETE' })
    ));
    expect(await screen.findByText('Нет привязок')).toBeInTheDocument();
  });
});

describe('ParameterEditorPage — FilterRulesEditor (внутри AxisForm)', () => {
  const axisValueA = { id: 1, value: 'A' };
  const axisValueB = { id: 2, value: 'B' };

  const openReferenceForm = async (overrides = {}) => {
    apiFetch.mockImplementation(routeFetch({ axes: [axis1], values: [axisValueA, axisValueB], ...overrides }));
    const user = userEvent.setup();
    render(<ParameterEditorPage />);
    await selectProductType(user);
    await screen.findByText('Дизайн');
    await user.click(screen.getByText('+ Ось'));
    await user.selectOptions(screen.getByDisplayValue('Классификационная (граф)'), 'reference');
    return user;
  };

  it('загружает только classifier-оси в выпадающий список родительской оси', async () => {
    await openReferenceForm();
    expect(await screen.findByText(/Дизайн \(design\)/)).toBeInTheDocument();
  });

  it('выбор оси подгружает активные значения и позволяет мультивыбор', async () => {
    const user = await openReferenceForm();
    await user.selectOptions(screen.getByText(/Дизайн \(design\)/).closest('select'), '10');
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      expect.stringContaining('/parameter-values/?axis=10&is_active=true')
    ));
    await user.click(await screen.findByText('A'));
    expect(screen.getByText(/"allowedValues": \[\s*"A"/)).toBeInTheDocument();

    await user.click(screen.getByText('B'));
    expect(screen.getByText(/"A"/)).toBeInTheDocument();
    expect(screen.getByText(/"B"/)).toBeInTheDocument();

    // повторный клик по "A" снимает выбор
    await user.click(screen.getByText('A'));
    expect(screen.queryByText(/"A"/)).not.toBeInTheDocument();
  });
});
