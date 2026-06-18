import { useRef, useEffect, useState } from 'react'
import FanChartEditor from '../components/common/FanChartEditor'
import { tokenStorage } from '../api/auth'
import { selectionApi } from '../api/selection'
import ConfirmModal from '../components/common/ConfirmModal'

// ─── Константы ───────────────────────────────────────────────────────────────

const X_UNITS = [
  { label: 'тыс.м³/ч', factor: 1.0 },
  { label: 'м³/ч', factor: 1000.0 },
  { label: 'л/с', factor: 277.78 },
]

const Y_UNITS = [
  { label: 'Па', factor: 1.0 },
  { label: 'кПа', factor: 0.001 },
]

const CURVE_COLORS = {
  PRESSURE: '#1d4ed8',
  EFFICIENCY: '#16a34a',
  POWER: '#d97706',
  TIP_SPEED: '#9333ea',
  NETWORK: '#6b7280',
}

const D_RATIO_COLORS = [
  '#ef4444', '#f97316', '#1d4ed8', '#16a34a',
  '#9333ea', '#0891b2', '#ca8a04', '#be185d',
]

const CURVE_TYPE_LABELS = {
  PRESSURE: 'Давление Pv(Q)',
  EFFICIENCY: 'КПД η(Q)',
  POWER: 'Мощность Nu(Q)',
  TIP_SPEED: 'Окружная скорость u(Q)',
}

