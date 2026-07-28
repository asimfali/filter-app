import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
  if (url.includes('/parameter-values/')) return Promise.resolve(resp(overrides.values ?? []));
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
