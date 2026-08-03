import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChainProductsPanel } from '../ProductBindingPanel';

const p1 = { id: 1, name: 'Калорифер КЭВ-1', sku: 'KEV-1' };
const p2 = { id: 2, name: 'Калорифер КЭВ-2', sku: 'KEV-2' };
const p3 = { id: 3, name: 'Калорифер КЭВ-3', sku: 'KEV-3' };

const partial1 = { id: 10, name: 'Неполный-1', missing_axes: ['Серия', 'Мощность'] };
const partial2 = { id: 11, name: 'Неполный-2', missing_axes: ['Серия', 'Напряжение'] };

function makeDataTransfer(data = {}) {
    const store = { ...data };
    return {
        setData: vi.fn((k, v) => { store[k] = v; }),
        getData: vi.fn((k) => store[k]),
        effectAllowed: '',
    };
}

describe('ChainProductsPanel — Delete (регрессия на исправленный краш)', () => {
    it('непустое выделение: не падает, вызывает onDetach с id, очищает выделение', async () => {
        const user = userEvent.setup();
        const onDetach = vi.fn();
        render(<ChainProductsPanel products={[p1, p2, p3]} loading={false} onDetach={onDetach} />);
        await user.click(screen.getByText('Калорифер КЭВ-1'));
        expect(screen.getByText('1 выбрано · Shift/Ctrl')).toBeInTheDocument();

        expect(() => fireEvent.keyDown(window, { key: 'Delete' })).not.toThrow();
        expect(onDetach).toHaveBeenCalledWith([1]);
        expect(screen.queryByText(/выбрано/)).not.toBeInTheDocument();
    });

    it('пустое выделение: onDetach не вызывается', () => {
        const onDetach = vi.fn();
        render(<ChainProductsPanel products={[p1, p2, p3]} loading={false} onDetach={onDetach} />);
        fireEvent.keyDown(window, { key: 'Delete' });
        expect(onDetach).not.toHaveBeenCalled();
    });
});

describe('ChainProductsPanel — полные товары', () => {
    it('счётчик количества, "500+" при 500 товарах', () => {
        const { rerender } = render(<ChainProductsPanel products={[p1, p2]} loading={false} />);
        expect(screen.getByText('2 шт.')).toBeInTheDocument();

        const many = Array.from({ length: 500 }, (_, i) => ({ id: i, name: `П${i}` }));
        rerender(<ChainProductsPanel products={many} loading={false} />);
        expect(screen.getByText('500+ шт.')).toBeInTheDocument();
    });

    it('loading=true — "Загрузка...", пусто — "Нет изделий"', () => {
        const { rerender } = render(<ChainProductsPanel products={[]} loading={true} />);
        expect(screen.getByText('Загрузка...')).toBeInTheDocument();
        rerender(<ChainProductsPanel products={[]} loading={false} />);
        expect(screen.getByText('Нет изделий')).toBeInTheDocument();
    });

    it('"Все" выделяет все товары', async () => {
        const user = userEvent.setup();
        render(<ChainProductsPanel products={[p1, p2, p3]} loading={false} />);
        await user.click(screen.getAllByText('Все')[0]);
        expect(screen.getByText('3 выбрано · Shift/Ctrl')).toBeInTheDocument();
    });

    it('клик по строке выделяет её (подсветка)', async () => {
        const user = userEvent.setup();
        render(<ChainProductsPanel products={[p1, p2]} loading={false} />);
        const row = screen.getByText('Калорифер КЭВ-1').closest('div[draggable]');
        await user.click(screen.getByText('Калорифер КЭВ-1'));
        expect(row.className).toContain('bg-red-50');
    });

    it('drag одного выделенного тащит только его; drag нескольких выделенных — всю группу', async () => {
        const user = userEvent.setup();
        render(<ChainProductsPanel products={[p1, p2, p3]} loading={false} />);
        await user.click(screen.getByText('Калорифер КЭВ-1'));
        await user.keyboard('{Control>}');
        await user.click(screen.getByText('Калорифер КЭВ-2'), { ctrlKey: true });

        const row1 = screen.getByText('Калорифер КЭВ-1').closest('div[draggable]');
        const dt = makeDataTransfer();
        fireEvent.dragStart(row1, { dataTransfer: dt });
        const ids = JSON.parse(dt.setData.mock.calls[0][1]);
        expect(ids.sort()).toEqual([1, 2]);
    });

    it('drag невыделенной строки тащит только её', () => {
        render(<ChainProductsPanel products={[p1, p2, p3]} loading={false} />);
        const row3 = screen.getByText('Калорифер КЭВ-3').closest('div[draggable]');
        const dt = makeDataTransfer();
        fireEvent.dragStart(row3, { dataTransfer: dt });
        expect(dt.setData).toHaveBeenCalledWith('productIds', JSON.stringify([3]));
    });
});

