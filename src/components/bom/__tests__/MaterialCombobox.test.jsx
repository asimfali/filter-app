import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MaterialCombobox from '../MaterialCombobox';
import { bomApi } from '../../../api/bom';

vi.mock('../../../api/bom', () => ({
  bomApi: { getMaterialGroup: vi.fn(), trackPartUse: vi.fn(), togglePriority: vi.fn() },
}));

const row = (overrides = {}) => ({
  material_type: 'АЛР оц', thickness: 0.7, in_process: false,
  source_material_id: null, source_material_name: '', ...overrides,
});

const okList = (data) => ({ ok: true, data: { success: true, data } });

const renderCombobox = (rowOverrides = {}, props = {}) => {
  const matRefs = { current: {} };
  const onSelect = vi.fn();
  const utils = render(
    <MaterialCombobox row={row(rowOverrides)} idx={0} canWrite onSelect={onSelect} matRefs={matRefs} {...props} />
  );
  return { ...utils, onSelect, matRefs };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MaterialCombobox — фокус и первичная загрузка', () => {
  it('по фокусу грузит группу материалов по material_type/thickness и контексту assembly (in_process=false)', async () => {
    const user = userEvent.setup();
    bomApi.getMaterialGroup.mockResolvedValue(okList([{ id: 1, onec_name: 'Лист 0.7' }]));
    renderCombobox({ in_process: false });

    await user.click(screen.getByPlaceholderText('Выберите материал...'));

    expect(bomApi.getMaterialGroup).toHaveBeenCalledWith('АЛР оц', '0.7', '', 'assembly');
    expect(await screen.findByText('Лист 0.7')).toBeInTheDocument();
  });

  it('контекст detail при in_process=true', async () => {
    const user = userEvent.setup();
    bomApi.getMaterialGroup.mockResolvedValue(okList([]));
    renderCombobox({ in_process: true });
    await user.click(screen.getByPlaceholderText('Выберите материал...'));
    expect(bomApi.getMaterialGroup).toHaveBeenCalledWith('АЛР оц', '0.7', '', 'detail');
  });

  it('повторный фокус не перезапрашивает, если опции уже загружены', async () => {
    const user = userEvent.setup();
    bomApi.getMaterialGroup.mockResolvedValue(okList([{ id: 1, onec_name: 'Лист 0.7' }]));
    renderCombobox();

    await user.click(screen.getByPlaceholderText('Выберите материал...'));
    await screen.findByText('Лист 0.7');
    await user.click(document.body); // закрыть
    await user.click(screen.getByPlaceholderText('Выберите материал...')); // фокус снова

    expect(bomApi.getMaterialGroup).toHaveBeenCalledTimes(1);
  });

  it('показывает "Загрузка...", пока запрос выполняется', async () => {
    let resolveFetch;
    bomApi.getMaterialGroup.mockReturnValue(new Promise((r) => { resolveFetch = r; }));
    renderCombobox();

    fireEvent.focus(screen.getByPlaceholderText('Выберите материал...'));
    expect(await screen.findByText('Загрузка...')).toBeInTheDocument();

    resolveFetch(okList([]));
  });
});

describe('MaterialCombobox — поиск по вводу', () => {
  it('запрос от 2 символов вызывает getMaterialGroup с текстом запроса', async () => {
    const user = userEvent.setup();
    bomApi.getMaterialGroup.mockResolvedValue(okList([{ id: 2, onec_name: 'Лист 0.7 сорт2' }]));
    renderCombobox();

    await user.type(screen.getByPlaceholderText('Выберите материал...'), 'со');

    expect(bomApi.getMaterialGroup).toHaveBeenLastCalledWith('АЛР оц', '0.7', 'со', 'assembly');
    expect(await screen.findByText('Лист 0.7 сорт2')).toBeInTheDocument();
  });

  it('запрос короче 2 символов не добавляет новый вызов getMaterialGroup поверх фокус-запроса (несмотря на комментарий в коде)', async () => {
    const user = userEvent.setup();
    bomApi.getMaterialGroup.mockResolvedValue(okList([]));
    renderCombobox();
    const input = screen.getByPlaceholderText('Выберите материал...');

    await user.click(input); // сам фокус уже запрашивает группу с q=''
    expect(bomApi.getMaterialGroup).toHaveBeenCalledTimes(1);

    await user.type(input, 'с'); // handleChange по-прежнему делает ранний return при q.length<2
    expect(bomApi.getMaterialGroup).toHaveBeenCalledTimes(1);
  });

  it('displayValue приоритизирует текущий ввод над source_material_name', async () => {
    const user = userEvent.setup();
    bomApi.getMaterialGroup.mockResolvedValue(okList([]));
    renderCombobox({ source_material_name: 'Старый выбор' });

    const input = screen.getByPlaceholderText('Выберите материал...');
    expect(input).toHaveValue('Старый выбор');

    await user.type(input, 'но');
    expect(input).toHaveValue('Старый выборно');
  });
});

