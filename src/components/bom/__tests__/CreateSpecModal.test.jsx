import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateSpecModal from '../CreateSpecModal';
import { bomApi } from '../../../api/bom';

vi.mock('../../../api/bom', () => ({
  bomApi: { getParts: vi.fn(), createPart: vi.fn(), createSpec: vi.fn() },
}));

const okList = (data) => ({ ok: true, data: { success: true, data } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CreateSpecModal — поиск и выбор изделия', () => {
  it('запрос короче 2 символов не ищет', async () => {
    const user = userEvent.setup();
    render(<CreateSpecModal onClose={vi.fn()} onCreated={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('Начните вводить название...'), 'К');
    expect(bomApi.getParts).not.toHaveBeenCalled();
  });

  it('выбор изделия из списка автозаполняет название спецификации суффиксом "(Сборка)"', async () => {
    const user = userEvent.setup();
    bomApi.getParts.mockResolvedValue(okList([{ id: 1, onec_name: 'КЭВ-45П5033Е' }]));
    render(<CreateSpecModal onClose={vi.fn()} onCreated={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Начните вводить название...'), 'КЭВ');
    await user.click(await screen.findByText('КЭВ-45П5033Е'));

    expect(screen.getByPlaceholderText('Начните вводить название...')).toHaveValue('КЭВ-45П5033Е');
    expect(screen.getByPlaceholderText('КЭВ-45П5033Е(Сборка)')).toHaveValue('КЭВ-45П5033Е(Сборка)');
  });

  it('кнопка "Создать" задизейблена без изделия/названия', () => {
    render(<CreateSpecModal onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.getByText('Создать')).toBeDisabled();
  });
});

describe('CreateSpecModal — создание', () => {
  it('изделие выбрано из списка: createSpec использует его id напрямую, createPart не вызывается', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    bomApi.getParts.mockResolvedValue(okList([{ id: 5, onec_name: 'КЭВ-1' }]));
    bomApi.createSpec.mockResolvedValue(okList({ id: 100, onec_name: 'КЭВ-1(Сборка)' }));
    render(<CreateSpecModal onClose={vi.fn()} onCreated={onCreated} />);

    await user.type(screen.getByPlaceholderText('Начните вводить название...'), 'КЭВ');
    await user.click(await screen.findByText('КЭВ-1'));
    await user.click(screen.getByText('Создать'));

    expect(bomApi.createPart).not.toHaveBeenCalled();
    expect(bomApi.createSpec).toHaveBeenCalledWith(expect.objectContaining({
      part: 5, onec_name: 'КЭВ-1(Сборка)', stage_name: 'Сборка', process_type: 'Сборка', quantity: 1,
    }));
    expect(onCreated).toHaveBeenCalledWith({ id: 100, onec_name: 'КЭВ-1(Сборка)' });
  });

  it('изделие введено вручную (не выбрано): создаёт Part перед спецификацией', async () => {
    const user = userEvent.setup();
    bomApi.getParts.mockResolvedValue(okList([]));
    bomApi.createPart.mockResolvedValue(okList({ id: 7 }));
    bomApi.createSpec.mockResolvedValue(okList({ id: 101 }));
    render(<CreateSpecModal onClose={vi.fn()} onCreated={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Начните вводить название...'), 'Новое изделие');
    await user.clear(screen.getByPlaceholderText('КЭВ-45П5033Е(Сборка)'));
    await user.type(screen.getByPlaceholderText('КЭВ-45П5033Е(Сборка)'), 'Новое изделие(Сборка)');
    await user.click(screen.getByText('Создать'));

    expect(bomApi.createPart).toHaveBeenCalledWith({
      onec_name: 'Новое изделие', is_assembly: true, unit: 'шт.',
    });
    expect(bomApi.createSpec).toHaveBeenCalledWith(expect.objectContaining({ part: 7 }));
  });

  it('неудача createPart показывает ошибку и не вызывает createSpec', async () => {
    const user = userEvent.setup();
    bomApi.getParts.mockResolvedValue(okList([]));
    bomApi.createPart.mockResolvedValue({ ok: false, data: { error: 'Изделие уже существует' } });
    render(<CreateSpecModal onClose={vi.fn()} onCreated={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Начните вводить название...'), 'X');
    await user.type(screen.getByPlaceholderText('КЭВ-45П5033Е(Сборка)'), 'X(Сборка)');
    await user.click(screen.getByText('Создать'));

    expect(await screen.findByText('Изделие уже существует')).toBeInTheDocument();
    expect(bomApi.createSpec).not.toHaveBeenCalled();
  });

  it('неудача createSpec: приоритет data.error.onec_name[0] над data.error и дефолтом', async () => {
    const user = userEvent.setup();
    bomApi.getParts.mockResolvedValue(okList([{ id: 1, onec_name: 'КЭВ-1' }]));
    bomApi.createSpec.mockResolvedValue({
      ok: true, data: { success: false, error: { onec_name: ['Такое название уже занято'] } },
    });
    render(<CreateSpecModal onClose={vi.fn()} onCreated={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('Начните вводить название...'), 'КЭВ');
    await user.click(await screen.findByText('КЭВ-1'));

    await user.click(screen.getByText('Создать'));

    expect(await screen.findByText('Такое название уже занято')).toBeInTheDocument();
  });

  it('неудача createSpec без field-ошибки использует строковый data.error', async () => {
    const user = userEvent.setup();
    bomApi.getParts.mockResolvedValue(okList([{ id: 1, onec_name: 'КЭВ-1' }]));
    bomApi.createSpec.mockResolvedValue({ ok: true, data: { success: false, error: 'Сервис недоступен' } });
    render(<CreateSpecModal onClose={vi.fn()} onCreated={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('Начните вводить название...'), 'КЭВ');
    await user.click(await screen.findByText('КЭВ-1'));
    await user.click(screen.getByText('Создать'));

    expect(await screen.findByText('Сервис недоступен')).toBeInTheDocument();
  });

  it('показывает "Создание..." во время запроса', async () => {
    const user = userEvent.setup();
    bomApi.getParts.mockResolvedValue(okList([{ id: 1, onec_name: 'КЭВ-1' }]));
    let resolveCreate;
    bomApi.createSpec.mockReturnValue(new Promise((r) => { resolveCreate = r; }));
    render(<CreateSpecModal onClose={vi.fn()} onCreated={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('Начните вводить название...'), 'КЭВ');
    await user.click(await screen.findByText('КЭВ-1'));

    await user.click(screen.getByText('Создать'));
    expect(screen.getByText('Создание...')).toBeDisabled();

    resolveCreate(okList({ id: 1 }));
  });

  it('"×"/"Отмена" вызывают onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CreateSpecModal onClose={onClose} onCreated={vi.fn()} />);
    await user.click(screen.getByText('×'));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByText('Отмена'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
