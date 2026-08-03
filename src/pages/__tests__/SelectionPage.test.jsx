import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SelectionPage from '../SelectionPage';
import { selectionApi } from '../../api/selection';
import { useAuth } from '../../contexts/AuthContext';

vi.mock('../../api/selection', () => ({
    selectionApi: {
        formData: vi.fn(),
        allOptions: vi.fn(),
        getConfig: vi.fn(),
        availableOptions: vi.fn(),
        calculate: vi.fn(),
        nearestRegion: vi.fn(),
        accessories: vi.fn(),
        proposal: vi.fn(),
        proposalsCreate: vi.fn(),
        proposalsUpdate: vi.fn(),
    },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../components/common/SmartSelect', () => ({
    default: ({ placeholder, onSelect, onClear, value }) => (
        <div>
            <input placeholder={placeholder} readOnly value={value ? value.name : ''} />
            <button onClick={() => onSelect({ id: 5, name: 'Санкт-Петербург', tn: -26, V: 4.8 })}>select-region</button>
            <button onClick={onClear}>clear-region</button>
        </div>
    ),
}));
vi.mock('../../components/selection/ProposalsPanel', () => ({
    default: ({ open, onClose, onRestore }) => (open ? (
        <div data-testid="proposals-panel-stub">
            <button onClick={onClose}>close-proposals</button>
            <button onClick={() => onRestore({
                id: 55,
                proposal_number: 'П-55',
                customer: 'ООО Ромашка',
                params: {
                    heat_type: 'W', install_type: 'BO', ip: 54, h: 3, b: 4,
                    tn: -25, tv: 16, V: 4, tsm: 0, Tpr: 60, optimize: true,
                    _region: { id: 9, name: 'Москва', tn: -25, V: 4 },
                },
            })}>restore-proposal</button>
        </div>
    ) : null),
}));

const ok = (data) => ({ ok: true, data });

const heatingValues = [
    { id: 1, value: 'E' },
    { id: 2, value: 'W' },
    { id: 3, value: 'G' },
    { id: 4, value: 'A' },
];
const ipValues = [
    { id: 1, value: 'IP21' },
    { id: 2, value: 'IP54' },
    { id: 3, value: 'IP44' }, // должен быть отфильтрован (не 21/54)
];
const standardOpenings = [
    { id: 1, name: 'Стандарт 1', h: 2.5, b: 2 },
];

beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    useAuth.mockReturnValue({ user: { id: 1 } });
    selectionApi.formData.mockResolvedValue(ok({
        success: true,
        data: { heating_values: heatingValues, ip_values: ipValues, standard_openings: standardOpenings },
    }));
    selectionApi.allOptions.mockResolvedValue(ok({
        success: true,
        data: { all_series: ['ВО', 'КЭВ'], all_designs: ['Design1', 'Design2'] },
    }));
    selectionApi.getConfig.mockResolvedValue(ok({
        success: true,
        data: { excluded_designs: [], excluded_series: [] },
    }));
});

describe('SelectionPage — загрузка формы', () => {
    it('грузит и рендерит источники тепла/IP/типовые проёмы', async () => {
        render(<SelectionPage />);
        expect(await screen.findByText('Электро')).toBeInTheDocument();
        expect(screen.getByText('Вода')).toBeInTheDocument();
        expect(screen.getByText('Газ')).toBeInTheDocument();
        expect(screen.getByText('Без нагрева')).toBeInTheDocument();

        expect(screen.getByText('IP21')).toBeInTheDocument();
        expect(screen.getByText('IP54')).toBeInTheDocument();
        expect(screen.queryByText('IP44')).not.toBeInTheDocument();

        expect(screen.getByText('Стандарт 1')).toBeInTheDocument();
    });

    it('клик по типовому проёму подставляет h/b', async () => {
        const user = userEvent.setup();
        render(<SelectionPage />);
        const preset = await screen.findByText('Стандарт 1');
        await user.click(preset);
        // h/b подставлены — проверяем через инпуты с их значениями (числовые инпуты)
        const numberInputs = document.querySelectorAll('input[type="number"]');
        const values = Array.from(numberInputs).map(i => i.value);
        expect(values).toContain('2.5');
        expect(values).toContain('2');
    });
});

