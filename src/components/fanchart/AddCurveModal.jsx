import { useState } from 'react'
import { CURVE_TYPE_LABELS } from '../common/FanChartEditor'
import Modal from '../common/Modal'
import Field from './Field'

export default function AddCurveModal({ onAdd, onClose }) {
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
    <Modal title="Добавить кривую" onClose={onClose} maxWidth="sm">
      <div className="space-y-4">
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
    </Modal>
  )
}
