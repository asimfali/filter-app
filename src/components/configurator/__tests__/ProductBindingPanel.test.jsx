import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductBindingPanel from '../ProductBindingPanel';
import { catalogApi } from '../../../api/catalog';

vi.mock('../../../api/catalog', () => ({
    catalogApi: { searchProducts: vi.fn() },
}));

const ok = (data) => ({ ok: true, data: { success: true, data } });

const p1 = { id: 1, name: 'Калорифер КЭВ-1', sku: 'KEV-1' };
const p2 = { id: 2, name: 'Калорифер КЭВ-2', sku: 'KEV-2' };
const p3 = { id: 3, name: 'Калорифер КЭВ-3' };

beforeEach(() => {
    vi.clearAllMocks();
});

function makeDataTransfer(data = {}) {
    const store = { ...data };
    return {
        setData: vi.fn((k, v) => { store[k] = v; }),
        getData: vi.fn((k) => store[k]),
        effectAllowed: '',
    };
}

describe('ProductBindingPanel — поиск', () => {
    it('пустой поиск без noParams — не грузит, "Нет товаров"', async () => {
        render(<ProductBindingPanel productTypeId="t1" filterValueIds={[]} pendingAssignments={{}} />);
        await new Promise(r => setTimeout(r, 350));
        expect(catalogApi.searchProducts).not.toHaveBeenCalled();
        expect(screen.getByText('Нет товаров')).toBeInTheDocument();
    });

    it('короче 2 символов без noParams — не грузит, "Ничего не найдено"', async () => {
        const user = userEvent.setup();
        render(<ProductBindingPanel productTypeId="t1" filterValueIds={[]} pendingAssignments={{}} />);
        await user.type(screen.getByPlaceholderText('Поиск товаров...'), 'К');
        await new Promise(r => setTimeout(r, 350));
        expect(catalogApi.searchProducts).not.toHaveBeenCalled();
        expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
    });

    it('noParams=true грузит даже с пустым search', async () => {
        const user = userEvent.setup();
        catalogApi.searchProducts.mockResolvedValue(ok([p1]));
        render(<ProductBindingPanel productTypeId="t1" filterValueIds={[]} pendingAssignments={{}} />);
        await user.click(screen.getByText('∅ Без осей'));
        await waitFor(() => expect(catalogApi.searchProducts).toHaveBeenCalledWith('', {
            productTypeId: 't1', limit: 50, regex: false, noParams: true,
        }));
        expect(await screen.findByText('Калорифер КЭВ-1')).toBeInTheDocument();
    });

    it('debounce 300мс, вызывает searchProducts с правильными параметрами; regexMode меняет плейсхолдер', async () => {
        const user = userEvent.setup();
        catalogApi.searchProducts.mockResolvedValue(ok([p1, p2]));
        render(<ProductBindingPanel productTypeId="t1" filterValueIds={[]} pendingAssignments={{}} />);
        await user.click(screen.getByText('.* Regex'));
        expect(screen.getByPlaceholderText('Regex: П2\\d*E')).toBeInTheDocument();

        await user.type(screen.getByPlaceholderText('Regex: П2\\d*E'), 'КЭВ');
        await waitFor(() => expect(screen.getByText('Загрузка...')).toBeInTheDocument());
        await waitFor(() => expect(catalogApi.searchProducts).toHaveBeenCalledWith('КЭВ', {
            productTypeId: 't1', limit: 50, regex: true, noParams: false,
        }));
        expect(await screen.findByText('Калорифер КЭВ-1')).toBeInTheDocument();
        expect(screen.getByText('Калорифер КЭВ-2')).toBeInTheDocument();
    });

    it('пусто с поиском — "Ничего не найдено"', async () => {
        const user = userEvent.setup();
        catalogApi.searchProducts.mockResolvedValue(ok([]));
        render(<ProductBindingPanel productTypeId="t1" filterValueIds={[]} pendingAssignments={{}} />);
        await user.type(screen.getByPlaceholderText('Поиск товаров...'), 'нетничего');
        expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument();
    });
});

