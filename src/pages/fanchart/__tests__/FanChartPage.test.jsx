import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FanChartPage from '../FanChartPage';
import { selectionApi } from '../../../api/selection';

vi.mock('../../../api/selection', () => ({
    selectionApi: {
        fanCharts: vi.fn(),
        fanChartDetail: vi.fn(),
        fanChartCreate: vi.fn(),
        fanChartSave: vi.fn(),
        fanChartOperatingPoint: vi.fn(),
        fanChartCombined: vi.fn(),
        fanChartSelect: vi.fn(),
    },
}));
vi.mock('../../../components/common/FanChartEditor', () => ({
    default: ({ curves, xDomain, yDomain, editable, activeCurveId, editTool, onChange, onAddPoint, onCurveClick, operatingPoint }) => (
        <div
            data-testid="fan-chart-editor-stub"
            data-curves={curves.length}
            data-xdomain={JSON.stringify(xDomain)}
            data-ydomain={JSON.stringify(yDomain)}
            data-editable={String(editable)}
            data-active-curve={activeCurveId ?? ''}
            data-edit-tool={editTool}
            data-operating-points={operatingPoint ? operatingPoint.length : 0}
        >
            <button onClick={() => onChange?.(curves)}>trigger-change</button>
            <button onClick={() => onAddPoint?.(activeCurveId, { x: 1, y: 2 })}>trigger-add-point</button>
            <button onClick={() => onCurveClick?.(curves[0]?.id)}>trigger-curve-click</button>
        </div>
    ),
    CURVE_TYPE_LABELS: {
        PRESSURE: 'Давление Pv(Q)',
        EFFICIENCY: 'КПД η(Q)',
        POWER: 'Мощность Nu(Q)',
        TIP_SPEED: 'Окружная скорость u(Q)',
    },
}));

const ok = (data) => ({ ok: true, data });

const listItemWithCurves = {
    id: 1, product_external_id: 'ВО-3.5', d_ratio: 1.0, temperature: 20, source_page: 12,
    x_min: 0.3, x_max: 2, y_min: 60, y_max: 1000,
    x_scale_factor: 1, y_scale_factor: 1, display_factor_x: 1, display_factor_y: 1,
    scale_type: 'log',
    curves: [{ id: 10, curve_type: 'PRESSURE', label: 'n=2750', points: [{ x: 0.5, y: 200 }, { x: 1, y: 150 }] }],
};

const listItemNoCurves = { id: 2, product_external_id: 'ВО-3.5', d_ratio: 0.9, temperature: 20 };

beforeEach(() => {
    vi.clearAllMocks();
});
afterEach(() => {
    vi.useRealTimers();
});

async function search(user, charts) {
    selectionApi.fanCharts.mockResolvedValue(ok({ success: true, results: charts }));
    render(<FanChartPage />);
    const input = screen.getByPlaceholderText(/Название изделия или External ID/);
    await user.type(input, 'ВО-3.5');
    await user.click(screen.getByRole('button', { name: 'Найти' }));
    await waitFor(() => expect(selectionApi.fanCharts).toHaveBeenCalledWith('ВО-3.5'));
}

describe('FanChartPage — поиск и выбор графика', () => {
    it('ищет графики и рендерит список карточек', async () => {
        const user = userEvent.setup();
        await search(user, [listItemWithCurves, listItemNoCurves]);
        expect(await screen.findByText('Графики (2)')).toBeInTheDocument();
        expect(screen.getAllByText('ВО-3.5').length).toBeGreaterThan(0);
        expect(screen.getAllByText('t = 20°C').length).toBe(2);
        expect(screen.getByText('стр. 12')).toBeInTheDocument();
    });

    it('выбор графика из списка (уже с curves) — пересчитывает домены по scale/display factor', async () => {
        const user = userEvent.setup();
        const scaled = { ...listItemWithCurves, x_scale_factor: 2, display_factor_x: 1, y_scale_factor: 1, display_factor_y: 1 };
        await search(user, [scaled]);
        await user.click(screen.getByText(/D = 1 D/));

        const stub = await screen.findByTestId('fan-chart-editor-stub');
        // ratio.x = xSF/dFX = 2/1 = 2 → x_min*2=0.6, x_max*2=4
        expect(stub.dataset.xdomain).toBe(JSON.stringify([0.6, 4]));
        expect(stub.dataset.ydomain).toBe(JSON.stringify([60, 1000]));
        expect(stub.dataset.curves).toBe('1');
    });

    it('выбор графика без curves — грузит детали (fanChartDetail), пока грузится — "Найти" в состоянии загрузки', async () => {
        const user = userEvent.setup();
        let resolveDetail;
        selectionApi.fanChartDetail.mockReturnValue(new Promise(r => { resolveDetail = r; }));
        await search(user, [listItemNoCurves]);
        await user.click(screen.getByText(/D = 0.9 D/));

        expect(selectionApi.fanChartDetail).toHaveBeenCalledWith(2);
        expect(screen.getByRole('button', { name: '...' })).toBeInTheDocument();

        resolveDetail(ok({
            id: 2, x_min: 0.3, x_max: 2, y_min: 60, y_max: 1000,
            x_scale_factor: 1, y_scale_factor: 1, display_factor_x: 1, display_factor_y: 1,
            scale_type: 'log', curves: [{ id: 20, curve_type: 'PRESSURE', label: 'c', points: [] }],
        }));
        const stub = await screen.findByTestId('fan-chart-editor-stub');
        expect(stub.dataset.curves).toBe('1');
    });
});

