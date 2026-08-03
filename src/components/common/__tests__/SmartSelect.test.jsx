import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import SmartSelect from '../SmartSelect';

vi.mock('../../../api/auth', () => ({
  tokenStorage: { getAccess: vi.fn(() => 'test-token') },
}));

const jsonRes = (data) => Promise.resolve({ ok: true, json: async () => data });

let fetchMock;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete HTMLElement.prototype.offsetHeight;
});

// debounce у SmartSelect — 300ms
const search = async (input, text) => {
  fireEvent.change(input, { target: { value: text } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
};

describe('SmartSelect — режим чипа (value)', () => {
  it('показывает чип с value[nameKey] и не рендерит инпут', () => {
    render(<SmartSelect endpoint="/api/x" onSelect={vi.fn()} value={{ id: 1, name: 'Товар А' }} />);
    expect(screen.getByText('Товар А')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('падает обратно на value.name, если по nameKey значения нет', () => {
    render(<SmartSelect endpoint="/api/x" onSelect={vi.fn()} nameKey="title" value={{ id: 1, name: 'Товар Б' }} />);
    expect(screen.getByText('Товар Б')).toBeInTheDocument();
  });

  it('кнопка × рендерится только при onClear и вызывает его', () => {
    const onClear = vi.fn();
    const { rerender } = render(<SmartSelect endpoint="/api/x" onSelect={vi.fn()} value={{ id: 1, name: 'X' }} />);
    expect(screen.queryByText('×')).not.toBeInTheDocument();

    rerender(<SmartSelect endpoint="/api/x" onSelect={vi.fn()} value={{ id: 1, name: 'X' }} onClear={onClear} />);
    fireEvent.click(screen.getByText('×'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

describe('SmartSelect — поиск', () => {
  it('не ищет, пока длина запроса меньше minChars', async () => {
    render(<SmartSelect endpoint="/api/x" onSelect={vi.fn()} />);
    await search(screen.getByPlaceholderText('Поиск...'), 'а'); // minChars по умолчанию 2
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ищет с debounce и рендерит результаты по nameKey из data.data', async () => {
    fetchMock.mockReturnValue(
      jsonRes({ success: true, data: [{ id: 1, name: 'Фильтр А' }, { id: 2, name: 'Фильтр Б' }] })
    );
    render(<SmartSelect endpoint="/api/catalog/products/" onSelect={vi.fn()} />);
    await search(screen.getByPlaceholderText('Поиск...'), 'фильтр');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(`/api/catalog/products/?q=${encodeURIComponent('фильтр')}&limit=15`);
    expect(opts.headers.Authorization).toBe('Bearer test-token');
    expect(screen.getByText('Фильтр А')).toBeInTheDocument();
    expect(screen.getByText('Фильтр Б')).toBeInTheDocument();
  });

  it('использует & вместо ? для endpoint, у которого уже есть query-строка', async () => {
    fetchMock.mockReturnValue(jsonRes({ success: true, data: [] }));
    render(<SmartSelect endpoint="/api/x?type=1" onSelect={vi.fn()} />);
    await search(screen.getByPlaceholderText('Поиск...'), 'ab');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/x?type=1&q=ab&limit=15');
  });

  it('уважает кастомный limit', async () => {
    fetchMock.mockReturnValue(jsonRes({ success: true, data: [] }));
    render(<SmartSelect endpoint="/api/x" onSelect={vi.fn()} limit={5} />);
    await search(screen.getByPlaceholderText('Поиск...'), 'ab');

    expect(fetchMock.mock.calls[0][0]).toContain('limit=5');
  });

  it('renderItem переопределяет дефолтный рендер по nameKey', async () => {
    fetchMock.mockReturnValue(jsonRes({ success: true, data: [{ id: 1, name: 'X', code: 'КЭВ-1' }] }));
    render(<SmartSelect endpoint="/api/x" onSelect={vi.fn()} renderItem={(item) => <b>{item.code}</b>} />);
    await search(screen.getByPlaceholderText('Поиск...'), 'ab');

    expect(screen.getByText('КЭВ-1')).toBeInTheDocument();
    expect(screen.queryByText('X')).not.toBeInTheDocument();
  });

  it('excludeIds отфильтровывает уже выбранные элементы из результатов', async () => {
    fetchMock.mockReturnValue(
      jsonRes({ success: true, data: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }] })
    );
    render(<SmartSelect endpoint="/api/x" onSelect={vi.fn()} excludeIds={new Set([2])} />);
    await search(screen.getByPlaceholderText('Поиск...'), 'ab');

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.queryByText('B')).not.toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('показывает "···" пока запрос выполняется, и убирает по завершении', async () => {
    let resolveFetch;
    fetchMock.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));
    render(<SmartSelect endpoint="/api/x" onSelect={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('Поиск...'), { target: { value: 'ab' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(screen.getByText('···')).toBeInTheDocument();

    await act(async () => {
      resolveFetch(await jsonRes({ success: true, data: [{ id: 1, name: 'A' }] }));
    });

    expect(screen.queryByText('···')).not.toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('при success:false в ответе не открывает дропдаун', async () => {
    fetchMock.mockReturnValue(jsonRes({ success: false }));
    render(<SmartSelect endpoint="/api/x" onSelect={vi.fn()} />);
    await search(screen.getByPlaceholderText('Поиск...'), 'ab');

    expect(document.querySelector('[data-smartselect-dropdown]')).toBeNull();
  });

  it('сетевая ошибка перехватывается молча, без падения', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    render(<SmartSelect endpoint="/api/x" onSelect={vi.fn()} />);
    await search(screen.getByPlaceholderText('Поиск...'), 'ab');

    expect(screen.queryByText('···')).not.toBeInTheDocument();
    expect(document.querySelector('[data-smartselect-dropdown]')).toBeNull();
  });

  it('handleSelect: выбор результата вызывает onSelect и сбрасывает/закрывает поиск', async () => {
    fetchMock.mockReturnValue(jsonRes({ success: true, data: [{ id: 1, name: 'Фильтр А' }] }));
    const onSelect = vi.fn();
    render(<SmartSelect endpoint="/api/x" onSelect={onSelect} />);
    const input = screen.getByPlaceholderText('Поиск...');
    await search(input, 'фильтр');

    fireEvent.mouseDown(screen.getByText('Фильтр А'));

    expect(onSelect).toHaveBeenCalledWith({ id: 1, name: 'Фильтр А' });
    expect(input.value).toBe('');
    expect(screen.queryByText('Фильтр А')).not.toBeInTheDocument();
  });

  it('повторный фокус переоткрывает дропдаун без нового запроса, если результаты уже есть', async () => {
    fetchMock.mockReturnValue(jsonRes({ success: true, data: [{ id: 1, name: 'A' }] }));
    render(<SmartSelect endpoint="/api/x" onSelect={vi.fn()} />);
    const input = screen.getByPlaceholderText('Поиск...');
    await search(input, 'ab');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(document.body); // закрыть кликом снаружи
    expect(screen.queryByText('A')).not.toBeInTheDocument();

    fireEvent.focus(input);

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // без нового запроса
  });
});

describe('SmartSelect — закрытие дропдауна', () => {
  it('клик снаружи закрывает дропдаун', async () => {
    fetchMock.mockReturnValue(jsonRes({ success: true, data: [{ id: 1, name: 'A' }] }));
    render(
      <div>
        <div data-testid="outside">снаружи</div>
        <SmartSelect endpoint="/api/x" onSelect={vi.fn()} />
      </div>
    );
    await search(screen.getByPlaceholderText('Поиск...'), 'ab');
    expect(screen.getByText('A')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside'));

    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });

  it('клик внутри контейнера поиска не закрывает дропдаун', async () => {
    fetchMock.mockReturnValue(jsonRes({ success: true, data: [{ id: 1, name: 'A' }] }));
    render(<SmartSelect endpoint="/api/x" onSelect={vi.fn()} />);
    const input = screen.getByPlaceholderText('Поиск...');
    await search(input, 'ab');

    fireEvent.mouseDown(input);

    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('scroll/wheel на window закрывает дропдаун', async () => {
    fetchMock.mockReturnValue(jsonRes({ success: true, data: [{ id: 1, name: 'A' }] }));
    render(<SmartSelect endpoint="/api/x" onSelect={vi.fn()} />);
    await search(screen.getByPlaceholderText('Поиск...'), 'ab');
    expect(screen.getByText('A')).toBeInTheDocument();

    // реальный scroll-эвент на window имеет target === document (не сам window),
    // поэтому диспатчим на document — так же, как это делают браузеры
    fireEvent.scroll(document);

    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });
});

describe('SmartSelect — inline create', () => {
  it('showCreate: кнопка "+ Добавить" появляется даже при 0 результатах, пока поиск не идёт', async () => {
    fetchMock.mockReturnValue(jsonRes({ success: true, data: [] }));
    render(<SmartSelect endpoint="/api/x" onSelect={vi.fn()} allowCreate createEndpoint="/api/x/create/" />);
    await search(screen.getByPlaceholderText('Поиск...'), 'новый');

    expect(screen.getByText('+ Добавить «новый»')).toBeInTheDocument();
  });

  it('без allowCreate дропдаун вообще не рендерится при 0 результатах', async () => {
    fetchMock.mockReturnValue(jsonRes({ success: true, data: [] }));
    render(<SmartSelect endpoint="/api/x" onSelect={vi.fn()} createEndpoint="/api/x/create/" />);
    await search(screen.getByPlaceholderText('Поиск...'), 'новый');

    expect(document.querySelector('[data-smartselect-dropdown]')).toBeNull();
  });

  it('handleCreate: POST с дефолтным {name: query}, вызывает onCreated и сбрасывает состояние', async () => {
    fetchMock
      .mockReturnValueOnce(jsonRes({ success: true, data: [] }))
      .mockReturnValueOnce(jsonRes({ success: true, data: { id: 99, name: 'Новый товар' } }));
    const onSelect = vi.fn();
    const onCreated = vi.fn();
    render(
      <SmartSelect
        endpoint="/api/x"
        onSelect={onSelect}
        onCreated={onCreated}
        allowCreate
        createEndpoint="/api/x/create/"
      />
    );
    const input = screen.getByPlaceholderText('Поиск...');
    await search(input, 'Новый товар');

    await act(async () => {
      fireEvent.mouseDown(screen.getByText('+ Добавить «Новый товар»'));
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, opts] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/x/create/');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ name: 'Новый товар' });
    expect(onCreated).toHaveBeenCalledWith({ id: 99, name: 'Новый товар' });
    expect(onSelect).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('handleCreate: без onCreated использует onSelect', async () => {
    fetchMock
      .mockReturnValueOnce(jsonRes({ success: true, data: [] }))
      .mockReturnValueOnce(jsonRes({ success: true, data: { id: 5, name: 'X' } }));
    const onSelect = vi.fn();
    render(<SmartSelect endpoint="/api/x" onSelect={onSelect} allowCreate createEndpoint="/api/x/create/" />);
    await search(screen.getByPlaceholderText('Поиск...'), 'XX');

    await act(async () => {
      fireEvent.mouseDown(screen.getByRole('button', { name: /Добавить/ }));
    });

    expect(onSelect).toHaveBeenCalledWith({ id: 5, name: 'X' });
  });

  it('handleCreate: использует кастомный createPayload вместо {name}', async () => {
    fetchMock
      .mockReturnValueOnce(jsonRes({ success: true, data: [] }))
      .mockReturnValueOnce(jsonRes({ success: true, data: { id: 1 } }));
    render(
      <SmartSelect
        endpoint="/api/x"
        onSelect={vi.fn()}
        allowCreate
        createEndpoint="/api/x/create/"
        createPayload={(q) => ({ title: q, source: 'manual' })}
      />
    );
    await search(screen.getByPlaceholderText('Поиск...'), 'XX');
    await act(async () => {
      fireEvent.mouseDown(screen.getByRole('button', { name: /Добавить/ }));
    });

    const [, opts] = fetchMock.mock.calls[1];
    expect(JSON.parse(opts.body)).toEqual({ title: 'XX', source: 'manual' });
  });

  it('показывает "Создание..." и блокирует кнопку, пока запрос создания не завершится', async () => {
    fetchMock.mockReturnValueOnce(jsonRes({ success: true, data: [] }));
    let resolveCreate;
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { resolveCreate = resolve; }));
    render(<SmartSelect endpoint="/api/x" onSelect={vi.fn()} allowCreate createEndpoint="/api/x/create/" />);
    await search(screen.getByPlaceholderText('Поиск...'), 'XX');

    fireEvent.mouseDown(screen.getByRole('button', { name: /Добавить/ }));

    expect(screen.getByText('Создание...')).toBeDisabled();

    await act(async () => {
      resolveCreate(await jsonRes({ success: true, data: { id: 1, name: 'XX' } }));
    });
  });

  it('handleCreate ничего не делает без createEndpoint (кнопка есть, запроса нет)', async () => {
    fetchMock.mockReturnValue(jsonRes({ success: true, data: [] }));
    render(<SmartSelect endpoint="/api/x" onSelect={vi.fn()} allowCreate />);
    await search(screen.getByPlaceholderText('Поиск...'), 'XX');
    const createBtn = screen.getByRole('button', { name: /Добавить/ });
    expect(createBtn).toBeInTheDocument();

    fireEvent.mouseDown(createBtn);

    expect(fetchMock).toHaveBeenCalledTimes(1); // только поиск, без POST
  });

  it('handleCreate ничего не делает при пустом после trim() запросе', async () => {
    fetchMock.mockReturnValue(jsonRes({ success: true, data: [] }));
    render(<SmartSelect endpoint="/api/x" onSelect={vi.fn()} allowCreate createEndpoint="/api/x/create/" />);
    await search(screen.getByPlaceholderText('Поиск...'), '  '); // 2 пробела ≥ minChars, но trim() пуст

    fireEvent.mouseDown(screen.getByRole('button', { name: /Добавить/ }));

    expect(fetchMock).toHaveBeenCalledTimes(1); // только поиск
  });

  it('сетевая ошибка при создании перехватывается молча', async () => {
    fetchMock.mockReturnValueOnce(jsonRes({ success: true, data: [] }));
    fetchMock.mockRejectedValueOnce(new Error('down'));
    const onCreated = vi.fn();
    render(
      <SmartSelect
        endpoint="/api/x"
        onSelect={vi.fn()}
        onCreated={onCreated}
        allowCreate
        createEndpoint="/api/x/create/"
      />
    );
    await search(screen.getByPlaceholderText('Поиск...'), 'XX');

    await act(async () => {
      fireEvent.mouseDown(screen.getByRole('button', { name: /Добавить/ }));
    });

    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.queryByText('Создание...')).not.toBeInTheDocument();
  });
});

describe('SmartSelect — позиционирование дропдауна', () => {
  it('по умолчанию встаёт под инпутом (нулевая jsdom-геометрия)', async () => {
    fetchMock.mockReturnValue(jsonRes({ success: true, data: [{ id: 1, name: 'A' }] }));
    render(<SmartSelect endpoint="/api/x" onSelect={vi.fn()} />);
    await search(screen.getByPlaceholderText('Поиск...'), 'ab');

    const dropdown = document.querySelector('[data-smartselect-dropdown]');
    expect(dropdown.style.position).toBe('fixed');
    expect(dropdown.style.top).toBe('4px');
  });

  it('переворачивается вверх, если снизу не хватает места', async () => {
    fetchMock.mockReturnValue(jsonRes({ success: true, data: [{ id: 1, name: 'A' }] }));
    render(<SmartSelect endpoint="/api/x" onSelect={vi.fn()} />);
    const input = screen.getByPlaceholderText('Поиск...');
    vi.spyOn(input, 'getBoundingClientRect').mockReturnValue({
      top: 700, bottom: 730, left: 10, width: 200, height: 30, right: 210, x: 10, y: 700, toJSON() {},
    });
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(768);
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 200 });

    await search(input, 'ab');

    const dropdown = document.querySelector('[data-smartselect-dropdown]');
    expect(dropdown.style.top).toBe('496px'); // 700 - 200 - 4
  });
});
