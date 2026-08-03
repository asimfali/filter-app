import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EyeIcon from '../EyeIcon';

describe('EyeIcon', () => {
  it('вызывает onToggle по клику', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<EyeIcon show={false} onToggle={onToggle} />);

    await user.click(screen.getByRole('button'));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('рендерит разную SVG-иконку в зависимости от show', () => {
    const { container, rerender } = render(<EyeIcon show={false} onToggle={vi.fn()} />);
    expect(container.querySelectorAll('path').length).toBe(2); // обычный глаз: зрачок + контур

    rerender(<EyeIcon show onToggle={vi.fn()} />);
    expect(container.querySelectorAll('path').length).toBe(1); // перечёркнутый глаз
  });

  it('кнопка не участвует в табуляции (tabIndex=-1)', () => {
    render(<EyeIcon show={false} onToggle={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveAttribute('tabIndex', '-1');
  });
});