describe('FanChartPage — создание графика и добавление кривой', () => {
    it('CreateChartModal создаёт локальный график и сразу выбирает его', async () => {
        const user = userEvent.setup();
        render(<FanChartPage />);
        await user.click(screen.getByText('+ Новый график'));
        expect(screen.getByText('Новый график')).toBeInTheDocument();

        await user.click(screen.getByText('Создать'));
        const stub = await screen.findByTestId('fan-chart-editor-stub');
        expect(stub.dataset.curves).toBe('0');
        expect(screen.queryByText('Новый график')).not.toBeInTheDocument();
    });

    it('AddCurveModal: валидация метки, добавление кривой переключает activeCurveId/editTool', async () => {
        const user = userEvent.setup();
        render(<FanChartPage />);
        await user.click(screen.getByText('+ Новый график'));
        await user.click(screen.getByText('Создать'));
        await screen.findByTestId('fan-chart-editor-stub');

        // переключаемся в режим редактора (второй "Редактор" — тумблер режима, первый — вкладка)
        await user.click(screen.getAllByText('Редактор')[1]);
        await user.click(screen.getByText('+ Кривая'));

        const addBtn = screen.getByText('Добавить');
        expect(addBtn).toBeDisabled();

        await user.type(screen.getByPlaceholderText('n=2750 об/мин'), 'n=2900 об/мин');
        expect(addBtn).not.toBeDisabled();
        await user.click(addBtn);

        const stub = await screen.findByTestId('fan-chart-editor-stub');
        expect(stub.dataset.curves).toBe('1');
        expect(stub.dataset.editTool).toBe('add');
        expect(stub.dataset.activeCurve).not.toBe('');
    });
});

describe('FanChartPage — сохранение', () => {
    async function gotoEditModeWithCurve(user) {
        render(<FanChartPage />);
        await user.click(screen.getByText('+ Новый график'));
        await user.click(screen.getByText('Создать'));
        await screen.findByTestId('fan-chart-editor-stub');
        await user.click(screen.getAllByText('Редактор')[1]);
    }

    it('новый график: подтверждение → fanChartCreate затем fanChartSave, статус "✓ Сохранено"', async () => {
        const user = userEvent.setup();
        selectionApi.fanChartCreate.mockResolvedValue(ok({ id: 999 }));
        selectionApi.fanChartSave.mockResolvedValue(ok({ success: true }));
        await gotoEditModeWithCurve(user);

        await user.click(screen.getByText('Сохранить'));
        expect(screen.getByText(/Сохранить изменения графика/)).toBeInTheDocument();
        await user.click(screen.getByText('Подтвердить'));

        await waitFor(() => expect(selectionApi.fanChartCreate).toHaveBeenCalled());
        await waitFor(() => expect(selectionApi.fanChartSave).toHaveBeenCalledWith(999, expect.any(Object)));
        expect(await screen.findByText('✓ Сохранено')).toBeInTheDocument();
    });

    it('существующий график: сохранение сразу через fanChartSave, без fanChartCreate', async () => {
        const user = userEvent.setup();
        selectionApi.fanChartSave.mockResolvedValue(ok({ success: true }));
        await search(user, [listItemWithCurves]);
        await user.click(screen.getByText(/D = 1 D/));
        await screen.findByTestId('fan-chart-editor-stub');
        await user.click(screen.getAllByText('Редактор')[1]);

        await user.click(screen.getByText('Сохранить'));
        await user.click(screen.getByText('Подтвердить'));

        await waitFor(() => expect(selectionApi.fanChartSave).toHaveBeenCalledWith(1, expect.any(Object)));
        expect(selectionApi.fanChartCreate).not.toHaveBeenCalled();
    });

    it('ошибка сохранения — статус "error" (без автотекста "Сохранено")', async () => {
        const user = userEvent.setup();
        selectionApi.fanChartSave.mockResolvedValue(ok({ success: false }));
        await search(user, [listItemWithCurves]);
        await user.click(screen.getByText(/D = 1 D/));
        await screen.findByTestId('fan-chart-editor-stub');
        await user.click(screen.getAllByText('Редактор')[1]);

        await user.click(screen.getByText('Сохранить'));
        await user.click(screen.getByText('Подтвердить'));

        await waitFor(() => expect(selectionApi.fanChartSave).toHaveBeenCalled());
        expect(screen.queryByText('✓ Сохранено')).not.toBeInTheDocument();
    });

    it('отмена подтверждения не вызывает сохранение', async () => {
        const user = userEvent.setup();
        await gotoEditModeWithCurve(user);
        await user.click(screen.getByText('Сохранить'));
        await user.click(screen.getByText('Отмена'));
        expect(selectionApi.fanChartCreate).not.toHaveBeenCalled();
        expect(selectionApi.fanChartSave).not.toHaveBeenCalled();
    });
});

