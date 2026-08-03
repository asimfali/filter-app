import { useState } from 'react'
import Modal from '../common/Modal'
import Field from './Field'

export default function CreateChartModal({ productExternalId, onCreated, onClose }) {
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
    <Modal title="Новый график" onClose={onClose}>
      <div className="space-y-5">
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
    </Modal>
  )
}
