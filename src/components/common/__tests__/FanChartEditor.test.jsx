import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import FanChartEditor from '../FanChartEditor';

const curve1 = {
    id: 'c1', curve_type: 'PRESSURE', label: 'n=2750',
    points: [{ x: 0.5, y: 200 }, { x: 1, y: 150 }, { x: 1.5, y: 100 }],
};
const curve2 = {
    id: 'c2', curve_type: 'EFFICIENCY', label: 'КПД', points: [{ x: 0.5, y: 300 }],
};

function setup(props = {}) {
    return render(
        <FanChartEditor
            width={700} height={500}
            curves={[curve1]}
            xDomain={[0.3, 2]} yDomain={[60, 1000]}
            editable
            {...props}
        />
    );
}

describe('FanChartEditor — рендер', () => {
    it('рисует линию кривой (>=2 точек) и по точке на каждую вершину при editable', () => {
        const { container } = setup();
        expect(container.querySelectorAll('path.visx-linepath')).toHaveLength(1);
        expect(container.querySelectorAll('circle')).toHaveLength(3);
    });

    it('не рисует линию, если у кривой <2 точек, но точка (editable) остаётся', () => {
        const { container } = setup({ curves: [curve2] });
        expect(container.querySelectorAll('path.visx-linepath')).toHaveLength(0);
        expect(container.querySelectorAll('circle')).toHaveLength(1);
    });

    it('editable=false — точки (circle) не рендерятся, линия остаётся', () => {
        const { container } = setup({ editable: false });
        expect(container.querySelectorAll('path.visx-linepath')).toHaveLength(1);
        expect(container.querySelectorAll('circle')).toHaveLength(0);
    });

    it('подписи осей и метка кривой рендерятся', () => {
        const { getByText } = setup({ xLabel: 'Q, тыс.м³/ч', yLabel: 'Pv, Па' });
        expect(getByText('Q, тыс.м³/ч')).toBeInTheDocument();
        expect(getByText('Pv, Па')).toBeInTheDocument();
        expect(getByText('n=2750')).toBeInTheDocument();
    });

    it('xDomain/yDomain с a<=0 не крашит (клэмп в 0.01/0.1) — путь без NaN', () => {
        const { container } = setup({ xDomain: [0, 2], yDomain: [0, 1000] });
        const path = container.querySelector('path.visx-linepath');
        expect(path.getAttribute('d')).not.toMatch(/NaN/);
    });

    it('рендерит рабочие точки (operatingPoint) отдельными circle с большим радиусом', () => {
        const { container } = setup({
            operatingPoint: [
                { q: 1, pv: 200, is_target: true, in_working_zone: true },
                { q: 1.2, pv: 180, is_target: false, in_working_zone: true },
                { q: 1.4, pv: 400, is_target: false, in_working_zone: false },
            ],
        });
        const opCircles = Array.from(container.querySelectorAll('circle[r="6"]'));
        expect(opCircles).toHaveLength(3);
        expect(opCircles[0].getAttribute('fill')).toBe('#f97316'); // target
        expect(opCircles[1].getAttribute('fill')).toBe('#0891b2'); // в рабочей зоне
        expect(opCircles[2].getAttribute('fill')).toBe('#ef4444'); // вне рабочей зоны
    });
});

describe('FanChartEditor — клики', () => {
    it('клик по линии кривой вызывает onCurveClick(curve.id)', () => {
        const onCurveClick = vi.fn();
        const { container } = setup({ onCurveClick });
        fireEvent.click(container.querySelector('path.visx-linepath'));
        expect(onCurveClick).toHaveBeenCalledWith('c1');
    });

    it('клик по фону без activeCurveId — onAddPoint не вызывается', () => {
        const onAddPoint = vi.fn();
        const { container } = setup({ onAddPoint, editTool: 'add', activeCurveId: null });
        fireEvent.click(container.querySelector('rect'));
        expect(onAddPoint).not.toHaveBeenCalled();
    });

    it('клик по фону при editTool!=="add" — onAddPoint не вызывается', () => {
        const onAddPoint = vi.fn();
        const { container } = setup({ onAddPoint, editTool: 'move', activeCurveId: 'c1' });
        fireEvent.click(container.querySelector('rect'));
        expect(onAddPoint).not.toHaveBeenCalled();
    });

    it('клик по фону с activeCurveId + editTool="add" вызывает onAddPoint с координатами из клика', () => {
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
            left: 0, top: 0, right: 700, bottom: 500, width: 700, height: 500, x: 0, y: 0, toJSON() {},
        });
        const onAddPoint = vi.fn();
        const { container } = setup({ onAddPoint, editTool: 'add', activeCurveId: 'c1' });
        // margin.left=65, margin.top=20 (фиксированные) — клик в (165,120) => svgX=100,svgY=100
        fireEvent.click(container.querySelector('rect'), { clientX: 165, clientY: 120 });
        expect(onAddPoint).toHaveBeenCalledTimes(1);
        const [curveId, point] = onAddPoint.mock.calls[0];
        expect(curveId).toBe('c1');
        expect(point.x).toBeGreaterThan(0);
        expect(point.y).toBeGreaterThan(0);
        vi.restoreAllMocks();
    });

    it('клик по самой точке (circle) не триггерит onAddPoint', () => {
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
            left: 0, top: 0, right: 700, bottom: 500, width: 700, height: 500, x: 0, y: 0, toJSON() {},
        });
        const onAddPoint = vi.fn();
        const { container } = setup({ onAddPoint, editTool: 'add', activeCurveId: 'c1' });
        fireEvent.click(container.querySelector('circle'));
        expect(onAddPoint).not.toHaveBeenCalled();
        vi.restoreAllMocks();
    });
});

describe('FanChartEditor — drag точки', () => {
    it('drag точки вызывает onChange с обновлёнными координатами, показывает и прячет tooltip', () => {
        const onChange = vi.fn();
        const { container, queryByText } = setup({ onChange });
        const circle = container.querySelectorAll('circle')[0];

        fireEvent.mouseDown(circle, { clientX: 100, clientY: 100 });
        fireEvent.mouseMove(window, { clientX: 130, clientY: 70 });

        expect(onChange).toHaveBeenCalledTimes(1);
        const updated = onChange.mock.calls[0][0];
        // первая точка первой кривой сдвинулась (x/y изменились относительно исходных 0.5/200)
        expect(updated[0].points[0]).not.toEqual(curve1.points[0]);
        expect(queryByText(/Q=.*Pv=.*Па/)).toBeInTheDocument();

        fireEvent.mouseUp(window);
        expect(queryByText(/Q=.*Pv=.*Па/)).not.toBeInTheDocument();
    });

    it('drag не затрагивает другие точки/кривые', () => {
        const onChange = vi.fn();
        const { container } = setup({ curves: [curve1, curve2], onChange });
        const circles = container.querySelectorAll('circle');
        // Последняя circle относится к curve2 (единственная точка)
        const lastCircle = circles[circles.length - 1];
        fireEvent.mouseDown(lastCircle, { clientX: 0, clientY: 0 });
        fireEvent.mouseMove(window, { clientX: 20, clientY: 0 });
        fireEvent.mouseUp(window);

        const updated = onChange.mock.calls[0][0];
        const updatedCurve1 = updated.find(c => c.id === 'c1');
        expect(updatedCurve1.points).toEqual(curve1.points);
    });
});