describe('MaterialCombobox — выбор и приоритет', () => {
  it('выбор материала вызывает onSelect(idx, part), трекает использование, сбрасывает запрос и закрывает список', async () => {
    const user = userEvent.setup();
    bomApi.getMaterialGroup.mockResolvedValue(okList([{ id: 3, onec_name: 'Лист выбранный' }]));
    const { onSelect } = renderCombobox();

    await user.click(screen.getByPlaceholderText('Выберите материал...'));
    await user.click(await screen.findByText('Лист выбранный'));

    expect(onSelect).toHaveBeenCalledWith(0, { id: 3, onec_name: 'Лист выбранный' });
    expect(bomApi.trackPartUse).toHaveBeenCalledWith(3);
    expect(screen.queryByText('Лист выбранный')).not.toBeInTheDocument();
  });

  it('клик "Загрузка..." (id=__loading__) не вызывает onSelect', async () => {
    let resolveFetch;
    bomApi.getMaterialGroup.mockReturnValue(new Promise((r) => { resolveFetch = r; }));
    const { onSelect } = renderCombobox();

    fireEvent.focus(screen.getByPlaceholderText('Выберите материал...'));
    fireEvent.mouseDown(await screen.findByText('Загрузка...'));

    expect(onSelect).not.toHaveBeenCalled();
    resolveFetch(okList([]));
  });

  it('звезда переключает priority локально без повторного запроса группы', async () => {
    const user = userEvent.setup();
    bomApi.getMaterialGroup.mockResolvedValue(okList([{ id: 4, onec_name: 'Лист', priority: 0 }]));
    bomApi.togglePriority.mockResolvedValue({});
    renderCombobox();

    await user.click(screen.getByPlaceholderText('Выберите материал...'));
    await screen.findByText('Лист');

    await user.click(screen.getByTitle('В избранное'));

    expect(bomApi.togglePriority).toHaveBeenCalledWith(4);
    expect(await screen.findByTitle('Убрать из избранного')).toBeInTheDocument();
    expect(bomApi.getMaterialGroup).toHaveBeenCalledTimes(1); // без повторного запроса
  });
});

describe('MaterialCombobox — визуальные и закрывающие поведения', () => {
  it('подсвечивает поле амбером, если есть thickness, но не выбран source_material', () => {
    renderCombobox({ thickness: 1, source_material_id: null });
    expect(screen.getByPlaceholderText('Выберите материал...').className).toContain('border-amber-400');
  });

  it('не подсвечивает, если source_material уже выбран', () => {
    renderCombobox({ thickness: 1, source_material_id: 9 });
    expect(screen.getByPlaceholderText('Выберите материал...').className).not.toContain('border-amber-400');
  });

  it('disabled, когда canWrite=false', () => {
    renderCombobox({}, { canWrite: false });
    expect(screen.getByPlaceholderText('Выберите материал...')).toBeDisabled();
  });

  it('клик снаружи закрывает список', async () => {
    const user = userEvent.setup();
    bomApi.getMaterialGroup.mockResolvedValue(okList([{ id: 1, onec_name: 'Лист' }]));
    renderCombobox();

    await user.click(screen.getByPlaceholderText('Выберите материал...'));
    expect(await screen.findByText('Лист')).toBeInTheDocument();

    await user.click(document.body);
    expect(screen.queryByText('Лист')).not.toBeInTheDocument();
  });

  it('регистрирует input в matRefs.current[idx] (на рендер позже — ref коммитится после рендера, где присвоение читается)', () => {
    // matRefs, кстати, нигде не читается в MaterialsPanel — прокидывается, но не
    // используется; сама регистрация всё равно наблюдаема, тестируем как есть
    const { matRefs, rerender } = renderCombobox();
    expect(matRefs.current[0]).toBeUndefined();

    rerender(<MaterialCombobox row={row()} idx={0} canWrite onSelect={vi.fn()} matRefs={matRefs} />);
    expect(matRefs.current[0]).toBe(screen.getByPlaceholderText('Выберите материал...'));
  });
});