describe('SelectionPage — температурные предупреждения', () => {
    it('показывает ошибку и блокирует submit при tn >= tv', async () => {
        const user = userEvent.setup();
        render(<SelectionPage />);
        await screen.findByText('Электро');
        const inputs = document.querySelectorAll('input[type="number"]');
        // Порядок полей: h, b, tn, tv, V (по разметке формы)
        const [, , tnInp, tvInp] = inputs;
        await user.clear(tnInp); await user.type(tnInp, '20');
        await user.clear(tvInp); await user.type(tvInp, '10');

        expect(await screen.findByText('Расчёт охлаждения не поддерживается (Tн ≥ Tв)')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Подобрать завесы/ })).toBeDisabled();
    });

    it('показывает рекомендацию без источника тепла при малой разнице температур', async () => {
        const user = userEvent.setup();
        render(<SelectionPage />);
        await screen.findByText('Электро');
        const inputs = document.querySelectorAll('input[type="number"]');
        const [, , tnInp, tvInp] = inputs;
        await user.clear(tnInp); await user.type(tnInp, '8');
        await user.clear(tvInp); await user.type(tvInp, '10');

        expect(await screen.findByText('Рекомендуется завеса без источника тепла')).toBeInTheDocument();
    });
});

describe('SelectionPage — регион и координаты', () => {
    it('выбор региона через SmartSelect подставляет tn/V', async () => {
        const user = userEvent.setup();
        render(<SelectionPage />);
        await screen.findByText('Электро');
        await user.click(screen.getByText('select-region'));

        const inputs = document.querySelectorAll('input[type="number"]');
        const values = Array.from(inputs).map(i => i.value);
        expect(values).toContain('-26');
        expect(values).toContain('4.8');
    });

    it('поиск по координатам: неверный формат', async () => {
        const user = userEvent.setup();
        render(<SelectionPage />);
        await screen.findByText('Электро');
        const coordInput = screen.getByPlaceholderText('59.9390, 30.3139');
        await user.type(coordInput, 'непонятно');
        await user.click(screen.getByText('Найти город'));
        expect(await screen.findByText('Введите координаты: 59.9390, 30.3139')).toBeInTheDocument();
        expect(selectionApi.nearestRegion).not.toHaveBeenCalled();
    });

    it('поиск по координатам: успех подставляет регион и очищает поле', async () => {
        const user = userEvent.setup();
        selectionApi.nearestRegion.mockResolvedValue(ok({ success: true, data: { id: 9, name: 'Москва', tn: -25, V: 5 } }));
        render(<SelectionPage />);
        await screen.findByText('Электро');
        const coordInput = screen.getByPlaceholderText('59.9390, 30.3139');
        await user.type(coordInput, '55.75, 37.61');
        await user.click(screen.getByText('Найти город'));

        await waitFor(() => expect(selectionApi.nearestRegion).toHaveBeenCalledWith(55.75, 37.61));
        expect(coordInput.value).toBe('');
    });

    it('поиск по координатам: регион не найден', async () => {
        const user = userEvent.setup();
        selectionApi.nearestRegion.mockResolvedValue({ ok: false, data: {} });
        render(<SelectionPage />);
        await screen.findByText('Электро');
        const coordInput = screen.getByPlaceholderText('59.9390, 30.3139');
        await user.type(coordInput, '55.75, 37.61');
        await user.click(screen.getByText('Найти город'));
        expect(await screen.findByText('Регион не найден')).toBeInTheDocument();
    });

    it('поиск по координатам: сетевая ошибка', async () => {
        const user = userEvent.setup();
        selectionApi.nearestRegion.mockRejectedValue(new Error('network'));
        render(<SelectionPage />);
        await screen.findByText('Электро');
        const coordInput = screen.getByPlaceholderText('59.9390, 30.3139');
        await user.type(coordInput, '55.75, 37.61');
        await user.click(screen.getByText('Найти город'));
        expect(await screen.findByText('Ошибка соединения')).toBeInTheDocument();
    });
});

async function submitForm(user, overrides = {}) {
    const inputs = document.querySelectorAll('input[type="number"]');
    const [hInp, bInp, tnInp, tvInp, vInp] = inputs;
    const values = { h: '2', b: '2', tn: '-20', tv: '18', V: '3', ...overrides };
    for (const [inp, val] of [[hInp, values.h], [bInp, values.b], [tnInp, values.tn], [tvInp, values.tv], [vInp, values.V]]) {
        await user.clear(inp);
        await user.type(inp, val);
    }
    await user.click(screen.getByRole('button', { name: /Подобрать завесы/ }));
}

