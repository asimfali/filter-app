import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterForm from '../RegisterForm';
import { authApi } from '../../../api/auth';

vi.mock('../../../api/auth', () => ({
  authApi: { register: vi.fn(), roles: vi.fn(), departments: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  authApi.departments.mockResolvedValue({ ok: true, data: [{ id: 1, name: 'Производство', children: [] }] });
  authApi.roles.mockResolvedValue({ data: [{ id: 10, name: 'Инженер' }] });
});

// Дожидаемся, пока справочники (departments/roles) подгрузятся и появятся в <select>
const waitDicts = async () => {
  await screen.findByText('Производство');
  await screen.findByText('Инженер');
};

const selects = (container) => container.querySelectorAll('select');

const fillValid = async (user, container, overrides = {}) => {
  const { email = 'new@example.com', password = 'password1', password2 = 'password1' } = overrides;
  await user.type(screen.getByPlaceholderText('you@teplomash.ru'), email);
  await user.selectOptions(selects(container)[0], '1');
  await user.selectOptions(selects(container)[1], '10');
  await user.type(screen.getByPlaceholderText('Минимум 8 символов'), password);
  await user.type(screen.getByPlaceholderText('Повторите пароль'), password2);
};

describe('RegisterForm — справочники', () => {
  it('подгружает departments (root_only=true) и roles на маунте, рендерит их опциями', async () => {
    const { container } = render(<RegisterForm onSuccess={vi.fn()} />);
    await waitDicts();

    expect(authApi.departments).toHaveBeenCalledWith(true);
    expect(authApi.roles).toHaveBeenCalled();
    expect(selects(container)[0].querySelector('option[value="1"]')).not.toBeNull();
    expect(selects(container)[1].querySelector('option[value="10"]')).not.toBeNull();
  });

  it('поддерживает пагинированный ответ вида {results: [...]}', async () => {
    authApi.departments.mockResolvedValue({ ok: true, data: { results: [{ id: 2, name: 'Продажи', children: [] }] } });
    authApi.roles.mockResolvedValue({ data: { results: [{ id: 20, name: 'Менеджер' }] } });
    render(<RegisterForm onSuccess={vi.fn()} />);

    expect(await screen.findByText('Продажи')).toBeInTheDocument();
    expect(await screen.findByText('Менеджер')).toBeInTheDocument();
  });

  it('вложенные подразделения рендерятся с отступом по depth*3 неразрывных пробелов', async () => {
    authApi.departments.mockResolvedValue({
      ok: true,
      data: [{ id: 1, name: 'Производство', children: [{ id: 2, name: 'Цех №1', children: [] }] }],
    });
    authApi.roles.mockResolvedValue({ data: [] });
    const { container } = render(<RegisterForm onSuccess={vi.fn()} />);
    await screen.findByText('Производство');

    const childOption = selects(container)[0].querySelector('option[value="2"]');
    expect(childOption.textContent).toBe('   Цех №1');
  });

  it('сетевая ошибка при загрузке справочников перехватывается молча', async () => {
    authApi.departments.mockRejectedValue(new Error('network down'));
    authApi.roles.mockRejectedValue(new Error('network down'));
    const { container } = render(<RegisterForm onSuccess={vi.fn()} />);

    // компонент не падает, селекты остаются с одной дефолтной опцией
    await act(async () => { await Promise.resolve(); });
    expect(selects(container)[0].options.length).toBe(1);
    expect(selects(container)[1].options.length).toBe(1);
  });
});

describe('RegisterForm — пароли', () => {
  it('показывает "Пароли не совпадают" и красную рамку, только пока подтверждение не пустое', async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSuccess={vi.fn()} />);
    await waitDicts();

    await user.type(screen.getByPlaceholderText('Минимум 8 символов'), 'password1');
    expect(screen.queryByText('Пароли не совпадают')).not.toBeInTheDocument(); // подтверждение ещё пустое

    await user.type(screen.getByPlaceholderText('Повторите пароль'), 'other');
    expect(screen.getByText('Пароли не совпадают')).toBeInTheDocument();
  });

  it('кнопка отправки задизейблена при несовпадении или пустых полях пароля', async () => {
    const user = userEvent.setup();
    const { container } = render(<RegisterForm onSuccess={vi.fn()} />);
    await waitDicts();
    const submit = screen.getByRole('button', { name: /Зарегистрироваться/ });

    expect(submit).toBeDisabled(); // все поля пустые

    await user.type(screen.getByPlaceholderText('you@teplomash.ru'), 'new@example.com');
    await user.selectOptions(selects(container)[0], '1');
    await user.selectOptions(selects(container)[1], '10');
    await user.type(screen.getByPlaceholderText('Минимум 8 символов'), 'password1');
    expect(submit).toBeDisabled(); // подтверждение пустое

    await user.type(screen.getByPlaceholderText('Повторите пароль'), 'password2');
    expect(submit).toBeDisabled(); // не совпадают

    await user.clear(screen.getByPlaceholderText('Повторите пароль'));
    await user.type(screen.getByPlaceholderText('Повторите пароль'), 'password1');
    expect(submit).toBeEnabled();
  });

  it('переключает видимость обоих полей пароля независимо', async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSuccess={vi.fn()} />);
    await waitDicts();

    const pass1 = screen.getByPlaceholderText('Минимум 8 символов');
    const pass2 = screen.getByPlaceholderText('Повторите пароль');
    expect(pass1).toHaveAttribute('type', 'password');
    expect(pass2).toHaveAttribute('type', 'password');

    await user.click(pass1.parentElement.querySelector('button'));
    expect(pass1).toHaveAttribute('type', 'text');
    expect(pass2).toHaveAttribute('type', 'password');

    await user.click(pass2.parentElement.querySelector('button'));
    expect(pass2).toHaveAttribute('type', 'text');
  });
});

