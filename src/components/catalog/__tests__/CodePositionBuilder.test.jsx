import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CodePositionBuilder from '../CodePositionBuilder';

const lengthValues = [{ id: 1, value: '1000' }, { id: 2, value: '1500' }];
const design = { id: 7, value: 'Стандарт' };

const basePositions = [
  { pos: '1', type: 'network' },
  { pos: '2', type: 'axis', axis_code: 'length', digits: 1 },
];

function setup(overrides = {}) {
  const props = {
    positions: basePositions,
    onPositionsChange: vi.fn(),
    lengthValues,
    lengthMap: [],
    onLengthMapChange: vi.fn(),
    designMap: [],
    onDesignMapChange: vi.fn(),
    design,
    ...overrides,
  };
  const utils = render(<CodePositionBuilder {...props} />);
  return { ...utils, props };
}

// Пропы — updater-колбэки (prev => next), компонент не хранит стейт локально:
// применяем последний вызванный updater к исходному массиву, чтобы получить результат.
const lastResult = (fn, prevArray) => fn.mock.calls[fn.mock.calls.length - 1][0](prevArray);

describe('CodePositionBuilder — превью кода', () => {
  it('собирает превью по типам позиций: network→{N}, axis:length→{Д}', () => {
    setup();
    expect(screen.getByText('{N}{Д}')).toBeInTheDocument();
  });

  it('series_digit→{С}, axis:design→{Диз}, неизвестный тип→"?"', () => {
    setup({ positions: [
      { pos: '1', type: 'series_digit' },
      { pos: '2', type: 'axis', axis_code: 'design' },
      { pos: '3', type: 'weird' },
    ] });
    expect(screen.getByText('{С}{Диз}?')).toBeInTheDocument();
  });

  it('позиции сортируются по числовому значению pos ("10" после "2")', () => {
    setup({ positions: [
      { pos: '10', type: 'series_digit' },
      { pos: '2', type: 'network' },
    ] });
    expect(screen.getByText('{N}{С}')).toBeInTheDocument();
  });
});

describe('CodePositionBuilder — позиции', () => {
  it('"+ позиция" добавляет позицию с pos = max+1 и типом network', () => {
    const { props } = setup();
    fireEvent.click(screen.getByText('+ позиция'));
    expect(lastResult(props.onPositionsChange, basePositions)).toEqual([
      ...basePositions, { pos: '3', type: 'network' },
    ]);
  });

  it('изменение типа первой позиции вызывает onPositionsChange с обновлённым type', () => {
    const { props } = setup();
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'series_digit' } });
    const next = lastResult(props.onPositionsChange, basePositions);
    expect(next.find(p => p.pos === '1').type).toBe('series_digit');
  });

  it('тип "Ось параметра" показывает доп. селекты (ось/кол-во цифр)', () => {
    setup({ positions: [{ pos: '1', type: 'axis', axis_code: 'length', digits: 2 }] });
    expect(screen.getByText('Ось...')).toBeInTheDocument();
    expect(screen.getByText('2 цифры')).toBeInTheDocument();
  });

  it('удалить позицию задизейблено, когда positions.length <= 1', () => {
    setup({ positions: [{ pos: '1', type: 'network' }] });
    const removeButton = screen.getAllByText('✕').find(b => b.tagName === 'BUTTON');
    expect(removeButton).toBeDisabled();
  });

  it('удаление позиции вызывает onPositionsChange без неё, когда позиций больше одной', () => {
    const { props } = setup();
    const removeButtons = screen.getAllByText('✕');
    fireEvent.click(removeButtons[0]);
    expect(lastResult(props.onPositionsChange, basePositions)).toEqual([basePositions[1]]);
  });
});

