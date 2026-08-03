import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FuzzyMergeModal from '../FuzzyMergeModal';
import { bomApi } from '../../../api/bom';

vi.mock('../../../api/bom', () => ({ bomApi: { fuzzySearchPart: vi.fn(), mergeSpecMaterial: vi.fn() } }));

const material = { id: 1, part_name: 'Панель бок 1.5' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FuzzyMergeModal — поиск похожих', () => {
  it('показывает исходное имя материала и "Поиск похожих..." во время загрузки', async () => {
    let resolveFetch;
    bomApi.fuzzySearchPart.mockReturnValue(new Promise((r) => { resolveFetch = r; }));
    render(<FuzzyMergeModal material={material} onClose={vi.fn()} onMerged={vi.fn()} />);

    expect(screen.getByText('Панель бок 1.5')).toBeInTheDocument();
    expect(screen.getByText('Поиск похожих...')).toBeInTheDocument();

    resolveFetch({ ok: true, data: { success: true, data: [] } });
  });

  it('вызывает fuzzySearchPart(material.part_name), рендерит результаты с процентом схожести', async () => {
    bomApi.fuzzySearchPart.mockResolvedValue({
      ok: true,
      data: { success: true, data: [{ id: 10, onec_name: 'Панель боковая 1.5', score: 96, folder: 'Металл/Панели' }] },
    });
    render(<FuzzyMergeModal material={material} onClose={vi.fn()} onMerged={vi.fn()} />);

    expect(bomApi.fuzzySearchPart).toHaveBeenCalledWith('Панель бок 1.5');
    expect(await screen.findByText('Панель боковая 1.5')).toBeInTheDocument();
    expect(screen.getByText('96%')).toBeInTheDocument();
    expect(screen.getByText('Металл/Панели')).toBeInTheDocument();
  });

  it('пустой результат показывает "Похожих не найдено"', async () => {
    bomApi.fuzzySearchPart.mockResolvedValue({ ok: true, data: { success: true, data: [] } });
    render(<FuzzyMergeModal material={material} onClose={vi.fn()} onMerged={vi.fn()} />);
    expect(await screen.findByText('Похожих не найдено')).toBeInTheDocument();
  });

  it('неуспешный поиск показывает "Ошибка поиска"', async () => {
    bomApi.fuzzySearchPart.mockResolvedValue({ ok: false, data: {} });
    render(<FuzzyMergeModal material={material} onClose={vi.fn()} onMerged={vi.fn()} />);
    expect(await screen.findByText('Ошибка поиска')).toBeInTheDocument();
  });
});

describe('FuzzyMergeModal — выбор и замена', () => {
  it('"Выбрать" задизейблена, пока не выбран вариант', async () => {
    bomApi.fuzzySearchPart.mockResolvedValue({
      ok: true, data: { success: true, data: [{ id: 10, onec_name: 'Панель боковая 1.5', score: 90 }] },
    });
    render(<FuzzyMergeModal material={material} onClose={vi.fn()} onMerged={vi.fn()} />);
    await screen.findByText('Панель боковая 1.5');

    expect(screen.getByText('Выбрать')).toBeDisabled();
  });

  it('выбор варианта и подтверждение вызывает mergeSpecMaterial → onMerged', async () => {
    const user = userEvent.setup();
    const onMerged = vi.fn();
    bomApi.fuzzySearchPart.mockResolvedValue({
      ok: true, data: { success: true, data: [{ id: 10, onec_name: 'Панель боковая 1.5', score: 90 }] },
    });
    bomApi.mergeSpecMaterial.mockResolvedValue({ ok: true, data: { success: true, data: { new_name: 'Панель боковая 1.5' } } });
    render(<FuzzyMergeModal material={material} onClose={vi.fn()} onMerged={onMerged} />);
    await user.click(await screen.findByText('Панель боковая 1.5'));

    await user.click(screen.getByText('Выбрать'));

    expect(bomApi.mergeSpecMaterial).toHaveBeenCalledWith(1, 10);
    expect(onMerged).toHaveBeenCalledWith({ new_name: 'Панель боковая 1.5' });
  });

  it('неудача замены показывает ошибку и возвращает кнопку в активное состояние ("Выбрать")', async () => {
    const user = userEvent.setup();
    bomApi.fuzzySearchPart.mockResolvedValue({
      ok: true, data: { success: true, data: [{ id: 10, onec_name: 'Вариант', score: 90 }] },
    });
    bomApi.mergeSpecMaterial.mockResolvedValue({ ok: false, data: { error: 'Материал уже используется' } });
    render(<FuzzyMergeModal material={material} onClose={vi.fn()} onMerged={vi.fn()} />);
    await user.click(await screen.findByText('Вариант'));

    await user.click(screen.getByText('Выбрать'));

    expect(await screen.findByText('Материал уже используется')).toBeInTheDocument();
    expect(screen.getByText('Выбрать')).toBeEnabled();
  });

  it('"Отмена" вызывает onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    bomApi.fuzzySearchPart.mockResolvedValue({ ok: true, data: { success: true, data: [] } });
    render(<FuzzyMergeModal material={material} onClose={onClose} onMerged={vi.fn()} />);
    await screen.findByText('Похожих не найдено');
    await user.click(screen.getByText('Отмена'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