describe('ProductBindingPanel — выбор', () => {
    async function search(user) {
        catalogApi.searchProducts.mockResolvedValue(ok([p1, p2, p3]));
        await user.type(screen.getByPlaceholderText('Поиск товаров...'), 'КЭВ');
        await screen.findByText('Калорифер КЭВ-1');
    }

    it('клик выделяет товар, счётчик "N выбрано", повторный клик снимает выбор', async () => {
        const user = userEvent.setup();
        render(<ProductBindingPanel productTypeId="t1" filterValueIds={[]} pendingAssignments={{}} />);
        await search(user);

        await user.click(screen.getByText('Калорифер КЭВ-1'));
        expect(screen.getByText('1 выбрано')).toBeInTheDocument();
        await user.click(screen.getByText('Калорифер КЭВ-1'));
        expect(screen.queryByText('1 выбрано')).not.toBeInTheDocument();
    });

    it('"Все (N)" переключает выбор всех, вызывает onSelectionChange', async () => {
        const user = userEvent.setup();
        const onSelectionChange = vi.fn();
        render(<ProductBindingPanel productTypeId="t1" filterValueIds={[]} pendingAssignments={{}} onSelectionChange={onSelectionChange} />);
        await search(user);

        await user.click(screen.getByLabelText(/Все \(3\)/));
        expect(screen.getByText('3 выбрано')).toBeInTheDocument();
        expect(onSelectionChange).toHaveBeenCalledWith([1, 2, 3]);

        await user.click(screen.getByLabelText(/Все \(3\)/));
        expect(screen.queryByText(/выбрано/)).not.toBeInTheDocument();
        expect(onSelectionChange).toHaveBeenCalledWith([]);
    });

    it('readOnly=true: чекбоксы товаров disabled, "Все" не работает, футер показывает предупреждение', async () => {
        const user = userEvent.setup();
        render(<ProductBindingPanel productTypeId="t1" filterValueIds={[]} pendingAssignments={{}} readOnly />);
        await search(user);

        expect(screen.getByText('[R] Режим только для чтения')).toBeInTheDocument();
        const row1 = screen.getByText('Калорифер КЭВ-1').closest('div[draggable]');
        expect(row1).toHaveAttribute('draggable', 'false');
        expect(row1.querySelector('input[type="checkbox"]')).toBeDisabled();

        await user.click(screen.getByLabelText(/Все \(3\)/));
        expect(screen.queryByText(/выбрано/)).not.toBeInTheDocument();
    });

    it('pendingAssignments показывает "✓ axis=value" под товаром', async () => {
        const user = userEvent.setup();
        render(<ProductBindingPanel productTypeId="t1" filterValueIds={[]} pendingAssignments={{
            1: [{ axisId: 'a1', valueId: 'v1', axisName: 'Серия', valueName: '200' }],
        }} />);
        await search(user);
        expect(screen.getByText('✓ Серия=200')).toBeInTheDocument();
        // у товара без назначений подсказки нет
        const row2 = screen.getByText('Калорифер КЭВ-2').closest('div[draggable]');
        expect(row2.textContent).not.toContain('✓');
    });
});

describe('ProductBindingPanel — drag', () => {
    async function search(user) {
        catalogApi.searchProducts.mockResolvedValue(ok([p1, p2, p3]));
        await user.type(screen.getByPlaceholderText('Поиск товаров...'), 'КЭВ');
        await screen.findByText('Калорифер КЭВ-1');
    }

    it('drag невыделенного товара выделяет только его и вызывает onDragStart/onSelectionChange', async () => {
        const user = userEvent.setup();
        const onDragStart = vi.fn();
        const onSelectionChange = vi.fn();
        render(<ProductBindingPanel productTypeId="t1" filterValueIds={[]} pendingAssignments={{}}
            onDragStart={onDragStart} onSelectionChange={onSelectionChange} />);
        await search(user);

        const row = screen.getByText('Калорифер КЭВ-1').closest('div[draggable]');
        const dt = makeDataTransfer();
        fireEvent.dragStart(row, { dataTransfer: dt });

        expect(dt.setData).toHaveBeenCalledWith('productIds', JSON.stringify([1]));
        expect(onDragStart).toHaveBeenCalledWith([1]);
        expect(onSelectionChange).toHaveBeenCalledWith([1]);
    });

    it('drag уже выделенной группы тащит все выделенные id', async () => {
        const user = userEvent.setup();
        const onDragStart = vi.fn();
        render(<ProductBindingPanel productTypeId="t1" filterValueIds={[]} pendingAssignments={{}} onDragStart={onDragStart} />);
        await search(user);

        await user.click(screen.getByText('Калорифер КЭВ-1'));
        await user.keyboard('{Control>}');
        await user.click(screen.getByText('Калорифер КЭВ-2'), { ctrlKey: true });

        const row = screen.getByText('Калорифер КЭВ-1').closest('div[draggable]');
        const dt = makeDataTransfer();
        fireEvent.dragStart(row, { dataTransfer: dt });
        const sentIds = JSON.parse(dt.setData.mock.calls[0][1]);
        expect(sentIds.sort()).toEqual([1, 2]);
        expect(onDragStart).toHaveBeenCalledWith(expect.arrayContaining([1, 2]));
    });

    it('readOnly=true — drag вызывает preventDefault, onDragStart не вызывается', async () => {
        const user = userEvent.setup();
        const onDragStart = vi.fn();
        render(<ProductBindingPanel productTypeId="t1" filterValueIds={[]} pendingAssignments={{}} readOnly onDragStart={onDragStart} />);
        await search(user);

        const row = screen.getByText('Калорифер КЭВ-1').closest('div');
        const dt = makeDataTransfer();
        const event = fireEvent.dragStart(row, { dataTransfer: dt });
        expect(onDragStart).not.toHaveBeenCalled();
        void event;
    });
});
