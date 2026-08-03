import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateDetailsModal from '../CreateDetailsModal';

// Компонент нигде не рендерится в приложении (кнопки "Создать детали"/"Обновить
// детали" в SpecEditor.jsx вызывают bomApi.createDetails/updateDetails напрямую,
// минуя эту модалку) — тестируем как самостоятельный, потенциально ещё не
// подключённый компонент.
vi.mock('../FolderPicker', () => ({
  default: ({ value, onChange }) => (
    <div data-testid="folder-picker-stub" data-value={value?.path ?? ''}>
      <button onClick={() => onChange({ id: 42, path: 'папка/деталей' })}>pick-folder</button>
    </div>
  ),
}));

describe('CreateDetailsModal', () => {
  it('"Создать детали" задизейблена, пока папка не выбрана', () => {
    render(<CreateDetailsModal onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('Создать детали')).toBeDisabled();
  });

  it('выбор папки показывает её путь в лейбле и включает кнопку', async () => {
    const user = userEvent.setup();
    render(<CreateDetailsModal onClose={vi.fn()} onConfirm={vi.fn()} />);

    await user.click(screen.getByText('pick-folder'));

    expect(screen.getByText('папка/деталей')).toBeInTheDocument();
    expect(screen.getByText('Создать детали')).toBeEnabled();
  });

  it('подтверждение вызывает onConfirm(selectedFolder.id)', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<CreateDetailsModal onClose={vi.fn()} onConfirm={onConfirm} />);

    await user.click(screen.getByText('pick-folder'));
    await user.click(screen.getByText('Создать детали'));

    expect(onConfirm).toHaveBeenCalledWith(42);
  });

  it('"Отмена" вызывает onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CreateDetailsModal onClose={onClose} onConfirm={vi.fn()} />);
    await user.click(screen.getByText('Отмена'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
