import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../AuthContext';
import { authApi, tokenStorage } from '../../api/auth';
import { sessionsApi } from '../../api/sessions';

vi.mock('../../api/auth', () => ({
  authApi: {
    profile: vi.fn(),
    login: vi.fn(),
    login2fa: vi.fn(),
    logout: vi.fn(),
  },
  tokenStorage: {
    getAccess: vi.fn(),
    getRefresh: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock('../../api/sessions', () => ({
  sessionsApi: {
    getCurrent: vi.fn(),
  },
}));

function Harness() {
  const auth = useAuth();
  const [lastLoginResult, setLastLoginResult] = useState(null);

  return (
    <div>
      <div data-testid="loading">{String(auth.loading)}</div>
      <div data-testid="user">{auth.user ? auth.user.email : 'none'}</div>
      <div data-testid="session">{auth.activeSession ? auth.activeSession.id : 'none'}</div>
      <div data-testid="login-result">{lastLoginResult ? JSON.stringify(lastLoginResult) : ''}</div>
      <button onClick={async () => setLastLoginResult(await auth.login('user@example.com', 'pw'))}>
        login
      </button>
      <button onClick={() => auth.login2fa('user@example.com', '123456')}>login2fa</button>
      <button onClick={() => auth.logout()}>logout</button>
      <button onClick={() => auth.refreshUser()}>refresh</button>
    </div>
  );
}

const renderAuth = () => render(<AuthProvider><Harness /></AuthProvider>);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuthProvider — восстановление сессии при маунте', () => {
  it('заканчивает загрузку без пользователя, если токена в сторадже нет', async () => {
    tokenStorage.getAccess.mockReturnValue(null);
    renderAuth();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(authApi.profile).not.toHaveBeenCalled();
    expect(sessionsApi.getCurrent).not.toHaveBeenCalled();
  });

  it('восстанавливает пользователя и активную сессию по валидному токену', async () => {
    tokenStorage.getAccess.mockReturnValue('tok');
    authApi.profile.mockResolvedValue({ ok: true, data: { id: 1, email: 'user@example.com' } });
    sessionsApi.getCurrent.mockResolvedValue({ success: true, data: { id: 5, data: { page: 'spec-editor' } } });

    renderAuth();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('user@example.com');
    expect(screen.getByTestId('session')).toHaveTextContent('5');
  });

  it('чистит токены и остаётся разлогиненным, если /profile/ отвечает не ok', async () => {
    tokenStorage.getAccess.mockReturnValue('stale-tok');
    authApi.profile.mockResolvedValue({ ok: false, data: {} });

    renderAuth();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(tokenStorage.clear).toHaveBeenCalledTimes(1);
    expect(sessionsApi.getCurrent).not.toHaveBeenCalled();
  });

  it('тихо игнорирует ошибку получения активной сессии', async () => {
    tokenStorage.getAccess.mockReturnValue('tok');
    authApi.profile.mockResolvedValue({ ok: true, data: { id: 1, email: 'user@example.com' } });
    sessionsApi.getCurrent.mockRejectedValue(new Error('network'));

    renderAuth();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('user@example.com');
    expect(screen.getByTestId('session')).toHaveTextContent('none');
  });

  it('не выставляет активную сессию при success:false от sessionsApi.getCurrent', async () => {
    tokenStorage.getAccess.mockReturnValue('tok');
    authApi.profile.mockResolvedValue({ ok: true, data: { id: 1, email: 'user@example.com' } });
    sessionsApi.getCurrent.mockResolvedValue({ success: false });

    renderAuth();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('session')).toHaveTextContent('none');
  });
});

describe('AuthProvider — login/login2fa/logout/refreshUser', () => {
  beforeEach(() => {
    tokenStorage.getAccess.mockReturnValue(null); // чистый старт, без auto-restore при маунте
  });

  it('login(): при успехе сохраняет токены и подгружает профиль + активную сессию', async () => {
    const user = userEvent.setup();
    authApi.login.mockResolvedValue({ ok: true, status: 200, data: { access: 'a', refresh: 'r' } });
    authApi.profile.mockResolvedValue({ ok: true, data: { id: 1, email: 'user@example.com' } });
    sessionsApi.getCurrent.mockResolvedValue({ success: true, data: { id: 9 } });

    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await user.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('user@example.com'));
    expect(tokenStorage.set).toHaveBeenCalledWith('a', 'r');
    expect(screen.getByTestId('session')).toHaveTextContent('9');
    expect(screen.getByTestId('login-result')).toHaveTextContent('"ok":true');
  });

  it('login(): при неверных данных не сохраняет токены и не логинит', async () => {
    const user = userEvent.setup();
    authApi.login.mockResolvedValue({ ok: false, status: 400, data: { detail: 'Неверный пароль' } });

    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await user.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('login-result')).not.toHaveTextContent(''));
    expect(tokenStorage.set).not.toHaveBeenCalled();
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('login(): ответ без access (нужен 2FA) не логинит пользователя', async () => {
    const user = userEvent.setup();
    authApi.login.mockResolvedValue({ ok: true, status: 200, data: { need_2fa: true, method: 'email' } });

    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await user.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('login-result')).not.toHaveTextContent(''));
    expect(tokenStorage.set).not.toHaveBeenCalled();
    expect(authApi.profile).not.toHaveBeenCalled();
  });

  it('login2fa(): при успехе сохраняет токены и подгружает профиль', async () => {
    const user = userEvent.setup();
    authApi.login2fa.mockResolvedValue({ ok: true, status: 200, data: { access: 'a2', refresh: 'r2' } });
    authApi.profile.mockResolvedValue({ ok: true, data: { id: 2, email: 'twofa@example.com' } });
    sessionsApi.getCurrent.mockResolvedValue({ success: false });

    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await user.click(screen.getByText('login2fa'));

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('twofa@example.com'));
    expect(tokenStorage.set).toHaveBeenCalledWith('a2', 'r2');
  });

  it('refreshUser(): перезагружает и заменяет текущий профиль', async () => {
    const user = userEvent.setup();
    authApi.profile.mockResolvedValue({ ok: true, data: { id: 1, email: 'updated@example.com' } });

    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await user.click(screen.getByText('refresh'));

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('updated@example.com'));
  });

  it('refreshUser(): не трогает пользователя, если /profile/ отвечает не ok', async () => {
    const user = userEvent.setup();
    authApi.login.mockResolvedValue({ ok: true, status: 200, data: { access: 'a', refresh: 'r' } });
    authApi.profile.mockResolvedValueOnce({ ok: true, data: { id: 1, email: 'user@example.com' } });
    sessionsApi.getCurrent.mockResolvedValue({ success: false });

    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    await user.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('user@example.com'));

    authApi.profile.mockResolvedValueOnce({ ok: false, data: {} });
    await user.click(screen.getByText('refresh'));

    await waitFor(() => expect(authApi.profile).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('user')).toHaveTextContent('user@example.com');
  });

  it('logout(): шлёт сохранённый refresh-токен, чистит токены и сбрасывает user/session', async () => {
    const user = userEvent.setup();
    authApi.login.mockResolvedValue({ ok: true, status: 200, data: { access: 'a', refresh: 'r' } });
    authApi.profile.mockResolvedValue({ ok: true, data: { id: 1, email: 'user@example.com' } });
    sessionsApi.getCurrent.mockResolvedValue({ success: true, data: { id: 9 } });
    tokenStorage.getRefresh.mockReturnValue('r');
    authApi.logout.mockResolvedValue(undefined);

    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    await user.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('user@example.com'));

    await user.click(screen.getByText('logout'));

    expect(authApi.logout).toHaveBeenCalledWith('r');
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'));
    expect(screen.getByTestId('session')).toHaveTextContent('none');
    expect(tokenStorage.clear).toHaveBeenCalled();
  });
});
