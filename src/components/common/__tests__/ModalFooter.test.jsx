import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModalFooter from '../ModalFooter';

describe('ModalFooter', () => {
  it('renders the default close label and calls onClose when clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ModalFooter onClose={onClose} />);

    const closeBtn = screen.getByText('Отмена');
    await user.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('supports a custom close label', () => {
    render(<ModalFooter onClose={vi.fn()} closeLabel="Назад" />);
    expect(screen.getByText('Назад')).toBeInTheDocument();
  });

  it('does not render a confirm button when onConfirm is not passed', () => {
    render(<ModalFooter onClose={vi.fn()} confirmLabel="Сохранить" />);
    expect(screen.queryByText('Сохранить')).not.toBeInTheDocument();
  });

  it('renders the confirm button with confirmLabel and calls onConfirm when clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ModalFooter onClose={vi.fn()} onConfirm={onConfirm} confirmLabel="Сохранить" />);

    await user.click(screen.getByText('Сохранить'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('shows "Обработка..." and disables the confirm button while loading', () => {
    render(<ModalFooter onClose={vi.fn()} onConfirm={vi.fn()} confirmLabel="Сохранить" loading />);

    const btn = screen.getByText('Обработка...');
    expect(btn).toBeDisabled();
    expect(screen.queryByText('Сохранить')).not.toBeInTheDocument();
  });

  it('disables the confirm button when disabled is passed (without loading)', () => {
    render(<ModalFooter onClose={vi.fn()} onConfirm={vi.fn()} confirmLabel="Сохранить" disabled />);

    expect(screen.getByText('Сохранить')).toBeDisabled();
  });
});
