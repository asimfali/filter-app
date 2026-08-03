import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useModals } from '../useModals';

function Harness({ danger, onConfirmSpy = () => {} }) {
  const { showConfirm, showAlert, modals } = useModals();
  return (
    <div>
      <button onClick={() => showConfirm('Удалить запись?', onConfirmSpy, danger)}>open-confirm</button>
      <button onClick={() => showAlert('Готово')}>open-alert</button>
      {modals}
    </div>
  );
}

describe('useModals', () => {
  it('ничего не рендерит, пока showConfirm/showAlert не вызваны', () => {
    render(<Harness />);
    expect(screen.queryByText('Удалить запись?')).not.toBeInTheDocument();
    expect(screen.queryByText('Готово')).not.toBeInTheDocument();
  });

  it('showConfirm рендерит ConfirmModal; Подтвердить вызывает колбэк и скрывает модалку', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirmSpy={onConfirm} />);

    await user.click(screen.getByText('open-confirm'));
    expect(screen.getByText('Удалить запись?')).toBeInTheDocument();

    await user.click(screen.getByText('Подтвердить'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Удалить запись?')).not.toBeInTheDocument();
  });

  it('Отмена скрывает ConfirmModal без вызова колбэка', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirmSpy={onConfirm} />);

    await user.click(screen.getByText('open-confirm'));
    await user.click(screen.getByText('Отмена'));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByText('Удалить запись?')).not.toBeInTheDocument();
  });

  it('danger по умолчанию true — кнопка подтверждения красная', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText('open-confirm'));
    expect(screen.getByText('Подтвердить').className).toContain('bg-red-600');
  });

  it('danger=false — кнопка подтверждения синяя', async () => {
    const user = userEvent.setup();
    render(<Harness danger={false} />);

    await user.click(screen.getByText('open-confirm'));
    expect(screen.getByText('Подтвердить').className).toContain('bg-blue-600');
  });

  it('showAlert рендерит AlertModal; OK скрывает его', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText('open-alert'));
    expect(screen.getByText('Готово')).toBeInTheDocument();

    await user.click(screen.getByText('OK'));
    expect(screen.queryByText('Готово')).not.toBeInTheDocument();
  });

  it('confirm и alert могут быть открыты одновременно', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText('open-confirm'));
    await user.click(screen.getByText('open-alert'));

    expect(screen.getByText('Удалить запись?')).toBeInTheDocument();
    expect(screen.getByText('Готово')).toBeInTheDocument();
  });
});