describe('SelectionPage — расчёт (авто-режим)', () => {
    it('успешный расчёт рендерит результаты (SeriaCard/CombinationRow)', async () => {
        const user = userEvent.setup();
        selectionApi.calculate.mockResolvedValue(ok({
            success: true,
            data: {
                results: [
                    {
                        seria: 'ВО', design: 'Design1',
                        combinations: [
                            {
                                angle: 30, Tz: 12, tsm: 5,
                                aero: { q: 1.2, Gn: 0.5, Gz: 0.4, Ge: 0.1 },
                                products: [{ name: 'ВО-3.5', count: 2 }],
                                total_length: 3.5,
                            },
                        ],
                    },
                ],
            },
        }));
        selectionApi.accessories.mockResolvedValue(ok({ success: true, data: { items: [], has_pcb: false } }));

        render(<SelectionPage />);
        await screen.findByText('Электро');
        await submitForm(user);

        expect(await screen.findByText('Серия ВО')).toBeInTheDocument();
        expect(screen.getByText('ВО-3.5')).toBeInTheDocument();
        expect(screen.getByText('×2')).toBeInTheDocument();
        expect(screen.getByText('30°')).toBeInTheDocument();

        expect(selectionApi.calculate).toHaveBeenCalledWith(expect.objectContaining({
            heat_type: 'E', install_type: 'V', mode: 'auto',
        }));
        // Tpr не передаётся при heat_type !== 'W'
        const payload = selectionApi.calculate.mock.calls[0][0];
        expect(payload.Tpr).toBeUndefined();
    });

    it('передаёт Tpr при heat_type W', async () => {
        const user = userEvent.setup();
        selectionApi.calculate.mockResolvedValue(ok({ success: true, data: { results: [] } }));
        render(<SelectionPage />);
        await screen.findByText('Вода');
        await user.click(screen.getByText('Вода'));
        await submitForm(user);

        const payload = selectionApi.calculate.mock.calls[0][0];
        expect(payload.Tpr).toBe(95);
    });

    it('data.success:false показывает сообщение об ошибке', async () => {
        const user = userEvent.setup();
        selectionApi.calculate.mockResolvedValue(ok({ success: false, error: { message: 'Нет подходящих серий' } }));
        render(<SelectionPage />);
        await screen.findByText('Электро');
        await submitForm(user);
        expect(await screen.findByText('Нет подходящих серий')).toBeInTheDocument();
    });

    it('сетевая ошибка расчёта показывает "Ошибка соединения"', async () => {
        const user = userEvent.setup();
        selectionApi.calculate.mockRejectedValue(new Error('boom'));
        render(<SelectionPage />);
        await screen.findByText('Электро');
        await submitForm(user);
        expect(await screen.findByText('Ошибка соединения')).toBeInTheDocument();
    });

    it('results.error (частичная ошибка) рендерит предупреждение', async () => {
        const user = userEvent.setup();
        selectionApi.calculate.mockResolvedValue(ok({
            success: true,
            data: { error: true, error_message: 'Не найдено ни одного варианта', results: [] },
        }));
        render(<SelectionPage />);
        await screen.findByText('Электро');
        await submitForm(user);
        expect(await screen.findByText('Не найдено ни одного варианта')).toBeInTheDocument();
    });

    it('сворачивание/разворачивание SeriaCard', async () => {
        const user = userEvent.setup();
        selectionApi.calculate.mockResolvedValue(ok({
            success: true,
            data: {
                results: [{
                    seria: 'ВО', design: '',
                    combinations: [{ angle: 30, Tz: 12, tsm: 5, products: [{ name: 'ВО-3.5', count: 1 }], total_length: 1.2 }],
                }],
            },
        }));
        selectionApi.accessories.mockResolvedValue(ok({ success: true, data: { items: [], has_pcb: false } }));
        render(<SelectionPage />);
        await screen.findByText('Электро');
        await submitForm(user);

        const header = await screen.findByText('Серия ВО');
        expect(screen.getByText('ВО-3.5')).toBeInTheDocument();
        await user.click(header);
        expect(screen.queryByText('ВО-3.5')).not.toBeInTheDocument();
        await user.click(header);
        expect(await screen.findByText('ВО-3.5')).toBeInTheDocument();
    });

    it('выбор комбинации грузит accessories и подсвечивает выбранный вариант', async () => {
        const user = userEvent.setup();
        selectionApi.calculate.mockResolvedValue(ok({
            success: true,
            data: {
                results: [{
                    seria: 'ВО', design: '',
                    combinations: [
                        { angle: 30, Tz: 12, tsm: 5, products: [{ name: 'A', count: 1, id: 1 }], total_length: 1 },
                        { angle: 45, Tz: 10, tsm: 3, products: [{ name: 'B', count: 1, id: 2 }], total_length: 2 },
                    ],
                }],
            },
        }));
        selectionApi.accessories.mockResolvedValue(ok({ success: true, data: { items: [{ accessory_id: 1, kind: 'other', name: 'Клапан' }], has_pcb: false } }));

        render(<SelectionPage />);
        await screen.findByText('Электро');
        await submitForm(user);
        await screen.findByText('Серия ВО');

        const radios = document.querySelectorAll('input[type="radio"][class*="accent-blue"]');
        expect(radios.length).toBe(2);
        await user.click(radios[0]);

        await waitFor(() => expect(selectionApi.accessories).toHaveBeenCalledWith([1]));
        expect(radios[0]).toBeChecked();
        expect(radios[1]).not.toBeChecked();
    });
});

