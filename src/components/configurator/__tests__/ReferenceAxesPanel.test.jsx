import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import ReferenceAxesPanel, {
    REF_DETACH, refAttachValueIds, refDetachAxisIds, withRefValues, refAxisStats,
} from '../ReferenceAxesPanel';

const rt = {
    axis_id: 7, axis_name: 'Рядность ТО', order: 2, parent_axis_id: 3, parent_value_ids: [30],
    values: [{ id: 71, label: '2', sort_order: 2 }, { id: 70, label: '1', sort_order: 1 }],
};
const izol = {
    axis_id: 9, axis_name: 'Изолированная нейтраль', order: 1, parent_axis_id: 3, parent_value_ids: [31],
    values: [{ id: 90, label: 'Да', sort_order: 1 }],
};
const axes = [rt, izol];

describe('ReferenceAxesPanel — хелперы', () => {
    const sel = {
        7: { on: true, choice: '71' },
        9: { on: true, choice: REF_DETACH },
    };

    it('attach — только отмеченные оси со значением; detach — оси «снять»', () => {
        expect(refAttachValueIds(axes, sel)).toEqual(['71']);
        expect(refDetachAxisIds(axes, sel)).toEqual([9]);
    });

    it('снятый чекбокс или ось без выбора не участвуют', () => {
        const s = { 7: { on: false, choice: '71' }, 9: { on: true, choice: null } };
        expect(refAttachValueIds(axes, s)).toEqual([]);
        expect(refDetachAxisIds(axes, s)).toEqual([]);
        expect(withRefValues([1, 70], axes, s)).toEqual(['1', '70']);
    });

    it('withRefValues: значения цепочки на отмеченной оси заменяются значением панели', () => {
        expect(withRefValues([1, 2, 70], axes, sel)).toEqual(['1', '2', '71']);
    });

    it('withRefValues: «снять» убирает значение этой оси из цепочки', () => {
        expect(withRefValues([1, 90], axes, { 9: { on: true, choice: REF_DETACH } })).toEqual(['1']);
    });

    it('refAxisStats: общее значение, смешано, пусто, число сирот', () => {
        const current = {
            by_product: { 1: { 7: '71', 9: null }, 2: { 7: '70', 9: null } },
            parent_ok: { 1: { 7: true, 9: false }, 2: { 7: false, 9: false } },
        };
        expect(refAxisStats(7, current)).toEqual({ total: 2, mixed: true, value: null, orphans: 1 });
        expect(refAxisStats(9, current)).toEqual({ total: 2, mixed: false, value: null, orphans: 2 });
        expect(refAxisStats(7, null)).toBeNull();
    });
});

function Harness({ onApply = vi.fn(), selectedCount = 2, current = null }) {
    const [selection, setSelection] = useState({});
    return (
        <>
            <ReferenceAxesPanel axes={axes} selection={selection} onChange={setSelection}
                current={current} selectedCount={selectedCount} onApply={onApply} />
            <pre data-testid="sel">{JSON.stringify(selection)}</pre>
        </>
    );
}

describe('ReferenceAxesPanel — UI', () => {
    it('нет осей — ничего не рендерит', () => {
        const { container } = render(<ReferenceAxesPanel axes={[]} selection={{}} onChange={vi.fn()} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('оси по order, значения по sort_order', () => {
        render(<Harness />);
        const labels = screen.getAllByRole('checkbox').map(cb => cb.closest('label').textContent.trim());
        expect(labels).toEqual(['Изолированная нейтраль', 'Рядность ТО']);
        const radios = screen.getAllByRole('radio').map(r => r.closest('label').textContent);
        expect(radios).toEqual(['Да', 'снять', '1', '2', 'снять']);
    });

    it('выбор значения отмечает ось; кнопка активна только при выбранном значении и товарах', async () => {
        const user = userEvent.setup();
        const onApply = vi.fn();
        render(<Harness onApply={onApply} />);
        const btn = screen.getByRole('button', { name: 'Применить к выделенным (2)' });
        expect(btn).toBeDisabled();

        await user.click(screen.getByRole('checkbox', { name: 'Рядность ТО' }));
        expect(btn).toBeDisabled(); // ось отмечена, но значение не выбрано

        await user.click(screen.getByRole('radio', { name: '2' }));
        expect(JSON.parse(screen.getByTestId('sel').textContent)).toEqual({ 7: { on: true, choice: '71' } });
        expect(btn).toBeEnabled();
        await user.click(btn);
        expect(onApply).toHaveBeenCalledTimes(1);
    });

    it('без выделенных товаров кнопка неактивна', async () => {
        const user = userEvent.setup();
        render(<Harness selectedCount={0} />);
        await user.click(screen.getAllByRole('radio', { name: 'снять' })[0]);
        expect(screen.getByRole('button', { name: 'Применить к выделенным (0)' })).toBeDisabled();
    });

    it('текущее значение у выделенных: общее, «смешано», «не задано»', () => {
        render(<Harness current={{
            by_product: { 1: { 7: '71', 9: null }, 2: { 7: '71', 9: '90' } },
            parent_ok: {},
        }} />);
        expect(screen.getByRole('checkbox', { name: 'Рядность ТО (2)' })).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'Изолированная нейтраль (смешано)' })).toBeInTheDocument();
    });

    it('предупреждение «N из M без родителя» — только для отмеченной оси со значением', async () => {
        const user = userEvent.setup();
        render(<Harness current={{
            by_product: { 1: { 7: null }, 2: { 7: null }, 3: { 7: '70' } },
            parent_ok: { 1: { 7: false }, 2: { 7: false }, 3: { 7: true } },
        }} />);
        expect(screen.getByRole('checkbox', { name: 'Рядность ТО (смешано)' })).toBeInTheDocument();
        expect(screen.queryByText(/станет «сиротой»/)).not.toBeInTheDocument();

        await user.click(screen.getAllByRole('radio', { name: 'снять' })[1]);
        expect(screen.queryByText(/станет «сиротой»/)).not.toBeInTheDocument();

        await user.click(screen.getByRole('radio', { name: '2' }));
        expect(screen.getByText(/2 из 3 товаров без родительского значения/)).toBeInTheDocument();
    });
});
