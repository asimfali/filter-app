import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffPage from '../StaffPage';
import { apiFetch } from '../../api/auth';
import { useAuth } from '../../contexts/AuthContext';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../api/auth', () => ({
  apiFetch: vi.fn(),
  authApi: { specMatrix: vi.fn(), specToggle: vi.fn() },
}));

const withPerms = (...perms) => ({ id: 1, permissions: perms });
const ALL_PERMS = ['portal.staff.users', 'portal.staff.requests', 'portal.staff.departments'];

const resp = (data, ok = true) => ({ ok, json: () => Promise.resolve(data) });

const dept1 = { id: 1, name: 'Бюро автоматики', code: 'ba', children: [] };
const role1 = { id: 10, name: 'Инженер', can_approve: false };
const role2 = { id: 11, name: 'Начальник бюро', can_approve: true };

const user1 = {
  id: 100, full_name: 'Иванов Иван', username: 'ivanov', email: 'ivanov@tm.ru',
  first_name: 'Иван', is_confirmed: true, date_joined: '2026-01-01T00:00:00Z',
  department_roles: [],
};

// Роутит apiFetch по URL/методу — большинство хуков дергают разные эндпоинты параллельно.
const routeApiFetch = (overrides = {}) => {
  apiFetch.mockImplementation((url, opts = {}) => {
    const method = opts.method || 'GET';
    for (const [matcher, handler] of overrides.routes || []) {
      if (matcher(url, method)) return Promise.resolve(handler(url, opts));
    }
    if (url.includes('/departments/') && url.includes('root_only=true')) return Promise.resolve(resp([dept1]));
    if (url.includes('/roles/')) return Promise.resolve(resp([role1, role2]));
    if (url.includes('/users-list/')) return Promise.resolve(resp([]));
    if (url.includes('/staff-requests/')) return Promise.resolve(resp([]));
    return Promise.resolve(resp({}));
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ user: withPerms(...ALL_PERMS) });
  routeApiFetch();
});

