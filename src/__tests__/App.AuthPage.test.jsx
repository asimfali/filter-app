import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { useAuth } from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }) => <>{children}</>,
}));
vi.mock('../contexts/IssuesContext.jsx', () => ({
  IssuesProvider: ({ children }) => <>{children}</>,
}));
vi.mock('../contexts/NotificationsContext.jsx', () => ({
  NotificationsProvider: ({ children }) => <>{children}</>,
}));
vi.mock('../contexts/CartContext', () => ({
  CartProvider: ({ children }) => <>{children}</>,
}));

vi.mock('../components/auth/LoginForm', () => ({
  default: ({ onSuccess, onNeed2fa, onNeedActivation }) => (
    <div data-testid="login-form-stub">
      <button onClick={onSuccess}>login-success</button>
      <button onClick={() => onNeed2fa('user@example.com', 'email', 'Код отправлен на почту')}>
        login-need-2fa
      </button>
      <button onClick={() => onNeedActivation('user@example.com')}>login-need-activation</button>
    </div>
  ),
}));
vi.mock('../components/auth/RegisterForm', () => ({
  default: ({ onSuccess }) => (
    <div data-testid="register-form-stub">
      <button onClick={() => onSuccess('new@example.com')}>register-success</button>
    </div>
  ),
}));
vi.mock('../components/auth/ActivateForm', () => ({
  default: ({ email, onSuccess }) => (
    <div data-testid="activate-form-stub" data-email={email}>
      <button onClick={onSuccess}>activate-success</button>
    </div>
  ),
}));
vi.mock('../components/auth/TwoFAForm', () => ({
  default: ({ email, method, message, onSuccess, onBack }) => (
    <div data-testid="twofa-form-stub" data-email={email} data-method={method} data-message={message}>
      <button onClick={onSuccess}>twofa-success</button>
      <button onClick={onBack}>twofa-back</button>
    </div>
  ),
}));
vi.mock('../components/auth/PasswordResetForm', () => ({
  default: ({ onBack }) => (
    <div data-testid="reset-form-stub">
      <button onClick={onBack}>reset-back</button>
    </div>
  ),
}));

// Страницы MainApp сюда не рендерятся (user отсутствует → AuthPage), но App.jsx
// статически импортирует их все (включая FilterTree/cytoscape и ModelViewerPage/
// three.js) — мокаем, чтобы тест не тянул тяжёлые реальные модули.
vi.mock('../components/configurator/FilterTree', () => ({ default: () => null }));
vi.mock('../pages/ParameterEditorPage', () => ({ default: () => null }));
vi.mock('../pages/staff/StaffPage', () => ({ default: () => null }));
vi.mock('../pages/documents/DocumentsPage', () => ({ default: () => null }));
vi.mock('../pages/product/ProductPage', () => ({ default: () => null }));
vi.mock('../pages/SpecEditorPage', () => ({ default: () => null }));
vi.mock('../pages/IssuesPage.jsx', () => ({ default: () => null }));
vi.mock('../pages/IssueThreadPage.jsx', () => ({ default: () => null }));
vi.mock('../pages/SpecPreviewPage', () => ({ default: () => null }));
vi.mock('../pages/model-viewer/ModelViewerPage', () => ({ default: () => null }));
vi.mock('../pages/plm/PLMPage', () => ({ default: () => null }));
vi.mock('../pages/PartEditorPage', () => ({ default: () => null }));
vi.mock('../pages/HeatExchangersPage', () => ({ default: () => null }));
vi.mock('../pages/AccessoryKitsPage', () => ({ default: () => null }));
vi.mock('../pages/FolderUploadPage', () => ({ default: () => null }));
vi.mock('../pages/DefectActPage', () => ({ default: () => null }));
vi.mock('../pages/ProductMasterPage', () => ({ default: () => null }));
vi.mock('../pages/CartPage', () => ({ default: () => null }));
vi.mock('../pages/CartKPPage', () => ({ default: () => null }));
vi.mock('../pages/VariantEditorPage', () => ({ default: () => null }));
vi.mock('../pages/SelectionPage', () => ({ default: () => null }));
vi.mock('../components/layout/Header', () => ({ default: () => null }));