function NetworkCurvePanel({ xDomain, onNetworkCurve, onOperatingPoint,
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

function AxisSettingsPanel({ chart, onApply, onApplyAll }) {
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

// ─── Модалка создания графика ─────────────────────────────────────────────────

function CreateChartModal({ productExternalId, onCreated, onClose }) {
  const [form, setForm] = useState({
    d_ratio: '1.0',
    temperature: '20',
    source_page: '',
    xMin: '0.3', xMax: '2',
    yMin: '60', yMax: '1000',
    scaleType: 'log', // 'log' | 'linear'
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleCreate = () => {
    const chart = {
      id: `new_${Date.now()}`,
      product_external_id: productExternalId,
      d_ratio: parseFloat(form.d_ratio),
      temperature: parseFloat(form.temperature),
      source_page: form.source_page ? parseInt(form.source_page) : null,
      xDomain: [parseFloat(form.xMin), parseFloat(form.xMax)],
      yDomain: [parseFloat(form.yMin), parseFloat(form.yMax)],
      scaleType: form.scaleType,
      curves: [],
    }
    onCreated(chart)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Новый график
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        {/* Условия */}
        <div className="space-y-3">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Условия</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="D/Dном" value={form.d_ratio} onChange={v => set('d_ratio', v)}
              placeholder="0.9" />
            <Field label="Температура, °C" value={form.temperature} onChange={v => set('temperature', v)}
              placeholder="20" />
            <Field label="Страница каталога" value={form.source_page} onChange={v => set('source_page', v)}
              placeholder="необязательно" />
          </div>
        </div>

        {/* Границы осей */}
        <div className="space-y-3">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Границы осей
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Q min (тыс.м³/ч)" value={form.xMin} onChange={v => set('xMin', v)} />
            <Field label="Q max (тыс.м³/ч)" value={form.xMax} onChange={v => set('xMax', v)} />
            <Field label="Pv min (Па)" value={form.yMin} onChange={v => set('yMin', v)} />
            <Field label="Pv max (Па)" value={form.yMax} onChange={v => set('yMax', v)} />
          </div>
        </div>

        {/* Тип шкалы */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Шкала</div>
          <div className="flex gap-2">
            {[['log', 'Логарифмическая'], ['linear', 'Линейная']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => set('scaleType', val)}
                className={`flex-1 text-xs px-3 py-2 rounded-lg border transition-colors
                  ${form.scaleType === val
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 text-sm border border-gray-200 dark:border-gray-700
                       text-gray-600 dark:text-gray-400 px-4 py-2 rounded-lg
                       hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
            Отмена
          </button>
          <button onClick={handleCreate}
            className="flex-1 text-sm bg-blue-600 hover:bg-blue-700 text-white
                       px-4 py-2 rounded-lg transition-colors">
            Создать
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Модалка добавления кривой ────────────────────────────────────────────────

function AddCurveModal({ onAdd, onClose }) {
  const [form, setForm] = useState({
    curve_type: 'PRESSURE',
    label: '',
    param_value: '',
    param_unit: '',
    interpolation: 'spline',
    color: '',  // ← добавить, пусто = цвет по типу
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleAdd = () => {
    if (!form.label.trim()) return
    onAdd({
      id: `curve_${Date.now()}`,
      curve_type: form.curve_type,
      label: form.label,
      param_value: form.param_value ? parseFloat(form.param_value) : null,
      param_unit: form.param_unit,
      interpolation: form.interpolation,
      color: form.color || null,
      points: [],
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Добавить кривую
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        {/* Тип кривой */}
        <div className="space-y-1.5">
          <label className="text-xs text-gray-500">Тип кривой</label>
          <select
            value={form.curve_type}
            onChange={e => set('curve_type', e.target.value)}
            className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700
                       bg-white dark:bg-neutral-800 text-gray-900 dark:text-white
                       px-3 py-2 focus:outline-none focus:border-blue-500"
          >
            {Object.entries(CURVE_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        <Field label="Метка (напр. n=2750 об/мин)" value={form.label}
          onChange={v => set('label', v)} placeholder="n=2750 об/мин" />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Значение параметра" value={form.param_value}
            onChange={v => set('param_value', v)} placeholder="2750" />
          <Field label="Единица" value={form.param_unit}
            onChange={v => set('param_unit', v)} placeholder="rpm" />
        </div>

        {/* Тип интерполяции */}
        <div className="space-y-1.5">
          <label className="text-xs text-gray-500">Интерполяция</label>
          <div className="flex gap-2">
            {[['spline', 'Сплайн'], ['linear', 'Прямые']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => set('interpolation', val)}
                className={`flex-1 text-xs px-3 py-2 rounded-lg border transition-colors
                  ${form.interpolation === val
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Цвет */}
        <div className="space-y-1.5">
          <label className="text-xs text-gray-500">Цвет (оставьте пустым — по типу кривой)</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.color || '#1d4ed8'}
              onChange={e => set('color', e.target.value)}
              className="w-10 h-8 rounded cursor-pointer border-0 bg-transparent"
            />
            <button
              onClick={() => set('color', '')}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Сбросить (авто)
            </button>
            {form.color && (
              <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: form.color, color: '#fff' }}>
                {form.label || 'кривая'}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 text-sm border border-gray-200 dark:border-gray-700
                       text-gray-600 dark:text-gray-400 px-4 py-2 rounded-lg
                       hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
            Отмена
          </button>
          <button onClick={handleAdd} disabled={!form.label.trim()}
            className="flex-1 text-sm bg-blue-600 hover:bg-blue-700 text-white
                       px-4 py-2 rounded-lg disabled:opacity-50 transition-colors">
            Добавить
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Вспомогательный компонент поля ──────────────────────────────────────────

function Field({ label, value, onChange, placeholder = '' }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-500 dark:text-gray-400">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700
                   bg-white dark:bg-neutral-800 text-gray-900 dark:text-white
                   px-3 py-2 focus:outline-none focus:border-blue-500"
      />
    </div>
  )
}

// ─── Основная страница ────────────────────────────────────────────────────────

export default function FanChartPage() {
  const [productId, setProductId] = useState('')
  const [charts, setCharts] = useState([])
  const [selectedChart, setSelectedChart] = useState(null)
  const [chartData, setChartData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('view')
  const [showCreateChart, setShowCreateChart] = useState(false)
  const [showAddCurve, setShowAddCurve] = useState(false)
  const [activeCurveId, setActiveCurveId] = useState(null)
  const [editTool, setEditTool] = useState('move')
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null)
  const [networkCurve, setNetworkCurve] = useState(null)
  const [operatingPoint, setOperatingPoint] = useState(null)
  const [activeTab, setActiveTab] = useState('editor')
  const [combinedProduct, setCombinedProduct] = useState('')
  const [combinedCurves, setCombinedCurves] = useState([])
  const [combinedDomain, setCombinedDomain] = useState(null)
  const [combinedLoading, setCombinedLoading] = useState(false)
  const containerRef = useRef(null)
  const [chartSize, setChartSize] = useState({ width: 800, height: 600 })
  const [combinedNetworkCurve, setCombinedNetworkCurve] = useState(null)
  const [selectedCurves, setSelectedCurves] = useState(null)
  const [selectionPoints, setSelectionPoints] = useState(null)
  const [pendingNetwork, setPendingNetwork] = useState(null)
  const [lastQRef, setLastQRef] = useState(null)
  const [lastPvRef, setLastPvRef] = useState(null)
  const [lastSelection, setLastSelection] = useState(null)
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [showAxisSettings, setShowAxisSettings] = useState(false)
  const combinedWidth = window.innerWidth - 80
  const combinedHeight = window.innerHeight - 280

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      const sideW = charts.length > 0 ? 256 : 0  // w-56 = 224px + gap
      setChartSize({
        width: Math.floor(width - sideW - 24),
        height: Math.floor(window.innerHeight - 340),
      })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [charts.length])

  const allCurves = networkCurve
    ? [...(chartData || []), networkCurve]
    : (chartData || [])

  const allCombinedCurves = combinedNetworkCurve
    ? [...combinedCurves, combinedNetworkCurve]
    : combinedCurves

  const displayCurves = selectedCurves
    ? [...selectedCurves, ...(combinedNetworkCurve ? [combinedNetworkCurve] : [])]
    : allCombinedCurves

  const handleSearch = async () => {
    setLoading(true)
    const { ok, data } = await selectionApi.fanCharts(productId.trim())
    setCharts(ok ? (Array.isArray(data) ? data : data.results ?? []) : [])
    setSelectedChart(null)
    setChartData(null)
    setLoading(false)
  }

  const handleSelectChart = async (chart) => {
    setActiveCurveId(null)

    if (chart.curves !== undefined) {
      const xSF = chart.x_scale_factor ?? 1.0
      const ySF = chart.y_scale_factor ?? 1.0
      const dFX = chart.display_factor_x ?? 1.0
      const dFY = chart.display_factor_y ?? 1.0
      const ratio = { x: xSF / dFX, y: ySF / dFY }

      setSelectedChart({
        ...chart,
        xDomain: [chart.x_min * ratio.x, chart.x_max * ratio.x],
        yDomain: [chart.y_min * ratio.y, chart.y_max * ratio.y],
        scaleType: chart.scale_type ?? chart.scaleType,
      })
      setChartData(chart.curves.map(c => ({
        ...c,
        points: c.points.map(p => ({
          x: p.x * ratio.x,
          y: p.y * ratio.y,
        })),
      })))
      setMode('view')
      return
    }

    setLoading(true)
    const { ok, data } = await selectionApi.fanChartDetail(chart.id)
    if (ok) {
      console.log('scale_type:', data.scale_type)
      console.log('x_min:', data.x_min, 'x_max:', data.x_max)
      console.log('first curve first points:', data.curves?.[0]?.points?.slice(0, 3))
      const xSF = data.x_scale_factor ?? 1.0
      const ySF = data.y_scale_factor ?? 1.0
      const dFX = data.display_factor_x ?? 1.0
      const dFY = data.display_factor_y ?? 1.0
      const ratio = { x: xSF / dFX, y: ySF / dFY }

      const chartWithDomains = {
        ...data,
        xDomain: [data.x_min * ratio.x, data.x_max * ratio.x],
        yDomain: [data.y_min * ratio.y, data.y_max * ratio.y],
        scaleType: data.scale_type,
      }

      setSelectedChart(chartWithDomains)
      setChartData(data.curves.map(c => ({
        ...c,
        points: c.points.map(p => ({
          x: p.x * ratio.x,
          y: p.y * ratio.y,
        })),
      })))
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!pendingNetwork || !chartData || !selectedChart) return
    const { q, pv } = pendingNetwork
    const R = pv / (q * q)
    const xMin = selectedChart.x_min ?? 0.3
    const xMax = selectedChart.x_max ?? 10
    setNetworkCurve({
      id: 'network',
      curve_type: 'NETWORK',
      label: 'Сеть',
      color: '#6b7280',
      interpolation: 'linear',
      points: [
        { x: xMin, y: parseFloat((R * xMin * xMin).toFixed(2)) },
        { x: xMax, y: parseFloat((R * xMax * xMax).toFixed(2)) },
      ],
    })

    // ── Переключить в режим просмотра ──
    setMode('view')

    // ── Запросить точки пересечения ──
    selectionApi.fanChartOperatingPoint(selectedChart.id, q, pv).then(({ ok, data }) => {
      if (ok && data.success) {
        setOperatingPoint([
          { q, pv, is_target: true, in_working_zone: true },
          ...data.data,
        ])
      }
    })

    setPendingNetwork(null)
  }, [chartData, pendingNetwork, selectedChart])

  const handleSave = async () => {
    if (!selectedChart?.id || String(selectedChart.id).startsWith('new_')) {
      // Новый график — создаём через API
      const { ok, data } = await selectionApi.fanChartCreate({
        product_external_id: selectedChart.product_external_id || productId || '',
        d_ratio: selectedChart.d_ratio,
        temperature: selectedChart.temperature,
        source_page: selectedChart.source_page || null,
        x_min: selectedChart.xDomain?.[0] ?? 0.3,
        x_max: selectedChart.xDomain?.[1] ?? 2.0,
        y_min: selectedChart.yDomain?.[0] ?? 60,
        y_max: selectedChart.yDomain?.[1] ?? 1000,
        scale_type: selectedChart.scaleType ?? 'log',
      })
      if (ok) {
        const realId = data.id
        const realChart = { ...selectedChart, id: realId }
        setSelectedChart(realChart)
        setCharts(prev => prev.map(c =>
          c.id === selectedChart.id ? { ...c, id: realId } : c
        ))
        await doSaveCurves(realId, realChart)
      }
      return
    }
    await doSaveCurves(selectedChart.id, selectedChart)
  }

  const doSaveCurves = async (chartId, chart) => {
    setSaving(true)
    const xSF = chart.x_scale_factor ?? 1.0
    const ySF = chart.y_scale_factor ?? 1.0
    const dFX = chart.display_factor_x ?? 1.0
    const dFY = chart.display_factor_y ?? 1.0

    const { ok, data } = await selectionApi.fanChartSave(chartId, {
      x_min: chart.x_min ?? 0.3,          // ← хранятся как есть
      x_max: chart.x_max ?? 2.0,
      y_min: chart.y_min ?? 60,
      y_max: chart.y_max ?? 1000,
      scale_type: chart.scaleType ?? chart.scale_type ?? 'log',
      x_label: chart.x_label ?? 'Q, тыс.м³/ч',
      y_label: chart.y_label ?? 'Pv, Па',
      x_scale_factor: xSF,
      y_scale_factor: ySF,
      display_factor_x: dFX,              // ← добавить
      display_factor_y: dFY,              // ← добавить
      curves: chartData.map(c => ({
        id: String(c.id).startsWith('curve_') ? null : c.id,
        curve_type: c.curve_type,
        label: c.label,
        param_value: c.param_value ?? null,
        param_unit: c.param_unit ?? '',
        color: c.color ?? '',
        interpolation: c.interpolation ?? 'spline',
        points: c.points.map(p => ({ x: p.x, y: p.y })),
      })),
    })
    setSaving(false)
    setSaveStatus(ok && data.success ? 'ok' : 'error')
    setTimeout(() => setSaveStatus(null), 3000)
  }

  const handleChartCreated = (chart) => {
    setCharts(prev => [...prev, chart])
    setShowCreateChart(false)
    handleSelectChart(chart)
  }

  const handleCurvesChange = (curves) => {
    setChartData(curves)
  }

  const handleAddPoint = (curveId, point) => {
    setChartData(prev => prev.map(c =>
      // eslint-disable-next-line eqeqeq
      c.id == curveId
        ? { ...c, points: [...c.points, point] }
        : c
    ))
  }
  const handleCurveAdded = (curve) => {
    setChartData(prev => [...(prev || []), curve])
    setActiveCurveId(curve.id)
    setEditTool('add')
  }

  const handleCurveClick = (curveId) => {
    // Найти chart по curve_id среди selectedCurves
    const curve = selectedCurves?.find(c => c.id === curveId)
    if (!curve) return

    // Найти chart_id из данных подбора
    const found = [
      ...(lastSelection?.above || []),
      ...(lastSelection?.below || []),
    ].find(r => r.curve_id === curveId)
    if (!found) return

    const loadChart = (chart) => {
      setActiveTab('editor')
      handleSelectChart(chart)
      if (lastQRef && lastPvRef) setPendingNetwork({ q: lastQRef, pv: lastPvRef })
    }

    const existing = charts.find(c => c.id === found.chart_id)
    if (existing) {
      loadChart(existing)
    } else {
      selectionApi.fanChartDetail(found.chart_id).then(({ ok, data }) => {
        if (!ok) return
        const newChart = { ...data, id: found.chart_id }
        setCharts(prev => [...prev, newChart])
        loadChart(newChart)
      })
    }
  }

  const xScaleFactor = selectedChart?.x_scale_factor ?? 1.0
  const yScaleFactor = selectedChart?.y_scale_factor ?? 1.0

  // Домены из выбранного графика или дефолт
  const xDomain = selectedChart?.xDomain ?? [
    (selectedChart?.x_min ?? 0.3) * xScaleFactor,
    (selectedChart?.x_max ?? 2) * xScaleFactor,
  ]
  const yDomain = selectedChart?.yDomain ?? [
    (selectedChart?.y_min ?? 60) * yScaleFactor,
    (selectedChart?.y_max ?? 1000) * yScaleFactor,
  ]
  const scaleType = selectedChart?.scaleType ?? selectedChart?.scale_type ?? 'log'
  const scaleRatio = selectedChart?.scale_ratio ?? null

  const BASE_SIZE = 500
  const chartWidth = scaleRatio && scaleRatio > 1
    ? BASE_SIZE
    : Math.round(BASE_SIZE * Math.abs(scaleRatio))
  const chartHeight = scaleRatio && scaleRatio > 1
    ? Math.round(BASE_SIZE * Math.abs(scaleRatio))
    : BASE_SIZE

  const handleCombinedSearch = async () => {
    if (!combinedProduct.trim()) return
    setCombinedLoading(true)
    const { ok, data } = await selectionApi.fanChartCombined(combinedProduct.trim())
    if (ok && data.success) {
      // Строим colorMap: d_ratio → цвет
      const ratios = [...new Set(data.data.charts.map(c => c.d_ratio))].sort((a, b) => a - b)
      const colorMap = Object.fromEntries(
        ratios.map((d, i) => [d, D_RATIO_COLORS[i % D_RATIO_COLORS.length]])
      )
      // Маппим в формат FanChartEditor
      const curves = data.data.charts.flatMap(chart =>
        chart.curves.map(curve => ({
          id: curve.id,
          curve_type: 'PRESSURE',
          label: `${chart.product_external_id} D=${chart.d_ratio} ${curve.label}`,
          color: colorMap[chart.d_ratio],
          interpolation: 'spline',
          points: curve.points,
        }))
      )
      setCombinedCurves(curves)
      setCombinedDomain({
        x: data.data.x_domain,
        y: data.data.y_domain,
        colorMap,
        scaleType: data.data.scale_type ?? 'log',
        xLabel: data.data.x_label ?? 'Q, тыс.м³/ч',
        yLabel: data.data.y_label ?? 'Pv, Па',
        xScaleFactor: data.data.x_scale_factor ?? 1.0,
        yScaleFactor: data.data.y_scale_factor ?? 1.0,
      })
    }
    setCombinedLoading(false)
  }

  const buildSelectionCurves = (selectionData) => {
    if (!selectionData) return null

    const ABOVE_COLORS = ['#ef4444', '#f97316']  // красный, оранжевый
    const BELOW_COLORS = ['#1d4ed8', '#16a34a']  // синий, зелёный

    const curves = [
      ...selectionData.above.map((r, i) => ({
        id: r.curve_id,
        curve_type: 'PRESSURE',
        label: `${r.product_external_id} D=${r.d_ratio} ${r.curve_label}`,
        color: ABOVE_COLORS[i % ABOVE_COLORS.length],
        interpolation: 'spline',
        points: r.curve_points,
      })),
      ...selectionData.below.map((r, i) => ({
        id: r.curve_id,
        curve_type: 'PRESSURE',
        label: `${r.product_external_id} D=${r.d_ratio} ${r.curve_label}`,
        color: BELOW_COLORS[i % BELOW_COLORS.length],
        interpolation: 'spline',
        points: r.curve_points,
      })),
    ]

    const points = [
      { q: selectionData.q_ref, pv: selectionData.pv_ref, in_working_zone: true, is_target: true },
      ...selectionData.selected.map(r => ({
        q: r.q_op,
        pv: r.pv_op,
        in_working_zone: true,
      })),
    ]

    return { curves, points }
  }

  const handleSelection = (selectionData) => {
    if (!selectionData) {
      setSelectedCurves(null)
      setSelectionPoints(null)
      setLastSelection(null)
      return
    }
    setLastSelection(selectionData)
    const built = buildSelectionCurves(selectionData)
    setSelectedCurves(built.curves)
    setSelectionPoints(built.points)
  }

  return (
    <div className={activeTab === 'combined'
      ? "px-6 space-y-6"
      : "max-w-screen-2xl mx-auto px-6 space-y-6"
    }>
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          Аэродинамические характеристики
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Просмотр и редактирование графиков вентиляторов
        </p>
      </div>

      {/* ── ДОБАВИТЬ: переключатель вкладок ── */}
      <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg w-fit">
        {[['editor', 'Редактор'], ['combined', 'Все графики']].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded text-sm transition-colors
            ${activeTab === tab
                ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'
              }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── ДОБАВИТЬ: вкладка combined ── */}
      {activeTab === 'combined' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              value={combinedProduct}
              onChange={e => setCombinedProduct(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCombinedSearch()}
              placeholder="Серия, напр. ВЦ 4-70"
              className="flex-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700
                       bg-white dark:bg-neutral-900 text-gray-900 dark:text-white
                       px-4 py-2 focus:outline-none focus:border-blue-500"
            />
            <button onClick={handleCombinedSearch} disabled={combinedLoading}
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white
                       px-4 py-2 rounded-lg disabled:opacity-50 transition-colors">
              {combinedLoading ? '...' : 'Показать'}
            </button>
          </div>

          {combinedDomain && (
            <div className="space-y-3">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {combinedCurves.length} кривых давления
              </div>
              <div className="flex flex-wrap gap-4">
                {Object.entries(combinedDomain.colorMap).map(([d, color]) => (
                  <div key={d} className="flex items-center gap-1.5">
                    <span className="inline-block w-5 h-0.5 rounded"
                      style={{ backgroundColor: color }} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      D = {d} D<sub>ном</sub>
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ height: combinedHeight, minHeight: 400 }} className="w-full">
                <FanChartEditor
                  width={combinedWidth}
                  height={combinedHeight}
                  curves={displayCurves}
                  xDomain={combinedDomain.x}
                  yDomain={combinedDomain.y}
                  scaleType="log"
                  editable={false}
                  activeCurveId={null}
                  editTool="move"
                  operatingPoint={selectionPoints}
                  onCurveClick={selectedCurves ? handleCurveClick : null}
                  xLabel={selectedChart?.x_label ?? 'Q, тыс.м³/ч'}
                  yLabel={selectedChart?.y_label ?? 'Pv, Па'}
                />
              </div>
              <NetworkCurvePanel
                xDomain={combinedDomain.x}
                chartId={null}
                onNetworkCurve={setCombinedNetworkCurve}
                onOperatingPoint={() => { }}
                productFilter={combinedProduct}
                onSelection={handleSelection}
                onCalc={({ q, pv }) => { setLastQRef(q); setLastPvRef(pv) }}
                scaleType={combinedDomain.scaleType ?? 'log'}
                xLabel={combinedDomain.xLabel ?? 'Q, тыс.м³/ч'}
                yLabel={combinedDomain.yLabel ?? 'Pv, Па'}
                xScaleFactor={combinedDomain.xScaleFactor ?? 1.0}
                yScaleFactor={combinedDomain.yScaleFactor ?? 1.0}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'editor' && (
        <>
          {/* Поиск */}
          <div className="flex gap-2">
            <input
              value={productId}
              onChange={e => setProductId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Название изделия или External ID (напр. ВО-3.5)"
              className="flex-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700
                     bg-white dark:bg-neutral-900 text-gray-900 dark:text-white
                     px-4 py-2 focus:outline-none focus:border-blue-500"
            />
            <button onClick={handleSearch} disabled={loading}
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white
                     px-4 py-2 rounded-lg disabled:opacity-50 transition-colors">
              {loading ? '...' : 'Найти'}
            </button>
            <button onClick={() => setShowCreateChart(true)}
              className="text-sm bg-neutral-700 hover:bg-neutral-600 text-white
                     px-4 py-2 rounded-lg transition-colors">
              + Новый график
            </button>
          </div>

          <div ref={containerRef} className="flex gap-6 items-start">
            {/* Список графиков */}
            {charts.length > 0 && (
              <div className="w-56 shrink-0 flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400
                    uppercase tracking-wide px-1 mb-2 shrink-0">
                  Графики ({charts.length})
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {charts.map(chart => (
                    <button key={chart.id} onClick={() => handleSelectChart(chart)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors
            ${selectedChart?.id === chart.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 hover:border-blue-300'
                        }`}
                    >
                      {chart.product_external_id && (
                        <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 truncate">
                          {chart.product_external_id}
                        </div>
                      )}
                      <div className="text-sm font-medium">
                        D = {chart.d_ratio} D<sub>ном</sub>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">t = {chart.temperature}°C</div>
                      {chart.source_page && (
                        <div className="text-xs text-gray-400">стр. {chart.source_page}</div>
                      )}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowCreateChart(true)}
                  className="mt-2 shrink-0 w-full text-sm text-blue-600 dark:text-blue-400
                 border border-dashed border-blue-300 dark:border-blue-700
                 rounded-lg px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/10
                 transition-colors">
                  + Добавить график
                </button>
              </div>
            )}

            {/* Область графика */}
            {chartData !== null && (
              <div className="flex-1 space-y-4">
                {/* Тулбар */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    D = {selectedChart?.d_ratio} D<sub>ном</sub>,
                    t = {selectedChart?.temperature}°C
                    {scaleType === 'log' && (
                      <span className="ml-2 text-xs text-gray-400">(лог. шкала)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {mode === 'edit' && (
                      <button onClick={() => setShowAddCurve(true)}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white
                               px-3 py-1.5 rounded-lg transition-colors">
                        + Кривая
                      </button>
                    )}
                    {mode === 'edit' && (
                      <button
                        onClick={() => setShowSaveConfirm(true)}
                        disabled={saving}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50
      ${saveStatus === 'ok'
                            ? 'bg-emerald-600 text-white'
                            : saveStatus === 'error'
                              ? 'bg-red-600 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                      >
                        {saving ? 'Сохранение...' : saveStatus === 'ok' ? '✓ Сохранено' : 'Сохранить'}
                      </button>
                    )}
                    {mode === 'edit' && chartData.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {chartData.map(c => {
                          const isSelected = activeCurveId == c.id
                          const curveColor = (c.color || CURVE_COLORS[c.curve_type]) ?? '#374151'
                          return (
                            <div key={c.id}
                              className={`flex items-center gap-2 px-2 py-1 rounded-lg border cursor-pointer transition-colors
            ${isSelected
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                                }`}
                              onClick={() => setActiveCurveId(String(c.id))}
                            >
                              {/* Цветовой пикер */}
                              <input
                                type="color"
                                value={curveColor}
                                onClick={e => e.stopPropagation()}
                                onChange={e => {
                                  setChartData(prev => prev.map(curve =>
                                    // eslint-disable-next-line eqeqeq
                                    curve.id == c.id ? { ...curve, color: e.target.value } : curve
                                  ))
                                }}
                                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                                title="Изменить цвет"
                              />
                              <input
                                type="text"
                                value={c.label || ''}
                                onClick={e => e.stopPropagation()}
                                onChange={e => {
                                  setChartData(prev => prev.map(curve =>
                                    // eslint-disable-next-line eqeqeq
                                    curve.id == c.id ? { ...curve, label: e.target.value } : curve
                                  ))
                                }}
                                className="text-xs bg-transparent border-b border-gray-300 dark:border-gray-600
             focus:outline-none focus:border-blue-500
             text-gray-700 dark:text-gray-300 w-28 truncate"
                                placeholder={c.curve_type}
                              />
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {mode === 'edit' && activeCurveId && (
                      <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
                        {[['move', '✥ Двигать'], ['add', '+ Точка']].map(([val, label]) => (
                          <button key={val} onClick={() => setEditTool(val)}
                            className={`px-3 py-1 rounded text-xs transition-colors
          ${editTool === val
                                ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'
                              }`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
                      {['view', 'edit'].map(m => (
                        <button key={m} onClick={() => setMode(m)}
                          className={`px-3 py-1 rounded text-xs transition-colors
                        ${mode === m
                              ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                              : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'
                            }`}>
                          {m === 'view' ? 'Просмотр' : 'Редактор'}
                        </button>
                      ))}
                      <button
                        onClick={() => setShowAxisSettings(v => !v)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors
    ${showAxisSettings
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                          }`}
                      >
                        ⚙ Оси
                      </button>
                    </div>
                  </div>
                </div>

                {showAxisSettings && selectedChart && (
                  <AxisSettingsPanel
                    chart={selectedChart}
                    onApply={(updates) => {
                      setSelectedChart(prev => ({ ...prev, ...updates }))
                      if (!String(selectedChart.id).startsWith('new_')) {
                        selectionApi.fanChartSave(selectedChart.id, {
                          x_min: updates.x_min,
                          x_max: updates.x_max,
                          y_min: updates.y_min,
                          y_max: updates.y_max,
                          scale_type: updates.scale_type,
                          x_label: updates.x_label,
                          y_label: updates.y_label,
                          x_scale_factor: updates.x_scale_factor ?? 1.0,
                          y_scale_factor: updates.y_scale_factor ?? 1.0,
                          display_factor_x: updates.display_factor_x ?? 1.0,
                          display_factor_y: updates.display_factor_y ?? 1.0,
                          // curves не передаём — бэкенд не трогает кривые
                        })
                      }
                    }}
                    onApplyAll={(updates) => {
                      // Применяем метаданные ко всем графикам в списке
                      charts.forEach(chart => {
                        if (String(chart.id).startsWith('new_')) return
                        selectionApi.fanChartSave(chart.id, {
                          x_min: updates.x_min,
                          x_max: updates.x_max,
                          y_min: updates.y_min,
                          y_max: updates.y_max,
                          scale_type: updates.scale_type,
                          x_label: updates.x_label,
                          y_label: updates.y_label,
                          x_scale_factor: updates.x_scale_factor ?? 1.0,
                          y_scale_factor: updates.y_scale_factor ?? 1.0,
                          display_factor_x: updates.display_factor_x ?? 1.0,
                          display_factor_y: updates.display_factor_y ?? 1.0,
                          // curves не передаём
                        })
                      })
                      // Текущий чарт тоже обновляем локально
                      setSelectedChart(prev => ({ ...prev, ...updates }))
                    }}
                  />
                )}

                <div ref={containerRef} style={{ height: 'calc(100vh - 340px)', minHeight: 400 }} className="w-full">
                  <FanChartEditor
                    width={chartSize.width}
                    height={chartSize.height}
                    curves={allCurves}
                    editable={mode === 'edit'}
                    xDomain={xDomain}
                    yDomain={yDomain}
                    scaleType={scaleType}
                    onChange={handleCurvesChange}
                    activeCurveId={mode === 'edit' ? activeCurveId : null}
                    editTool={mode === 'edit' ? editTool : 'move'}
                    onAddPoint={handleAddPoint}
                    operatingPoint={operatingPoint}
                    xLabel={selectedChart?.x_label ?? 'Q, тыс.м³/ч'}
                    yLabel={selectedChart?.y_label ?? 'Pv, Па'}
                  />
                </div>

                {chartData !== null && (
                  <NetworkCurvePanel
                    xDomain={xDomain}
                    chartId={selectedChart?.id}
                    onNetworkCurve={setNetworkCurve}
                    onOperatingPoint={setOperatingPoint}
                    scaleType={scaleType}
                    xLabel={selectedChart?.x_label ?? 'Q, тыс.м³/ч'}
                    yLabel={selectedChart?.y_label ?? 'Pv, Па'}
                    xScaleFactor={selectedChart?.x_scale_factor ?? 1.0}
                    yScaleFactor={selectedChart?.y_scale_factor ?? 1.0}
                  />
                )}

                {showSaveConfirm && (
                  <ConfirmModal
                    message="Сохранить изменения графика? Это перезапишет все кривые и точки. А также подписи"
                    danger={false}
                    onConfirm={() => {
                      setShowSaveConfirm(false)
                      handleSave()
                    }}
                    onCancel={() => setShowSaveConfirm(false)}
                  />
                )}

                {chartData.length > 0 && <Legend curves={chartData} />}

                {/* Подсказка если кривых нет */}
                {chartData.length === 0 && mode === 'edit' && (
                  <div className="text-center py-8 text-sm text-gray-400 border-2 border-dashed
                              border-gray-200 dark:border-gray-700 rounded-xl">
                    График пустой — добавьте первую кривую
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Модалки */}
      {showCreateChart && (
        <CreateChartModal
          productExternalId={productId}
          onCreated={handleChartCreated}
          onClose={() => setShowCreateChart(false)}
        />
      )}
      {showAddCurve && (
        <AddCurveModal
          onAdd={handleCurveAdded}
          onClose={() => setShowAddCurve(false)}
        />
      )}
    </div>
  )
}

// ─── Легенда ─────────────────────────────────────────────────────────────────

function Legend({ curves }) {
  const groups = curves.reduce((acc, c) => {
    acc[c.curve_type] = acc[c.curve_type] || []
    acc[c.curve_type].push(c)
    return acc
  }, {})

  return (
    <div className="flex flex-wrap gap-4">
      {Object.entries(groups).map(([type, items]) => (
        <div key={type} className="flex items-center gap-2">
          <span className="w-6 h-0.5 inline-block rounded"
            style={{ backgroundColor: CURVE_COLORS[type] ?? '#374151' }} />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {items.map(c => c.label).join(', ')}
          </span>
        </div>
      ))}
    </div>
  )
}