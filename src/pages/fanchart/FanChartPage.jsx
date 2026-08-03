import { useState } from 'react'
import { selectionApi } from '../../api/selection'
import useFanChartData from './useFanChartData'
import useCombinedFanChart from './useCombinedFanChart'
import FanChartEditorPanel from './FanChartEditorPanel'
import CombinedTab from './CombinedTab'

export default function FanChartPage() {
  const [activeTab, setActiveTab] = useState('editor')
  const editor = useFanChartData()
  const combined = useCombinedFanChart()

  const handleCurveClick = (curveId) => {
    // Найти chart по curve_id среди selectedCurves
    const curve = combined.selectedCurves?.find(c => c.id === curveId)
    if (!curve) return

    // Найти chart_id из данных подбора
    const found = [
      ...(combined.lastSelection?.above || []),
      ...(combined.lastSelection?.below || []),
    ].find(r => r.curve_id === curveId)
    if (!found) return

    const loadChart = (chart) => {
      setActiveTab('editor')
      editor.handleSelectChart(chart)
      if (combined.lastQRef && combined.lastPvRef) {
        editor.setPendingNetwork({ q: combined.lastQRef, pv: combined.lastPvRef })
      }
    }

    const existing = editor.charts.find(c => c.id === found.chart_id)
    if (existing) {
      loadChart(existing)
    } else {
      selectionApi.fanChartDetail(found.chart_id).then(({ ok, data }) => {
        if (!ok) return
        const newChart = { ...data, id: found.chart_id }
        editor.setCharts(prev => [...prev, newChart])
        loadChart(newChart)
      })
    }
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

      {activeTab === 'combined' && (
        <CombinedTab
          combined={combined}
          editorSelectedChart={editor.selectedChart}
          onCurveClick={handleCurveClick}
        />
      )}

      {activeTab === 'editor' && (
        <FanChartEditorPanel editor={editor} />
      )}
    </div>
  )
}
