import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PasswordResetForm from '../PasswordResetForm';
import { authApi } from '../../../api/auth';

vi.mock('../../../api/auth', () => ({
  authApi: { passwordResetRequest: vi.fn(), passwordResetConfirm: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const goToConfirmStep = async (user, email = 'user@example.com') => {
  authApi.passwordResetRequest.mockResolvedValue({ ok: true, data: {} });
  await user.type(screen.getByPlaceholderText('you@teplomash.ru'), email);
  await user.click(screen.getByRole('button', { name: 'Отправить код' }));
  await screen.findByText('Код из письма');
};

describe('PasswordResetForm — шаг request', () => {
  it('отправляет authApi.passwordResetRequest(email) и всегда переходит на confirm', async () => {
    const user = userEvent.setup();
    authApi.passwordResetRequest.mockResolvedValue({ ok: false, data: {} }); // бэк не палит существование email
    render(<PasswordResetForm onBack={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('you@teplomash.ru'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: 'Отправить код' }));

    expect(authApi.passwordResetRequest).toHaveBeenCalledWith('user@example.com');
    expect(await screen.findByText('Код из письма')).toBeInTheDocument();
  });

  it('"← Назад" вызывает onBack без отправки запроса', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<PasswordResetForm onBack={onBack} />);

    await user.click(screen.getByText('← Назад'));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(authApi.passwordResetRequest).not.toHaveBeenCalled();
  });

  it('показывает "Отправка..." и блокирует кнопку на время запроса', async () => {
    const user = userEvent.setup();
    let resolveRequest;
    authApi.passwordResetRequest.mockReturnValue(new Promise((r) => { resolveRequest = r; }));
    render(<PasswordResetForm onBack={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('you@teplomash.ru'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: 'Отправить код' }));

    expect(screen.getByRole('button', { name: 'Отправка...' })).toBeDisabled();

    await act(async () => { resolveRequest({ ok: true, data: {} }); });
  });
});

describe('PasswordResetForm — шаг confirm', () => {
  it('показывает email, на который отправлен код', async () => {
    const user = userEvent.setup();
    render(<PasswordResetForm onBack={vi.fn()} />);
    await goToConfirmStep(user, 'user@example.com');

    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  it('показывает "Пароли не совпадают" и блокирует кнопку при несовпадении', async () => {
    const user = userEvent.setup();
    render(<PasswordResetForm onBack={vi.fn()} />);
    await goToConfirmStep(user);

    await user.type(screen.getByPlaceholderText('123456'), '111111');
    await user.type(screen.getByPlaceholderText('Минимум 8 символов'), 'password1');
    await user.type(screen.getByPlaceholderText('Повторите пароль'), 'other123');

    expect(screen.getByText('Пароли не совпадают')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить пароль' })).toBeDisabled();
  });

  it('переключает видимость обоих полей пароля независимо', async () => {
    const user = userEvent.setup();
    render(<PasswordResetForm onBack={vi.fn()} />);
    await goToConfirmStep(user);

    const pass1 = screen.getByPlaceholderText('Минимум 8 символов');
    const pass2 = screen.getByPlaceholderText('Повторите пароль');
    await user.click(pass1.parentElement.querySelector('button'));
    expect(pass1).toHaveAttribute('type', 'text');
    expect(pass2).toHaveAttribute('type', 'password');
  });

  it('внутренний guard password!==password2 недостижим кнопкой, но проверяется прямым submit', async () => {
    const user = userEvent.setup();
    const { container } = render(<PasswordResetForm onBack={vi.fn()} />);
    await goToConfirmStep(user);

    await user.type(screen.getByPlaceholderText('123456'), '111111');
    await user.type(screen.getByPlaceholderText('Минимум 8 символов'), 'password1');
    await user.type(screen.getByPlaceholderText('Повторите пароль'), 'password2');

    fireEvent.submit(container.querySelector('form'));

    expect(authApi.passwordResetConfirm).not.toHaveBeenCalled();
  });

  it('успешное подтверждение вызывает passwordResetConfirm(...) и переходит на done', async () => {
    const user = userEvent.setup();
    authApi.passwordResetConfirm.mockResolvedValue({ ok: true, data: { success: true } });
    render(<PasswordResetForm onBack={vi.fn()} />);
    await goToConfirmStep(user, 'user@example.com');

    await user.type(screen.getByPlaceholderText('123456'), '111111');
    await user.type(screen.getByPlaceholderText('Минимум 8 символов'), 'password1');
    await user.type(screen.getByPlaceholderText('Повторите пароль'), 'password1');
    await user.click(screen.getByRole('button', { name: 'Сохранить пароль' }));

    expect(authApi.passwordResetConfirm).toHaveBeenCalledWith('user@example.com', '111111', 'password1', 'password1');
    expect(await screen.findByText('Пароль успешно изменён')).toBeInTheDocument();
  });

  it('ok:true, но success:false не переходит на done — показывает ошибку', async () => {
    const user = userEvent.setup();
    authApi.passwordResetConfirm.mockResolvedValue({ ok: true, data: { success: false, error: { message: 'Код истёк' } } });
    render(<PasswordResetForm onBack={vi.fn()} />);
    await goToConfirmStep(user);

    await user.type(screen.getByPlaceholderText('123456'), '111111');
    await user.type(screen.getByPlaceholderText('Минимум 8 символов'), 'password1');
    await user.type(screen.getByPlaceholderText('Повторите пароль'), 'password1');
    await user.click(screen.getByRole('button', { name: 'Сохранить пароль' }));

    expect(screen.getByText('Код истёк')).toBeInTheDocument();
    expect(screen.queryByText('Пароль успешно изменён')).not.toBeInTheDocument();
  });

  it('показывает дефолтное сообщение "Ошибка" без error.message', async () => {
    const user = userEvent.setup();
    authApi.passwordResetConfirm.mockResolvedValue({ ok: false, data: {} });
    render(<PasswordResetForm onBack={vi.fn()} />);
    await goToConfirmStep(user);

    await user.type(screen.getByPlaceholderText('123456'), '111111');
    await user.type(screen.getByPlaceholderText('Минимум 8 символов'), 'password1');
    await user.type(screen.getByPlaceholderText('Повторите пароль'), 'password1');
    await user.click(screen.getByRole('button', { name: 'Сохранить пароль' }));

    expect(screen.getByText('Ошибка')).toBeInTheDocument();
  });

  it('показывает "Сохранение..." и блокирует кнопку на время запроса', async () => {
    const user = userEvent.setup();
    let resolveConfirm;
    authApi.passwordResetConfirm.mockReturnValue(new Promise((r) => { resolveConfirm = r; }));
    render(<PasswordResetForm onBack={vi.fn()} />);
    await goToConfirmStep(user);

    await user.type(screen.getByPlaceholderText('123456'), '111111');
    await user.type(screen.getByPlaceholderText('Минимум 8 символов'), 'password1');
    await user.type(screen.getByPlaceholderText('Повторите пароль'), 'password1');
    await user.click(screen.getByRole('button', { name: 'Сохранить пароль' }));

    expect(screen.getByRole('button', { name: 'Сохранение...' })).toBeDisabled();

    await act(async () => { resolveConfirm({ ok: true, data: { success: true } }); });
  });
});

describe('PasswordResetForm — шаг done', () => {
  it('кнопка "Войти" вызывает onBack', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    authApi.passwordResetConfirm.mockResolvedValue({ ok: true, data: { success: true } });
    render(<PasswordResetForm onBack={onBack} />);
    await goToConfirmStep(user);

    await user.type(screen.getByPlaceholderText('123456'), '111111');
    await user.type(screen.getByPlaceholderText('Минимум 8 символов'), 'password1');
    await user.type(screen.getByPlaceholderText('Повторите пароль'), 'password1');
    await user.click(screen.getByRole('button', { name: 'Сохранить пароль' }));
    await screen.findByText('Пароль успешно изменён');

    await user.click(screen.getByText('Войти'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
