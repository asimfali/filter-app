import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeriesItemsTable from '../SeriesItemsTable';

vi.mock('../../common/SmartSelect', () => ({
  default: ({ placeholder, value, onSelect, onClear }) => (
    <div data-testid="smart-select">
      <input placeholder={placeholder} readOnly value={value ? value.name : ''} />
      <button onClick={() => onSelect({ value: 5 })}>select-power</button>
      <button onClick={onClear}>clear-power</button>
    </div>
  ),
}));

const masterConfig = {
  varies_axes: ['heating'],
  heating_axis_code: 'heating',
  power_not_required_for: ['A'],
  has_network: true,
  has_power: true,
  axes: { heating: { name: 'Нагрев' } },
};

const itemE = { localId: 'l1', name: 'КЭВ-5П01', networkDigit: '1', power: 5, comboMap: { heating: { value: 'E' } } };
const itemA = { localId: 'l2', name: 'КЭВ-А', networkDigit: '0', power: '', comboMap: { heating: { value: 'A' } } };

describe('SeriesItemsTable', () => {
  it('пустой список показывает заглушку', () => {
    render(<SeriesItemsTable items={[]} masterConfig={masterConfig} onAddPower={vi.fn()} onUpdate={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('Нет изделий — вернитесь назад и выберите значения')).toBeInTheDocument();
  });

  it('рендерит шапку с названиями осей/Сеть/Мощность/Название', () => {
    render(<SeriesItemsTable items={[itemE]} masterConfig={masterConfig} onAddPower={vi.fn()} onUpdate={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('Нагрев')).toBeInTheDocument();
    expect(screen.getByText('Сеть')).toBeInTheDocument();
    expect(screen.getByText('Мощность')).toBeInTheDocument();
    expect(screen.getByText('Название')).toBeInTheDocument();
  });

  it('значение heating-оси подсвечивается цветом из HEATING_COLORS', () => {
    render(<SeriesItemsTable items={[itemE]} masterConfig={masterConfig} onAddPower={vi.fn()} onUpdate={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('E')).toHaveClass('bg-red-100');
  });

  it('power_not_required_for скрывает поле мощности и не считает изделие незаполненным', () => {
    render(<SeriesItemsTable items={[itemA]} masterConfig={masterConfig} onAddPower={vi.fn()} onUpdate={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.queryByTestId('smart-select')).not.toBeInTheDocument();
    expect(screen.getByText('Итого: 1 изделий')).toBeInTheDocument();
    expect(screen.queryByText(/незаполненные мощности/)).not.toBeInTheDocument();
  });

  it('изделие без мощности (когда она требуется) подсвечивается и попадает в "незаполненные"', () => {
    const empty = { ...itemE, power: '' };
    render(<SeriesItemsTable items={[empty]} masterConfig={masterConfig} onAddPower={vi.fn()} onUpdate={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('Итого: 0 изделий')).toBeInTheDocument();
    expect(screen.getByText(/есть незаполненные мощности/)).toBeInTheDocument();
  });

  it('onUpdate вызывается при вводе названия, onRemove — по крестику, onAddPower — по "+"', async () => {
    const onUpdate = vi.fn();
    const onRemove = vi.fn();
    const onAddPower = vi.fn();
    const user = userEvent.setup();
    render(<SeriesItemsTable items={[itemE]} masterConfig={masterConfig} onAddPower={onAddPower} onUpdate={onUpdate} onRemove={onRemove} />);

    const nameInput = screen.getByDisplayValue('КЭВ-5П01');
    await user.clear(nameInput);
    expect(onUpdate).toHaveBeenCalledWith('l1', 'name', expect.any(String));

    const networkInput = screen.getByDisplayValue('1');
    await user.clear(networkInput);
    expect(onUpdate).toHaveBeenCalledWith('l1', 'networkDigit', expect.any(String));

    await user.click(screen.getByText('select-power'));
    expect(onUpdate).toHaveBeenCalledWith('l1', 'power', 5);

    await user.click(screen.getByText('clear-power'));
    expect(onUpdate).toHaveBeenCalledWith('l1', 'power', '');

    await user.click(screen.getByText('+'));
    expect(onAddPower).toHaveBeenCalledWith('l1');

    await user.click(screen.getByText('✕'));
    expect(onRemove).toHaveBeenCalledWith('l1');
  });

  it('has_network=false скрывает колонку "Сеть", has_power=false скрывает "Мощность"', () => {
    const cfg = { ...masterConfig, has_network: false, has_power: false };
    render(<SeriesItemsTable items={[itemE]} masterConfig={cfg} onAddPower={vi.fn()} onUpdate={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.queryByText('Сеть')).not.toBeInTheDocument();
    expect(screen.queryByText('Мощность')).not.toBeInTheDocument();
  });
});
