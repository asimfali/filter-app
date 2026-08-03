import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileDropZone from '../FileDropZone';

describe('FileDropZone', () => {
  it('shows the placeholder and no hint when there is no file and no hint prop', () => {
    render(<FileDropZone file={null} onFile={vi.fn()} />);

    expect(screen.getByText('Выберите файл или перетащите сюда')).toBeInTheDocument();
  });

  it('shows a custom placeholder and hint when provided', () => {
    render(<FileDropZone file={null} onFile={vi.fn()} placeholder="Загрузите прайс" hint="только .xlsx" />);

    expect(screen.getByText('Загрузите прайс')).toBeInTheDocument();
    expect(screen.getByText('только .xlsx')).toBeInTheDocument();
  });

  it('shows the file name and size in KB when a file is selected', () => {
    const file = new File(['x'.repeat(2048)], 'price.xlsx');
    render(<FileDropZone file={file} onFile={vi.fn()} />);

    expect(screen.getByText('price.xlsx')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
  });

  it('shows the error message only when error is passed', () => {
    const { rerender } = render(<FileDropZone file={null} onFile={vi.fn()} />);
    expect(screen.queryByText('Неверный формат')).not.toBeInTheDocument();

    rerender(<FileDropZone file={null} onFile={vi.fn()} error="Неверный формат" />);
    expect(screen.getByText('Неверный формат')).toBeInTheDocument();
  });

  it('calls onFile with the picked file via the hidden file input', async () => {
    const user = userEvent.setup();
    const onFile = vi.fn();
    const { container } = render(<FileDropZone file={null} onFile={onFile} />);
    const file = new File(['x'], 'price.xlsx');

    await user.upload(container.querySelector('input[type="file"]'), file);

    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('calls onFile(null) when the file input is cleared', () => {
    const onFile = vi.fn();
    const { container } = render(<FileDropZone file={null} onFile={onFile} />);
    const input = container.querySelector('input[type="file"]');

    fireEvent.change(input, { target: { files: [] } });

    expect(onFile).toHaveBeenCalledWith(null);
  });

  it('calls onFile with the dropped file on drop', () => {
    const onFile = vi.fn();
    render(<FileDropZone file={null} onFile={onFile} />);
    const label = screen.getByText('Выберите файл или перетащите сюда').closest('label');
    const file = new File(['x'], 'dropped.xlsx');

    fireEvent.dragOver(label, { dataTransfer: { files: [file] } });
    expect(onFile).not.toHaveBeenCalled();

    fireEvent.drop(label, { dataTransfer: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('does not call onFile when dropping with no files', () => {
    const onFile = vi.fn();
    render(<FileDropZone file={null} onFile={onFile} />);
    const label = screen.getByText('Выберите файл или перетащите сюда').closest('label');

    fireEvent.drop(label, { dataTransfer: { files: [] } });

    expect(onFile).not.toHaveBeenCalled();
  });
});
