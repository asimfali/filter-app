import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AlertModal from '../AlertModal';

describe('AlertModal', () => {
  it('renders the message', () => {
    render(<AlertModal message="Готово" onClose={vi.fn()} />);
    expect(screen.getByText('Готово')).toBeInTheDocument();
  });

  it('calls onClose when OK is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AlertModal message="Готово" onClose={onClose} />);

    await user.click(screen.getByText('OK'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
