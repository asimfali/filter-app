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
    const panel = () => screen.getByText('T').parentElement.parentElement.parentElement;

    expect(panel().className).toContain('max-w-md');
    expect(panel().className).not.toContain('max-w-2xl');

    rerender(<Modal title="T" onClose={vi.fn()} wide>c</Modal>);
    expect(panel().className).toContain('max-w-2xl');
  });

  it('maxWidth принимает конкретный размер и имеет приоритет над wide', () => {
    const panel = () => screen.getByText('T').parentElement.parentElement.parentElement;
    render(<Modal title="T" onClose={vi.fn()} wide maxWidth="5xl">c</Modal>);
    expect(panel().className).toContain('max-w-5xl');
    expect(panel().className).not.toContain('max-w-2xl');
  });

  it('неизвестный maxWidth молча падает обратно на max-w-md', () => {
    const panel = () => screen.getByText('T').parentElement.parentElement.parentElement;
    render(<Modal title="T" onClose={vi.fn()} maxWidth="not-a-real-size">c</Modal>);
    expect(panel().className).toContain('max-w-md');
  });

  it('scrollBody делает карточку max-h-[90vh]/flex-col и оборачивает контент в flex-1 overflow-y-auto', () => {
    render(<Modal title="T" onClose={vi.fn()} scrollBody><p>содержимое</p></Modal>);
    const panel = screen.getByText('T').parentElement.parentElement.parentElement;
    expect(panel.className).toContain('max-h-[90vh]');
    expect(panel.className).toContain('flex');
    expect(panel.className).toContain('flex-col');

    const body = screen.getByText('содержимое').parentElement;
    expect(body.className).toContain('flex-1');
    expect(body.className).toContain('overflow-y-auto');
  });

  it('без scrollBody тело — обычный статичный div без overflow', () => {
    render(<Modal title="T" onClose={vi.fn()}><p>содержимое</p></Modal>);
    const body = screen.getByText('содержимое').parentElement;
    expect(body.className).not.toContain('overflow-y-auto');
  });

  it('footer рендерится в отдельном шапка-подвал блоке с border-t, если передан', () => {
    render(<Modal title="T" onClose={vi.fn()} footer={<button>Сохранить</button>}>content</Modal>);
    const footerBtn = screen.getByText('Сохранить');
    expect(footerBtn.parentElement.className).toContain('border-t');
  });

  it('без footer — подвального блока нет', () => {
    render(<Modal title="T" onClose={vi.fn()}>content</Modal>);
    expect(screen.queryByText('Сохранить')).not.toBeInTheDocument();
  });

  it('closeOnBackdropClick=false (по умолчанию) — клик по фону не закрывает', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<Modal title="T" onClose={onClose}>content</Modal>);
    await user.click(container.firstChild);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closeOnBackdropClick=true — клик по фону закрывает, клик внутри карточки — нет', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <Modal title="T" onClose={onClose} closeOnBackdropClick>content</Modal>
    );
    await user.click(screen.getByText('content'));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('xs/sm — дополнительные размеры ширины', () => {
    const panel = () => screen.getByText('T').parentElement.parentElement.parentElement;
    const { rerender } = render(<Modal title="T" onClose={vi.fn()} maxWidth="xs">c</Modal>);
    expect(panel().className).toContain('max-w-xs');

    rerender(<Modal title="T" onClose={vi.fn()} maxWidth="sm">c</Modal>);
    expect(panel().className).toContain('max-w-sm');
  });

  it('subtitle рендерится под заголовком, если передан', () => {
    render(<Modal title="T" subtitle="Подзаголовок" onClose={vi.fn()}>c</Modal>);
    expect(screen.getByText('Подзаголовок')).toBeInTheDocument();
  });

  it('без subtitle — подзаголовка нет', () => {
    render(<Modal title="T" onClose={vi.fn()}>c</Modal>);
    expect(screen.queryByText('Подзаголовок')).not.toBeInTheDocument();
  });

  it('headerExtra рендерится в шапке перед крестиком', () => {
    render(<Modal title="T" onClose={vi.fn()} headerExtra={<button>Доп. действие</button>}>c</Modal>);
    expect(screen.getByText('Доп. действие')).toBeInTheDocument();
  });

  it('bodyClassName переопределяет классы тела целиком', () => {
    render(<Modal title="T" onClose={vi.fn()} scrollBody bodyClassName="custom-body-cls"><p>содержимое</p></Modal>);
    const body = screen.getByText('содержимое').parentElement;
    expect(body.className).toBe('custom-body-cls');
  });

  it('forceDark — карточка всегда тёмная независимо от темы', () => {
    render(<Modal title="T" onClose={vi.fn()} forceDark>content</Modal>);
    const panel = screen.getByText('T').parentElement.parentElement.parentElement;
    expect(panel.className).toContain('bg-neutral-900');
    expect(panel.className).not.toContain('dark:bg-neutral-900');
    expect(panel.className).toContain('border-gray-700');
  });
});
