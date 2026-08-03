import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LiteraSelector from '../LiteraSelector';

const s1 = { id: 1, litera_code: 'А', litera_name: 'Опытная', status: 'draft' };
const s2 = { id: 2, litera_code: 'Б', litera_name: 'Серийная', status: 'active' };

describe('LiteraSelector — пустые случаи', () => {
    it('не рендерится при stages=null/[]', () => {
        const { container: c1 } = render(<LiteraSelector stages={null} selected={null} onChange={vi.fn()} />);
        expect(c1).toBeEmptyDOMElement();
        const { container: c2 } = render(<LiteraSelector stages={[]} selected={null} onChange={vi.fn()} />);
        expect(c2).toBeEmptyDOMElement();
    });

    it('один элемент + showAll=false — просто бейдж без дропдауна', async () => {
        const user = userEvent.setup();
        render(<LiteraSelector stages={[s1]} selected={null} onChange={vi.fn()} showAll={false} />);
        expect(screen.getByText('Лит.А')).toBeInTheDocument();
        expect(screen.queryByText('▼')).not.toBeInTheDocument();
        await user.click(screen.getByText('Лит.А'));
        expect(screen.queryByText('Все литеры')).not.toBeInTheDocument();
    });
});

describe('LiteraSelector — дропдаун', () => {
    it('метка кнопки: "Все литеры"/"Без литеры"/"Лит.N"', () => {
        const { rerender } = render(<LiteraSelector stages={[s1, s2]} selected={null} onChange={vi.fn()} />);
        expect(screen.getByText('Все литеры')).toBeInTheDocument();

        rerender(<LiteraSelector stages={[s1, s2]} selected="none" onChange={vi.fn()} />);
        expect(screen.getByText('Без литеры')).toBeInTheDocument();

        rerender(<LiteraSelector stages={[s1, s2]} selected={s2} onChange={vi.fn()} />);
        expect(screen.getByText('Лит.Б')).toBeInTheDocument();
    });

    it('открывает дропдаун и показывает "Все литеры"/"Без литеры"/пункты стадий', async () => {
        const user = userEvent.setup();
        render(<LiteraSelector stages={[s1, s2]} selected={null} onChange={vi.fn()} />);
        await user.click(screen.getByText('Все литеры'));

        expect(screen.getByText('Без литеры')).toBeInTheDocument();
        expect(screen.getByText('Опытная')).toBeInTheDocument();
        expect(screen.getByText('Серийная')).toBeInTheDocument();
        expect(screen.getByText('Активна')).toBeInTheDocument();
    });

    it('выбор "Все литеры" вызывает onChange(null) и закрывает дропдаун', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<LiteraSelector stages={[s1, s2]} selected={s2} onChange={onChange} />);
        await user.click(screen.getByText('Лит.Б'));
        await user.click(screen.getByText('Все литеры'));
        expect(onChange).toHaveBeenCalledWith(null);
        expect(screen.queryByText('Опытная')).not.toBeInTheDocument();
    });

    it('выбор "Без литеры" вызывает onChange(\'none\')', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<LiteraSelector stages={[s1, s2]} selected={null} onChange={onChange} />);
        await user.click(screen.getByText('Все литеры'));
        await user.click(screen.getByText('Без литеры'));
        expect(onChange).toHaveBeenCalledWith('none');
    });

    it('выбор конкретной стадии вызывает onChange(stage)', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<LiteraSelector stages={[s1, s2]} selected={null} onChange={onChange} />);
        await user.click(screen.getByText('Все литеры'));
        await user.click(screen.getByText('Опытная'));
        expect(onChange).toHaveBeenCalledWith(s1);
    });

    it('showAll=false скрывает пункты "Все литеры"/"Без литеры" в дропдауне (>1 стадии)', async () => {
        const user = userEvent.setup();
        render(<LiteraSelector stages={[s1, s2]} selected={s1} onChange={vi.fn()} showAll={false} />);
        await user.click(screen.getByText('Лит.А'));
        expect(screen.queryByText('Все литеры')).not.toBeInTheDocument();
        expect(screen.queryByText('Без литеры')).not.toBeInTheDocument();
        expect(screen.getByText('Опытная')).toBeInTheDocument();
    });

    it('клик вне дропдауна закрывает его', async () => {
        const user = userEvent.setup();
        render(
            <div>
                <div data-testid="outside">снаружи</div>
                <LiteraSelector stages={[s1, s2]} selected={null} onChange={vi.fn()} />
            </div>
        );
        await user.click(screen.getByText('Все литеры'));
        expect(screen.getByText('Опытная')).toBeInTheDocument();
        await user.click(screen.getByTestId('outside'));
        expect(screen.queryByText('Опытная')).not.toBeInTheDocument();
    });
});