describe('CodePositionBuilder — маппинг длин', () => {
  it('пустой lengthMap показывает подсказку', () => {
    setup();
    expect(screen.getByText('Добавьте маппинг цифры кода → значение длины')).toBeInTheDocument();
  });

  it('"+ длина" добавляет пустую запись маппинга', () => {
    const { props } = setup();
    fireEvent.click(screen.getByText('+ длина'));
    expect(lastResult(props.onLengthMapChange, [])).toEqual([{ digit: '', valueId: '', valueLabel: '' }]);
  });

  it('выбор значения длины подставляет valueId (число) и valueLabel из lengthValues', () => {
    const map = [{ digit: '3', valueId: '', valueLabel: '' }];
    const { props } = setup({ lengthMap: map });
    const select = screen.getByText('Длина...').closest('select');
    fireEvent.change(select, { target: { value: '2' } });
    expect(lastResult(props.onLengthMapChange, map)).toEqual([{ digit: '3', valueId: 2, valueLabel: '1500' }]);
  });

  it('изменение цифры маппинга длины обновляет digit как есть (строка)', () => {
    const map = [{ digit: '', valueId: 1, valueLabel: '1000' }];
    const { props } = setup({ lengthMap: map });
    const digitInput = screen.getByPlaceholderText('3');
    fireEvent.change(digitInput, { target: { value: '9' } });
    expect(lastResult(props.onLengthMapChange, map)).toEqual([{ digit: '9', valueId: 1, valueLabel: '1000' }]);
  });

  it('удаление записи маппинга длины вызывает onLengthMapChange без неё', () => {
    const map = [{ digit: '3', valueId: 1, valueLabel: '1000' }, { digit: '4', valueId: 2, valueLabel: '1500' }];
    const { props } = setup({ lengthMap: map });
    // первые ✕ относятся к позициям (2шт: network + axis), затем к строкам маппинга длин
    const removeButtons = screen.getAllByText('✕');
    fireEvent.click(removeButtons[2]);
    expect(lastResult(props.onLengthMapChange, map)).toEqual([map[1]]);
  });
});

describe('CodePositionBuilder — маппинг дизайна', () => {
  it('"+ цифра" добавляет запись с valueId/valueLabel из пропа design', () => {
    const { props } = setup();
    fireEvent.click(screen.getByText('+ цифра'));
    expect(lastResult(props.onDesignMapChange, [])).toEqual([{ digit: '', valueId: 7, valueLabel: 'Стандарт' }]);
  });

  it('без design в новой записи valueId/valueLabel пустые, а подпись — "(дизайн из шага 2)"', () => {
    const { props } = setup({ design: null, designMap: [{ digit: '0', valueId: '', valueLabel: '' }] });
    expect(screen.getByText('(дизайн из шага 2)')).toBeInTheDocument();
    fireEvent.click(screen.getByText('+ цифра'));
    expect(lastResult(props.onDesignMapChange, [])).toEqual([{ digit: '', valueId: '', valueLabel: '' }]);
  });

  it('изменение цифры маппинга дизайна вызывает onDesignMapChange с обновлённым digit', () => {
    const map = [{ digit: '0', valueId: 7, valueLabel: 'Стандарт' }];
    const { props } = setup({ designMap: map });
    const digitInput = screen.getByPlaceholderText('0');
    fireEvent.change(digitInput, { target: { value: '5' } });
    expect(lastResult(props.onDesignMapChange, map)).toEqual([{ digit: '5', valueId: 7, valueLabel: 'Стандарт' }]);
  });

  it('удаление записи маппинга дизайна вызывает onDesignMapChange без неё', () => {
    const map = [{ digit: '0', valueId: 7, valueLabel: 'Стандарт' }, { digit: '1', valueId: 7, valueLabel: 'Стандарт' }];
    const { props } = setup({ designMap: map });
    const removeButtons = screen.getAllByText('✕');
    // первые ✕ — позиции (2шт), маппинга длин нет (пустой) — сразу маппинг дизайна
    fireEvent.click(removeButtons[2]);
    expect(lastResult(props.onDesignMapChange, map)).toEqual([map[1]]);
  });
});
