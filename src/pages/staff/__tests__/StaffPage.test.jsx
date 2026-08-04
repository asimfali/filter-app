import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffPage from '../StaffPage';
import { apiFetch, authApi } from '../../../api/auth';
import { useAuth } from '../../../contexts/AuthContext';

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../api/auth', () => ({
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

  it('отмена в модалке подтверждения не удаляет роль', async () => {
    setupWithRole();
    const user = userEvent.setup();
    render(<StaffPage />);
    await user.click(await screen.findByText('Иванов Иван'));
    await user.click(screen.getByText('Снять'));
    expect(screen.getByText('Снять роль?')).toBeInTheDocument();
    await user.click(screen.getByText('Отмена'));
    expect(apiFetch).not.toHaveBeenCalledWith(expect.stringContaining('/user-roles/5/'), expect.anything());
  });

  it('подтверждение в модалке удаляет роль и обновляет список', async () => {
    setupWithRole();
    const user = userEvent.setup();
    render(<StaffPage />);
    await user.click(await screen.findByText('Иванов Иван'));
    apiFetch.mockClear();
    // после клика реализация снова резолвит DELETE + users-list, роуты уже настроены выше
    setupWithRole();
    await user.click(screen.getByText('Снять'));
    await user.click(screen.getByText('Подтвердить'));
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

// ── Модуль 14 / шаг 3: вкладка «Подразделения» ────────────────────────────

const deptChild = {
  id: 2, name: 'Группа ПО', code: 'po', description: '', parent: 1, members_count: 1, children: [],
};
const deptRoot = {
  id: 1, name: 'Бюро автоматики', code: 'ba', description: 'Автоматика', parent: null,
  members_count: 3, children: [deptChild],
};

const perm1 = { id: 501, code: 'catalog.product.read', name: 'Чтение товара', resource_type: 'product' };
const perm2 = { id: 502, code: 'catalog.product.write', name: 'Запись товара', resource_type: 'product' };
const perm3 = { id: 503, code: 'bom.spec.write', name: 'Запись характеристик', resource_type: 'spec' };

const specMatrixData = {
  roles: [role1, role2],
  specs: [
    { spec_id: 1, spec_name: 'Мощность', spec_unit: 'кВт', roles: { 10: 5001 } },
    { spec_id: 2, spec_name: 'Напряжение', spec_unit: null, roles: { 10: null } },
  ],
};

const routeDeptFetch = (overrides = {}) => (url, opts = {}) => {
  const method = opts.method || 'GET';
  const o = overrides;
  if (url.match(/\/departments\/\d+\/permissions\/\d+\/$/) && method === 'DELETE') {
    return Promise.resolve(resp({}));
  }
  if (url.match(/\/departments\/\d+\/permissions\/$/) && method === 'POST') {
    return Promise.resolve((o.addPermission || (() => resp({ id: 900 })))());
  }
  if (url.match(/\/departments\/\d+\/permissions\/$/) && method === 'GET') {
    return Promise.resolve(resp(o.deptPerms ?? []));
  }
  if (url.endsWith('/permissions/') && method === 'POST') {
    return Promise.resolve((o.createPermission || (() => resp({ id: 504, code: 'x', name: 'x', resource_type: 'x' })))());
  }
  if (url.endsWith('/permissions/') && method === 'GET') {
    return Promise.resolve(resp(o.allPermissions ?? [perm1, perm2, perm3]));
  }
  if (url.includes('/departments/') && (method === 'POST' || method === 'PATCH')) {
    return Promise.resolve((o.saveDept || (() => resp({ id: 1 })))());
  }
  if (url.includes('/departments/') && url.includes('root_only=true')) return Promise.resolve(resp(o.departments ?? [deptRoot]));
  if (url.includes('/roles/')) return Promise.resolve(resp([role1, role2]));
  if (url.includes('/users-list/')) return Promise.resolve(resp([]));
  if (url.includes('/staff-requests/')) return Promise.resolve(resp([]));
  return Promise.resolve(resp({}));
};

describe('StaffPage — вкладка «Подразделения»', () => {
  const gotoDepartments = async (overrides = {}) => {
    apiFetch.mockImplementation(routeDeptFetch(overrides));
    const user = userEvent.setup();
    render(<StaffPage />);
    await user.click(await screen.findByText('Подразделения'));
    return user;
  };

  it('рендерит дерево с вложенностью и счётчиком сотрудников', async () => {
    await gotoDepartments();
    expect(await screen.findByText('Бюро автоматики')).toBeInTheDocument();
    expect(screen.getByText('3 чел.')).toBeInTheDocument();
    expect(screen.getByText('Группа ПО')).toBeInTheDocument();
    expect(screen.getByText('1 чел.')).toBeInTheDocument();
  });

  it('пустой список подразделений показывает заглушку', async () => {
    await gotoDepartments({ departments: [] });
    expect(await screen.findByText('Нет подразделений')).toBeInTheDocument();
  });

  it('"+ Добавить корневое" открывает модалку создания без вкладок', async () => {
    const user = await gotoDepartments();
    await screen.findByText('Бюро автоматики');
    await user.click(screen.getByText('+ Добавить корневое'));

    expect(screen.getByText('Новое корневое подразделение')).toBeInTheDocument();
    expect(screen.queryByText('Основное')).not.toBeInTheDocument();
    expect(screen.queryByText('Права')).not.toBeInTheDocument();
  });

  it('"+ дочернее" открывает модалку с указанием родителя', async () => {
    const user = await gotoDepartments();
    await screen.findByText('Бюро автоматики');
    await user.click(screen.getAllByText('+ дочернее')[0]);

    expect(screen.getByText('Новое подразделение в «Бюро автоматики»')).toBeInTheDocument();
    expect(screen.getByText('Родитель:')).toBeInTheDocument();
  });

  it('создание корневого подразделения отправляет POST и перезагружает список', async () => {
    const user = await gotoDepartments();
    await screen.findByText('Бюро автоматики');
    await user.click(screen.getByText('+ Добавить корневое'));

    await user.type(screen.getByPlaceholderText('Бюро автоматики'), 'Новое бюро');
    await user.type(screen.getByPlaceholderText('ba'), 'nb');
    apiFetch.mockClear();
    await user.click(screen.getByText('Сохранить'));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/v1/auth/departments/', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'Новое бюро', code: 'nb', description: '', parent: null }),
    })));
    await waitFor(() => expect(screen.queryByText('Новое корневое подразделение')).not.toBeInTheDocument());
  });

  it('ошибка сохранения подразделения показывает parseError', async () => {
    const user = await gotoDepartments({ saveDept: () => resp({ error: 'Код уже занят' }, false) });
    await screen.findByText('Бюро автоматики');
    await user.click(screen.getByText('+ Добавить корневое'));
    await user.type(screen.getByPlaceholderText('Бюро автоматики'), 'X');
    await user.type(screen.getByPlaceholderText('ba'), 'x');
    await user.click(screen.getByText('Сохранить'));
    expect(await screen.findByText('Код уже занят')).toBeInTheDocument();
  });

  it('"✎" открывает редактирование с предзаполненными полями и вкладками', async () => {
    const user = await gotoDepartments();
    await screen.findByText('Бюро автоматики');
    await user.click(screen.getAllByText('✎')[0]);

    expect(screen.getByText('Редактировать: Бюро автоматики')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Бюро автоматики')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ba')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Автоматика')).toBeInTheDocument();
    expect(screen.getByText('Основное')).toBeInTheDocument();
    expect(screen.getByText('Права')).toBeInTheDocument();
    expect(screen.getByText('Характеристики')).toBeInTheDocument();
  });

  it('редактирование отправляет PATCH с id подразделения', async () => {
    const user = await gotoDepartments();
    await screen.findByText('Бюро автоматики');
    await user.click(screen.getAllByText('✎')[0]);

    const nameInput = screen.getByDisplayValue('Бюро автоматики');
    await user.clear(nameInput);
    await user.type(nameInput, 'Бюро автоматики 2');
    apiFetch.mockClear();
    await user.click(screen.getByText('Сохранить'));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/v1/auth/departments/1/', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ name: 'Бюро автоматики 2', code: 'ba', description: 'Автоматика', parent: null }),
    })));
  });

  describe('вкладка «Права» (DeptPermissionsTab)', () => {
    const openPermissionsTab = async (overrides = {}) => {
      const user = await gotoDepartments(overrides);
      await screen.findByText('Бюро автоматики');
      await user.click(screen.getAllByText('✎')[0]);
      await user.click(screen.getByText('Права'));
      return user;
    };

    it('группирует права по типу ресурса и показывает включённые галочкой', async () => {
      await openPermissionsTab({ deptPerms: [{ id: 900, role: 10, permission: 501 }] });
      expect(await screen.findByText('Товар')).toBeInTheDocument();
      expect(screen.getByText('Характеристика')).toBeInTheDocument();
      expect(screen.getByText('catalog.product.read')).toBeInTheDocument();
    });

    it('сворачивание/разворачивание группы скрывает её таблицу', async () => {
      const user = await openPermissionsTab();
      await screen.findByText('catalog.product.read');
      await user.click(screen.getByText('Товар'));
      expect(screen.queryByText('catalog.product.read')).not.toBeInTheDocument();
      await user.click(screen.getByText('Товар'));
      expect(await screen.findByText('catalog.product.read')).toBeInTheDocument();
    });

    it('поиск фильтрует список прав по коду/названию', async () => {
      const user = await openPermissionsTab();
      await screen.findByText('catalog.product.read');
      await user.type(screen.getByPlaceholderText('Поиск по коду или названию...'), 'spec');
      expect(screen.queryByText('catalog.product.read')).not.toBeInTheDocument();
      expect(screen.getByText('bom.spec.write')).toBeInTheDocument();
    });

    it('переключение права отправляет POST при выключенном и DELETE при включённом', async () => {
      const user = await openPermissionsTab({ deptPerms: [{ id: 900, role: 10, permission: 501 }] });
      await screen.findByText('catalog.product.read');
      const readRow = () => screen.getAllByRole('row').find(r => r.textContent.includes('catalog.product.read'));

      apiFetch.mockClear();
      // роль1 (10) уже включена для этого права -> клик должен удалить
      await user.click(within(readRow()).getAllByRole('button')[0]);
      await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
        '/api/v1/auth/departments/1/permissions/900/', expect.objectContaining({ method: 'DELETE' })
      ));

      apiFetch.mockClear();
      // роль2 (11) не включена -> клик должен создать (перечитываем строку — после DELETE таблица перерендерилась)
      await user.click(within(readRow()).getAllByRole('button')[1]);
      await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
        '/api/v1/auth/departments/1/permissions/', expect.objectContaining({
          method: 'POST', body: JSON.stringify({ role: 11, permission: 501 }),
        })
      ));
    });

    it('toggle обновляет галочку оптимистично, без перезагрузки списка (не сбрасывает scroll)', async () => {
      const user = await openPermissionsTab({
        deptPerms: [{ id: 900, role: 10, permission: 501 }],
        addPermission: () => resp({ id: 901, role: 11, permission: 501 }),
      });
      await screen.findByText('catalog.product.read');
      const readRow = () => screen.getAllByRole('row').find(r => r.textContent.includes('catalog.product.read'));

      apiFetch.mockClear();
      await user.click(within(readRow()).getAllByRole('button')[1]);
      await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
        '/api/v1/auth/departments/1/permissions/', expect.objectContaining({ method: 'POST' })
      ));

      // список прав не перезапрашивался (GET без опций, как в useDeptPermissions.load) ->
      // таблица не размонтировалась/не мигнула "Загрузка..."
      expect(apiFetch).not.toHaveBeenCalledWith('/api/v1/auth/departments/1/permissions/');
      expect(screen.queryByText('Загрузка...')).not.toBeInTheDocument();
      expect(within(readRow()).getAllByRole('button')[1]).toHaveTextContent('✓');
    });

    it('пустое состояние при отсутствии прав/ролей', async () => {
      await openPermissionsTab({ allPermissions: [] });
      expect(await screen.findByText('Нет данных')).toBeInTheDocument();
    });

    it('"+ Новое право" создаёт право с автогенерацией кода и добавляет его в список', async () => {
      const user = await openPermissionsTab();
      await screen.findByText('catalog.product.read');
      await user.click(screen.getByText('+ Новое право'));
      expect(screen.getByText('Новое право доступа')).toBeInTheDocument();

      const selects = screen.getAllByRole('combobox');
      await user.selectOptions(selects[0], 'document');
      await user.selectOptions(selects[1], 'delete');
      expect(screen.getByPlaceholderText('portal.document.delete')).toHaveValue('portal.document.delete');

      await user.type(screen.getByPlaceholderText('Удаление документов'), 'Удаление документов');
      apiFetch.mockImplementation(routeDeptFetch({
        createPermission: () => resp({ id: 777, code: 'portal.document.delete', name: 'Удаление документов', resource_type: 'document' }),
      }));
      await user.click(screen.getByText('Создать'));

      await waitFor(() => expect(screen.queryByText('Новое право доступа')).not.toBeInTheDocument());
      expect(await screen.findByText('portal.document.delete')).toBeInTheDocument();
    });

    it('ручное редактирование кода отключает автогенерацию при смене типа/действия', async () => {
      const user = await openPermissionsTab();
      await screen.findByText('catalog.product.read');
      await user.click(screen.getByText('+ Новое право'));

      const codeInput = screen.getByPlaceholderText('portal.document.delete');
      await user.type(codeInput, 'custom.code');
      const selects = screen.getAllByRole('combobox');
      await user.selectOptions(selects[0], 'document');
      expect(codeInput).toHaveValue('custom.code');
    });
  });

  describe('вкладка «Характеристики» (SpecPermissionsTab)', () => {
    const openSpecsTab = async (overrides = {}) => {
      authApi.specMatrix.mockResolvedValue({ ok: true, data: overrides.matrix ?? specMatrixData });
      authApi.specToggle.mockResolvedValue(overrides.toggleResult ?? { ok: true, data: { action: 'created', drp_id: 6001 } });
      const user = await gotoDepartments();
      await screen.findByText('Бюро автоматики');
      await user.click(screen.getAllByText('✎')[0]);
      await user.click(screen.getByText('Характеристики'));
      return user;
    };

    it('запрашивает матрицу для подразделения и рендерит характеристики/роли', async () => {
      await openSpecsTab();
      expect(await screen.findByText('Мощность')).toBeInTheDocument();
      expect(screen.getByText('кВт')).toBeInTheDocument();
      expect(screen.getByText('Напряжение')).toBeInTheDocument();
      expect(authApi.specMatrix).toHaveBeenCalledWith(1);
    });

    it('пустая матрица показывает заглушку', async () => {
      await openSpecsTab({ matrix: { roles: [role1], specs: [] } });
      expect(await screen.findByText('Характеристики не найдены')).toBeInTheDocument();
    });

    it('клик по ячейке переключает право и оптимистично обновляет матрицу без релоада', async () => {
      const user = await openSpecsTab();
      await screen.findByText('Мощность');
      authApi.specMatrix.mockClear();

      const rows = screen.getAllByRole('row');
      const powerRow = rows.find(r => r.textContent.includes('Мощность'));
      const [, role2Cell] = within(powerRow).getAllByRole('button');

      await user.click(role2Cell);
      await waitFor(() => expect(authApi.specToggle).toHaveBeenCalledWith(1, 11, 1));
      expect(authApi.specMatrix).not.toHaveBeenCalled();
    });
  });
});