useAuth.mockReturnValue({
  user: null,
  loading: false,
  activeSession: null,
  setActiveSession: vi.fn(),
});

describe('App — AuthPage (пользователь не залогинен)', () => {
  it('по умолчанию показывает экран входа с LoginForm', () => {
    render(<App />);
    expect(screen.getByText('Вход')).toBeInTheDocument();
    expect(screen.getByTestId('login-form-stub')).toBeInTheDocument();
  });

  it('LoginForm.onSuccess не меняет экран (переход управляется AuthContext снаружи)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('login-success'));
    expect(screen.getByTestId('login-form-stub')).toBeInTheDocument();
  });

  it('LoginForm.onNeed2fa переключает на экран 2FA с email/method/message', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('login-need-2fa'));

    expect(screen.getByText('Двухфакторная аутентификация')).toBeInTheDocument();
    const stub = screen.getByTestId('twofa-form-stub');
    expect(stub).toHaveAttribute('data-email', 'user@example.com');
    expect(stub).toHaveAttribute('data-method', 'email');
    expect(stub).toHaveAttribute('data-message', 'Код отправлен на почту');
  });

  it('LoginForm.onNeedActivation переключает на экран активации с email', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('login-need-activation'));

    expect(screen.getByText('Активация аккаунта')).toBeInTheDocument();
    expect(screen.getByTestId('activate-form-stub')).toHaveAttribute('data-email', 'user@example.com');
  });

  it('"Зарегистрироваться" переключает на экран регистрации; "Уже есть аккаунт? Войти" — назад', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Зарегистрироваться'));

    expect(screen.getByText('Регистрация')).toBeInTheDocument();
    expect(screen.getByTestId('register-form-stub')).toBeInTheDocument();

    await user.click(screen.getByText('Войти'));
    expect(screen.getByText('Вход')).toBeInTheDocument();
  });

  it('RegisterForm.onSuccess показывает баннер успеха и переключает на активацию с email', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Зарегистрироваться'));
    await user.click(screen.getByText('register-success'));

    expect(screen.getByText('Аккаунт создан! Введите код из письма.')).toBeInTheDocument();
    expect(screen.getByText('Активация аккаунта')).toBeInTheDocument();
    expect(screen.getByTestId('activate-form-stub')).toHaveAttribute('data-email', 'new@example.com');
  });

  it('"Забыли пароль?" переключает на экран сброса; PasswordResetForm.onBack возвращает к входу', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Забыли пароль?'));

    expect(screen.getByText('Сброс пароля')).toBeInTheDocument();
    expect(screen.getByTestId('reset-form-stub')).toBeInTheDocument();

    await user.click(screen.getByText('reset-back'));
    expect(screen.getByText('Вход')).toBeInTheDocument();
  });

  it('ActivateForm.onSuccess показывает баннер подтверждения и возвращает к входу', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('login-need-activation'));
    await user.click(screen.getByText('activate-success'));

    expect(screen.getByText('Email подтверждён! Теперь войдите.')).toBeInTheDocument();
    expect(screen.getByText('Вход')).toBeInTheDocument();
  });

  it('"← Назад к входу" на экране активации возвращает к входу без баннера успеха', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('login-need-activation'));
    await user.click(screen.getByText('← Назад к входу'));

    expect(screen.getByText('Вход')).toBeInTheDocument();
    expect(screen.queryByText('Email подтверждён! Теперь войдите.')).not.toBeInTheDocument();
  });

  it('TwoFAForm.onBack возвращает к входу', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('login-need-2fa'));
    await user.click(screen.getByText('twofa-back'));

    expect(screen.getByText('Вход')).toBeInTheDocument();
  });

  it('TwoFAForm.onSuccess не меняет экран (переход управляется AuthContext снаружи)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('login-need-2fa'));
    await user.click(screen.getByText('twofa-success'));

    expect(screen.getByTestId('twofa-form-stub')).toBeInTheDocument();
  });
});