describe('StaffPage — вкладки по правам', () => {
  it('со всеми правами показывает все три вкладки, активна первая (Сотрудники)', async () => {
    render(<StaffPage />);
    expect(await screen.findByText('Сотрудники')).toBeInTheDocument();
    expect(screen.getByText('Заявки')).toBeInTheDocument();
    expect(screen.getByText('Подразделения')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Поиск по имени, фамилии, email...')).toBeInTheDocument();
  });

  it('с одним правом видна только соответствующая вкладка и она активна', async () => {
    useAuth.mockReturnValue({ user: withPerms('portal.staff.departments') });
    render(<StaffPage />);
    expect(await screen.findByText('Подразделения')).toBeInTheDocument();
    expect(screen.queryByText('Сотрудники')).not.toBeInTheDocument();
    expect(screen.queryByText('Заявки')).not.toBeInTheDocument();
    expect(screen.getByText('Структура подразделений')).toBeInTheDocument();
  });

  it('без прав не показывает ни одной вкладки и не падает', async () => {
    useAuth.mockReturnValue({ user: withPerms() });
    render(<StaffPage />);
    expect(await screen.findByText('Управление персоналом')).toBeInTheDocument();
    expect(screen.queryByText('Сотрудники')).not.toBeInTheDocument();
    expect(screen.queryByText('Заявки')).not.toBeInTheDocument();
    expect(screen.queryByText('Подразделения')).not.toBeInTheDocument();
  });
});

describe('StaffPage — список сотрудников', () => {
  it('показывает загрузку, затем пустой список и разный текст для поиска без результатов', async () => {
    let resolveUsers;
    apiFetch.mockImplementation((url) => {
      if (url.includes('/users-list/')) {
        return new Promise((r) => { resolveUsers = r; });
      }
      if (url.includes('/departments/')) return Promise.resolve(resp([dept1]));
      if (url.includes('/roles/')) return Promise.resolve(resp([role1, role2]));
      if (url.includes('/staff-requests/')) return Promise.resolve(resp([]));
      return Promise.resolve(resp({}));
    });
    render(<StaffPage />);
    expect(await screen.findByText('Загрузка...')).toBeInTheDocument();
    await act(async () => { resolveUsers(resp([])); });
    expect(await screen.findByText('Нет пользователей')).toBeInTheDocument();
  });

  it('дебаунс на 300мс перезапрашивает список по вводу в поиск', async () => {
    vi.useFakeTimers();
    render(<StaffPage />);
    await act(async () => { await Promise.resolve(); });
    apiFetch.mockClear();

    const input = screen.getByPlaceholderText('Поиск по имени, фамилии, email...');
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(input, { target: { value: 'Иванов' } });

    await act(async () => { vi.advanceTimersByTime(300); });
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/users-list/?search=%D0%98%D0%B2%D0%B0%D0%BD%D0%BE%D0%B2'));
    vi.useRealTimers();
  });

  it('рендерит карточку с данными пользователя, раскрытие/сворачивание', async () => {
    apiFetch.mockImplementation((url) => {
      if (url.includes('/users-list/')) return Promise.resolve(resp([user1]));
      if (url.includes('/departments/')) return Promise.resolve(resp([dept1]));
      if (url.includes('/roles/')) return Promise.resolve(resp([role1, role2]));
      if (url.includes('/staff-requests/')) return Promise.resolve(resp([]));
      return Promise.resolve(resp({}));
    });
    const user = userEvent.setup();
    render(<StaffPage />);
    expect(await screen.findByText('Иванов Иван')).toBeInTheDocument();
    expect(screen.getByText('ivanov@tm.ru')).toBeInTheDocument();
    expect(screen.getByText('нет ролей')).toBeInTheDocument();
    expect(screen.getByText('активен')).toBeInTheDocument();

    await user.click(screen.getByText('Иванов Иван'));
    expect(screen.getByText('Роли не назначены. Пользователь не может работать в системе.')).toBeInTheDocument();
    expect(screen.getByText(/Зарегистрирован:/)).toBeInTheDocument();

    await user.click(screen.getByText('Иванов Иван'));
    expect(screen.queryByText(/Зарегистрирован:/)).not.toBeInTheDocument();
  });

  it('пользователь с ролями: бейджи (>2 — "+N") и статус "ожидает" для неподтверждённого', async () => {
    const withRoles = {
      ...user1, is_confirmed: false,
      department_roles: [
        { id: 1, department: 1, department_name: 'Бюро A', role: 10, role_name: 'Инженер', can_approve: false },
        { id: 2, department: 2, department_name: 'Бюро B', role: 10, role_name: 'Инженер', can_approve: false },
        { id: 3, department: 3, department_name: 'Бюро C', role: 11, role_name: 'Начальник', can_approve: true },
      ],
    };
    apiFetch.mockImplementation((url) => {
      if (url.includes('/users-list/')) return Promise.resolve(resp([withRoles]));
      if (url.includes('/departments/')) return Promise.resolve(resp([dept1]));
      if (url.includes('/roles/')) return Promise.resolve(resp([role1, role2]));
      if (url.includes('/staff-requests/')) return Promise.resolve(resp([]));
      return Promise.resolve(resp({}));
    });
    const user = userEvent.setup();
    render(<StaffPage />);
    await screen.findByText('Иванов Иван');
    expect(screen.getByText('ожидает')).toBeInTheDocument();
    expect(screen.getByText('Бюро A')).toBeInTheDocument();
    expect(screen.getByText('Бюро B')).toBeInTheDocument();
    expect(screen.queryByText('Бюро C')).not.toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();

    await user.click(screen.getByText('Иванов Иван'));
    expect(screen.getByText('Бюро C')).toBeInTheDocument();
    expect(screen.getByText('может утверждать')).toBeInTheDocument();
  });
});

describe('StaffPage — снятие роли', () => {
  const withOneRole = {
    ...user1,
    department_roles: [
      { id: 5, department: 1, department_name: 'Бюро A', role: 10, role_name: 'Инженер', can_approve: false },
    ],
  };

  const setupWithRole = () => {
    apiFetch.mockImplementation((url, opts = {}) => {
      const method = opts.method || 'GET';
      if (url.includes('/user-roles/5/') && method === 'DELETE') return Promise.resolve(resp({}));
      if (url.includes('/users-list/')) return Promise.resolve(resp([withOneRole]));
      if (url.includes('/departments/')) return Promise.resolve(resp([dept1]));
      if (url.includes('/roles/')) return Promise.resolve(resp([role1, role2]));
      if (url.includes('/staff-requests/')) return Promise.resolve(resp([]));
      return Promise.resolve(resp({}));
    });
  };

  it('отмена в confirm() не удаляет роль', async () => {
    setupWithRole();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<StaffPage />);
    await user.click(await screen.findByText('Иванов Иван'));
    await user.click(screen.getByText('Снять'));
    expect(apiFetch).not.toHaveBeenCalledWith(expect.stringContaining('/user-roles/5/'), expect.anything());
  });

  it('подтверждение в confirm() удаляет роль и обновляет список', async () => {
    setupWithRole();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<StaffPage />);
    await user.click(await screen.findByText('Иванов Иван'));
    apiFetch.mockClear();
    // после клика реализация снова резолвит DELETE + users-list, роуты уже настроены выше
    setupWithRole();
    await user.click(screen.getByText('Снять'));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      expect.stringContaining('/user-roles/5/'), expect.objectContaining({ method: 'DELETE' })
    ));
  });
});

