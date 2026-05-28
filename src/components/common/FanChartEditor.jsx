import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { scaleLog, scaleLinear } from '@visx/scale'
import { LinePath } from '@visx/shape'
import { AxisBottom, AxisLeft } from '@visx/axis'
import { GridRows, GridColumns } from '@visx/grid'
import { curveMonotoneX, curveLinear } from 'd3-shape'

const MARGIN = { top: 20, right: 40, bottom: 60, left: 65 }

const CURVE_COLORS = {
  PRESSURE: '#1d4ed8',  // синий
  EFFICIENCY: '#16a34a',  // зелёный  
  POWER: '#0072b6',  // голубой (как в оригинале)
  TIP_SPEED: '#9333ea',  // фиолетовый
}

const CURVE_TYPE_LABELS = {
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
  const innerW = width - MARGIN.left - MARGIN.right
  const innerH = height - MARGIN.top - MARGIN.bottom

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

  const xTicks = useMemo(() => {
    if (scaleType !== 'log') return undefined
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
  }, [xDomain, scaleType])

  const yTicks = useMemo(() => {
    if (scaleType !== 'log') return undefined
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
  }, [yDomain, scaleType])

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-2 w-full">
      <svg ref={svgRef} width={width} height={height}>
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
            tickFormat={v => v >= 1 ? String(v) : String(parseFloat(v.toPrecision(2)))}
            label="Q, тыс.м³/ч"
            labelProps={{ fontSize: 12, fill: '#6b7280', textAnchor: 'middle', dy: 38 }}
            tickLabelProps={{ fontSize: 10, fill: '#6b7280', textAnchor: 'middle' }}
            stroke="#9ca3af" tickStroke="#9ca3af" />

          {/* Подпись оси X */}
          <text x={innerW} y={innerH + 48} textAnchor="end" fontSize={12} fill="#6b7280">
            {xLabel}
          </text>

          <AxisLeft scale={yScale} tickValues={yTicks}
            tickFormat={v => v} label="Pv, Па"
            labelProps={{ fontSize: 12, fill: '#6b7280', textAnchor: 'middle', dx: -42 }}
            tickLabelProps={{ fontSize: 10, fill: '#6b7280', textAnchor: 'end', dy: 3 }}
            stroke="#9ca3af" tickStroke="#9ca3af" />

          {/* Подпись оси Y */}
          <text x={-MARGIN.left + 4} y={-8} textAnchor="start" fontSize={12} fill="#6b7280">
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
