import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChainOperationModal from '../ChainOperationModal';
import { catalogApi } from '../../../api/catalog';

vi.mock('../../../api/catalog', () => ({
  catalogApi: { chainAnalyze: vi.fn(), chainPlan: vi.fn(), chainApply: vi.fn(), parameterValues: vi.fn() },
}));

const axis = { id: 5, name: 'Дизайн' };
const basePlan = {
  plan_hash: 'h1', can_apply: true, requires_confirmation: false, blocking: [], warnings: [],
  edges_add: [
    { from: 1, to: 2, from_label: 'A', to_label: 'B', supported: 1 },
    { from: 3, to: 4, from_label: 'C', to_label: 'D', supported: 0 },
  ],
};
const okPlan = (p = basePlan) => ({ ok: true, status: 200, data: { success: true, data: p } });

beforeEach(() => {
  vi.clearAllMocks();
  catalogApi.chainPlan.mockResolvedValue(okPlan());
});

describe('ChainOperationModal', () => {
  it('remove: строит plan и применяет с plan_hash', async () => {
    catalogApi.chainApply.mockResolvedValue({ ok: true, status: 200, data: { success: true, data: { operation_id: 1 } } });
    const onApplied = vi.fn(), onClose = vi.fn();
    const user = userEvent.setup();
    render(<ChainOperationModal typeId={1} op="remove" axis={axis} onClose={onClose} onApplied={onApplied} />);
    await screen.findByText(/A → B/);
    expect(catalogApi.chainPlan).toHaveBeenCalledWith(1, expect.objectContaining({ op: 'remove', axis_id: 5 }));
    await user.click(screen.getByText('Применить'));
    await waitFor(() => expect(catalogApi.chainApply).toHaveBeenCalledWith(1, expect.objectContaining({ plan_hash: 'h1' })));
    expect(onApplied).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('«не создавать» для связи без товаров уходит в skip_edges повторного plan', async () => {
    const user = userEvent.setup();
    render(<ChainOperationModal typeId={1} op="remove" axis={axis} onClose={() => {}} />);
    await user.click(await screen.findByLabelText('не создавать'));
    await waitFor(() => expect(catalogApi.chainPlan).toHaveBeenLastCalledWith(1, expect.objectContaining({ skip_edges: [[3, 4]] })));
  });

  it('PLAN_CHANGED обновляет предпросмотр с пометкой и не закрывает диалог', async () => {
    catalogApi.chainApply.mockResolvedValue({
      ok: false, status: 409,
      data: { success: false, error: { code: 'PLAN_CHANGED', plan: { ...basePlan, plan_hash: 'h2', edges_add: [] } } },
    });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ChainOperationModal typeId={1} op="remove" axis={axis} onClose={onClose} />);
    await user.click(await screen.findByText('Применить'));
    expect(await screen.findByText(/Данные изменились/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('requires_confirmation блокирует «Применить» до подтверждения и шлёт confirm_losses', async () => {
    catalogApi.chainPlan.mockResolvedValue(okPlan({ ...basePlan, requires_confirmation: true }));
    catalogApi.chainApply.mockResolvedValue({ ok: true, status: 200, data: { success: true, data: {} } });
    const user = userEvent.setup();
    render(<ChainOperationModal typeId={1} op="remove" axis={axis} onClose={() => {}} />);
    await screen.findByText(/A → B/);
    expect(screen.getByText('Применить')).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /Подтверждаю потерю/ }));
    await user.click(screen.getByText('Применить'));
    await waitFor(() => expect(catalogApi.chainApply).toHaveBeenCalledWith(1, expect.objectContaining({ confirm_losses: true })));
  });

  it('can_apply=false показывает блокирующие проблемы, применить нельзя', async () => {
    catalogApi.chainPlan.mockResolvedValue(okPlan({ ...basePlan, can_apply: false, blocking: [{ code: 'product_gap', message: 'У товаров дыры' }] }));
    render(<ChainOperationModal typeId={1} op="remove" axis={axis} onClose={() => {}} />);
    expect(await screen.findByText('У товаров дыры')).toBeInTheDocument();
    expect(screen.getByText('Применить')).toBeDisabled();
  });

  it('insert: plan не строится, пока не выбрано «после оси»; null = в начало', async () => {
    catalogApi.chainAnalyze.mockResolvedValue({ ok: true, data: { success: true, data: { chain: [{ id: 7, name: 'Серия' }, axis] } } });
    const user = userEvent.setup();
    render(<ChainOperationModal typeId={1} op="insert" axis={axis} onClose={() => {}} />);
    await screen.findByRole('option', { name: 'Серия' });
    expect(catalogApi.chainPlan).not.toHaveBeenCalled();
    await user.selectOptions(screen.getByRole('combobox'), 'start');
    await waitFor(() => expect(catalogApi.chainPlan).toHaveBeenCalledWith(1, expect.objectContaining({ op: 'insert', after_axis_id: null })));
  });

  it('товар с дырой: названия осей, ручной выбор значения уходит в assign повторного plan', async () => {
    catalogApi.parameterValues.mockResolvedValue({ ok: true, data: [{ id: 91, value: 'Нержавейка' }] });
    catalogApi.chainPlan.mockResolvedValue(okPlan({
      ...basePlan, can_apply: false,
      blocking: [{ code: 'product_gap', message: 'Дыры', products: [{ id: 7, name: 'Т-1', missing: [10], missing_names: ['Материал'], hints: {} }] }],
    }));
    const user = userEvent.setup();
    render(<ChainOperationModal typeId={1} op="remove" axis={axis} onClose={() => {}} />);
    expect(await screen.findByText('Материал')).toBeInTheDocument();
    await screen.findAllByRole('option', { name: 'Нержавейка' });
    // [0] — «Для всех товаров», [1] — селект конкретного товара
    await user.selectOptions(screen.getAllByRole('combobox')[1], '91');
    await waitFor(() => expect(catalogApi.chainPlan).toHaveBeenLastCalledWith(1,
      expect.objectContaining({ assign: [{ product_id: 7, axis_id: 10, value_id: 91 }] })));
  });

  it('«Всем товарам без значения» уходит правилом assign_rules, а не списком товаров', async () => {
    catalogApi.parameterValues.mockResolvedValue({ ok: true, data: [{ id: 91, value: 'Нержавейка' }] });
    catalogApi.chainPlan.mockResolvedValue(okPlan({
      ...basePlan, can_apply: false,
      blocking: [{ code: 'product_gap', message: 'Дыры', product_count: 1200, products_truncated: true,
        products: [{ id: 7, name: 'Т-1', missing: [10], missing_names: ['Материал'] }] }],
    }));
    const user = userEvent.setup();
    render(<ChainOperationModal typeId={1} op="remove" axis={axis} onClose={() => {}} />);
    await screen.findAllByRole('option', { name: 'Нержавейка' });
    await user.selectOptions(screen.getAllByRole('combobox')[0], '91');
    await waitFor(() => expect(catalogApi.chainPlan).toHaveBeenLastCalledWith(1, expect.objectContaining({
      assign_rules: [{ axis_id: 10, value_id: 91, only_missing: true }], assign: [],
    })));
    expect(screen.getByText(/Материал = Нержавейка для всех без значения/)).toBeInTheDocument();
  });

  it('«Принять все подсказки» шлёт assign_from_hints', async () => {
    catalogApi.parameterValues.mockResolvedValue({ ok: true, data: [] });
    catalogApi.chainPlan.mockResolvedValue(okPlan({
      ...basePlan, can_apply: false,
      blocking: [{ code: 'product_gap', message: 'Дыры', product_count: 1,
        products: [{ id: 7, name: 'Т-1', missing: [10], missing_names: ['Материал'], hints: { 10: 91 } }] }],
    }));
    const user = userEvent.setup();
    render(<ChainOperationModal typeId={1} op="remove" axis={axis} onClose={() => {}} />);
    await user.click(await screen.findByText('Принять все подсказки из parameters_path'));
    await waitFor(() => expect(catalogApi.chainPlan).toHaveBeenLastCalledWith(1, expect.objectContaining({ assign_from_hints: true })));
  });

  it('старые дыры в warnings не блокируют «Применить», но доступна необязательная починка правилом', async () => {
    catalogApi.parameterValues.mockResolvedValue({ ok: true, data: [{ id: 91, value: 'Нержавейка' }] });
    catalogApi.chainPlan.mockResolvedValue(okPlan({
      ...basePlan,
      warnings: [{ code: 'product_gap', message: 'Уже было до операции: 11 товаров', extra: { preexisting: true }, product_count: 11,
        products: [{ id: 7, name: 'Т-1', missing: [10], missing_names: ['Материал'] }] }],
    }));
    const user = userEvent.setup();
    render(<ChainOperationModal typeId={1} op="remove" axis={axis} onClose={() => {}} />);
    expect(await screen.findByText(/Уже было до операции/)).toBeInTheDocument();
    expect(screen.getByText('Применить')).not.toBeDisabled();
    await screen.findAllByRole('option', { name: 'Нержавейка' });
    await user.selectOptions(screen.getAllByRole('combobox')[0], '91');
    await waitFor(() => expect(catalogApi.chainPlan).toHaveBeenLastCalledWith(1, expect.objectContaining({
      assign_rules: [{ axis_id: 10, value_id: 91, only_missing: true }],
    })));
  });
});

describe('ChainOperationModal — удаляемые связи', () => {
  it('различает stale и flip в предпросмотре', async () => {
    catalogApi.chainPlan.mockResolvedValue(okPlan({
      ...basePlan,
      edges_delete: [{ from: 1, to: 2, reason: 'stale' }, { from: 3, to: 4, reason: 'stale' }, { from: 5, to: 6, reason: 'flip' }],
    }));
    render(<ChainOperationModal typeId={1} op="remove" axis={axis} onClose={() => {}} />);
    expect(await screen.findByText('Будут удалены 2 связей между осями, которые больше не соседние')).toBeInTheDocument();
    expect(screen.getByText(/Будут развёрнуты 1 связей/)).toBeInTheDocument();
  });
});

describe('ChainOperationModal — направление ↑/↓', () => {
  const chain = [{ id: 1, name: 'A', order: 0 }, { id: 2, name: 'B', order: 1 }, { id: 3, name: 'C', order: 2 }];
  const setup = (axisId, direction) => {
    catalogApi.chainAnalyze.mockResolvedValue({ ok: true, data: { success: true, data: { chain } } });
    render(<ChainOperationModal typeId={1} op="move" axis={{ id: axisId, name: 'x' }} direction={direction} onClose={() => {}} />);
  };

  it('↑ для средней оси: after = ось, стоящая через одну выше', async () => {
    setup(3, 'up');
    await waitFor(() => expect(catalogApi.chainPlan).toHaveBeenCalledWith(1, expect.objectContaining({ after_axis_id: 1 })));
  });

  it('↑ для второй оси: в начало (after_axis_id null)', async () => {
    setup(2, 'up');
    await waitFor(() => expect(catalogApi.chainPlan).toHaveBeenCalledWith(1, expect.objectContaining({ after_axis_id: null })));
  });

  it('↓: после следующей оси', async () => {
    setup(1, 'down');
    await waitFor(() => expect(catalogApi.chainPlan).toHaveBeenCalledWith(1, expect.objectContaining({ after_axis_id: 2 })));
  });

  it('↑ у первой оси — сообщение, plan не строится', async () => {
    setup(1, 'up');
    expect(await screen.findByText('Ось уже первая в цепочке')).toBeInTheDocument();
    expect(catalogApi.chainPlan).not.toHaveBeenCalled();
  });
});