const reqPending1 = {
  id: 1, user_name: 'Петров Пётр', user_email: 'petrov@tm.ru',
  dept_name: 'Бюро автоматики', role_name: 'Инженер', status: 'pending',
  created_at: '2026-07-01T00:00:00Z',
};
const reqPending2 = {
  id: 2, user_name: 'Сидоров Сидор', user_email: 'sidorov@tm.ru',
  dept_name: 'Бюро B', role_name: 'Начальник', status: 'pending',
  created_at: '2026-07-02T00:00:00Z',
};
const reqRejected = {
  id: 3, user_name: 'Кузнецов Кузьма', user_email: 'kuznecov@tm.ru',
  dept_name: 'Бюро C', role_name: 'Инженер', status: 'rejected',
  created_at: '2026-06-01T00:00:00Z', comment: 'Не хватает данных',
};

// staff-requests с учётом текущего фильтра статуса (реализация всегда шлёт status=<filter>)
const staffRequestsByStatus = (byStatus) => (url) => {
  const m = url.match(/status=(\w+)/);
  const status = m ? m[1] : 'pending';
  return Promise.resolve(resp(byStatus[status] || []));
};

describe('StaffPage — вкладка «Заявки»', () => {
  const gotoRequests = async () => {
    const user = userEvent.setup();
    render(<StaffPage />);
    await user.click(await screen.findByText('Заявки'));
    return user;
  };

  it('бейдж pending-счётчика на вкладке: не показывается при 0, число при >0, "9+" при >9', async () => {
    apiFetch.mockImplementation((url) => {
      if (url.includes('/staff-requests/')) return staffRequestsByStatus({ pending: [reqPending1, reqPending2] })(url);
      if (url.includes('/departments/')) return Promise.resolve(resp([dept1]));
      if (url.includes('/roles/')) return Promise.resolve(resp([role1, role2]));
      if (url.includes('/users-list/')) return Promise.resolve(resp([]));
      return Promise.resolve(resp({}));
    });
    render(<StaffPage />);
    expect(await screen.findByText('2')).toBeInTheDocument();
  });

  it('бейдж показывает "9+" при более чем 9 заявках', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ ...reqPending1, id: i + 1 }));
    apiFetch.mockImplementation((url) => {
      if (url.includes('/staff-requests/')) return staffRequestsByStatus({ pending: many })(url);
      if (url.includes('/departments/')) return Promise.resolve(resp([dept1]));
      if (url.includes('/roles/')) return Promise.resolve(resp([role1, role2]));
      if (url.includes('/users-list/')) return Promise.resolve(resp([]));
      return Promise.resolve(resp({}));
    });
    render(<StaffPage />);
    expect(await screen.findByText('9+')).toBeInTheDocument();
  });

  it('пустой список при фильтре pending и другой текст для остальных фильтров', async () => {
    apiFetch.mockImplementation((url) => {
      if (url.includes('/staff-requests/')) return staffRequestsByStatus({})(url);
      if (url.includes('/departments/')) return Promise.resolve(resp([dept1]));
      if (url.includes('/roles/')) return Promise.resolve(resp([role1, role2]));
      if (url.includes('/users-list/')) return Promise.resolve(resp([]));
      return Promise.resolve(resp({}));
    });
    const user = await gotoRequests();
    expect(await screen.findByText('Нет новых заявок')).toBeInTheDocument();

    await user.click(screen.getByText('Одобренные'));
    expect(await screen.findByText('Нет заявок')).toBeInTheDocument();
  });

  it('переключение фильтра статуса перезапрашивает список с этим статусом', async () => {
    apiFetch.mockImplementation((url) => {
      if (url.includes('/staff-requests/')) {
        return staffRequestsByStatus({ pending: [reqPending1], rejected: [reqRejected] })(url);
      }
      if (url.includes('/departments/')) return Promise.resolve(resp([dept1]));
      if (url.includes('/roles/')) return Promise.resolve(resp([role1, role2]));
      if (url.includes('/users-list/')) return Promise.resolve(resp([]));
      return Promise.resolve(resp({}));
    });
    const user = await gotoRequests();
    expect(await screen.findByText('Петров Пётр')).toBeInTheDocument();

    await user.click(screen.getByText('Отклонённые'));
    expect(await screen.findByText('Кузнецов Кузьма')).toBeInTheDocument();
    expect(screen.getByText('Не хватает данных')).toBeInTheDocument();
    expect(screen.queryByText('Петров Пётр')).not.toBeInTheDocument();
  });

  it('одобрение отправляет POST approve/ и перезапрашивает текущий фильтр', async () => {
    apiFetch.mockImplementation((url, opts = {}) => {
      const method = opts.method || 'GET';
      if (url.includes('/approve/') && method === 'POST') return Promise.resolve(resp({}));
      if (url.includes('/staff-requests/')) return staffRequestsByStatus({ pending: [reqPending1] })(url);
      if (url.includes('/departments/')) return Promise.resolve(resp([dept1]));
      if (url.includes('/roles/')) return Promise.resolve(resp([role1, role2]));
      if (url.includes('/users-list/')) return Promise.resolve(resp([]));
      return Promise.resolve(resp({}));
    });
    const user = await gotoRequests();
    await screen.findByText('Петров Пётр');
    apiFetch.mockClear();
    await user.click(screen.getByText('Принять'));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      '/api/v1/auth/staff-requests/1/approve/', expect.objectContaining({ method: 'POST' })
    ));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      expect.stringContaining('/staff-requests/?status=pending')
    ));
  });

  it('отклонение открывает модалку, отправляет комментарий и перезапрашивает список', async () => {
    apiFetch.mockImplementation((url, opts = {}) => {
      const method = opts.method || 'GET';
      if (url.includes('/reject/') && method === 'POST') return Promise.resolve(resp({}));
      if (url.includes('/staff-requests/')) return staffRequestsByStatus({ pending: [reqPending1] })(url);
      if (url.includes('/departments/')) return Promise.resolve(resp([dept1]));
      if (url.includes('/roles/')) return Promise.resolve(resp([role1, role2]));
      if (url.includes('/users-list/')) return Promise.resolve(resp([]));
      return Promise.resolve(resp({}));
    });
    const user = await gotoRequests();
    await screen.findByText('Петров Пётр');
    await user.click(screen.getByText('Отклонить'));
    expect(screen.getByText(/Отклонить заявку/)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Причина...'), 'Недостаточно оснований');
    apiFetch.mockClear();
    await user.click(screen.getAllByText('Отклонить').at(-1));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      '/api/v1/auth/staff-requests/1/reject/',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ comment: 'Недостаточно оснований' }) })
    ));
    await waitFor(() => expect(screen.queryByText(/Отклонить заявку/)).not.toBeInTheDocument());
  });

  it('"Отмена" в модалке отклонения не отправляет запрос', async () => {
    apiFetch.mockImplementation((url) => {
      if (url.includes('/staff-requests/')) return staffRequestsByStatus({ pending: [reqPending1] })(url);
      if (url.includes('/departments/')) return Promise.resolve(resp([dept1]));
      if (url.includes('/roles/')) return Promise.resolve(resp([role1, role2]));
      if (url.includes('/users-list/')) return Promise.resolve(resp([]));
      return Promise.resolve(resp({}));
    });
    const user = await gotoRequests();
    await screen.findByText('Петров Пётр');
    await user.click(screen.getByText('Отклонить'));
    apiFetch.mockClear();
    await user.click(screen.getByText('Отмена'));

    expect(screen.queryByText(/Отклонить заявку/)).not.toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalledWith(expect.stringContaining('/reject/'), expect.anything());
  });
});

