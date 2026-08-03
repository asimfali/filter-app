import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Header from '../Header';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotifications } from '../../../contexts/NotificationsContext.jsx';
import { useCart } from '../../../contexts/CartContext';

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../contexts/NotificationsContext.jsx', () => ({ useNotifications: vi.fn() }));
vi.mock('../../../contexts/CartContext', () => ({ useCart: vi.fn() }));

vi.mock('../../common/SmartSelect', () => ({
  default: ({ onSelect, placeholder }) => (
    <input
      placeholder={placeholder}
      data-testid="smart-select-stub"
      onChange={(e) => { if (e.target.value === 'TRIGGER') onSelect({ id: 42 }); }}
    />
  ),
}));

vi.mock('../../auth/ProfileModal', () => ({
  default: ({ onClose }) => (
    <div data-testid="profile-modal-stub">
      <button onClick={onClose}>close-profile</button>
    </div>
  ),
}));

const baseUser = {
  id: 1,
  email: 'user@example.com',
  full_name: 'Иван Иванов',
  username: 'ivanov',
  permissions: [],
  avatar_url: null,
};

const setupAuth = (overrides = {}) => {
  useAuth.mockReturnValue({
    user: baseUser,
    logout: vi.fn(),
    activeSession: null,
    refreshUser: vi.fn(),
    ...overrides,
  });
};

const setupNotifications = (overrides = {}) => {
  useNotifications.mockReturnValue({
    notifications: [],
    unreadCount: 0,
    markAllRead: vi.fn(),
    dismiss: vi.fn(),
    ...overrides,
  });
};

const setupCart = (overrides = {}) => {
  useCart.mockReturnValue({ itemsCount: 0, activeCartId: null, ...overrides });
};

let notifIdSeq = 0;
const notif = (overrides = {}) => ({
  id: ++notifIdSeq,
  notification_type: 'issues.new_issue',
  is_delivered: false,
  created_at: '2026-01-01T10:00:00Z',
  payload: {},
  ...overrides,
});

const renderHeader = (props = {}) =>
  render(<Header currentPage="configurator" onNavigate={vi.fn()} {...props} />);

beforeEach(() => {
  notifIdSeq = 0;
  setupAuth();
  setupNotifications();
  setupCart();
});

describe('Header — без пользователя', () => {
  it('рендерит только заголовок — без nav/поиска/колокольчика/корзины/выхода', () => {
    setupAuth({ user: null, logout: vi.fn(), activeSession: null, refreshUser: vi.fn() });
    renderHeader();

    expect(screen.getByText('Корпоративный портал')).toBeInTheDocument();
    expect(screen.queryByTitle('Конфигуратор')).not.toBeInTheDocument();
    expect(screen.queryByTestId('smart-select-stub')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Уведомления')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Корзина')).not.toBeInTheDocument();
    expect(screen.queryByText('Выйти')).not.toBeInTheDocument();
  });
});

describe('Header — навигация', () => {
  it('без прав показывает только Конфигуратор (code: null)', () => {
    renderHeader();
    expect(screen.getByTitle('Конфигуратор')).toBeInTheDocument();
    expect(screen.queryByTitle('Персонал')).not.toBeInTheDocument();
    expect(screen.queryByTitle('PLM')).not.toBeInTheDocument();
  });

  it('показывает пункт меню, если у пользователя есть его право', () => {
    setupAuth({ user: { ...baseUser, permissions: ['portal.page.staff', 'plm.stage.manage'] } });
    renderHeader();
    expect(screen.getByTitle('Персонал')).toBeInTheDocument();
    expect(screen.getByTitle('PLM')).toBeInTheDocument();
    expect(screen.queryByTitle('Продажи')).not.toBeInTheDocument();
  });

  it('добавляет "✎ Редактор" только когда активная сессия — spec-editor', () => {
    setupAuth({ user: baseUser, activeSession: { data: { page: 'spec-editor' } } });
    renderHeader();
    expect(screen.getByTitle('✎ Редактор')).toBeInTheDocument();
  });

  it('не добавляет "✎ Редактор" для другой активной сессии', () => {
    setupAuth({ user: baseUser, activeSession: { data: { page: 'other' } } });
    renderHeader();
    expect(screen.queryByTitle('✎ Редактор')).not.toBeInTheDocument();
  });

  it('подсвечивает активную страницу', () => {
    renderHeader({ currentPage: 'configurator' });
    expect(screen.getByTitle('Конфигуратор').className).toContain('bg-blue-100');
  });

  it('клик по пункту меню вызывает onNavigate с его id', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    setupAuth({ user: { ...baseUser, permissions: ['portal.page.staff'] } });
    renderHeader({ onNavigate });

    await user.click(screen.getByTitle('Персонал'));
    expect(onNavigate).toHaveBeenCalledWith('staff');
  });
});

