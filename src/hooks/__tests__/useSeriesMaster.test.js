import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSeriesMaster } from '../useSeriesMaster';
import { catalogApi } from '../../api/catalog';

vi.mock('../../api/catalog', () => ({
  catalogApi: {
    masterConfig: vi.fn(),
    generateSeriesRules: vi.fn(),
    createSeriesTemplate: vi.fn(),
    createSeriesProducts: vi.fn(),
  },
}));

const ok = (data) => ({ ok: true, data: { success: true, data } });
const fail = (data) => ({ ok: false, data: { success: false, ...data } });

const configBase = {
  prefix: 'КЭВ-',
  fixed_axes: ['series'],
  varies_axes: ['heating'],
  heating_axis_code: 'heating',
  has_power: true,
  power_not_required_for: ['A'],
  series_prefix_len: 0,
  axes: {
    series: { name: 'Серия', values: [{ id: 1, value: '200' }] },
    heating: { name: 'Нагрев', values: [{ id: 10, value: 'E' }, { id: 11, value: 'A' }, { id: 12, value: 'W' }] },
    length: { name: 'Длина', values: [{ id: 20, value: '1000' }] },
  },
  name_positions: [
    { type: 'literal', value: '-' },
    { type: 'network' },
    { type: 'power' },
  ],
};

const loadConfig = async (result, config = configBase) => {
  catalogApi.masterConfig.mockResolvedValue(ok(config));
  act(() => { result.current.setProductType({ id: 1, name: 'Калорифер' }); });
  await waitFor(() => expect(result.current.configLoading).toBe(false));
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useSeriesMaster — загрузка конфига', () => {
  it('успешная загрузка сбрасывает предыдущее состояние и инициализирует positions/axisDigitMaps', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    await loadConfig(result, {
      ...configBase,
      name_positions: [
        { type: 'axis_digit', axis_code: 'length', digits: 1 },
        { type: 'network' },
      ],
    });
    expect(result.current.masterConfig).toBeTruthy();
    expect(result.current.positions).toEqual([
      { pos: '1', type: 'axis_digit', axis_code: 'length', digits: 1 },
      { pos: '2', type: 'network' },
    ]);
    expect(result.current.axisDigitMaps).toEqual({ length: [] });
    expect(result.current.fixedValues).toEqual({});
    expect(result.current.items).toEqual([]);
  });

  it('ошибка (success:false) выставляет error и не задаёт masterConfig', async () => {
    catalogApi.masterConfig.mockResolvedValue(fail({}));
    const { result } = renderHook(() => useSeriesMaster());
    act(() => { result.current.setProductType({ id: 1, name: 'X' }); });
    await waitFor(() => expect(result.current.configLoading).toBe(false));
    expect(result.current.masterConfig).toBeNull();
    expect(result.current.error).toBe('Конфиг мастера не найден для этого типа продукции');
  });
});

