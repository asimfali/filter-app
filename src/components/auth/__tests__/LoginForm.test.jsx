import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from '../LoginForm';
import { useAuth } from '../../../contexts/AuthContext';

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));

const fillAndSubmit = async (user, { email = 'user@example.com', password = 'secret123' } = {}) => {
  await user.type(screen.getByPlaceholderText('you@teplomash.ru'), email);
  await user.type(screen.getByPlaceholderText('••••••••'), password);
  await user.click(screen.getByRole('button', { name: /Войти/ }));
};

describe('LoginForm', () => {
  it('успешный вход вызывает login(email, password) и onSuccess, без ошибки', async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue({ ok: true, data: { access: 'a', refresh: 'r' } });
    useAuth.mockReturnValue({ login });
    const onSuccess = vi.fn();
    render(<LoginForm onSuccess={onSuccess} onNeed2fa={vi.fn()} onNeedActivation={vi.fn()} />);

    await fillAndSubmit(user);

    expect(login).toHaveBeenCalledWith('user@example.com', 'secret123');
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Ошибка/)).not.toBeInTheDocument();
  });

  it('requires_2fa вызывает onNeed2fa(email, method, message), не onSuccess', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({
      login: vi.fn().mockResolvedValue({
        ok: false,
        data: { requires_2fa: true, method: 'email', message: 'Код отправлен на почту' },
      }),
    });
    const onSuccess = vi.fn();
    const onNeed2fa = vi.fn();
    render(<LoginForm onSuccess={onSuccess} onNeed2fa={onNeed2fa} onNeedActivation={vi.fn()} />);

    await fillAndSubmit(user);

    expect(onNeed2fa).toHaveBeenCalledWith('user@example.com', 'email', 'Код отправлен на почту');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('EMAIL_NOT_CONFIRMED вызывает onNeedActivation(email)', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({
      login: vi.fn().mockResolvedValue({ ok: false, data: { code: 'EMAIL_NOT_CONFIRMED' } }),
    });
    const onNeedActivation = vi.fn();
    render(<LoginForm onSuccess={vi.fn()} onNeed2fa={vi.fn()} onNeedActivation={onNeedActivation} />);

    await fillAndSubmit(user);

    expect(onNeedActivation).toHaveBeenCalledWith('user@example.com');
  });

  it('показывает data.error, если он есть', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ login: vi.fn().mockResolvedValue({ ok: false, data: { error: 'Неверный пароль' } }) });
    render(<LoginForm onSuccess={vi.fn()} onNeed2fa={vi.fn()} onNeedActivation={vi.fn()} />);

    await fillAndSubmit(user);

    expect(screen.getByText('Неверный пароль')).toBeInTheDocument();
  });

  it('падает на data.detail, если нет data.error', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({
      login: vi.fn().mockResolvedValue({ ok: false, data: { detail: 'Учётная запись заблокирована' } }),
    });
    render(<LoginForm onSuccess={vi.fn()} onNeed2fa={vi.fn()} onNeedActivation={vi.fn()} />);

    await fillAndSubmit(user);

    expect(screen.getByText('Учётная запись заблокирована')).toBeInTheDocument();
  });

  it('падает на дефолтное сообщение без error и detail', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ login: vi.fn().mockResolvedValue({ ok: false, data: {} }) });
    render(<LoginForm onSuccess={vi.fn()} onNeed2fa={vi.fn()} onNeedActivation={vi.fn()} />);

    await fillAndSubmit(user);

    expect(screen.getByText('Ошибка входа')).toBeInTheDocument();
  });

  it('блокирует кнопку и показывает "Вход..." на время запроса', async () => {
    const user = userEvent.setup();
    let resolveLogin;
    useAuth.mockReturnValue({ login: vi.fn(() => new Promise((r) => { resolveLogin = r; })) });
    render(<LoginForm onSuccess={vi.fn()} onNeed2fa={vi.fn()} onNeedActivation={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('you@teplomash.ru'), 'user@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'secret123');
    await user.click(screen.getByRole('button', { name: /Войти/ }));

    expect(screen.getByRole('button', { name: 'Вход...' })).toBeDisabled();

    await act(async () => { resolveLogin({ ok: true, data: { access: 'a' } }); });
  });

  it('переключает видимость пароля по клику на EyeIcon', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ login: vi.fn() });
    render(<LoginForm onSuccess={vi.fn()} onNeed2fa={vi.fn()} onNeedActivation={vi.fn()} />);

    const passwordInput = screen.getByPlaceholderText('••••••••');
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleBtn = passwordInput.parentElement.querySelector('button');
    await user.click(toggleBtn);

    expect(passwordInput).toHaveAttribute('type', 'text');
  });
});
