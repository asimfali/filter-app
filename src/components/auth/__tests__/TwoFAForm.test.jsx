import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TwoFAForm from '../TwoFAForm';
import { useAuth } from '../../../contexts/AuthContext';

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));

describe('TwoFAForm', () => {
  it('показывает переданное message', () => {
    useAuth.mockReturnValue({ login2fa: vi.fn() });
    render(
      <TwoFAForm email="user@example.com" method="email" message="Код отправлен на почту"
        onSuccess={vi.fn()} onBack={vi.fn()} />
    );

    expect(screen.getByText('Код отправлен на почту')).toBeInTheDocument();
  });

  it('успешное подтверждение вызывает login2fa(email, code) и onSuccess', async () => {
    const user = userEvent.setup();
    const login2fa = vi.fn().mockResolvedValue({ ok: true, data: { access: 'a' } });
    useAuth.mockReturnValue({ login2fa });
    const onSuccess = vi.fn();
    render(
      <TwoFAForm email="user@example.com" method="email" message="msg" onSuccess={onSuccess} onBack={vi.fn()} />
    );

    await user.type(screen.getByPlaceholderText('000000'), '654321');
    await user.click(screen.getByRole('button', { name: 'Подтвердить' }));

    expect(login2fa).toHaveBeenCalledWith('user@example.com', '654321');
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('показывает data.error при неверном коде, иначе дефолтное сообщение', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ login2fa: vi.fn().mockResolvedValue({ ok: false, data: { error: 'Код истёк' } }) });
    render(<TwoFAForm email="user@example.com" method="email" message="msg" onSuccess={vi.fn()} onBack={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('000000'), '000000');
    await user.click(screen.getByRole('button', { name: 'Подтвердить' }));

    expect(screen.getByText('Код истёк')).toBeInTheDocument();
  });

  it('дефолтное сообщение об ошибке без data.error', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ login2fa: vi.fn().mockResolvedValue({ ok: false, data: {} }) });
    render(<TwoFAForm email="user@example.com" method="email" message="msg" onSuccess={vi.fn()} onBack={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('000000'), '000000');
    await user.click(screen.getByRole('button', { name: 'Подтвердить' }));

    expect(screen.getByText('Неверный код')).toBeInTheDocument();
  });

  it('ok:true, но без access не считается успехом (показывает ошибку)', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ login2fa: vi.fn().mockResolvedValue({ ok: true, data: {} }) });
    const onSuccess = vi.fn();
    render(<TwoFAForm email="user@example.com" method="email" message="msg" onSuccess={onSuccess} onBack={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('000000'), '000000');
    await user.click(screen.getByRole('button', { name: 'Подтвердить' }));

    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByText('Неверный код')).toBeInTheDocument();
  });

  it('"← Назад" вызывает onBack и не отправляет форму', async () => {
    const user = userEvent.setup();
    const login2fa = vi.fn();
    const onBack = vi.fn();
    useAuth.mockReturnValue({ login2fa });
    render(<TwoFAForm email="user@example.com" method="email" message="msg" onSuccess={vi.fn()} onBack={onBack} />);

    await user.click(screen.getByText('← Назад'));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(login2fa).not.toHaveBeenCalled();
  });

  it('показывает "Проверка..." и блокирует кнопку на время запроса', async () => {
    const user = userEvent.setup();
    let resolveLogin;
    useAuth.mockReturnValue({ login2fa: vi.fn(() => new Promise((r) => { resolveLogin = r; })) });
    render(<TwoFAForm email="user@example.com" method="email" message="msg" onSuccess={vi.fn()} onBack={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('000000'), '000000');
    await user.click(screen.getByRole('button', { name: 'Подтвердить' }));

    expect(screen.getByRole('button', { name: 'Проверка...' })).toBeDisabled();

    await act(async () => { resolveLogin({ ok: true, data: { access: 'a' } }); });
  });
});