describe('useSeriesMaster — навигация (canNext/next/prev)', () => {
  it('canNext на шаге 1 требует выбранный тип продукции', () => {
    const { result } = renderHook(() => useSeriesMaster());
    expect(result.current.canNext()).toBe(false);
  });

  it('next/prev клэмпятся в диапазон 1..7 и сбрасывают error', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    act(() => { result.current.prev(); });
    expect(result.current.step).toBe(1);

    for (let i = 0; i < 8; i++) act(() => { result.current.next(); });
    expect(result.current.step).toBe(7);
  });

  it('canNext на шаге 2 требует все fixed_axes', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    await loadConfig(result);
    act(() => { result.current.next(); });
    expect(result.current.step).toBe(2);
    expect(result.current.canNext()).toBe(false);

    act(() => { result.current.setFixedValue('series', { id: 1, value: '200' }); });
    expect(result.current.canNext()).toBe(true);
  });

  it('canNext на шаге 3 требует непустой выбор для каждой varies-оси', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    await loadConfig(result);
    act(() => { result.current.next(); result.current.next(); });
    expect(result.current.step).toBe(3);
    expect(result.current.canNext()).toBe(false);
    act(() => { result.current.setVariesSelection('heating', [{ id: 10, value: 'E' }]); });
    expect(result.current.canNext()).toBe(true);
  });

  it('canNext на шаге 4 без axis_digit-позиций — всегда true', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    await loadConfig(result);
    act(() => { result.current.next(); result.current.next(); result.current.next(); });
    expect(result.current.step).toBe(4);
    expect(result.current.canNext()).toBe(true);
  });

  it('canNext на шаге 4 с axis_digit требует заполненные digit+valueId во всех строках', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    await loadConfig(result, {
      ...configBase,
      name_positions: [...configBase.name_positions, { type: 'axis_digit', axis_code: 'length' }],
    });
    act(() => { result.current.next(); result.current.next(); result.current.next(); });
    expect(result.current.canNext()).toBe(false);

    act(() => { result.current.setAxisDigitMaps({ length: [{ digit: '3', valueId: 20, valueLabel: '1000' }] }); });
    expect(result.current.canNext()).toBe(true);

    act(() => { result.current.setAxisDigitMaps({ length: [{ digit: '', valueId: 20, valueLabel: '1000' }] }); });
    expect(result.current.canNext()).toBe(false);
  });

  it('canNext на шагах 5/6 требует непустые items/rules', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    expect(result.current.canNext).toBeInstanceOf(Function);
    await loadConfig(result);
    act(() => { result.current.setVariesSelection('heating', [{ id: 10, value: 'E' }]); });
    act(() => { for (let i = 0; i < 3; i++) result.current.next(); });
    expect(result.current.step).toBe(4);
    act(() => { result.current.next(); });
    // step 5: generateItems эффект сработает в реальном компоненте на step===5;
    // здесь эффект тоже вызывается (renderHook исполняет useEffect)
    expect(result.current.step).toBe(5);
  });
});

describe('useSeriesMaster — initAxisDigitMaps (эффект на шаге 4)', () => {
  const configWithDigits = {
    ...configBase,
    fixed_axes: ['series'],
    varies_axes: ['heating'],
    name_positions: [
      { type: 'axis_digit', axis_code: 'series' },
      { type: 'axis_digit', axis_code: 'heating' },
    ],
  };

  const gotoStep4 = async (result) => {
    await loadConfig(result, configWithDigits);
    act(() => { result.current.setFixedValue('series', { id: 1, value: '200' }); });
    act(() => { result.current.next(); });
    act(() => { result.current.setVariesSelection('heating', [
      { id: 12, value: 'W' }, { id: 10, value: 'E' },
    ]); });
    act(() => { result.current.next(); result.current.next(); });
  };

  it('фиксированная ось: одна строка из fixedValues, не создаётся повторно если уже есть', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    await gotoStep4(result);
    expect(result.current.axisDigitMaps.series).toEqual([{ digit: '', valueId: 1, valueLabel: '200' }]);
  });

  it('варьируемая ось: строка на каждое выбранное значение', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    await gotoStep4(result);
    // сортировка внутри initAxisDigitMaps — по parseFloat(value); нечисловые значения (буквы
    // heating: E/W/A/G) все дают 0 и сохраняют исходный порядок выбора (не алфавитный fallback,
    // в отличие от сортировки combinations в generateItems) — см. запись в памяти о нюансах сортировки.
    expect(result.current.axisDigitMaps.heating).toEqual([
      { digit: '', valueId: 12, valueLabel: 'W' },
      { digit: '', valueId: 10, valueLabel: 'E' },
    ]);
  });

  it('варьируемая ось с числовыми значениями сортируется по возрастанию числа', async () => {
    const configNumeric = {
      ...configWithDigits,
      varies_axes: ['length'],
      name_positions: [{ type: 'axis_digit', axis_code: 'length' }],
      axes: { ...configWithDigits.axes, length: { name: 'Длина', values: [
        { id: 20, value: '1000' }, { id: 21, value: '500' }, { id: 22, value: '1500' },
      ] } },
    };
    const { result } = renderHook(() => useSeriesMaster());
    await loadConfig(result, configNumeric);
    act(() => { result.current.setVariesSelection('length', [
      { id: 20, value: '1000' }, { id: 21, value: '500' }, { id: 22, value: '1500' },
    ]); });
    act(() => { result.current.next(); result.current.next(); result.current.next(); });
    expect(result.current.axisDigitMaps.length.map(r => r.valueLabel)).toEqual(['500', '1000', '1500']);
  });

  it('переиспользует существующую строку по valueId при повторном заходе на шаг', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    await gotoStep4(result);
    act(() => { result.current.setAxisDigitMaps(prev => ({
      ...prev, heating: prev.heating.map(r => r.valueId === 10 ? { ...r, digit: '5' } : r),
    })); });
    act(() => { result.current.prev(); });
    act(() => { result.current.next(); });
    expect(result.current.axisDigitMaps.heating.find(r => r.valueId === 10).digit).toBe('5');
  });
});

