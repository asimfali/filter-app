import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { scaleLog, scaleLinear } from '@visx/scale'
import { LinePath } from '@visx/shape'
import { AxisBottom, AxisLeft } from '@visx/axis'
import { GridRows, GridColumns } from '@visx/grid'
import { curveMonotoneX, curveLinear } from 'd3-shape'

const CURVE_COLORS = {
  PRESSURE: '#1d4ed8',  // синий
  EFFICIENCY: '#16a34a',  // зелёный  
  POWER: '#0072b6',  // голубой (как в оригинале)
  TIP_SPEED: '#9333ea',  // фиолетовый
}

export const CURVE_TYPE_LABELS = {
  PRESSURE: 'Давление Pv(Q)',
  EFFICIENCY: 'КПД η(Q)',
  POWER: 'Мощность Nu(Q)',
  TIP_SPEED: 'Окружная скорость u(Q)',
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
  xDomain: xDomainProp = [0.3, 2],
  yDomain: yDomainProp = [60, 1000],
  editable = true,
  scaleType = 'log',
  activeCurveId = null,
  onAddPoint,
  editTool = 'move',
  operatingPoint = null,
  onCurveClick = null,
  xLabel = 'Q, тыс.м³/ч',
  yLabel = 'Pv, Па',
}) {
  const rightMargin = useMemo(() => {
    const maxLabelLen = curves
      .filter(c => c.label)
      .reduce((max, c) => Math.max(max, c.label.length), 0)
    return Math.max(40, maxLabelLen * 6 + 16)
  }, [curves])

  const margin = useMemo(() => (
    { top: 20, right: rightMargin, bottom: 60, left: 65 }
  ), [rightMargin])

  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom

  const xDomain = useMemo(() => {
    const [a, b] = xDomainProp
    return [a <= 0 ? 0.01 : a, b]
  }, [xDomainProp])

  const yDomain = useMemo(() => {
    const [a, b] = yDomainProp
    return [a <= 0 ? 0.1 : a, b]
  }, [yDomainProp])

  const curvesRef = useRef(curves)
  useEffect(() => { curvesRef.current = curves }, [curves])

  const [tooltip, setTooltip] = useState(null)
  const svgRef = useRef(null)

  const bgColor = document.documentElement.classList.contains('dark') ? '#171717' : '#ffffff'

  const xScale = useMemo(() => {
    const fn = scaleType === 'log' ? scaleLog : scaleLinear
    return fn({ domain: xDomain, range: [0, innerW], ...(scaleType === 'log' ? { base: 10 } : {}) })
  }, [xDomain, innerW, scaleType])

  const yScale = useMemo(() => {
    const fn = scaleType === 'log' ? scaleLog : scaleLinear
    return fn({ domain: yDomain, range: [innerH, 0], ...(scaleType === 'log' ? { base: 10 } : {}) })
  }, [yDomain, innerH, scaleType])

  const [hoveredCurve, setHoveredCurve] = useState(null)
  const [curveTooltip, setCurveTooltip] = useState(null)

  const handleTooltip = useCallback((screenX, screenY) => {
    if (screenX === null) { setTooltip(null); return }
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const svgX = screenX - rect.left - margin.left
    const svgY = screenY - rect.top - margin.top
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

  const xTicksAll = useMemo(() => {
    if (scaleType !== 'log') {
      // Для линейной — равномерные тики (5-10 штук)
      const [xMin, xMax] = xDomain
      const step = (xMax - xMin) / 8
      const magnitude = Math.pow(10, Math.floor(Math.log10(step)))
      const niceStep = Math.ceil(step / magnitude) * magnitude
      const ticks = []
      const start = Math.ceil(xMin / niceStep) * niceStep
      for (let v = start; v <= xMax + niceStep * 0.01; v += niceStep) {
        ticks.push(parseFloat(v.toPrecision(10)))
      }
      return ticks
    }
    const [xMin, xMax] = xDomain
    const ticks = []
    const minExp = Math.floor(Math.log10(xMin))
    const maxExp = Math.ceil(Math.log10(xMax))
    for (let exp = minExp; exp <= maxExp; exp++) {
      for (const mult of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
        const v = parseFloat((mult * 10 ** exp).toPrecision(10))
        if (v >= xMin * 0.999 && v <= xMax * 1.001) ticks.push(v)
      }
    }
    return ticks
  }, [xDomain, innerW, scaleType])

  const yTicksAll = useMemo(() => {
    if (scaleType !== 'log') {
      const [yMin, yMax] = yDomain
      const step = (yMax - yMin) / 8
      const magnitude = Math.pow(10, Math.floor(Math.log10(step)))
      const niceStep = Math.ceil(step / magnitude) * magnitude
      const ticks = []
      const start = Math.ceil(yMin / niceStep) * niceStep
      for (let v = start; v <= yMax + niceStep * 0.01; v += niceStep) {
        ticks.push(parseFloat(v.toPrecision(10)))
      }
      return ticks
    }
    const [yMin, yMax] = yDomain
    const ticks = []
    const minExp = Math.floor(Math.log10(yMin))
    const maxExp = Math.ceil(Math.log10(yMax))
    for (let exp = minExp; exp <= maxExp; exp++) {
      for (const mult of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
        const v = mult * 10 ** exp
        if (v >= yMin && v <= yMax) ticks.push(v)
      }
    }
    return ticks
  }, [yDomain, innerH, scaleType])

  // ← добавить сразу после:
  const xTicksLabels = useMemo(
    () => filterTicks(xTicksAll ?? [], xScale, 28),
    [xTicksAll, xScale]
  )
  const yTicksLabels = useMemo(
    () => filterTicks(yTicksAll ?? [], yScale, 18),
    [yTicksAll, yScale]
  )

  function filterTicks(ticks, scale, minPx) {
    if (!ticks.length) return ticks
    const result = [ticks[0]]
    for (let i = 1; i < ticks.length; i++) {
      const prev = result[result.length - 1]
      const dist = Math.abs(scale(ticks[i]) - scale(prev))
      if (dist >= minPx) result.push(ticks[i])
    }
    return result
  }

  const labelPositions = useMemo(() => {
    const MIN_PX = 14

    // Для каждой кривой пробуем конец, потом начало — берём где больше места
    const positions = curves
      .filter(c => c.points?.length > 0 && c.label)
      .map(curve => {
        const sorted = [...curve.points].sort((a, b) => a.x - b.x)
        // Берём точку на 85% длины кривой по X
        const targetX = sorted[0].x + (sorted.at(-1).x - sorted[0].x) * 0.85
        const pt = sorted.reduce((best, p) =>
          Math.abs(p.x - targetX) < Math.abs(best.x - targetX) ? p : best
        )
        return { id: curve.id, x: pt.x, y: pt.y, labelY: pt.y, label: curve.label }
      })
      .sort((a, b) => yScale(a.y) - yScale(b.y))

    // Разнос: сначала вниз
    for (let i = 1; i < positions.length; i++) {
      const prevPx = yScale(positions[i - 1].labelY)
      const currPx = yScale(positions[i].labelY)
      if (currPx - prevPx < MIN_PX)
        positions[i].labelY = yScale.invert(prevPx + MIN_PX)
    }

    // Если вышли за нижнюю границу — разносим обратно вверх
    const [yMin] = yScale.domain()
    for (let i = positions.length - 1; i >= 0; i--) {
      if (positions[i].labelY < yMin) {
        positions[i].labelY = yMin
        if (i > 0) {
          const currPx = yScale(positions[i].labelY)
          const prevPx = yScale(positions[i - 1].labelY)
          if (prevPx - currPx < MIN_PX)
            positions[i - 1].labelY = yScale.invert(currPx - MIN_PX)
        }
      }
    }

    return positions
  }, [curves, yScale])

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-2 w-full">
      <svg ref={svgRef} width={width} height={height}>
        <g
          transform={`translate(${margin.left},${margin.top})`}
          onClick={editable && activeCurveId && editTool === 'add' ? (e) => {
            if (e.target.tagName === 'circle') return
            const rect = svgRef.current?.getBoundingClientRect()
            if (!rect) return
            const svgX = e.clientX - rect.left - margin.left
            const svgY = e.clientY - rect.top - margin.top
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
            stroke="#e5e7eb" strokeDasharray="3,3" tickValues={yTicksAll} />
          <GridColumns scale={xScale} height={innerH}
            stroke="#e5e7eb" strokeDasharray="3,3" tickValues={xTicksAll} />

          <AxisBottom top={innerH} scale={xScale} tickValues={xTicksLabels}
            tickFormat={v => {
              if (v >= 1000) return `${Math.round(v)}`
              if (v >= 1) return String(v)
              return String(parseFloat(v.toPrecision(2)))
            }}
            labelProps={{ fontSize: 12, fill: '#6b7280', textAnchor: 'middle', dy: 38 }}
            tickLabelProps={{ fontSize: 10, fill: '#6b7280', textAnchor: 'middle' }}
            stroke="#9ca3af" tickStroke="#9ca3af" />

          {/* Подпись оси X */}
          <text x={innerW} y={innerH + 48} textAnchor="end" fontSize={12} fill="#6b7280">
            {xLabel}
          </text>

          <AxisLeft scale={yScale} tickValues={yTicksLabels}
            tickFormat={v => {
              if (v >= 1) return String(v)
              if (v >= 0.01) return String(parseFloat(v.toPrecision(2)))
              return String(parseFloat(v.toPrecision(1)))
            }}
            labelProps={{ fontSize: 12, fill: '#6b7280', textAnchor: 'middle', dx: -42 }}
            tickLabelProps={{ fontSize: 10, fill: '#6b7280', textAnchor: 'end', dy: 3 }}
            stroke="#9ca3af" tickStroke="#9ca3af" />

          {/* Подпись оси Y */}
          <text x={-margin.left + 4} y={-8} textAnchor="start" fontSize={12} fill="#6b7280">
            {yLabel}
          </text>

          {curves.map((curve, ci) => {
            const color = curve.color || (
              curve.curve_type === 'PRESSURE' ? '#111827' : (CURVE_COLORS[curve.curve_type] ?? '#374151')
            )
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
                    strokeWidth={
                      curve.curve_type === 'PRESSURE' ? 2.5 :
                        curve.curve_type === 'EFFICIENCY' ? 0.8 : 1.5
                    }
                    fill="none"
                    opacity={activeCurveId && !isActive ? 0.35 : 1}
                    onClick={() => onCurveClick?.(curve.id)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => {
                      setHoveredCurve(curve.id)
                      const rect = svgRef.current?.getBoundingClientRect()
                      if (rect) setCurveTooltip({
                        label: curve.label || CURVE_TYPE_LABELS[curve.curve_type] || curve.curve_type,
                        color,
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top - 10,
                      })
                    }}
                    onMouseLeave={() => {
                      setHoveredCurve(null)
                      setCurveTooltip(null)
                    }}
                  />
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
          {/* Подписи кривых с разносом по Y */}
          {labelPositions.map(pos => {
            const curve = curves.find(c => c.id === pos.id)
            const color = curve?.color ||
              (curve?.curve_type === 'PRESSURE' ? '#111827' : (CURVE_COLORS[curve?.curve_type] ?? '#374151'))
            const isActive = activeCurveId != null && pos.id == activeCurveId
            const labelW = pos.label.length * 6 + 8
            const labelH = 14

            return (
              <g key={`label-${pos.id}`}
                opacity={activeCurveId && !isActive ? 0.35 : 1}>
                <line
                  x1={xScale(pos.x)} y1={yScale(pos.y)}
                  x2={xScale(pos.x) + 4} y2={yScale(pos.labelY)}
                  stroke={color} strokeWidth={0.5} opacity={0.6}
                />
                {/* Фоновый прямоугольник */}
                <rect
                  x={xScale(pos.x) + 6}
                  y={yScale(pos.labelY) - labelH / 2 - 1}
                  width={labelW}
                  height={labelH + 2}
                  rx={2}
                  fill="white"
                  opacity={0.85}
                />
                <text
                  x={xScale(pos.x) + 10}
                  y={yScale(pos.labelY)}
                  fontSize={10} fill={bgColor}
                  dominantBaseline="middle"
                >
                  {pos.label}
                </text>
              </g>
            )
          })}

          {/* Рабочие точки */}
          {operatingPoint && operatingPoint.map((op, i) => {
            const cx = xScale(op.q)
            const cy = yScale(op.pv)
            const color = op.is_target
              ? '#f97316'
              : op.in_working_zone !== false ? '#0891b2' : '#ef4444'
            const line1 = `Q=${op.q} тыс.м³/ч`
            const line2 = `Pv=${op.pv} Па`
            const labelW = Math.max(line1.length, line2.length) * 6.5 + 12

            // Чередуем: чётные — вправо-вверх, нечётные — влево-вверх
            const side = i % 2 === 0 ? 1 : -1
            const offsetX = side === 1 ? 10 : -(labelW + 10)
            const offsetY = -20 - Math.floor(i / 2) * 50  // каждая пара ниже предыдущей

            return (
              <g key={i}>
                <line x1={cx} y1={cy} x2={cx} y2={innerH}
                  stroke={color} strokeWidth={1} strokeDasharray="4,3" opacity={0.5} />
                <line x1={0} y1={cy} x2={cx} y2={cy}
                  stroke={color} strokeWidth={1} strokeDasharray="4,3" opacity={0.5} />
                <circle cx={cx} cy={cy} r={6} fill={color} stroke="white" strokeWidth={2} />
                {/* Линия от точки до подписи */}
                <line
                  x1={cx} y1={cy}
                  x2={cx + offsetX + (side === 1 ? 0 : labelW)}
                  y2={cy + offsetY + 36}
                  stroke={color} strokeWidth={1} opacity={0.5}
                />
                <g transform={`translate(${cx + offsetX}, ${cy + offsetY})`}>
                  <rect x={-4} y={-4} width={labelW} height={36} rx={4}
                    fill="white" stroke={color} strokeWidth={1}
                    className="dark:fill-neutral-900"
                  />
                  <text x={labelW / 2 - 4} y={10} textAnchor="middle"
                    fontSize={11} fill={color} fontWeight="500">
                    {line1}
                  </text>
                  <text x={labelW / 2 - 4} y={25} textAnchor="middle"
                    fontSize={11} fill={color} fontWeight="500">
                    {line2}
                  </text>
                </g>
              </g>
            )
          })}
        </g>

        {tooltip && (
          <g>
            <line x1={tooltip.screenX} y1={margin.top}
              x2={tooltip.screenX} y2={margin.top + innerH}
              stroke="#6b7280" strokeWidth={1} strokeDasharray="4,3" />
            <line x1={margin.left} y1={tooltip.screenY}
              x2={margin.left + innerW} y2={tooltip.screenY}
              stroke="#6b7280" strokeWidth={1} strokeDasharray="4,3" />
            <g transform={`translate(${tooltip.screenX}, ${tooltip.screenY})`}>
              <rect x={8} y={-28} width={120} height={22} rx={4} fill="rgba(0,0,0,0.75)" />
              <text x={68} y={-13} textAnchor="middle" fontSize={11} fill="white">
                Q={tooltip.x}  Pv={tooltip.y} Па
              </text>
            </g>
          </g>
        )}
        {curveTooltip && (
          <g transform={`translate(${curveTooltip.x}, ${curveTooltip.y})`}>
            <rect
              x={-4} y={-18}
              width={curveTooltip.label.length * 7 + 8}
              height={22} rx={4}
              fill="rgba(0,0,0,0.75)"
            />
            <text
              x={curveTooltip.label.length * 3.5}
              y={-3}
              textAnchor="middle"
              fontSize={11}
              fill={curveTooltip.color}
            >
              {curveTooltip.label}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}
