import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VariantEditorPage from '../VariantEditorPage';
import { catalogApi } from '../../api/catalog';

vi.mock('../../api/catalog', () => ({
  catalogApi: {
    productTypes: vi.fn(),
    variantFreeProducts: vi.fn(),
    variantParents: vi.fn(),
    variantFillExternalNames: vi.fn(),
    variantLink: vi.fn(),
    variantUnlink: vi.fn(),
    variantSetExternalName: vi.fn(),
  },
}));
vi.mock('../../components/common/SmartSelect', () => ({
  default: ({ placeholder, onSelect, onClear, value }) => (
    <div>
      <input placeholder={placeholder} readOnly value={value ? value.name : ''} />
      <button onClick={() => onSelect({ id: 500, name: 'Родитель X', product_type_id: 1 })}>select-parent</button>
      <button onClick={onClear}>clear-parent</button>
    </div>
  ),
}));

const ok = (data) => ({ ok: true, data });
const listOk = (items, total) => ok({ success: true, data: { items, total } });

const pt1 = { id: 1, name: 'Калорифер' };
const pt2 = { id: 2, name: 'Приточная установка' };

const parent1 = { id: 100, name: 'Родитель А', variants_count: 3 };
const parent2 = { id: 101, name: 'Родитель Б', variants_count: 0 };
const free1 = { id: 200, name: 'Изделие 1' };
const free2 = { id: 201, name: 'Изделие 2' };

beforeEach(() => {
  vi.clearAllMocks();
  catalogApi.productTypes.mockResolvedValue({ ok: true, data: [pt1, pt2] });
  catalogApi.variantParents.mockResolvedValue(listOk([], 0));
  catalogApi.variantFreeProducts.mockResolvedValue(listOk([], 0));
});

describe('VariantEditorPage — каркас/загрузка списков', () => {
  it('грузит типы продукции и рендерит их в глобальном селекторе', async () => {
    render(<VariantEditorPage onBack={vi.fn()} />);
    expect(await screen.findByText('Калорифер')).toBeInTheDocument();
    expect(screen.getByText('Приточная установка')).toBeInTheDocument();
  });

  it('loading/empty состояния для обеих колонок', async () => {
    let resolveParents;
    catalogApi.variantParents.mockReturnValue(new Promise(r => { resolveParents = r; }));
    render(<VariantEditorPage onBack={vi.fn()} />);
    expect(await screen.findByText('Загрузка...')).toBeInTheDocument();

    resolveParents(listOk([], 0));
    expect(await screen.findByText('Нет родителей')).toBeInTheDocument();
    expect(screen.getByText('Нет свободных изделий')).toBeInTheDocument();
  });

  it('рендерит строки родителей и свободных изделий с variants_count', async () => {
    catalogApi.variantParents.mockResolvedValue(listOk([parent1, parent2], 2));
    catalogApi.variantFreeProducts.mockResolvedValue(listOk([free1, free2], 2));
    render(<VariantEditorPage onBack={vi.fn()} />);
    expect(await screen.findByText('Родитель А')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Родитель Б')).toBeInTheDocument();
    expect(screen.getByText('Изделие 1')).toBeInTheDocument();
    expect(screen.getByText('Изделие 2')).toBeInTheDocument();
  });

  it('"←" вызывает onBack', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<VariantEditorPage onBack={onBack} />);
    await screen.findByText('Редактор исполнений');
    await user.click(screen.getByText('←'));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('VariantEditorPage — поиск и пагинация', () => {
  it('поиск слева/справа вызывает variantParents/variantFreeProducts с q и сбрасывает страницу', async () => {
    const user = userEvent.setup();
    render(<VariantEditorPage onBack={vi.fn()} />);
    await screen.findByText('Нет родителей');

    const searchInputs = screen.getAllByPlaceholderText('Поиск...');
    catalogApi.variantParents.mockClear();
    await user.type(searchInputs[0], 'ав');
    await waitFor(() => expect(catalogApi.variantParents).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'ав', page: 1 })
    ));

    catalogApi.variantFreeProducts.mockClear();
    await user.type(searchInputs[1], 'из');
    await waitFor(() => expect(catalogApi.variantFreeProducts).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'из', page: 1 })
    ));
  });

  it('пагинация: не рендерится при totalPages<=1, кнопки листают страницы', async () => {
    catalogApi.variantParents.mockResolvedValue(listOk([parent1], 120));
    render(<VariantEditorPage onBack={vi.fn()} />);
    await screen.findByText('Родитель А');

    expect(screen.getByText('120 изделий')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    // "←" неоднозначен: тот же символ у постоянной кнопки "Назад" в шапке
    const prevBtn = screen.getAllByText('←').find(b => b.disabled !== undefined && b.className.includes('px-2'));
    expect(prevBtn).toBeDisabled();

    const user = userEvent.setup();
    catalogApi.variantParents.mockClear();
    await user.click(screen.getByText('→'));
    await waitFor(() => expect(catalogApi.variantParents).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2 })
    ));
  });

  it('свободные изделия: пагинация не рендерится при total<=50', async () => {
    catalogApi.variantFreeProducts.mockResolvedValue(listOk([free1], 10));
    render(<VariantEditorPage onBack={vi.fn()} />);
    await screen.findByText('Изделие 1');
    expect(screen.queryByText('10 изделий')).not.toBeInTheDocument();
  });
});

