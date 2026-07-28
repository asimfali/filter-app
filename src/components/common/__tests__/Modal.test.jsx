import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from '../Modal';

describe('Modal', () => {
  it('renders the title and children', () => {
    render(<Modal title="Заголовок" onClose={vi.fn()}><p>содержимое</p></Modal>);

    expect(screen.getByText('Заголовок')).toBeInTheDocument();
    expect(screen.getByText('содержимое')).toBeInTheDocument();
  });

  it('calls onClose when the ✕ button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Modal title="Заголовок" onClose={onClose}>content</Modal>);

    await user.click(screen.getByText('✕'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses the narrow width by default and the wide width when wide is passed', () => {
    const { rerender } = render(<Modal title="T" onClose={vi.fn()}>c</Modal>);
    const panel = () => screen.getByText('T').parentElement.parentElement;

    expect(panel().className).toContain('max-w-md');
    expect(panel().className).not.toContain('max-w-2xl');

    rerender(<Modal title="T" onClose={vi.fn()} wide>c</Modal>);
    expect(panel().className).toContain('max-w-2xl');
  });
});
