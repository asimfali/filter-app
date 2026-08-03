import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActivateForm from '../ActivateForm';
import { authApi } from '../../../api/auth';

vi.mock('../../../api/auth', () => ({ authApi: { activate: vi.fn() } }));

describe('ActivateForm', () => {
  it('предзаполняет email из пропа', () => {
    const { container } = render(<ActivateForm email="user@example.com" onSuccess={vi.fn()} />);
    expect(container.querySelector('input[type="email"]').value).toBe('user@example.com');
  });

  it('без initialEmail email пустой', () => {
    const { container } = render(<ActivateForm onSuccess={vi.fn()} />);
    expect(container.querySelector('input[type="email"]').value).toBe('');
  });

  it('код очищается от не-цифр и обрезается до 6 символов', async () => {
    const user = userEvent.setup();
    render(<ActivateForm email="user@example.com" onSuccess={vi.fn()} />);

    const codeInput = screen.getByPlaceholderText('000000');
    await user.type(codeInput, 'ab12-34 5678');

    expect(codeInput.value).toBe('123456');
  });

  it('кнопка активации задизейблена, пока код короче 6 цифр', async () => {
    const user = userEvent.setup();
    render(<ActivateForm email="user@example.com" onSuccess={vi.fn()} />);

    const btn = screen.getByRole('button', { name: 'Активировать' });
    expect(btn).toBeDisabled();

    await user.type(screen.getByPlaceholderText('000000'), '12345');
    expect(btn).toBeDisabled();

    await user.type(screen.getByPlaceholderText('000000'), '6');
    expect(btn).toBeEnabled();
  });

  it('успешная активация вызывает authApi.activate(email, code) и onSuccess', async () => {
    const user = userEvent.setup();
    authApi.activate.mockResolvedValue({ ok: true, data: {} });
    const onSuccess = vi.fn();
    render(<ActivateForm email="user@example.com" onSuccess={onSuccess} />);

    await user.type(screen.getByPlaceholderText('000000'), '123456');
    await user.click(screen.getByRole('button', { name: 'Активировать' }));

    expect(authApi.activate).toHaveBeenCalledWith('user@example.com', '123456');
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('показывает data.error при неудаче, иначе дефолтное сообщение', async () => {
    const user = userEvent.setup();
    authApi.activate.mockResolvedValue({ ok: false, data: { error: 'Код истёк' } });
    render(<ActivateForm email="user@example.com" onSuccess={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('000000'), '123456');
    await user.click(screen.getByRole('button', { name: 'Активировать' }));

    expect(screen.getByText('Код истёк')).toBeInTheDocument();
  });

  it('дефолтное сообщение об ошибке без data.error', async () => {
    const user = userEvent.setup();
    authApi.activate.mockResolvedValue({ ok: false, data: {} });
    render(<ActivateForm email="user@example.com" onSuccess={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('000000'), '123456');
    await user.click(screen.getByRole('button', { name: 'Активировать' }));

    expect(screen.getByText('Неверный код или email')).toBeInTheDocument();
  });

  it('показывает "Проверка..." и блокирует кнопку на время запроса', async () => {
    const user = userEvent.setup();
    let resolveActivate;
    authApi.activate.mockReturnValue(new Promise((r) => { resolveActivate = r; }));
    render(<ActivateForm email="user@example.com" onSuccess={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('000000'), '123456');
    await user.click(screen.getByRole('button', { name: 'Активировать' }));

    expect(screen.getByRole('button', { name: 'Проверка...' })).toBeDisabled();

    await act(async () => { resolveActivate({ ok: true, data: {} }); });
  });
});