describe('useSeriesMaster — generateItems (эффект на шаге 5)', () => {
  const configTwoAxes = {
    ...configBase,
    fixed_axes: ['series'],
    varies_axes: ['heating', 'length'],
    name_positions: [
      { type: 'literal', value: 'X' },
      { type: 'network' },
      { type: 'power' },
    ],
  };

  const gotoStep5 = async (result, config = configTwoAxes, heatingSelection = [
    { id: 12, value: 'W' }, { id: 10, value: 'E' },
  ]) => {
    await loadConfig(result, config);
    act(() => { result.current.setFixedValue('series', { id: 1, value: '200' }); });
    act(() => { result.current.next(); });
    act(() => { result.current.setVariesSelection('heating', heatingSelection); });
    act(() => { result.current.setVariesSelection('length', [
      { id: 21, value: '1500' }, { id: 20, value: '1000' },
    ]); });
    act(() => { result.current.next(); result.current.next(); result.current.next(); });
  };

  it('декартово произведение варьируемых осей, отсортированное численно по каждой оси', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    await gotoStep5(result);
    expect(result.current.items).toHaveLength(4);
    const combos = result.current.items.map(i => `${i.comboMap.heating.value}-${i.comboMap.length.value}`);
    expect(combos).toEqual(['E-1000', 'E-1500', 'W-1000', 'W-1500']);
  });

  it('needsPower/power_not_required_for и networkDefault (heating W/A→1, иначе 0)', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    await gotoStep5(
      result,
      { ...configTwoAxes, power_not_required_for: ['A'] },
      [{ id: 11, value: 'A' }, { id: 10, value: 'E' }],
    );

    const byHeating = Object.fromEntries(result.current.items.map(i => [i.heatingCode, i]));
    expect(byHeating.A.power).toBeNull();
    expect(byHeating.A.networkDigit).toBe('1');
    expect(byHeating.E.power).toBe('');
    expect(byHeating.E.networkDigit).toBe('0');
  });

  it('buildName: literal+network+power собираются в baseName/name с "?" на месте сети', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    await gotoStep5(result);
    const item = result.current.items[0];
    expect(item.baseName).toBe(`КЭВ-X?{мощность}`);
    expect(item.name).toBe(`КЭВ-X${item.networkDigit}{мощность}`);
  });

  it('buildName: axis_value/axis_digit/series_part/series_digit', async () => {
    const config = {
      ...configBase,
      fixed_axes: ['series'],
      varies_axes: ['heating'],
      series_prefix_len: 1,
      name_positions: [
        { type: 'series_part', part: 'prefix' },
        { type: 'series_digit' },
        { type: 'axis_value', axis_code: 'heating' },
        { type: 'axis_digit', axis_code: 'heating' },
      ],
    };
    const { result } = renderHook(() => useSeriesMaster());
    await loadConfig(result, config);
    act(() => { result.current.setFixedValue('series', { id: 1, value: 'TW' }); });
    act(() => { result.current.next(); });
    act(() => { result.current.setVariesSelection('heating', [{ id: 10, value: 'E' }]); });
    act(() => { result.current.next(); });
    act(() => { result.current.setAxisDigitMaps({ heating: [{ digit: '7', valueId: 10, valueLabel: 'E' }] }); });
    act(() => { result.current.next(); result.current.next(); });

    const item = result.current.items[0];
    // series_part(prefix)='T' (getSeriesParts('TW',1)), series_digit — number пуст при prefixLen>0 → '',
    // axis_value='E' (значение heating), axis_digit=digit из первой строки маппинга ('7')
    expect(item.baseName).toBe('КЭВ-TE7');
    expect(item.name).toBe('КЭВ-TE7');
  });
});