describe('SelectionPage — ручной режим', () => {
    it('фильтрует серии/дизайны по исключённым из конфига', async () => {
        selectionApi.getConfig.mockResolvedValue(ok({
            success: true,
            data: { excluded_designs: ['Design2'], excluded_series: ['КЭВ'] },
        }));
        const user = userEvent.setup();
        render(<SelectionPage />);
        await screen.findByText('Электро');
        await user.click(screen.getByText('Ручной'));

        expect(await screen.findByText('ВО')).toBeInTheDocument();
        expect(screen.queryByText('КЭВ')).not.toBeInTheDocument();

        await user.click(screen.getByText('ВО'));
        expect(await screen.findByText('Design1')).toBeInTheDocument();
        expect(screen.queryByText('Design2')).not.toBeInTheDocument();
    });

    it('выбор серии/дизайна грузит длины (availableOptions), показывает loading', async () => {
        let resolveLengths;
        selectionApi.availableOptions.mockReturnValue(new Promise(r => { resolveLengths = r; }));
        const user = userEvent.setup();
        render(<SelectionPage />);
        await screen.findByText('Электро');
        await user.click(screen.getByText('Ручной'));
        await user.click(screen.getByText('ВО'));
        await user.click(screen.getByText('Design1'));

        expect(selectionApi.availableOptions).toHaveBeenCalledWith('ВО', 'Design1', 'E', 21);
        expect(await screen.findByText('Загрузка...')).toBeInTheDocument();

        resolveLengths(ok({ success: true, data: { lengths: [1000, 1500] } }));
        expect(await screen.findByRole('button', { name: /^1000 мм/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^1500 мм/ })).toBeInTheDocument();
    });

    it('нет доступных длин', async () => {
        selectionApi.availableOptions.mockResolvedValue(ok({ success: true, data: { lengths: [] } }));
        const user = userEvent.setup();
        render(<SelectionPage />);
        await screen.findByText('Электро');
        await user.click(screen.getByText('Ручной'));
        await user.click(screen.getByText('ВО'));
        await user.click(screen.getByText('Design1'));
        expect(await screen.findByText('Нет доступных длин')).toBeInTheDocument();
    });

    it('предупреждение о выборе длины, накопление по клику, "← Убрать" последнюю', async () => {
        selectionApi.availableOptions.mockResolvedValue(ok({ success: true, data: { lengths: [1000, 1500] } }));
        const user = userEvent.setup();
        render(<SelectionPage />);
        await screen.findByText('Электро');
        await user.click(screen.getByText('Ручной'));
        await user.click(screen.getByText('ВО'));
        await user.click(screen.getByText('Design1'));
        const lenBtn = await screen.findByRole('button', { name: /^1000 мм/ });

        expect(screen.getByText('Выберите хотя бы одну длину')).toBeInTheDocument();

        await user.click(lenBtn);
        await user.click(lenBtn);
        expect(screen.queryByText('Выберите хотя бы одну длину')).not.toBeInTheDocument();
        expect(screen.getByText('1000 мм + 1000 мм')).toBeInTheDocument();

        await user.click(screen.getByText('← Убрать'));
        expect(screen.queryByText('1000 мм + 1000 мм')).not.toBeInTheDocument();
        expect(lenBtn).toBeInTheDocument();
    });

    it('углы: дефолт 30°, удаление, добавление валидного, игнор вне диапазона/дублей', async () => {
        selectionApi.availableOptions.mockResolvedValue(ok({ success: true, data: { lengths: [1000] } }));
        const user = userEvent.setup();
        render(<SelectionPage />);
        await screen.findByText('Электро');
        await user.click(screen.getByText('Ручной'));
        await user.click(screen.getByText('ВО'));
        await user.click(screen.getByText('Design1'));
        await screen.findByText('Углы расчёта');

        expect(screen.getByText('30°')).toBeInTheDocument();

        const angleInput = document.querySelector('input[placeholder="°"]');
        await user.type(angleInput, '150');
        await user.click(screen.getByText('+ Добавить'));
        expect(screen.queryByText('150°')).not.toBeInTheDocument();

        await user.clear(angleInput);
        await user.type(angleInput, '30');
        await user.click(screen.getByText('+ Добавить'));
        expect(screen.getAllByText('30°')).toHaveLength(1);

        await user.clear(angleInput);
        await user.type(angleInput, '45');
        await user.click(screen.getByText('+ Добавить'));
        expect(screen.getByText('45°')).toBeInTheDocument();

        const removeDefault = within(screen.getByText('30°')).getByRole('button');
        await user.click(removeDefault);
        expect(screen.queryByText('30°')).not.toBeInTheDocument();
        expect(screen.getByText('45°')).toBeInTheDocument();
    });

    it('manualInvalid блокирует submit пока не выбраны серия/дизайн/длина/угол', async () => {
        selectionApi.availableOptions.mockResolvedValue(ok({ success: true, data: { lengths: [1000] } }));
        const user = userEvent.setup();
        render(<SelectionPage />);
        await screen.findByText('Электро');
        await user.click(screen.getByText('Ручной'));
        const submitBtn = screen.getByRole('button', { name: /Подобрать завесы/ });
        expect(submitBtn).toBeDisabled();

        await user.click(screen.getByText('ВО'));
        expect(submitBtn).toBeDisabled();
        await user.click(screen.getByText('Design1'));
        const lenBtn = await screen.findByRole('button', { name: /^1000 мм/ });
        expect(submitBtn).toBeDisabled();

        await user.click(lenBtn);
        expect(submitBtn).not.toBeDisabled();
    });

    it('submit в ручном режиме отправляет payload с mode=manual и manual.{series,design,lbodies,angles}', async () => {
        selectionApi.availableOptions.mockResolvedValue(ok({ success: true, data: { lengths: [1000] } }));
        selectionApi.calculate.mockResolvedValue(ok({ success: true, data: { results: [] } }));
        const user = userEvent.setup();
        render(<SelectionPage />);
        await screen.findByText('Электро');
        await user.click(screen.getByText('Ручной'));
        await user.click(screen.getByText('ВО'));
        await user.click(screen.getByText('Design1'));
        const lenBtn = await screen.findByRole('button', { name: /^1000 мм/ });
        await user.click(lenBtn);

        await submitForm(user);

        const payload = selectionApi.calculate.mock.calls[0][0];
        expect(payload.mode).toBe('manual');
        expect(payload.manual).toEqual({ series: 'ВО', design: 'Design1', lbodies: [1000], angles: [30] });
    });
});

