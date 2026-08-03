import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColumnSettingsModal from '../ColumnSettingsModal';

const columns = [
  { type: 'axis', id: 1, label: 'Дизайн', visible: true },
  { type: 'spec', id: 2, label: 'Мощность', visible: false },
  { type: 'docs', id: 3, label: 'Паспорт', visible: true },
];

describe('ColumnSettingsModal', () => {
  it('рендерит колонки с типом (label) и стилем видимой/скрытой', () => {
    render(<ColumnSettingsModal columns={columns} onToggle={vi.fn()} onReorder={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Дизайн')).toBeInTheDocument();
    expect(screen.getByText('Параметр')).toBeInTheDocument();
    expect(screen.getByText('Мощность')).toBeInTheDocument();
    expect(screen.getByText('Характеристика')).toBeInTheDocument();
    expect(screen.getByText('Паспорт')).toBeInTheDocument();
    expect(screen.getByText('Документы')).toBeInTheDocument();

    // скрытая колонка ("Мощность") получает приглушённый цвет текста
    expect(screen.getByText('Мощность')).toHaveClass('text-gray-400');
    expect(screen.getByText('Дизайн')).toHaveClass('text-gray-900');
  });

  it('клик по переключателю вызывает onToggle(type, id)', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<ColumnSettingsModal columns={columns} onToggle={onToggle} onReorder={vi.fn()} onClose={vi.fn()} />);

    const toggles = screen.getAllByRole('button').filter(b => b.className.includes('rounded-full') && b.className.includes('w-8'));
    await user.click(toggles[0]);
    expect(onToggle).toHaveBeenCalledWith('axis', 1);
  });

  it('drag-reorder: dragStart+dragOver над другим элементом вызывает onReorder(from, to)', () => {
    const onReorder = vi.fn();
    const { container } = render(
      <ColumnSettingsModal columns={columns} onToggle={vi.fn()} onReorder={onReorder} onClose={vi.fn()} />
    );
    const rows = container.querySelectorAll('[draggable="true"]');
    expect(rows).toHaveLength(3);

    fireEvent.dragStart(rows[0]);
    fireEvent.dragOver(rows[2]);
    expect(onReorder).toHaveBeenCalledWith(0, 2);
  });

  it('dragOver на том же элементе, где начали drag, не вызывает onReorder', () => {
    const onReorder = vi.fn();
    const { container } = render(
      <ColumnSettingsModal columns={columns} onToggle={vi.fn()} onReorder={onReorder} onClose={vi.fn()} />
    );
    const rows = container.querySelectorAll('[draggable="true"]');
    fireEvent.dragStart(rows[0]);
    fireEvent.dragOver(rows[0]);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('onClose вызывается по клику на фон, крестик и "Готово"; клик по карточке не закрывает', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <ColumnSettingsModal columns={columns} onToggle={vi.fn()} onReorder={vi.fn()} onClose={onClose} />
    );

    await user.click(screen.getByText('Дизайн'));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('Готово'));
    expect(onClose).toHaveBeenCalledTimes(2);

    // клик на фон (внешний div) закрывает
    fireEvent.click(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
