import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RulePreview from '../RulePreview';

const seriesRule = {
  type: 'series', name: 'Серия КЭВ', pattern: '^КЭВ-(\\d+)П', matches_count: 2,
  axes: [{ axis_code: 'design', value_id: 5 }],
  matches: ['КЭВ-6П-01', 'КЭВ-9П-02'],
};

const lengthRule = {
  type: 'length', name: 'Длина L1000', pattern: 'L(\\d+)', matches_count: 0,
  axes: [], matches: [],
};

describe('RulePreview', () => {
  it('пустой список правил показывает заглушку', () => {
    render(<RulePreview rules={[]} />);
    expect(screen.getByText('Правила не сгенерированы')).toBeInTheDocument();
  });

  it('шапка показывает тип/название/счётчик совпадений, детали скрыты по умолчанию', () => {
    render(<RulePreview rules={[seriesRule]} />);
    expect(screen.getByText('Серия + Дизайн + IP')).toBeInTheDocument();
    expect(screen.getByText('Серия КЭВ')).toBeInTheDocument();
    expect(screen.getByText('2 совп.')).toBeInTheDocument();
    expect(screen.queryByText('Паттерн (regex):')).not.toBeInTheDocument();
  });

  it('неизвестный rule.type — fallback label и серый цвет', () => {
    render(<RulePreview rules={[{ type: 'weird', name: 'X', pattern: 'p', axes: [] }]} />);
    expect(screen.getByText('weird')).toBeInTheDocument();
  });

  it('matches_count === 0 — счётчик серый (не зелёный), клик разворачивает детали', async () => {
    const user = userEvent.setup();
    render(<RulePreview rules={[lengthRule]} />);
    expect(screen.getByText('0 совп.')).toHaveClass('text-gray-400');

    await user.click(screen.getByText('Длина L1000'));
    expect(screen.getByText('Паттерн (regex):')).toBeInTheDocument();
    expect(screen.getByText('L(\\d+)')).toBeInTheDocument();
    expect(screen.getByText('Привязывает оси:')).toBeInTheDocument();
    // matches пустой — блок "Совпадает с существующими" не рендерится
    expect(screen.queryByText(/Совпадает с существующими/)).not.toBeInTheDocument();

    await user.click(screen.getByText('Длина L1000'));
    expect(screen.queryByText('Паттерн (regex):')).not.toBeInTheDocument();
  });

  it('разворачивание показывает оси и список совпадений с "...и ещё N"', async () => {
    const user = userEvent.setup();
    const rule = { ...seriesRule, matches_count: 5, matches: ['a', 'b'] };
    render(<RulePreview rules={[rule]} />);
    await user.click(screen.getByText('Серия КЭВ'));

    expect(screen.getByText('design → #5')).toBeInTheDocument();
    expect(screen.getByText('Совпадает с существующими (5):')).toBeInTheDocument();
    expect(screen.getByText('· a')).toBeInTheDocument();
    expect(screen.getByText('· b')).toBeInTheDocument();
    expect(screen.getByText('...и ещё 3')).toBeInTheDocument();
  });

  it('pattern_error рендерится, если есть', async () => {
    const user = userEvent.setup();
    render(<RulePreview rules={[{ ...lengthRule, pattern_error: 'некорректный regex' }]} />);
    await user.click(screen.getByText('Длина L1000'));
    expect(screen.getByText('Ошибка паттерна: некорректный regex')).toBeInTheDocument();
  });

  it('итоговые счётчики: Итого/Серия/Длина считают по типу', () => {
    render(<RulePreview rules={[seriesRule, lengthRule, { ...seriesRule, name: 'Серия 2' }]} />);
    expect(screen.getByText(/Итого правил: 3/)).toBeInTheDocument();
    expect(screen.getByText(/Серия: 2/)).toBeInTheDocument();
    expect(screen.getByText(/Длина: 1/)).toBeInTheDocument();
  });
});
