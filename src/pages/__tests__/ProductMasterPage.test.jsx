import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductMasterPage from '../ProductMasterPage';
import { catalogApi } from '../../api/catalog';

vi.mock('../../api/catalog', () => ({
  catalogApi: {
    productTypes: vi.fn(),
    masterConfig: vi.fn(),
    generateSeriesRules: vi.fn(),
    createSeriesTemplate: vi.fn(),
    createSeriesProducts: vi.fn(),
  },
}));

const ok = (data) => ({ ok: true, data: { success: true, data } });
const fail = (data) => ({ ok: false, data: { success: false, ...data } });

const pt1 = { id: 1, name: 'Калорифер' };
const pt2 = { id: 2, name: 'Приточная установка' };

const masterConfig = {
  prefix: 'КЭВ-',
  fixed_axes: ['series'],
  varies_axes: ['heating'],
  heating_axis_code: 'heating',
  has_power: true,
  power_not_required_for: ['A'],
  series_prefix_len: 0,
  axes: {
    series: { name: 'Серия', values: [{ id: 1, value: '200' }] },
    heating: { name: 'Нагрев', values: [{ id: 10, value: 'E' }, { id: 11, value: 'A' }] },
  },
  name_positions: [{ type: 'axis_digit', axis_code: 'heating', digits: 1 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  catalogApi.productTypes.mockResolvedValue({ ok: true, data: { results: [pt1, pt2] } });
  catalogApi.masterConfig.mockResolvedValue(ok(masterConfig));
});

// Шаг-индикатор в шапке — единственный <span> с классом "hidden sm:inline" с данным текстом,
// стиль активности висит на обёртывающем div, а не на самом span.
const stepBadge = (label) => screen.getByText(label, { selector: '.hidden.sm\\:inline' }).parentElement;

describe('ProductMasterPage — шапка визарда', () => {
  it('первый шаг активен, остальные — обычные (не пройдены)', async () => {
    render(<ProductMasterPage onBack={vi.fn()} />);
    await screen.findByText('Калорифер');
    expect(stepBadge('Тип продукции')).toHaveClass('bg-blue-600');
    expect(stepBadge('Параметры серии')).not.toHaveClass('bg-blue-600');
  });

  it('"Отмена" на первом шаге вызывает onBack', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<ProductMasterPage onBack={onBack} />);
    await user.click(await screen.findByText('Отмена'));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('ProductMasterPage — Step1 (тип продукции)', () => {
  it('поддерживает оба формата ответа productTypes: {results} и голый массив', async () => {
    render(<ProductMasterPage onBack={vi.fn()} />);
    expect(await screen.findByText('Калорифер')).toBeInTheDocument();
    expect(screen.getByText('Приточная установка')).toBeInTheDocument();

    catalogApi.productTypes.mockResolvedValue({ ok: true, data: [pt1] });
    // повторный маунт с "голым" массивом
    const { unmount } = render(<ProductMasterPage onBack={vi.fn()} />);
    expect(await screen.findAllByText('Калорифер')).not.toHaveLength(0);
    unmount();
  });

  it('выбор типа продукции показывает индикатор загрузки конфига, затем успех', async () => {
    let resolveConfig;
    catalogApi.masterConfig.mockReturnValue(new Promise(r => { resolveConfig = r; }));
    const user = userEvent.setup();
    render(<ProductMasterPage onBack={vi.fn()} />);
    const select = await screen.findByDisplayValue('Выберите...');
    await user.selectOptions(select, '1');

    expect(await screen.findByText('Загрузка конфига мастера...')).toBeInTheDocument();
    resolveConfig(ok(masterConfig));

    expect(await screen.findByText(/Конфиг загружен: КЭВ-/)).toBeInTheDocument();
    expect(screen.getByText(/Фиксированные оси: series/)).toBeInTheDocument();
    expect(screen.getByText(/Варьируемые: heating/)).toBeInTheDocument();
  });

  it('конфиг не настроен для типа продукции показывает сообщение', async () => {
    catalogApi.masterConfig.mockResolvedValue(fail({}));
    const user = userEvent.setup();
    render(<ProductMasterPage onBack={vi.fn()} />);
    const select = await screen.findByDisplayValue('Выберите...');
    await user.selectOptions(select, '1');
    expect(await screen.findByText('Конфиг мастера не настроен для этого типа продукции')).toBeInTheDocument();
  });
});

describe('ProductMasterPage — Step2 (фиксированные параметры)', () => {
  const gotoStep2 = async () => {
    const user = userEvent.setup();
    render(<ProductMasterPage onBack={vi.fn()} />);
    const select = await screen.findByDisplayValue('Выберите...');
    await user.selectOptions(select, '1');
    await screen.findByText(/Конфиг загружен/);
    await user.click(screen.getByText('Далее →'));
    return user;
  };

  it('рендерит select для каждой fixed-оси, "Далее" задизейблена без выбора', async () => {
    await gotoStep2();
    expect(screen.getByText('Серия *')).toBeInTheDocument();
    expect(screen.getByText('Далее →')).toBeDisabled();
  });

  it('выбор значения включает "Далее"', async () => {
    const user = await gotoStep2();
    const select = screen.getByDisplayValue('Выберите...');
    await user.selectOptions(select, '1');
    expect(screen.getByText('Далее →')).toBeEnabled();
  });

  it('ось не найдена в конфиге — сообщение об ошибке', async () => {
    catalogApi.masterConfig.mockResolvedValue(ok({ ...masterConfig, fixed_axes: ['series', 'missing'] }));
    await gotoStep2();
    expect(screen.getByText('Ось «missing» не найдена')).toBeInTheDocument();
  });

  it('"← Назад" возвращает на Step1', async () => {
    const user = await gotoStep2();
    // "← Назад" неоднозначен: тот же текст у постоянной ссылки onBack сверху страницы —
    // берём последнюю (нижнюю, навигационную кнопку визарда).
    const backButtons = screen.getAllByText('← Назад');
    await user.click(backButtons[backButtons.length - 1]);
    expect(stepBadge('Тип продукции')).toHaveClass('bg-blue-600');
  });
});

describe('ProductMasterPage — Step "Варьируемые оси" (визард-шаг 3, функция Step4)', () => {
  const gotoVaries = async () => {
    const user = userEvent.setup();
    render(<ProductMasterPage onBack={vi.fn()} />);
    const ptSelect = await screen.findByDisplayValue('Выберите...');
    await user.selectOptions(ptSelect, '1');
    await screen.findByText(/Конфиг загружен/);
    await user.click(screen.getByText('Далее →'));
    await user.selectOptions(screen.getByDisplayValue('Выберите...'), '1');
    await user.click(screen.getByText('Далее →'));
    return user;
  };

  it('мультиселект-кнопки переключают выбор, "(без мощности)" для power_not_required_for', async () => {
    const user = await gotoVaries();
    expect(screen.getByText('Далее →')).toBeDisabled();

    await user.click(screen.getByText(/^A$/));
    expect(screen.getByText('(без мощности)')).toBeInTheDocument();
    expect(screen.getByText(/Выбрано: A/)).toBeInTheDocument();
    expect(screen.getByText('Далее →')).toBeEnabled();

    await user.click(screen.getByText('E'));
    expect(screen.getByText(/Выбрано: A, E/)).toBeInTheDocument();

    // повторный клик снимает выбор
    await user.click(screen.getByText(/^A$/));
    expect(screen.queryByText(/Выбрано: A,/)).not.toBeInTheDocument();
  });
});

describe('ProductMasterPage — Step "Маппинг кода" (визард-шаг 4, функция Step3)', () => {
  const gotoMapping = async (config = masterConfig) => {
    catalogApi.masterConfig.mockResolvedValue(ok(config));
    const user = userEvent.setup();
    render(<ProductMasterPage onBack={vi.fn()} />);
    const ptSelect = await screen.findByDisplayValue('Выберите...');
    await user.selectOptions(ptSelect, '1');
    await screen.findByText(/Конфиг загружен/);
    await user.click(screen.getByText('Далее →'));
    await user.selectOptions(screen.getByDisplayValue('Выберите...'), '1');
    await user.click(screen.getByText('Далее →'));
    await user.click(screen.getByText('E'));
    await user.click(screen.getByText('Далее →'));
    return user;
  };

  it('без axis_digit-позиций показывает подсказку "не требуется"', async () => {
    await gotoMapping({ ...masterConfig, name_positions: [{ type: 'network' }] });
    expect(screen.getByText('Для этого типа продукции маппинг цифр не требуется.')).toBeInTheDocument();
  });

  it('для варьируемой оси показывает select значений, добавление/удаление строк', async () => {
    // на входе в шаг эффект initAxisDigitMaps уже создаёт одну строку под выбранное значение 'E'
    const user = await gotoMapping();
    expect(screen.getByText('Маппинг оси «Нагрев»')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('3')).toHaveLength(1);

    await user.click(screen.getByText('+ добавить'));
    const digitInputs = screen.getAllByPlaceholderText('3');
    expect(digitInputs).toHaveLength(2);
    await user.type(digitInputs[1], '7');
    expect(digitInputs[1]).toHaveValue('7');

    const valueSelects = screen.getAllByDisplayValue('Значение...');
    await user.selectOptions(valueSelects[valueSelects.length - 1], '10');
    expect(screen.getAllByDisplayValue('E')).not.toHaveLength(0);

    await user.click(screen.getAllByText('✕')[1]);
    expect(screen.getAllByPlaceholderText('3')).toHaveLength(1);
  });

  it('для фиксированной оси показывает значение как текст (без select)', async () => {
    const config = {
      ...masterConfig,
      name_positions: [{ type: 'axis_digit', axis_code: 'series' }],
    };
    // на входе в шаг для фиксированной оси уже есть одна строка с её значением
    const user = await gotoMapping(config);
    expect(screen.getByText('Маппинг оси «Серия»')).toBeInTheDocument();
    expect(screen.getAllByText('200')).toHaveLength(1);
    expect(screen.queryByDisplayValue('Значение...')).not.toBeInTheDocument();

    await user.click(screen.getByText('+ добавить'));
    expect(screen.getAllByText('200')).toHaveLength(2);
  });
});