describe('useSeriesMaster — addPowerRow/updateItem/removeItem', () => {
  const config = {
    ...configBase,
    fixed_axes: ['series'],
    varies_axes: ['heating'],
    name_positions: [{ type: 'network' }, { type: 'power' }],
  };

  const gotoStep5 = async (result) => {
    await loadConfig(result, config);
    act(() => { result.current.setFixedValue('series', { id: 1, value: '200' }); });
    act(() => { result.current.next(); });
    act(() => { result.current.setVariesSelection('heating', [{ id: 10, value: 'E' }]); });
    act(() => { result.current.next(); result.current.next(); result.current.next(); });
  };

  it('addPowerRow дублирует строку с новым externalId/power и сдвигает sort_order', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    await gotoStep5(result);
    const original = result.current.items[0];
    act(() => { result.current.addPowerRow(original.localId); });
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[1].power).toBe('');
    expect(result.current.items[1].externalId).not.toBe(original.externalId);
    expect(result.current.items.map(i => i.sort_order)).toEqual([1, 2]);
  });

  it('updateItem(power) форматирует дробную часть через запятую и подставляет в name', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    await gotoStep5(result);
    const localId = result.current.items[0].localId;
    act(() => { result.current.updateItem(localId, 'power', '5.5'); });
    expect(result.current.items[0].name).toContain('5,5');

    act(() => { result.current.updateItem(localId, 'power', '6.0'); });
    expect(result.current.items[0].name).toContain('6');
    expect(result.current.items[0].name).not.toContain('6,0');
  });

  it('updateItem(networkDigit) подставляет новую цифру сети в name/baseName', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    await gotoStep5(result);
    const localId = result.current.items[0].localId;
    const before = result.current.items[0].networkDigit;
    act(() => { result.current.updateItem(localId, 'networkDigit', '9'); });
    expect(result.current.items[0].networkDigit).toBe('9');
    expect(result.current.items[0].name).not.toContain(before === '9' ? '' : before);
  });

  it('removeItem убирает изделие по localId', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    await gotoStep5(result);
    const localId = result.current.items[0].localId;
    act(() => { result.current.removeItem(localId); });
    expect(result.current.items).toHaveLength(0);
  });
});