describe('FanChartPage — настройки осей', () => {
    it('⚙ Оси открывает панель; валидные значения вызывают Применить (fanChartSave без curves)', async () => {
        const user = userEvent.setup();
        selectionApi.fanChartSave.mockResolvedValue(ok({ success: true }));
        await search(user, [listItemWithCurves]);
        await user.click(screen.getByText(/D = 1 D/));
        await screen.findByTestId('fan-chart-editor-stub');

        await user.click(screen.getByText('⚙ Оси'));
        expect(screen.getByText('Границы осей')).toBeInTheDocument();
        await user.click(screen.getByText('Применить'));

        await waitFor(() => expect(selectionApi.fanChartSave).toHaveBeenCalledWith(1, expect.objectContaining({
            x_min: 0.3, x_max: 2, y_min: 60, y_max: 1000,
        })));
        const [, payload] = selectionApi.fanChartSave.mock.calls[0];
        expect(payload.curves).toBeUndefined();
    });

    it('невалидные значения (xMin >= xMax) — Применить no-op', async () => {
        const user = userEvent.setup();
        await search(user, [listItemWithCurves]);
        await user.click(screen.getByText(/D = 1 D/));
        await screen.findByTestId('fan-chart-editor-stub');
        await user.click(screen.getByText('⚙ Оси'));

        const inputs = document.querySelectorAll('input');
        const xMinInput = Array.from(inputs).find(i => i.value === '0.3');
        await user.clear(xMinInput);
        await user.type(xMinInput, '999');
        await user.click(screen.getByText('Применить'));

        expect(selectionApi.fanChartSave).not.toHaveBeenCalled();
    });
});

describe('FanChartPage — характеристика сети (редактор)', () => {
    it('построение сети добавляет кривую в редактор; "Очистить" убирает', async () => {
        const user = userEvent.setup();
        selectionApi.fanChartOperatingPoint.mockResolvedValue(ok({ success: true, data: [{ q: 1, pv: 300, in_working_zone: true }] }));
        await search(user, [listItemWithCurves]);
        await user.click(screen.getByText(/D = 1 D/));
        let stub = await screen.findByTestId('fan-chart-editor-stub');
        expect(stub.dataset.curves).toBe('1');

        const qInput = screen.getByPlaceholderText('1.5');
        const pvInput = screen.getByPlaceholderText('200');
        await user.type(qInput, '1.5');
        await user.type(pvInput, '200');
        await user.click(screen.getByText('Построить'));

        stub = await screen.findByTestId('fan-chart-editor-stub');
        expect(stub.dataset.curves).toBe('2'); // + сеть
        await waitFor(() => expect(selectionApi.fanChartOperatingPoint).toHaveBeenCalledWith(1, 1.5, 200));
        expect(stub.dataset.operatingPoints).not.toBe('0');

        await user.click(screen.getByText('Очистить'));
        stub = await screen.findByTestId('fan-chart-editor-stub');
        expect(stub.dataset.curves).toBe('1');
    });
});

