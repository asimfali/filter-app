import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from '../ThemeContext';

function Harness() {
  const { dark, toggle } = useTheme();
  return (
    <div>
      <div data-testid="dark">{String(dark)}</div>
      <button onClick={toggle}>toggle</button>
    </div>
  );
}

const renderTheme = () => render(<ThemeProvider><Harness /></ThemeProvider>);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
});

describe('ThemeProvider', () => {
  it('по умолчанию тёмная тема, если в localStorage ничего нет', () => {
    renderTheme();

    expect(screen.getByTestId('dark')).toHaveTextContent('true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('восстанавливает сохранённую светлую тему', () => {
    localStorage.setItem('theme', 'light');
    renderTheme();

    expect(screen.getByTestId('dark')).toHaveTextContent('false');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('восстанавливает сохранённую тёмную тему', () => {
    localStorage.setItem('theme', 'dark');
    renderTheme();

    expect(screen.getByTestId('dark')).toHaveTextContent('true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggle() переключает тему, class на <html> и localStorage в обе стороны', async () => {
    const user = userEvent.setup();
    renderTheme();

    await user.click(screen.getByText('toggle'));
    expect(screen.getByTestId('dark')).toHaveTextContent('false');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('theme')).toBe('light');

    await user.click(screen.getByText('toggle'));
    expect(screen.getByTestId('dark')).toHaveTextContent('true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});