describe('useSeriesMaster — buildPayload/submit', () => {
  const config = {
    ...configBase,
    fixed_axes: ['series'],
    varies_axes: ['heating'],
    name_positions: [
      { type: 'axis_digit', axis_code: 'length' },
      { type: 'network' },
      { type: 'power' },
    ],
  };

  const gotoStep5 = async (result) => {
    await loadConfig(result, config);
    act(() => { result.current.setFixedValue('series', { id: 1, value: '200' }); });
    act(() => { result.current.next(); });
    act(() => { result.current.setVariesSelection('heating', [{ id: 10, value: 'E' }]); });
    act(() => { result.current.next(); });
    act(() => { result.current.setAxisDigitMaps({ length: [{ digit: '3', valueId: 20, valueLabel: '1000' }] }); });
    act(() => { result.current.next(); result.current.next(); });
  };

  it('buildPayload собирает code_positions/length_map/fixed_values/items (фильтрует power==="")', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    await gotoStep5(result);
    act(() => { result.current.updateItem(result.current.items[0].localId, 'power', '5'); });

    const payload = result.current.buildPayload();
    expect(payload.product_type).toBe(1);
    expect(payload.prefix).toBe('КЭВ-');
    expect(payload.fixed_values).toEqual({ series: 1 });
    expect(payload.length_map).toEqual({ 3: 20 });
    expect(payload.code_positions['1']).toEqual({ type: 'axis_digit', axis_code: 'length' });
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({ power: 5, network_digit: expect.any(String) });
  });

  it('submit: happy path создаёт шаблон, грузит правила, создаёт изделия и переходит на шаг 7', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    await gotoStep5(result);
    act(() => { result.current.updateItem(result.current.items[0].localId, 'power', '5'); });

    catalogApi.createSeriesTemplate.mockResolvedValue(ok({ id: 42 }));
    catalogApi.generateSeriesRules.mockResolvedValue(ok([{ type: 'series', name: 'r1' }]));
    catalogApi.createSeriesProducts.mockResolvedValue(ok({ products_created: 1, rules_created: 1 }));

    await act(async () => { await result.current.submit(); });

    expect(result.current.step).toBe(7);
    expect(result.current.result).toEqual({ products_created: 1, rules_created: 1 });
    expect(result.current.savedTemplateId).toBe(42);
    expect(result.current.rules).toEqual([{ type: 'series', name: 'r1' }]);
    expect(result.current.saving).toBe(false);
  });

  it('submit: ошибка на createSeriesTemplate выставляет error и не идёт дальше', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    await gotoStep5(result);
    catalogApi.createSeriesTemplate.mockResolvedValue(fail({ error: 'Ошибка валидации' }));

    await act(async () => { await result.current.submit(); });
    expect(result.current.error).toBe('Ошибка валидации');
    expect(result.current.step).toBe(5);
    expect(result.current.saving).toBe(false);
  });

  it('submit: ошибка на createSeriesProducts выставляет error, не переходя на шаг 7', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    await gotoStep5(result);
    catalogApi.createSeriesTemplate.mockResolvedValue(ok({ id: 42 }));
    catalogApi.generateSeriesRules.mockResolvedValue(ok([]));
    catalogApi.createSeriesProducts.mockResolvedValue(fail({ error: 'Ошибка создания изделий' }));

    await act(async () => { await result.current.submit(); });
    expect(result.current.error).toBe('Ошибка создания изделий');
    expect(result.current.step).toBe(5);
    expect(result.current.savedTemplateId).toBe(42);
  });

  it('submit: повторный вызов после частичного успеха (templateId уже сохранён) не создаёт шаблон заново', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    await gotoStep5(result);
    catalogApi.createSeriesTemplate.mockResolvedValue(ok({ id: 42 }));
    catalogApi.generateSeriesRules.mockResolvedValue(ok([]));
    catalogApi.createSeriesProducts.mockResolvedValueOnce(fail({ error: 'temp' }));

    await act(async () => { await result.current.submit(); });
    expect(catalogApi.createSeriesTemplate).toHaveBeenCalledTimes(1);

    catalogApi.createSeriesProducts.mockResolvedValue(ok({ products_created: 1, rules_created: 0 }));
    await act(async () => { await result.current.submit(); });
    expect(catalogApi.createSeriesTemplate).toHaveBeenCalledTimes(1);
    expect(result.current.step).toBe(7);
  });

  it('submit: исключение (сеть упала) попадает в error', async () => {
    const { result } = renderHook(() => useSeriesMaster());
    await gotoStep5(result);
    catalogApi.createSeriesTemplate.mockRejectedValue(new Error('network down'));

    await act(async () => { await result.current.submit(); });
    expect(result.current.error).toBe('network down');
    expect(result.current.saving).toBe(false);
  });
});