describe('Header — поиск', () => {
  it('рендерит SmartSelect с нужным placeholder и навигирует на выбранный товар', () => {
    const onNavigate = vi.fn();
    renderHeader({ onNavigate });

    const input = screen.getByTestId('smart-select-stub');
    expect(input.placeholder).toBe('Поиск товара...');

    fireEvent.change(input, { target: { value: 'TRIGGER' } });
    expect(onNavigate).toHaveBeenCalledWith('product', 42);
  });
});

describe('Header — корзина', () => {
  it('не рендерится без права sales.cart.write', () => {
    renderHeader();
    expect(screen.queryByTitle('Корзина')).not.toBeInTheDocument();
  });

  it('рендерится с правом; бейдж только при itemsCount > 0', () => {
    setupAuth({ user: { ...baseUser, permissions: ['sales.cart.write'] } });
    setupCart({ itemsCount: 0 });
    const { rerender } = renderHeader();
    expect(screen.getByTitle('Корзина')).toBeInTheDocument();
    expect(within(screen.getByTitle('Корзина')).queryByText(/^\d+\+?$/)).not.toBeInTheDocument();

    setupCart({ itemsCount: 3 });
    rerender(<Header currentPage="configurator" onNavigate={vi.fn()} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('бейдж корзины показывает "9+" при itemsCount > 9', () => {
    setupAuth({ user: { ...baseUser, permissions: ['sales.cart.write'] } });
    setupCart({ itemsCount: 15 });
    renderHeader();
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('клик по корзине вызывает onNavigate("sales")', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    setupAuth({ user: { ...baseUser, permissions: ['sales.cart.write'] } });
    renderHeader({ onNavigate });

    await user.click(screen.getByTitle('Корзина'));
    expect(onNavigate).toHaveBeenCalledWith('sales');
  });
});

describe('Header — профиль', () => {
  it('показывает первую букву full_name, если нет avatar_url', () => {
    renderHeader();
    expect(screen.getByText('И')).toBeInTheDocument();
  });

  it('падает на email[0], если нет full_name', () => {
    setupAuth({ user: { ...baseUser, full_name: null, email: 'zzz@example.com' } });
    renderHeader();
    expect(screen.getByText('z')).toBeInTheDocument();
  });

  it('падает на "?" совсем без имени и email', () => {
    setupAuth({ user: { ...baseUser, full_name: null, email: null } });
    renderHeader();
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('рендерит <img> вместо инициала при наличии avatar_url', () => {
    setupAuth({ user: { ...baseUser, avatar_url: '/media/avatar.png' } });
    renderHeader();
    expect(screen.getByAltText('')).toHaveAttribute('src', '/media/avatar.png');
  });

  it('показывает full_name || username и email', () => {
    renderHeader();
    expect(screen.getByText('Иван Иванов')).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  it('падает на username, если нет full_name', () => {
    setupAuth({ user: { ...baseUser, full_name: null } });
    renderHeader();
    expect(screen.getByText('ivanov')).toBeInTheDocument();
  });

  it('клик по аватарке открывает ProfileModal; его onClose скрывает модалку', async () => {
    const user = userEvent.setup();
    renderHeader();

    expect(screen.queryByTestId('profile-modal-stub')).not.toBeInTheDocument();
    await user.click(screen.getByText('Иван Иванов'));
    expect(screen.getByTestId('profile-modal-stub')).toBeInTheDocument();

    await user.click(screen.getByText('close-profile'));
    expect(screen.queryByTestId('profile-modal-stub')).not.toBeInTheDocument();
  });

  it('кнопка "Выйти" вызывает logout', async () => {
    const user = userEvent.setup();
    const logout = vi.fn();
    setupAuth({ user: baseUser, logout });
    renderHeader();

    await user.click(screen.getByText('Выйти'));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});

describe('Header — NotificationBell', () => {
  it('без непрочитанных не показывает бейдж', () => {
    renderHeader();
    expect(within(screen.getByTitle('Уведомления')).queryByText(/^\d+\+?$/)).not.toBeInTheDocument();
  });

  it('показывает счётчик непрочитанных, "9+" при >9', () => {
    setupNotifications({ unreadCount: 5 });
    const { rerender } = renderHeader();
    expect(screen.getByText('5')).toBeInTheDocument();

    setupNotifications({ unreadCount: 12 });
    rerender(<Header currentPage="configurator" onNavigate={vi.fn()} />);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('открытие с unreadCount>0 вызывает markAllRead; при 0 — нет', async () => {
    const user = userEvent.setup();
    const markAllReadWhenZero = vi.fn();
    setupNotifications({ unreadCount: 0, markAllRead: markAllReadWhenZero });
    renderHeader();
    await user.click(screen.getByTitle('Уведомления'));
    expect(markAllReadWhenZero).not.toHaveBeenCalled();
  });

  it('открытие с unreadCount>0 отмечает все прочитанными', async () => {
    const user = userEvent.setup();
    const markAllRead = vi.fn();
    setupNotifications({ unreadCount: 2, markAllRead });
    renderHeader();
    await user.click(screen.getByTitle('Уведомления'));
    expect(markAllRead).toHaveBeenCalledTimes(1);
  });

  it('показывает "Нет уведомлений" для пустого списка, без кнопки "Прочитать все"', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByTitle('Уведомления'));
    expect(screen.getByText('Нет уведомлений')).toBeInTheDocument();
    expect(screen.queryByText('Прочитать все')).not.toBeInTheDocument();
  });

  it('"Прочитать все" показывается при непустом списке и вызывает markAllRead', async () => {
    const user = userEvent.setup();
    const markAllRead = vi.fn();
    setupNotifications({ notifications: [notif({ id: 1 })], unreadCount: 0, markAllRead });
    renderHeader();
    await user.click(screen.getByTitle('Уведомления'));

    await user.click(screen.getByText('Прочитать все'));
    expect(markAllRead).toHaveBeenCalledTimes(1);
  });

  it('рендерит не больше 20 уведомлений', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 25 }, (_, i) =>
      notif({
        id: i + 1,
        notification_type: 'issues.new_issue',
        payload: { type: 'new_issue', thread_title: 'T', issue_number: i, issue_title: 'X', created_by: 'A' },
      })
    );
    setupNotifications({ notifications: many, unreadCount: 0 });
    renderHeader();
    await user.click(screen.getByTitle('Уведомления'));

    expect(screen.getAllByText('Новое замечание')).toHaveLength(20);
  });

  it('известный notification_type показывает лейбл из словаря, неизвестный — сырой код', async () => {
    const user = userEvent.setup();
    setupNotifications({
      notifications: [
        notif({
          id: 1,
          notification_type: 'issues.new_issue',
          payload: { type: 'new_issue', thread_title: 'T', issue_number: 1, issue_title: 'X', created_by: 'A' },
        }),
        notif({ id: 2, notification_type: 'custom.unknown_type', payload: {} }),
      ],
    });
    renderHeader();
    await user.click(screen.getByTitle('Уведомления'));

    expect(screen.getByText('Новое замечание')).toBeInTheDocument();
    expect(screen.getByText('custom.unknown_type')).toBeInTheDocument();
  });

  it('не рендерит строку подзаголовка для неизвестного payload.type', async () => {
    const user = userEvent.setup();
    setupNotifications({ notifications: [notif({ id: 1, notification_type: 'x', payload: { type: 'weird' } })] });
    renderHeader();
    await user.click(screen.getByTitle('Уведомления'));

    expect(screen.getByText('x')).toBeInTheDocument();
  });

  it.each([
    ['new_issue', { type: 'new_issue', thread_title: 'Тема', issue_number: 7, issue_title: 'Течь', created_by: 'Петров' },
      'Тема · #7 Течь — от Петров'],
    ['new_message', { type: 'new_message', thread_title: 'Тема', issue_number: 7, author: 'Петров', text: 'привет' },
      'Тема · #7 — Петров: привет'],
    ['status_changed', { type: 'status_changed', issue_number: 7, issue_title: 'Течь', new_status: 'closed' },
      '#7 Течь → closed'],
    ['assigned', { type: 'assigned', issue_number: 7, issue_title: 'Течь', assigned_by: 'Иванов' },
      '#7 Течь — от Иванов'],
    ['new_staff_request', { type: 'new_staff_request', user_name: 'Сидоров', department_name: 'Отдел', role_name: 'Инженер' },
      'Сидоров → Отдел (Инженер)'],
    ['plm.stage_submitted', { type: 'plm.stage_submitted', product_name: 'КЭВ-1', litera: 'A' },
      'КЭВ-1 / Лит.A'],
    ['plm.stage_active', { type: 'plm.stage_active', product_name: 'КЭВ-1', litera: 'A' },
      'КЭВ-1 / Лит.A — активна ✓'],
    ['plm.stage_rejected', { type: 'plm.stage_rejected', product_name: 'КЭВ-1', litera: 'A', department: 'ОТК', comment: 'брак' },
      'КЭВ-1 / Лит.A — ОТК: брак'],
  ])('подзаголовок для payload.type=%s формируется по шаблону', async (_type, payload, expected) => {
    const user = userEvent.setup();
    setupNotifications({ notifications: [notif({ id: 1, notification_type: 'x', payload })] });
    renderHeader();
    await user.click(screen.getByTitle('Уведомления'));

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('staff_request_resolved: "одобрено ✓" при approved=true, "отклонено ✗" при false', async () => {
    const user = userEvent.setup();
    setupNotifications({
      notifications: [
        notif({
          id: 1,
          notification_type: 'authority.staff_request_resolved',
          payload: { type: 'staff_request_resolved', department_name: 'Отдел', approved: true },
        }),
      ],
    });
    renderHeader();
    await user.click(screen.getByTitle('Уведомления'));

    expect(screen.getByText('Отдел: одобрено ✓')).toBeInTheDocument();
  });

  it('клик снаружи закрывает дропдаун', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <div data-testid="outside">снаружи</div>
        <Header currentPage="configurator" onNavigate={vi.fn()} />
      </div>
    );
    await user.click(screen.getByTitle('Уведомления'));
    expect(screen.getByText('Нет уведомлений')).toBeInTheDocument();

    await user.click(screen.getByTestId('outside'));
    expect(screen.queryByText('Нет уведомлений')).not.toBeInTheDocument();
  });
});

describe('Header — NotificationBell: клик по уведомлению', () => {
  it('authority.new_staff_request → dismiss + onNavigate("staff") + закрытие', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const dismiss = vi.fn();
    setupNotifications({
      notifications: [
        notif({
          id: 1,
          notification_type: 'authority.new_staff_request',
          payload: { type: 'new_staff_request', user_name: 'A', department_name: 'B', role_name: 'C' },
        }),
      ],
      dismiss,
    });
    renderHeader({ onNavigate });
    await user.click(screen.getByTitle('Уведомления'));
    await user.click(screen.getByText('Новая заявка сотрудника'));

    expect(dismiss).toHaveBeenCalledWith(1);
    expect(onNavigate).toHaveBeenCalledWith('staff');
    expect(screen.queryByText('Новая заявка сотрудника')).not.toBeInTheDocument();
  });

  it('authority.staff_request_resolved закрывает дропдаун без onNavigate', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    setupNotifications({
      notifications: [
        notif({
          id: 2,
          notification_type: 'authority.staff_request_resolved',
          payload: { type: 'staff_request_resolved', department_name: 'B', approved: false },
        }),
      ],
    });
    renderHeader({ onNavigate });
    await user.click(screen.getByTitle('Уведомления'));
    await user.click(screen.getByText('Заявка рассмотрена'));

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it.each([
    ['plm.stage_submitted', 'Стадия на согласовании'],
    ['plm.stage_active', 'Стадия активирована'],
    ['plm.stage_rejected', 'Стадия отклонена'],
  ])('%s → onNavigate("plm")', async (type, label) => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    setupNotifications({
      notifications: [
        notif({ id: 3, notification_type: type, payload: { type, product_name: 'КЭВ', litera: 'A', department: 'X', comment: 'Y' } }),
      ],
    });
    renderHeader({ onNavigate });
    await user.click(screen.getByTitle('Уведомления'));
    await user.click(screen.getByText(label));

    expect(onNavigate).toHaveBeenCalledWith('plm');
  });

  it('issues-уведомление с payload.thread_id → onNavigate("issue-thread", id)', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    setupNotifications({
      notifications: [
        notif({
          id: 4,
          notification_type: 'issues.new_message',
          payload: { type: 'new_message', thread_id: 77, thread_title: 'T', issue_number: 1, author: 'A', text: 'x' },
        }),
      ],
    });
    renderHeader({ onNavigate });
    await user.click(screen.getByTitle('Уведомления'));
    await user.click(screen.getByText('Новое сообщение'));

    expect(onNavigate).toHaveBeenCalledWith('issue-thread', 77);
  });

  it('issues-уведомление без thread_id никуда не навигирует', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    setupNotifications({
      notifications: [
        notif({ id: 5, notification_type: 'issues.new_message', payload: { type: 'new_message', text: 'x' } }),
      ],
    });
    renderHeader({ onNavigate });
    await user.click(screen.getByTitle('Уведомления'));
    await user.click(screen.getByText('Новое сообщение'));

    expect(onNavigate).not.toHaveBeenCalled();
  });
});
