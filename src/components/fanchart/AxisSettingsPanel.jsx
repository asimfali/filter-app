import { useState, useEffect } from 'react'
import { X_UNITS, Y_UNITS } from '../../pages/fanchart/constants'
import Field from './Field'

export default function AxisSettingsPanel({ chart, onApply, onApplyAll }) {
  const [form, setForm] = useState({
    xMin: String(chart.x_min ?? chart.xDomain?.[0] ?? 0.3),
    xMax: String(chart.x_max ?? chart.xDomain?.[1] ?? 2),
    yMin: String(chart.y_min ?? chart.yDomain?.[0] ?? 60),
    yMax: String(chart.y_max ?? chart.yDomain?.[1] ?? 1000),
    scaleType: chart.scale_type ?? chart.scaleType ?? 'log',
    scaleRatio: String(chart.scale_ratio ?? ''),
    xLabel: chart.x_label ?? 'Q, тыс.м³/ч',
    yLabel: chart.y_label ?? 'Pv, Па',
    xScaleFactor: chart.x_scale_factor ?? 1.0,
    yScaleFactor: chart.y_scale_factor ?? 1.0,
    displayFactorX: chart.display_factor_x ?? 1.0,
    displayFactorY: chart.display_factor_y ?? 1.0,
  })

  // Синхронизируем если снаружи поменяли chart
  useEffect(() => {
    setForm({
      xMin: String(chart.x_min ?? chart.xDomain?.[0] ?? 0.3),
      xMax: String(chart.x_max ?? chart.xDomain?.[1] ?? 2),
      yMin: String(chart.y_min ?? chart.yDomain?.[0] ?? 60),
      yMax: String(chart.y_max ?? chart.yDomain?.[1] ?? 1000),
      scaleType: chart.scale_type ?? chart.scaleType ?? 'log',
      scaleRatio: String(chart.scale_ratio ?? ''),
      xLabel: chart.x_label ?? 'Q, тыс.м³/ч',
      yLabel: chart.y_label ?? 'Pv, Па',
      xScaleFactor: chart.x_scale_factor ?? 1.0,
      yScaleFactor: chart.y_scale_factor ?? 1.0,
      displayFactorX: chart.display_factor_x ?? 1.0,   // ← добавить
      displayFactorY: chart.display_factor_y ?? 1.0,   // ← добавить
    })
  }, [chart.id, chart.x_scale_factor, chart.y_scale_factor,
  chart.x_label, chart.y_label,
  chart.display_factor_x, chart.display_factor_y])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleApply = () => {
    const xMin = parseFloat(form.xMin)
    const xMax = parseFloat(form.xMax)
    const yMin = parseFloat(form.yMin)
    const yMax = parseFloat(form.yMax)
    const scaleRatio = form.scaleRatio !== '' ? parseFloat(form.scaleRatio) : null
    const xSF = parseFloat(form.xScaleFactor)
    const ySF = parseFloat(form.yScaleFactor)
    const dFX = parseFloat(form.displayFactorX)
    const dFY = parseFloat(form.displayFactorY)

    if ([xMin, xMax, yMin, yMax].some(isNaN) || xMin >= xMax || yMin >= yMax) return

    onApply({
      x_min: xMin,
      x_max: xMax,
      y_min: yMin,
      y_max: yMax,
      scale_type: form.scaleType,
      scale_ratio: scaleRatio,
      x_label: form.xLabel,
      y_label: form.yLabel,
      x_scale_factor: xSF,
      y_scale_factor: ySF,
      display_factor_x: dFX,
      display_factor_y: dFY,
      xDomain: [xMin, xMax],  // домены = границы в единицах БД
      yDomain: [yMin, yMax],
      scaleType: form.scaleType,
    })
  }

  const handleApplyAll = () => {
    // та же валидация что в handleApply
    const xMin = parseFloat(form.xMin)
    const xMax = parseFloat(form.xMax)
    const yMin = parseFloat(form.yMin)
    const yMax = parseFloat(form.yMax)
    if ([xMin, xMax, yMin, yMax].some(isNaN) || xMin >= xMax || yMin >= yMax) return

    onApplyAll?.({
      x_min: xMin, x_max: xMax, y_min: yMin, y_max: yMax,
      scale_type: form.scaleType,
      scale_ratio: form.scaleRatio !== '' ? parseFloat(form.scaleRatio) : null,
      x_label: form.xLabel, y_label: form.yLabel,
      x_scale_factor: parseFloat(form.xScaleFactor),
      y_scale_factor: parseFloat(form.yScaleFactor),
      display_factor_x: parseFloat(form.displayFactorX),
      display_factor_y: parseFloat(form.displayFactorY),
      xDomain: [xMin, xMax],
      yDomain: [yMin, yMax],
      scaleType: form.scaleType,
    })
  }

  return (
    <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-700
                    bg-gray-50 dark:bg-neutral-800 space-y-3">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        Границы осей
      </div>

      {/* Строка 1: границы */}
      <div className="flex flex-wrap items-end gap-3">
        <Field label={`Q min, ${X_UNITS.find(u => u.factor === form.xScaleFactor)?.label ?? 'тыс.м³/ч'}`} value={form.xMin} onChange={v => set('xMin', v)} />
        <Field label={`Q max, ${X_UNITS.find(u => u.factor === form.xScaleFactor)?.label ?? 'тыс.м³/ч'}`} value={form.xMax} onChange={v => set('xMax', v)} />
        <Field label={`Pv min, ${Y_UNITS.find(u => u.factor === form.yScaleFactor)?.label ?? 'Па'}`} value={form.yMin} onChange={v => set('yMin', v)} />
        <Field label={`Pv max, ${Y_UNITS.find(u => u.factor === form.yScaleFactor)?.label ?? 'Па'}`} value={form.yMax} onChange={v => set('yMax', v)} />
        <Field label="Соотношение масштабов" value={form.scaleRatio} onChange={v => set('scaleRatio', v)} placeholder="напр. 1.5" />
      </div>

      {/* Строка 2: единицы данных */}
      <div className="flex flex-wrap items-end gap-6">
        <div className="space-y-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">Данные хранятся X</label>
          <div className="flex gap-1">
            {X_UNITS.map(u => (
              <button key={u.label}
                onClick={() => { set('xScaleFactor', u.factor); set('xLabel', `Q, ${u.label}`) }}
                className={`text-xs px-3 py-2 rounded-lg border transition-colors
                                ${form.xScaleFactor === u.factor
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                {u.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">Данные хранятся Y</label>
          <div className="flex gap-1">
            {Y_UNITS.map(u => (
              <button key={u.label}
                onClick={() => { set('yScaleFactor', u.factor); set('yLabel', `Pv, ${u.label}`) }}
                className={`text-xs px-3 py-2 rounded-lg border transition-colors
                                ${form.yScaleFactor === u.factor
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                {u.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Строка 3: единицы отображения */}
      <div className="flex flex-wrap items-end gap-6">
        <div className="space-y-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">Показывать X в</label>
          <div className="flex gap-1">
            {X_UNITS.map(u => (
              <button key={u.label}
                onClick={() => { set('displayFactorX', u.factor); set('xLabel', `Q, ${u.label}`) }}
                className={`text-xs px-3 py-2 rounded-lg border transition-colors
                                ${form.displayFactorX === u.factor
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                {u.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">Показывать Y в</label>
          <div className="flex gap-1">
            {Y_UNITS.map(u => (
              <button key={u.label}
                onClick={() => { set('displayFactorY', u.factor); set('yLabel', `Pv, ${u.label}`) }}
                className={`text-xs px-3 py-2 rounded-lg border transition-colors
                                ${form.displayFactorY === u.factor
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                {u.label}
              </button>
            ))}
          </div>
        </div>
        <Field label="Подпись оси X" value={form.xLabel} onChange={v => set('xLabel', v)} placeholder="Q, тыс.м³/ч" />
        <Field label="Подпись оси Y" value={form.yLabel} onChange={v => set('yLabel', v)} placeholder="Pv, Па" />
      </div>

      {/* Строка 4: шкала + кнопка */}
      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">Шкала</label>
          <div className="flex gap-1">
            {[['log', 'Лог'], ['linear', 'Линейная']].map(([val, label]) => (
              <button key={val} onClick={() => set('scaleType', val)}
                className={`text-xs px-3 py-2 rounded-lg border transition-colors
                                ${form.scaleType === val
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={handleApply}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white
                           px-4 py-2 rounded-lg transition-colors self-end">
          Применить
        </button>
        {onApplyAll && (
          <button onClick={handleApplyAll}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white
                 px-4 py-2 rounded-lg transition-colors self-end">
            Применить ко всем
          </button>
        )}
      </div>
    </div>
  )
}