describe('VariantEditorPage — глобальный фильтр типа продукции', () => {
  it('выбор типа продукции сбрасывает выбор и перезапрашивает обе колонки', async () => {
    catalogApi.variantParents.mockResolvedValue(listOk([parent1], 1));
    catalogApi.variantFreeProducts.mockResolvedValue(listOk([free1], 1));
    const user = userEvent.setup();
    render(<VariantEditorPage onBack={vi.fn()} />);
    await screen.findByText('Родитель А');
    await user.click(screen.getByText('Изделие 1'));
    expect(await screen.findByText('1 выбрано')).toBeInTheDocument();

    catalogApi.variantParents.mockClear();
    catalogApi.variantFreeProducts.mockClear();
    await user.selectOptions(screen.getByDisplayValue('Все типы продукции'), '1');

    await waitFor(() => expect(catalogApi.variantParents).toHaveBeenCalledWith(
      expect.objectContaining({ productTypeId: '1' })
    ));
    expect(catalogApi.variantFreeProducts).toHaveBeenCalledWith(
      expect.objectContaining({ productTypeId: '1' })
    );
    expect(screen.queryByText(/выбрано/)).not.toBeInTheDocument();
  });

  it('"Заполнить имена" показывается только при выбранном типе продукции', async () => {
    render(<VariantEditorPage onBack={vi.fn()} />);
    await screen.findByText('Редактор исполнений');
    expect(screen.queryByText('Заполнить имена')).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.selectOptions(screen.getByDisplayValue('Все типы продукции'), '1');
    expect(await screen.findByText('Заполнить имена')).toBeInTheDocument();
  });
});

describe('VariantEditorPage — "Заполнить имена"', () => {
  const gotoWithType = async () => {
    const user = userEvent.setup();
    render(<VariantEditorPage onBack={vi.fn()} />);
    await screen.findByText('Редактор исполнений');
    await user.selectOptions(screen.getByDisplayValue('Все типы продукции'), '1');
    await screen.findByText('Заполнить имена');
    return user;
  };

  it('confirm() отклонён — запрос не отправляется', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = await gotoWithType();
    await user.click(screen.getByText('Заполнить имена'));
    expect(catalogApi.variantFillExternalNames).not.toHaveBeenCalled();
  });

  it('успех — флеш с числом обновлённых, релоад родителей', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    catalogApi.variantFillExternalNames.mockResolvedValue(ok({ success: true, data: { updated: 4 } }));
    const user = await gotoWithType();
    catalogApi.variantParents.mockClear();
    await user.click(screen.getByText('Заполнить имена'));

    expect(await screen.findByText('✓ Обновлено: 4')).toBeInTheDocument();
    await waitFor(() => expect(catalogApi.variantParents).toHaveBeenCalled());
  });

  it('ошибка — флеш с data.error', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    catalogApi.variantFillExternalNames.mockResolvedValue({ ok: true, data: { success: false, error: 'Нет прав' } });
    const user = await gotoWithType();
    await user.click(screen.getByText('Заполнить имена'));
    expect(await screen.findByText('Нет прав')).toBeInTheDocument();
  });
});

describe('VariantEditorPage — фильтры и выбор свободных изделий', () => {
  it('чекбоксы "Проблемные"/"С исполнениями" вызывают changeExtra на родителях', async () => {
    const user = userEvent.setup();
    render(<VariantEditorPage onBack={vi.fn()} />);
    await screen.findByText('Нет родителей');

    catalogApi.variantParents.mockClear();
    await user.click(screen.getByText('Проблемные'));
    await waitFor(() => expect(catalogApi.variantParents).toHaveBeenCalledWith(
      expect.objectContaining({ problematic: true })
    ));

    catalogApi.variantParents.mockClear();
    await user.click(screen.getByText('С исполнениями'));
    await waitFor(() => expect(catalogApi.variantParents).toHaveBeenCalledWith(
      expect.objectContaining({ withVariants: true })
    ));
  });

  it('чекбокс строки выбирает изделие, бейдж "N выбрано" появляется', async () => {
    catalogApi.variantFreeProducts.mockResolvedValue(listOk([free1, free2], 2));
    const user = userEvent.setup();
    render(<VariantEditorPage onBack={vi.fn()} />);
    await screen.findByText('Изделие 1');

    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    const rowCheckbox = Array.from(checkboxes).find(cb => cb.closest('div')?.textContent?.includes('Изделие 1'));
    await user.click(rowCheckbox);
    expect(await screen.findByText('1 выбрано')).toBeInTheDocument();
  });

  it('"Выбрать все на странице" выбирает и снимает выбор со всех', async () => {
    catalogApi.variantFreeProducts.mockResolvedValue(listOk([free1, free2], 2));
    const user = userEvent.setup();
    render(<VariantEditorPage onBack={vi.fn()} />);
    await screen.findByText('Изделие 1');

    await user.click(screen.getByText('Выбрать все на странице'));
    expect(await screen.findByText('2 выбрано')).toBeInTheDocument();

    await user.click(screen.getByText('Выбрать все на странице'));
    expect(screen.queryByText(/выбрано/)).not.toBeInTheDocument();
  });
});