describe('ChainProductsPanel — неполные товары', () => {
    it('рендерятся только при непустом partialProducts, показывают missing_axes', () => {
        const { rerender } = render(<ChainProductsPanel products={[]} partialProducts={[]} loading={false} />);
        expect(screen.queryByText(/Неполные/)).not.toBeInTheDocument();

        rerender(<ChainProductsPanel products={[]} partialProducts={[partial1, partial2]} loading={false} />);
        expect(screen.getByText('Неполные · 2 шт.')).toBeInTheDocument();
        expect(screen.getByText('нет: Серия, Мощность')).toBeInTheDocument();
        expect(screen.getByText('нет: Серия, Напряжение')).toBeInTheDocument();
    });

    it('drag нескольких выделенных неполных вычисляет ПЕРЕСЕЧЕНИЕ missing_axes (не объединение)', async () => {
        const user = userEvent.setup();
        const onPartialDragStart = vi.fn();
        render(<ChainProductsPanel products={[]} partialProducts={[partial1, partial2]} loading={false}
            onPartialDragStart={onPartialDragStart} />);

        await user.click(screen.getByText('Неполный-1'));
        await user.keyboard('{Control>}');
        await user.click(screen.getByText('Неполный-2'), { ctrlKey: true });

        const row1 = screen.getByText('Неполный-1').closest('div[draggable]');
        const dt = makeDataTransfer();
        fireEvent.dragStart(row1, { dataTransfer: dt });
        expect(onPartialDragStart).toHaveBeenCalledWith(['Серия']);
    });

    it('drag одного невыделенного неполного передаёт его собственные missing_axes', () => {
        const onPartialDragStart = vi.fn();
        render(<ChainProductsPanel products={[]} partialProducts={[partial1, partial2]} loading={false}
            onPartialDragStart={onPartialDragStart} />);
        const row1 = screen.getByText('Неполный-1').closest('div[draggable]');
        const dt = makeDataTransfer();
        fireEvent.dragStart(row1, { dataTransfer: dt });
        expect(onPartialDragStart).toHaveBeenCalledWith(['Серия', 'Мощность']);
    });

    it('dragEnd сбрасывает через onPartialDragStart([])', () => {
        const onPartialDragStart = vi.fn();
        render(<ChainProductsPanel products={[]} partialProducts={[partial1]} loading={false}
            onPartialDragStart={onPartialDragStart} />);
        const row1 = screen.getByText('Неполный-1').closest('div[draggable]');
        fireEvent.dragEnd(row1);
        expect(onPartialDragStart).toHaveBeenCalledWith([]);
    });
});

describe('ChainProductsPanel — отвязка оси', () => {
    const axes = [{ id: 'a1', label: 'Серия' }, { id: 'a2', name: 'Мощность' }];

    it('кнопка "−ось" видна только при availableAxes.length>0 && products.length>0', () => {
        const { rerender } = render(<ChainProductsPanel products={[]} loading={false} availableAxes={axes} />);
        expect(screen.queryByText('−ось')).not.toBeInTheDocument();

        rerender(<ChainProductsPanel products={[p1]} loading={false} availableAxes={[]} />);
        expect(screen.queryByText('−ось')).not.toBeInTheDocument();

        rerender(<ChainProductsPanel products={[p1]} loading={false} availableAxes={axes} />);
        expect(screen.getByText('−ось')).toBeInTheDocument();
    });

    it('выбор оси в меню вызывает onDetachAxis(axisId, все id товаров), закрывает меню', async () => {
        const user = userEvent.setup();
        const onDetachAxis = vi.fn();
        render(<ChainProductsPanel products={[p1, p2, p3]} loading={false} availableAxes={axes} onDetachAxis={onDetachAxis} />);

        await user.click(screen.getByText('−ось'));
        expect(screen.getByText('Серия')).toBeInTheDocument();
        await user.click(screen.getByText('Мощность'));

        expect(onDetachAxis).toHaveBeenCalledWith('a2', [1, 2, 3]);
        expect(screen.queryByText('Серия')).not.toBeInTheDocument();
    });
});

describe('ChainProductsPanel — drop', () => {
    it('валидный JSON productIds вызывает onDrop с массивом', () => {
        const onDrop = vi.fn();
        render(<ChainProductsPanel products={[]} loading={false} onDrop={onDrop} />);
        const panel = screen.getByText('Перетащите товар · Shift/Ctrl').closest('div[style]');
        const dt = makeDataTransfer({ productIds: JSON.stringify([5, 6]) });
        fireEvent.drop(panel, { dataTransfer: dt });
        expect(onDrop).toHaveBeenCalledWith([5, 6]);
    });

    it('невалидный JSON — перехвачен, onDrop не вызывается', () => {
        const onDrop = vi.fn();
        render(<ChainProductsPanel products={[]} loading={false} onDrop={onDrop} />);
        const panel = screen.getByText('Перетащите товар · Shift/Ctrl').closest('div[style]');
        const dt = makeDataTransfer({ productIds: 'not json' });
        expect(() => fireEvent.drop(panel, { dataTransfer: dt })).not.toThrow();
        expect(onDrop).not.toHaveBeenCalled();
    });

    it('пустой массив id — onDrop не вызывается', () => {
        const onDrop = vi.fn();
        render(<ChainProductsPanel products={[]} loading={false} onDrop={onDrop} />);
        const panel = screen.getByText('Перетащите товар · Shift/Ctrl').closest('div[style]');
        const dt = makeDataTransfer({ productIds: JSON.stringify([]) });
        fireEvent.drop(panel, { dataTransfer: dt });
        expect(onDrop).not.toHaveBeenCalled();
    });

    it('isDragOver подсветка при dragOver/dragLeave', () => {
        render(<ChainProductsPanel products={[]} loading={false} />);
        const panel = screen.getByText('Перетащите товар · Shift/Ctrl').closest('div[style]');
        fireEvent.dragOver(panel, { dataTransfer: makeDataTransfer() });
        expect(screen.getByText('+ Отпустите')).toBeInTheDocument();
        fireEvent.dragLeave(panel);
        expect(screen.getByText('Перетащите товар · Shift/Ctrl')).toBeInTheDocument();
    });
});
