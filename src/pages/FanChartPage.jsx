import { useState } from 'react'
import FanChartEditor, { DEMO_CURVES } from '../components/common/FanChartEditor'
import { tokenStorage } from '../api/auth'
import { selectionApi } from '../api/selection'

// ─── Константы ───────────────────────────────────────────────────────────────

const CURVE_COLORS = {
  PRESSURE: '#1d4ed8',
  EFFICIENCY: '#16a34a',
  POWER: '#d97706',
  TIP_SPEED: '#9333ea',
}

const CURVE_TYPE_LABELS = {
  PRESSURE: 'Давление Pv(Q)',
  EFFICIENCY: 'КПД η(Q)',
  POWER: 'Мощность Nu(Q)',
  TIP_SPEED: 'Окружная скорость u(Q)',
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

  const handleSearch = async () => {
    if (!productId.trim()) return
    setLoading(true)
    const { ok, data } = await selectionApi.fanCharts(productId.trim())
    setCharts(ok && data.success ? data.data : [])
    setSelectedChart(null)
    setChartData(null)
    setLoading(false)
  }

  const handleSelectChart = async (chart) => {
    setSelectedChart(chart)
    setActiveCurveId(null)
    if (chart.curves !== undefined) {
      setChartData(chart.curves)
      setMode('edit')
      return
    }
    setLoading(true)
    const { ok, data } = await selectionApi.fanChartInterpolated(chart.id)
    if (ok && data.success) {
      setChartData(data.data.curves.map(c => ({
        id: c.id,
        curve_type: c.type,
        label: c.label,
        color: c.color || null,
        interpolation: c.interpolation || 'spline',
        points: c.points,
      })))
    }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!selectedChart?.id || String(selectedChart.id).startsWith('new_')) {
      // Новый график — создаём через API
      const { ok, data } = await selectionApi.fanChartCreate({
        product_external_id: productId || 'unknown',
        d_ratio: selectedChart.d_ratio,
        temperature: selectedChart.temperature,
        source_page: selectedChart.source_page || null,
        x_min: selectedChart.xDomain?.[0] ?? 0.3,
        x_max: selectedChart.xDomain?.[1] ?? 2.0,
        y_min: selectedChart.yDomain?.[0] ?? 60,
        y_max: selectedChart.yDomain?.[1] ?? 1000,
        scale_type: selectedChart.scaleType ?? 'log',
      })
      if (ok && data.success) {
        // Обновляем id на реальный и сохраняем кривые
        const realChart = { ...selectedChart, id: data.data.id }
        setSelectedChart(realChart)
        setCharts(prev => prev.map(c =>
          c.id === selectedChart.id ? { ...c, id: data.data.id } : c
        ))
        await doSaveCurves(data.data.id, realChart)
      }
      return
    }
    await doSaveCurves(selectedChart.id, selectedChart)
  }

  const doSaveCurves = async (chartId, chart) => {
    setSaving(true)
    const { ok, data } = await selectionApi.fanChartSave(chartId, {
      x_min: chart.xDomain?.[0] ?? 0.3,
      x_max: chart.xDomain?.[1] ?? 2.0,
      y_min: chart.yDomain?.[0] ?? 60,
      y_max: chart.yDomain?.[1] ?? 1000,
      scale_type: chart.scaleType ?? 'log',
      curves: chartData.map(c => ({
        id: String(c.id).startsWith('curve_') ? null : c.id,
        curve_type: c.curve_type,
        label: c.label,
        param_value: c.param_value ?? null,
        param_unit: c.param_unit ?? '',
        color: c.color ?? '',
        interpolation: c.interpolation ?? 'spline',
        points: c.points,
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
    console.log('addPoint', curveId, point, chartData)
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

  // Домены из выбранного графика или дефолт
  const xDomain = selectedChart?.xDomain ?? [0.3, 2]
  const yDomain = selectedChart?.yDomain ?? [60, 1000]
  const scaleType = selectedChart?.scaleType ?? 'log'

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          Аэродинамические характеристики
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Просмотр и редактирование графиков вентиляторов
        </p>
      </div>

      {/* Поиск */}
      <div className="flex gap-2">
        <input
          value={productId}
          onChange={e => setProductId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="External ID изделия (напр. 00000030266)"
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

      {/* Демо */}
      {charts.length === 0 && !loading && (
        <div className="flex flex-col items-center gap-4 py-8">
          <p className="text-sm text-gray-400">Введите External ID или откройте демо-график</p>
          <button
            onClick={() => {
              const demo = {
                id: 'demo', d_ratio: 0.9, temperature: 20,
                xDomain: [0.3, 2], yDomain: [60, 1000], scaleType: 'log', curves: DEMO_CURVES
              }
              setCharts([demo])
              handleSelectChart({ ...demo, curves: DEMO_CURVES })
              setChartData(DEMO_CURVES)
            }}
            className="text-sm bg-neutral-700 hover:bg-neutral-600 text-white
                       px-4 py-2 rounded-lg transition-colors"
          >
            Открыть демо-график
          </button>
        </div>
      )}

      <div className="flex gap-6 items-start">
        {/* Список графиков */}
        {charts.length > 0 && (
          <div className="w-56 shrink-0 space-y-2">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400
                            uppercase tracking-wide px-1">
              Графики ({charts.length})
            </div>
            {charts.map(chart => (
              <button key={chart.id} onClick={() => handleSelectChart(chart)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors
                  ${selectedChart?.id === chart.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 hover:border-blue-300'
                  }`}
              >
                <div className="text-sm font-medium">
                  D = {chart.d_ratio} D<sub>ном</sub>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">t = {chart.temperature}°C</div>
                {chart.source_page && (
                  <div className="text-xs text-gray-400">стр. {chart.source_page}</div>
                )}
              </button>
            ))}
            <button onClick={() => setShowCreateChart(true)}
              className="w-full text-sm text-blue-600 dark:text-blue-400
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
                    onClick={handleSave}
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
                          <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-32">
                            {c.label || c.curve_type}
                          </span>
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
                </div>
              </div>
            </div>

            <FanChartEditor
              width={700}
              height={500}
              curves={chartData}          // ← было initialCurves
              editable={mode === 'edit'}
              xDomain={xDomain}
              yDomain={yDomain}
              scaleType={scaleType}
              onChange={handleCurvesChange}
              activeCurveId={mode === 'edit' ? activeCurveId : null}
              editTool={mode === 'edit' ? editTool : 'move'}
              onAddPoint={handleAddPoint}
            />

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