describe('RegisterForm — внутренние guard-проверки handleSubmit (через прямой submit формы)', () => {
  // Кнопка отправки уже блокируется при mismatch/пустых паролях, так что guard
  // `password !== passwordConfirm` внутри handleSubmit недостижим через клик по кнопке.
  // Проверяем его напрямую диспатчем submit на форме — так же обходим password.length<8
  // (кнопка это не проверяет) и незаполненные department/role (тоже не проверяются кнопкой).

  it('пароль короче 8 символов — ошибка, register не вызывается (доступимо и через кнопку)', async () => {
    const user = userEvent.setup();
    const { container } = render(<RegisterForm onSuccess={vi.fn()} />);
    await waitDicts();

    await user.type(screen.getByPlaceholderText('you@teplomash.ru'), 'new@example.com');
    await user.selectOptions(selects(container)[0], '1');
    await user.selectOptions(selects(container)[1], '10');
    await user.type(screen.getByPlaceholderText('Минимум 8 символов'), 'abc');
    await user.type(screen.getByPlaceholderText('Повторите пароль'), 'abc');

    await user.click(screen.getByRole('button', { name: /Зарегистрироваться/ }));

    expect(screen.getByText('Пароль должен быть не менее 8 символов')).toBeInTheDocument();
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it('не выбрано подразделение — ошибка "Выберите подразделение"', async () => {
    const user = userEvent.setup();
    const { container } = render(<RegisterForm onSuccess={vi.fn()} />);
    await waitDicts();
    await user.type(screen.getByPlaceholderText('you@teplomash.ru'), 'new@example.com');
    await user.selectOptions(selects(container)[1], '10');
    await user.type(screen.getByPlaceholderText('Минимум 8 символов'), 'password1');
    await user.type(screen.getByPlaceholderText('Повторите пароль'), 'password1');

    // requestSubmit() уважает нативную HTML5-валидацию (required у select) и не
    // отправит форму вовсе — диспатчим submit напрямую, в обход required, чтобы
    // добраться до внутреннего guard-а в handleSubmit
    fireEvent.submit(container.querySelector('form'));

    expect(screen.getByText('Выберите подразделение')).toBeInTheDocument();
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it('не выбрана роль — ошибка "Выберите роль"', async () => {
    const user = userEvent.setup();
    const { container } = render(<RegisterForm onSuccess={vi.fn()} />);
    await waitDicts();
    await user.type(screen.getByPlaceholderText('you@teplomash.ru'), 'new@example.com');
    await user.selectOptions(selects(container)[0], '1');
    await user.type(screen.getByPlaceholderText('Минимум 8 символов'), 'password1');
    await user.type(screen.getByPlaceholderText('Повторите пароль'), 'password1');

    fireEvent.submit(container.querySelector('form'));

    expect(screen.getByText('Выберите роль')).toBeInTheDocument();
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it('несовпадающие пароли при прямом submit — ошибка без вызова register', async () => {
    const user = userEvent.setup();
    const { container } = render(<RegisterForm onSuccess={vi.fn()} />);
    await waitDicts();
    await user.type(screen.getByPlaceholderText('you@teplomash.ru'), 'new@example.com');
    await user.selectOptions(selects(container)[0], '1');
    await user.selectOptions(selects(container)[1], '10');
    await user.type(screen.getByPlaceholderText('Минимум 8 символов'), 'password1');
    await user.type(screen.getByPlaceholderText('Повторите пароль'), 'password2');

    fireEvent.submit(container.querySelector('form'));

    // "Пароли не совпадают" уже виден как live-подсказка под полем (passwordMismatch),
    // submit добавляет тот же текст вторым разом как error — их два одновременно
    expect(screen.getAllByText('Пароли не совпадают')).toHaveLength(2);
    expect(authApi.register).not.toHaveBeenCalled();
  });
});

describe('RegisterForm — отправка', () => {
  it('успешная регистрация шлёт username=email и вызывает onSuccess(email)', async () => {
    const user = userEvent.setup();
    authApi.register.mockResolvedValue({ ok: true, data: {} });
    const onSuccess = vi.fn();
    const { container } = render(<RegisterForm onSuccess={onSuccess} />);
    await waitDicts();

    await fillValid(user, container);
    await user.click(screen.getByRole('button', { name: /Зарегистрироваться/ }));

    expect(authApi.register).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', username: 'new@example.com', department_id: '1', role_id: '10' })
    );
    expect(onSuccess).toHaveBeenCalledWith('new@example.com');
  });

  it('ошибка с {error: {details: {...}}} показывает первый элемент первого массива ошибок', async () => {
    const user = userEvent.setup();
    authApi.register.mockResolvedValue({
      ok: false,
      data: { error: { details: { email: ['Уже используется', 'ещё одна ошибка'] } } },
    });
    const { container } = render(<RegisterForm onSuccess={vi.fn()} />);
    await waitDicts();
    await fillValid(user, container);
    await user.click(screen.getByRole('button', { name: /Зарегистрироваться/ }));

    expect(screen.getByText('Уже используется')).toBeInTheDocument();
  });

  it('без error.details падает на первое поле result.data целиком (строка — как есть)', async () => {
    const user = userEvent.setup();
    authApi.register.mockResolvedValue({ ok: false, data: { email: 'уже существует' } });
    const { container } = render(<RegisterForm onSuccess={vi.fn()} />);
    await waitDicts();
    await fillValid(user, container);
    await user.click(screen.getByRole('button', { name: /Зарегистрироваться/ }));

    expect(screen.getByText('уже существует')).toBeInTheDocument();
  });

  it('показывает "Регистрация..." и блокирует кнопку на время запроса', async () => {
    const user = userEvent.setup();
    let resolveRegister;
    authApi.register.mockReturnValue(new Promise((r) => { resolveRegister = r; }));
    const { container } = render(<RegisterForm onSuccess={vi.fn()} />);
    await waitDicts();
    await fillValid(user, container);

    await user.click(screen.getByRole('button', { name: /Зарегистрироваться/ }));

    expect(screen.getByRole('button', { name: 'Регистрация...' })).toBeDisabled();

    await act(async () => { resolveRegister({ ok: true, data: {} }); });
  });
});
