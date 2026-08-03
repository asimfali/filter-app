import { useState } from 'react'
import { selectionApi } from '../../api/selection'
import Field from './Field'

export default function NetworkCurvePanel({ xDomain, onNetworkCurve, onOperatingPoint,
  productFilter, onSelection, onCalc, scaleType = 'log', chartId = null,
  xLabel = 'Q, тыс.м³/ч', yLabel = 'Pv, Па', xScaleFactor = 1.0, yScaleFactor = 1.0 }) {
  const [qRef, setQRef] = useState('')
  const [pvRef, setPvRef] = useState('')
  const [nAbove, setNAbove] = useState(3)
  const [nBelow, setNBelow] = useState(1)

  const handleCalc = async () => {
    const qRaw = parseFloat(qRef.replace(',', '.'))
    const pv = parseFloat(pvRef.replace(',', '.'))
    if (!qRaw || !pv) return

    const q = qRaw
    onCalc?.({ q, pv })

    const R = pv / (q * q)
    const [xMin, xMax] = xDomain

    const networkPoints = scaleType === 'log'
      ? [
        { x: xMin, y: parseFloat((R * xMin * xMin).toFixed(2)) },
        { x: xMax, y: parseFloat((R * xMax * xMax).toFixed(2)) },
      ]
      : Array.from({ length: 51 }, (_, i) => {
        const x = xMin + (xMax - xMin) * i / 50
        const y = R * x * x
        if (!isFinite(y) || y < 0) return null
        return { x: parseFloat(x.toFixed(2)), y: parseFloat(y.toFixed(2)) }
      }).filter(Boolean)

    onNetworkCurve({
      id: 'network',
      curve_type: 'NETWORK',
      label: 'Сеть',
      color: '#6b7280',
      interpolation: 'linear',
      points: networkPoints,
    })

    // ── НОВОЕ: подбор ближайших кривых ──
    if (productFilter && onSelection) {
      const { ok, data } = await selectionApi.fanChartSelect(
        q, pv, productFilter,
        nAbove, nBelow,
      )
      if (ok && data.success) {   // ← добавить
        onSelection(data.data)
      }
    }

    if (typeof chartId !== 'undefined' && chartId) {
      const { ok, data } = await selectionApi.fanChartOperatingPoint(chartId, q, pv)
      if (ok && data.success) {
        onOperatingPoint([
          { q, pv, is_target: true, in_working_zone: true },
          ...data.data,
        ])
      }
    }
  }

  const handleClear = () => {
    onNetworkCurve(null)
    onOperatingPoint(null)
    onSelection?.(null)
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200
                    dark:border-gray-700 bg-gray-50 dark:bg-neutral-800">
      <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
        Характеристика сети:
      </span>
      <Field label={xLabel} value={qRef} onChange={setQRef} placeholder="1.5" />
      <Field label={yLabel} value={pvRef} onChange={setPvRef} placeholder="200" />
      {/* Разделитель */}
      <span className="text-xs text-gray-400 shrink-0">Подобрать:</span>
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 shrink-0">выше:</span>
        <input
          type="number"
          min={0} max={10}
          value={nAbove}
          onChange={e => setNAbove(parseInt(e.target.value) || 0)}
          className="with-arrows w-14 text-sm rounded-lg border border-gray-200 dark:border-gray-700
               bg-white dark:bg-neutral-800 text-gray-900 dark:text-white
               px-2 py-2 focus:outline-none focus:border-blue-500"
        />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 shrink-0">ниже:</span>
        <input
          type="number"
          min={0} max={10}
          value={nBelow}
          onChange={e => setNBelow(parseInt(e.target.value) || 0)}
          className="with-arrows w-14 text-sm rounded-lg border border-gray-200 dark:border-gray-700
               bg-white dark:bg-neutral-800 text-gray-900 dark:text-white
               px-2 py-2 focus:outline-none focus:border-blue-500"
        />
      </div>
      <button onClick={handleCalc}
        className="text-xs bg-gray-600 hover:bg-gray-700 text-white
                   px-3 py-2 rounded-lg transition-colors shrink-0">
        Построить
      </button>
      <button onClick={handleClear}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors shrink-0">
        Очистить
      </button>
    </div>
  )
}