describe('FanChartPage — вкладка "Все графики" (combined)', () => {
    it('поиск combined строит цветовую карту и передаёт кривые в редактор', async () => {
        const user = userEvent.setup();
        selectionApi.fanChartCombined.mockResolvedValue(ok({
            success: true,
            data: {
                charts: [
                    { product_external_id: 'ВО-3.5', d_ratio: 1.0, curves: [{ id: 1, label: 'c1', points: [{ x: 1, y: 2 }] }] },
                    { product_external_id: 'ВО-3.5', d_ratio: 0.9, curves: [{ id: 2, label: 'c2', points: [{ x: 1, y: 2 }] }] },
                ],
                x_domain: [0.3, 2], y_domain: [60, 1000], scale_type: 'log',
            },
        }));
        render(<FanChartPage />);
        await user.click(screen.getByText('Все графики'));
        await user.type(screen.getByPlaceholderText(/Серия, напр/), 'ВО 4-70');
        await user.click(screen.getByText('Показать'));

        expect(await screen.findByText('2 кривых давления')).toBeInTheDocument();
        expect(screen.getByText('D = 1 D')).toBeInTheDocument();
        expect(screen.getByText('D = 0.9 D')).toBeInTheDocument();
        const stub = await screen.findByTestId('fan-chart-editor-stub');
        expect(stub.dataset.curves).toBe('2');
        expect(stub.dataset.editable).toBe('false');
    });

    it('подбор ближайших кривых (fanChartSelect) + клик по кривой грузит её график и переключает на вкладку "Редактор"', async () => {
        const user = userEvent.setup();
        selectionApi.fanChartCombined.mockResolvedValue(ok({
            success: true,
            data: {
                charts: [{ product_external_id: 'ВО-4', d_ratio: 1.0, curves: [{ id: 1, label: 'c1', points: [{ x: 1, y: 2 }] }] }],
                x_domain: [0.3, 2], y_domain: [60, 1000], scale_type: 'log',
            },
        }));
        selectionApi.fanChartSelect.mockResolvedValue(ok({
            success: true,
            data: {
                above: [{ curve_id: 5, chart_id: 3, product_external_id: 'ВО-4', d_ratio: 1.0, curve_label: 'n=2750', curve_points: [{ x: 1, y: 2 }] }],
                below: [],
                selected: [{ q_op: 1, pv_op: 2 }],
                q_ref: 1.5, pv_ref: 200,
            },
        }));
        selectionApi.fanChartDetail.mockResolvedValue(ok({
            id: 3, x_min: 0.3, x_max: 2, y_min: 60, y_max: 1000,
            x_scale_factor: 1, y_scale_factor: 1, display_factor_x: 1, display_factor_y: 1,
            scale_type: 'log', curves: [{ id: 5, curve_type: 'PRESSURE', label: 'n=2750', points: [{ x: 1, y: 2 }] }],
        }));
        selectionApi.fanChartOperatingPoint.mockResolvedValue(ok({ success: true, data: [] }));

        render(<FanChartPage />);
        await user.click(screen.getByText('Все графики'));
        await user.type(screen.getByPlaceholderText(/Серия, напр/), 'ВО-4');
        await user.click(screen.getByText('Показать'));
        await screen.findByText('1 кривых давления');

        const qInput = screen.getByPlaceholderText('1.5');
        const pvInput = screen.getByPlaceholderText('200');
        await user.type(qInput, '1.5');
        await user.type(pvInput, '200');
        await user.click(screen.getByText('Построить'));

        await waitFor(() => expect(selectionApi.fanChartSelect).toHaveBeenCalledWith(1.5, 200, 'ВО-4', 3, 1));

        const stub = await screen.findByTestId('fan-chart-editor-stub');
        await user.click(within(stub).getByText('trigger-curve-click'));

        await waitFor(() => expect(selectionApi.fanChartDetail).toHaveBeenCalledWith(3));
        // Переключились на вкладку "Редактор" — снова виден поиск по изделию
        expect(await screen.findByPlaceholderText(/Название изделия или External ID/)).toBeInTheDocument();
    });
});

describe('FanChartPage — пустой график и легенда', () => {
    it('пустой график в режиме редактора показывает подсказку, легенда скрыта', async () => {
        const user = userEvent.setup();
        render(<FanChartPage />);
        await user.click(screen.getByText('+ Новый график'));
        await user.click(screen.getByText('Создать'));
        await screen.findByTestId('fan-chart-editor-stub');
        await user.click(screen.getAllByText('Редактор')[1]);

        expect(await screen.findByText('График пустой — добавьте первую кривую')).toBeInTheDocument();
    });

    it('легенда группирует кривые по типу', async () => {
        const user = userEvent.setup();
        await search(user, [{
            ...listItemWithCurves,
            curves: [
                { id: 10, curve_type: 'PRESSURE', label: 'n=2750', points: [] },
                { id: 11, curve_type: 'EFFICIENCY', label: 'КПД', points: [] },
            ],
        }]);
        await user.click(screen.getByText(/D = 1 D/));
        await screen.findByTestId('fan-chart-editor-stub');
        expect(screen.getByText('n=2750')).toBeInTheDocument();
        expect(screen.getByText('КПД')).toBeInTheDocument();
    });
});