async function setupSelectedCombo(user) {
    selectionApi.calculate.mockResolvedValue(ok({
        success: true,
        data: {
            results: [{
                seria: 'ВО', design: '',
                combinations: [{ angle: 30, Tz: 12, tsm: 5, products: [{ name: 'A', count: 1, id: 1 }], total_length: 1 }],
            }],
        },
    }));
    selectionApi.accessories.mockResolvedValue(ok({ success: true, data: { items: [], has_pcb: false } }));
    render(<SelectionPage />);
    await screen.findByText('Электро');
    await submitForm(user);
    await screen.findByText('Серия ВО');
    await user.click(document.querySelector('input[type="radio"][class*="accent-blue"]'));
    await screen.findByText('Просмотреть предложение');
}

describe('SelectionPage — генерация предложения', () => {
    it('"Просмотреть предложение" — без сохранения, открывает blob в новой вкладке', async () => {
        const user = userEvent.setup();
        const blob = new Blob(['x']);
        selectionApi.proposal.mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });
        vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
        vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
        const fakeTab = { document: { write: vi.fn(), close: vi.fn() } };
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeTab);

        await setupSelectedCombo(user);
        await user.click(screen.getByText('Просмотреть предложение'));

        await waitFor(() => expect(selectionApi.proposal).toHaveBeenCalled());
        expect(selectionApi.proposalsCreate).not.toHaveBeenCalled();
        expect(openSpy).toHaveBeenCalledWith('', '_blank');
        expect(fakeTab.document.write).toHaveBeenCalledWith(expect.stringContaining('blob:mock-url'));

        vi.restoreAllMocks();
    });

    it('"Скачать PDF" без currentProposalId — создаёт предложение (proposalsCreate), потом скачивает', async () => {
        const user = userEvent.setup();
        const blob = new Blob(['x']);
        selectionApi.proposalsCreate.mockResolvedValue({ ok: true, data: { id: 77, proposal_number: 'П-77' } });
        selectionApi.proposal.mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });
        vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
        vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
        const clicks = [];
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
            clicks.push({ href: this.href, download: this.download });
        });

        await setupSelectedCombo(user);
        await user.click(screen.getByText('Скачать PDF'));

        await waitFor(() => expect(selectionApi.proposalsCreate).toHaveBeenCalled());
        expect(selectionApi.proposalsCreate).toHaveBeenCalledWith(expect.objectContaining({
            selection_type: 'CURTAIN_SHUTTER',
        }));
        await waitFor(() => expect(clicks.length).toBe(1));
        expect(clicks[0].download).toBe('Предложение.pdf');
        expect(selectionApi.proposal.mock.calls[0][0].proposal_no).toBe('П-77');

        vi.restoreAllMocks();
    });

    it('"Скачать PDF" с существующим currentProposalId — обновляет (proposalsUpdate), не создаёт заново', async () => {
        const user = userEvent.setup();
        selectionApi.proposalsUpdate.mockResolvedValue({ ok: true, data: {} });
        selectionApi.proposal.mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['x'])) });
        vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
        vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

        await setupSelectedCombo(user);
        // Восстанавливаем предложение из истории — это выставит currentProposalId
        await user.click(screen.getByText('История'));
        await user.click(screen.getByText('restore-proposal'));
        // После restore результаты сброшены — пересчитываем и выбираем вариант заново
        await submitForm(user);
        await screen.findByText('Серия ВО');
        await user.click(document.querySelector('input[type="radio"][class*="accent-blue"]'));
        await screen.findByText('Скачать PDF');

        await user.click(screen.getByText('Скачать PDF'));

        await waitFor(() => expect(selectionApi.proposalsUpdate).toHaveBeenCalledWith(55, expect.objectContaining({ status: 'SENT' })));
        expect(selectionApi.proposalsCreate).not.toHaveBeenCalled();

        vi.restoreAllMocks();
    });

    it('ошибка формирования предложения (!res.ok)', async () => {
        const user = userEvent.setup();
        selectionApi.proposal.mockResolvedValue({ ok: false });
        vi.spyOn(window, 'open').mockReturnValue({ document: { write: vi.fn(), close: vi.fn() } });

        await setupSelectedCombo(user);
        await user.click(screen.getByText('Просмотреть предложение'));

        expect(await screen.findByText('Ошибка формирования предложения')).toBeInTheDocument();
        vi.restoreAllMocks();
    });
});

describe('SelectionPage — восстановление из истории (ProposalsPanel.onRestore)', () => {
    it('восстанавливает форму/заказчика/регион, сбрасывает результаты', async () => {
        const user = userEvent.setup();
        await setupSelectedCombo(user);
        expect(screen.getByText('Серия ВО')).toBeInTheDocument();

        await user.click(screen.getByText('История'));
        await user.click(screen.getByText('restore-proposal'));

        expect(screen.queryByText('Серия ВО')).not.toBeInTheDocument();
        const values = Array.from(document.querySelectorAll('input[type="number"]')).map(i => i.value);
        expect(values).toEqual(['3', '4', '-25', '16', '4']);
        expect(screen.getByDisplayValue('ООО Ромашка')).toBeInTheDocument();
    });
});
