import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { scaleLog, scaleLinear } from '@visx/scale'
import { LinePath } from '@visx/shape'
import { AxisBottom, AxisLeft } from '@visx/axis'
import { GridRows, GridColumns } from '@visx/grid'
import { curveMonotoneX, curveLinear } from 'd3-shape'

const MARGIN = { top: 20, right: 40, bottom: 50, left: 60 }

const CURVE_COLORS = {
  PRESSURE: '#1d4ed8',
  EFFICIENCY: '#16a34a',
  POWER: '#d97706',
  TIP_SPEED: '#9333ea',
}

function clampToScale(scale, value) {
  const [min, max] = scale.domain()
  return Math.max(min, Math.min(max, value))
}

function DraggablePoint({ cx, cy, onDragMove, onTooltip, color }) {
  const startPos = useRef(null)

  const handleMouseDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    startPos.current = { x: e.clientX, y: e.clientY }

    const onMove = (e) => {
      const dx = e.clientX - startPos.current.x
      const dy = e.clientY - startPos.current.y
      startPos.current = { x: e.clientX, y: e.clientY }
      onDragMove(dx, dy)
      onTooltip?.(e.clientX, e.clientY)
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      onTooltip?.(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <circle
      cx={cx} cy={cy} r={5}
      fill={color} stroke="white" strokeWidth={1.5}
      style={{ cursor: 'grab', touchAction: 'none' }}
      onMouseDown={handleMouseDown}
    />
  )
}

export default function FanChartEditor({
  width = 700,
  height = 500,
  curves = [],          // ← controlled: управляется снаружи
  onChange,             // ← обязателен для drag
  xDomain = [0.3, 2],
  yDomain = [60, 1000],
  editable = true,
  scaleType = 'log',
  activeCurveId = null,
  onAddPoint,
  editTool = 'move',
}) {
  const innerW = width - MARGIN.left - MARGIN.right
  const innerH = height - MARGIN.top - MARGIN.bottom

  const curvesRef = useRef(curves)
  useEffect(() => { curvesRef.current = curves }, [curves])

  const [tooltip, setTooltip] = useState(null)
  const svgRef = useRef(null)

  const xScale = useMemo(() => {
    const fn = scaleType === 'log' ? scaleLog : scaleLinear
    return fn({ domain: xDomain, range: [0, innerW], ...(scaleType === 'log' ? { base: 10 } : {}) })
  }, [xDomain, innerW, scaleType])

  const yScale = useMemo(() => {
    const fn = scaleType === 'log' ? scaleLog : scaleLinear
    return fn({ domain: yDomain, range: [innerH, 0], ...(scaleType === 'log' ? { base: 10 } : {}) })
  }, [yDomain, innerH, scaleType])

  const handleTooltip = useCallback((screenX, screenY) => {
    if (screenX === null) { setTooltip(null); return }
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const svgX = screenX - rect.left - MARGIN.left
    const svgY = screenY - rect.top - MARGIN.top
    setTooltip({
      x: +xScale.invert(svgX).toFixed(3),
      y: +yScale.invert(svgY).toFixed(1),
      screenX: screenX - rect.left,
      screenY: screenY - rect.top,
    })
  }, [xScale, yScale])

  // Drag — обновляем через onChange наружу
  const handleDrag = (curveIdx, pointIdx, dx, dy) => {
    const next = curvesRef.current.map((c, ci) => {
      if (ci !== curveIdx) return c
      return {
        ...c,
        points: c.points.map((p, pi) => {
          if (pi !== pointIdx) return p
          const newX = clampToScale(xScale, xScale.invert(xScale(p.x) + dx))
          const newY = clampToScale(yScale, yScale.invert(yScale(p.y) + dy))
          return { ...p, x: +newX.toFixed(4), y: +newY.toFixed(4) }
        }),
      }
    })
    onChange?.(next)
  }

  const xTicks = scaleType === 'log'
    ? [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1, 1.5, 2]
    : undefined
  const yTicks = scaleType === 'log'
    ? [60, 80, 100, 150, 200, 300, 400, 500, 600, 800, 1000]
    : undefined

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-2 inline-block">
      <svg ref={svgRef} width={width} height={height}>
        {/* debug — убрать после */}
        {console.log('render check', { editable, activeCurveId })}
        <g
          transform={`translate(${MARGIN.left},${MARGIN.top})`}
          onClick={editable && activeCurveId && editTool === 'add' ? (e) => {
            if (e.target.tagName === 'circle') return
            const rect = svgRef.current?.getBoundingClientRect()
            if (!rect) return
            const svgX = e.clientX - rect.left - MARGIN.left
            const svgY = e.clientY - rect.top - MARGIN.top
            const x = +xScale.invert(svgX).toFixed(3)
            const y = +yScale.invert(svgY).toFixed(1)
            if (x > 0 && y > 0) onAddPoint?.(activeCurveId, { x, y })
          } : undefined}
          style={{
            cursor: editable && activeCurveId
              ? (editTool === 'add' ? 'crosshair' : 'default')
              : 'default'
          }}
        >
          {/* Невидимая область для перехвата кликов */}
          <rect width={innerW} height={innerH} fill="transparent" />
          <GridRows scale={yScale} width={innerW}
            stroke="#e5e7eb" strokeDasharray="3,3" tickValues={yTicks} />
          <GridColumns scale={xScale} height={innerH}
            stroke="#e5e7eb" strokeDasharray="3,3" tickValues={xTicks} />

          <AxisBottom top={innerH} scale={xScale} tickValues={xTicks}
            tickFormat={v => v} label="Q, тыс.м³/час"
            labelProps={{ fontSize: 12, fill: '#374151', textAnchor: 'middle', dy: 36 }}
            tickLabelProps={{ fontSize: 10, fill: '#6b7280', textAnchor: 'middle' }}
            stroke="#9ca3af" tickStroke="#9ca3af" />
          <AxisLeft scale={yScale} tickValues={yTicks}
            tickFormat={v => v} label="Pv, Па"
            labelProps={{ fontSize: 12, fill: '#374151', textAnchor: 'middle', dx: -36 }}
            tickLabelProps={{ fontSize: 10, fill: '#6b7280', textAnchor: 'end', dy: 3 }}
            stroke="#9ca3af" tickStroke="#9ca3af" />

          {curves.map((curve, ci) => {
            const color = curve.color || (CURVE_COLORS[curve.curve_type] ?? '#374151')
            // eslint-disable-next-line eqeqeq
            const isActive = activeCurveId != null && curve.id == activeCurveId
            const sorted = [...curve.points].sort((a, b) => a.x - b.x)

            return (
              <g key={curve.id ?? ci}>
                {sorted.length >= 2 && (
                  <LinePath
                    data={sorted}
                    x={d => xScale(d.x)}
                    y={d => yScale(d.y)}
                    curve={curve.interpolation === 'linear' ? curveLinear : curveMonotoneX}
                    stroke={color}
                    strokeWidth={isActive ? 2.5 : 2}
                    fill="none"
                    opacity={activeCurveId && !isActive ? 0.35 : 1}
                  />
                )}
                {sorted.length > 0 && (
                  <text
                    x={xScale(sorted.at(-1).x) + 6}
                    y={yScale(sorted.at(-1).y)}
                    fontSize={10} fill={color}
                    dominantBaseline="middle"
                    opacity={activeCurveId && !isActive ? 0.35 : 1}
                  >
                    {curve.label}
                  </text>
                )}
                {editable && curve.points.map((pt, pi) => (
                  <DraggablePoint
                    key={pi}
                    cx={xScale(pt.x)}
                    cy={yScale(pt.y)}
                    color={color}
                    onDragMove={(dx, dy) => handleDrag(ci, pi, dx, dy)}
                    onTooltip={handleTooltip}
                  />
                ))}
              </g>
            )
          })}
        </g>

        {tooltip && (
          <g>
            <line x1={tooltip.screenX} y1={MARGIN.top}
              x2={tooltip.screenX} y2={MARGIN.top + innerH}
              stroke="#6b7280" strokeWidth={1} strokeDasharray="4,3" />
            <line x1={MARGIN.left} y1={tooltip.screenY}
              x2={MARGIN.left + innerW} y2={tooltip.screenY}
              stroke="#6b7280" strokeWidth={1} strokeDasharray="4,3" />
            <g transform={`translate(${tooltip.screenX}, ${tooltip.screenY})`}>
              <rect x={8} y={-28} width={120} height={22} rx={4} fill="rgba(0,0,0,0.75)" />
              <text x={68} y={-13} textAnchor="middle" fontSize={11} fill="white">
                Q={tooltip.x}  Pv={tooltip.y} Па
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  )
}

export const DEMO_CURVES = [
  {
    id: 1, curve_type: 'PRESSURE', label: 'n=2750 об/мин', interpolation: 'spline',
    points: [
      { x: 0.5, y: 500 }, { x: 0.7, y: 480 }, { x: 1.0, y: 430 },
      { x: 1.4, y: 350 }, { x: 1.8, y: 220 }, { x: 2.0, y: 140 },
    ],
  },
  {
    id: 2, curve_type: 'PRESSURE', label: 'n=1350 об/мин', interpolation: 'spline',
    points: [
      { x: 0.35, y: 120 }, { x: 0.5, y: 110 }, { x: 0.7, y: 90 },
      { x: 0.85, y: 70 }, { x: 1.0, y: 55 },
    ],
  },
  {
    id: 3, curve_type: 'EFFICIENCY', label: 'η=0.68', interpolation: 'spline',
    points: [{ x: 0.8, y: 390 }, { x: 1.0, y: 430 }, { x: 1.2, y: 400 }],
  },
  {
    id: 4, curve_type: 'POWER', label: 'Nu=0.37 кВт', interpolation: 'linear',
    points: [{ x: 0.7, y: 250 }, { x: 1.0, y: 350 }, { x: 1.4, y: 480 }],
  },
]