describe('StaffPage — назначение роли', () => {
  const setupOpenModal = async () => {
    apiFetch.mockImplementation((url) => {
      if (url.includes('/users-list/')) return Promise.resolve(resp([user1]));
      if (url.includes('/departments/')) return Promise.resolve(resp([dept1]));
      if (url.includes('/roles/')) return Promise.resolve(resp([role1, role2]));
      if (url.includes('/staff-requests/')) return Promise.resolve(resp([]));
      return Promise.resolve(resp({}));
    });
    const user = userEvent.setup();
    render(<StaffPage />);
    await user.click(await screen.findByText('Иванов Иван'));
    await user.click(screen.getByText('+ Назначить роль'));
    return user;
  };

  it('открывает модалку с опциями подразделений и ролей', async () => {
    await setupOpenModal();
    expect(screen.getByRole('heading', { name: /Назначить роль/ })).toBeInTheDocument();
    expect(screen.getByText('Бюро автоматики')).toBeInTheDocument();
    expect(screen.getByText(/Начальник бюро/)).toBeInTheDocument();
    expect(screen.getByText(/✓ может утверждать/)).toBeInTheDocument();
  });

  it('успешный сабмит отправляет POST, обновляет список и закрывает модалку', async () => {
    const user = await setupOpenModal();
    apiFetch.mockImplementation((url, opts = {}) => {
      const method = opts.method || 'GET';
      if (url.includes('/user-roles/') && method === 'POST') return Promise.resolve(resp({ id: 99 }));
      if (url.includes('/users-list/')) return Promise.resolve(resp([user1]));
      if (url.includes('/departments/')) return Promise.resolve(resp([dept1]));
      if (url.includes('/roles/')) return Promise.resolve(resp([role1, role2]));
      if (url.includes('/staff-requests/')) return Promise.resolve(resp([]));
      return Promise.resolve(resp({}));
    });

    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0], '1');
    await user.selectOptions(selects[1], '10');
    await user.click(screen.getByText('Назначить'));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/v1/auth/user-roles/', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ user: 100, department: '1', role: '10' }),
    })));
    await waitFor(() => expect(screen.queryByText(/^Назначить роль/)).not.toBeInTheDocument());
  });

  it('ошибка сохранения показывает parseError-сообщение', async () => {
    const user = await setupOpenModal();
    apiFetch.mockImplementation((url, opts = {}) => {
      const method = opts.method || 'GET';
      if (url.includes('/user-roles/') && method === 'POST') {
        return Promise.resolve(resp({ error: 'Такая роль уже назначена' }, false));
      }
      if (url.includes('/users-list/')) return Promise.resolve(resp([user1]));
      if (url.includes('/departments/')) return Promise.resolve(resp([dept1]));
      if (url.includes('/roles/')) return Promise.resolve(resp([role1, role2]));
      if (url.includes('/staff-requests/')) return Promise.resolve(resp([]));
      return Promise.resolve(resp({}));
    });

    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0], '1');
    await user.selectOptions(selects[1], '10');
    await user.click(screen.getByText('Назначить'));
    expect(await screen.findByText('Такая роль уже назначена')).toBeInTheDocument();
  });

  it('клиентская защита от дублей: выбор уже назначенной комбинации не отправляет запрос', async () => {
    const withRole = {
      ...user1,
      department_roles: [
        { id: 5, department: 1, department_name: 'Бюро автоматики', role: 10, role_name: 'Инженер', can_approve: false },
      ],
    };
    apiFetch.mockImplementation((url) => {
      if (url.includes('/users-list/')) return Promise.resolve(resp([withRole]));
      if (url.includes('/departments/')) return Promise.resolve(resp([dept1]));
      if (url.includes('/roles/')) return Promise.resolve(resp([role1, role2]));
      if (url.includes('/staff-requests/')) return Promise.resolve(resp([]));
      return Promise.resolve(resp({}));
    });
    const user = userEvent.setup();
    render(<StaffPage />);
    await user.click(await screen.findByText('Иванов Иван'));
    await user.click(screen.getByText('+ Назначить роль'));

    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0], '1');
    await user.selectOptions(selects[1], '10');
    apiFetch.mockClear();
    await user.click(screen.getByText('Назначить'));

    expect(await screen.findByText('Эта комбинация подразделение + роль уже назначена')).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalledWith(expect.stringContaining('/user-roles/'), expect.objectContaining({ method: 'POST' }));
  });
});
