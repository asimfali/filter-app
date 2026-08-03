import FanChartEditor from '../../components/common/FanChartEditor'
import ConfirmModal from '../../components/common/ConfirmModal'
import NetworkCurvePanel from '../../components/fanchart/NetworkCurvePanel'
import AxisSettingsPanel from '../../components/fanchart/AxisSettingsPanel'
import CreateChartModal from '../../components/fanchart/CreateChartModal'
import AddCurveModal from '../../components/fanchart/AddCurveModal'
import FanChartLegend from '../../components/fanchart/FanChartLegend'
import { selectionApi } from '../../api/selection'
import { CURVE_COLORS } from './constants'

export default function FanChartEditorPanel({ editor }) {
  return (
    <>
      {/* Поиск */}
      <div className="flex gap-2">
        <input
          value={editor.productId}
          onChange={e => editor.setProductId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && editor.handleSearch()}
          placeholder="Название изделия или External ID (напр. ВО-3.5)"
          className="flex-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700
                 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white
                 px-4 py-2 focus:outline-none focus:border-blue-500"
        />
        <button onClick={editor.handleSearch} disabled={editor.loading}
          className="text-sm bg-blue-600 hover:bg-blue-700 text-white
                 px-4 py-2 rounded-lg disabled:opacity-50 transition-colors">
          {editor.loading ? '...' : 'Найти'}
        </button>
        <button onClick={() => editor.setShowCreateChart(true)}
          className="text-sm bg-neutral-700 hover:bg-neutral-600 text-white
                 px-4 py-2 rounded-lg transition-colors">
          + Новый график
        </button>
      </div>

      <div ref={editor.containerRef} className="flex gap-6 items-start">
        {/* Список графиков */}
        {editor.charts.length > 0 && (
          <div className="w-56 shrink-0 flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400
                uppercase tracking-wide px-1 mb-2 shrink-0">
              Графики ({editor.charts.length})
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {editor.charts.map(chart => (
                <button key={chart.id} onClick={() => editor.handleSelectChart(chart)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors
        ${editor.selectedChart?.id === chart.id
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
            <button onClick={() => editor.setShowCreateChart(true)}
              className="mt-2 shrink-0 w-full text-sm text-blue-600 dark:text-blue-400
             border border-dashed border-blue-300 dark:border-blue-700
             rounded-lg px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/10
             transition-colors">
              + Добавить график
            </button>
          </div>
        )}

        {/* Область графика */}
        {editor.chartData !== null && (
          <div className="flex-1 space-y-4">
            {/* Тулбар */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                D = {editor.selectedChart?.d_ratio} D<sub>ном</sub>,
                t = {editor.selectedChart?.temperature}°C
                {editor.scaleType === 'log' && (
                  <span className="ml-2 text-xs text-gray-400">(лог. шкала)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {editor.mode === 'edit' && (
                  <button onClick={() => editor.setShowAddCurve(true)}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white
                           px-3 py-1.5 rounded-lg transition-colors">
                    + Кривая
                  </button>
                )}
                {editor.mode === 'edit' && (
                  <button
                    onClick={() => editor.setShowSaveConfirm(true)}
                    disabled={editor.saving}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50
      ${editor.saveStatus === 'ok'
                        ? 'bg-emerald-600 text-white'
                        : editor.saveStatus === 'error'
                          ? 'bg-red-600 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                  >
                    {editor.saving ? 'Сохранение...' : editor.saveStatus === 'ok' ? '✓ Сохранено' : 'Сохранить'}
                  </button>
                )}
                {editor.mode === 'edit' && editor.chartData.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {editor.chartData.map(c => {
                      const isSelected = editor.activeCurveId == c.id
                      const curveColor = (c.color || CURVE_COLORS[c.curve_type]) ?? '#374151'
                      return (
                        <div key={c.id}
                          className={`flex items-center gap-2 px-2 py-1 rounded-lg border cursor-pointer transition-colors
        ${isSelected
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                            }`}
                          onClick={() => editor.setActiveCurveId(String(c.id))}
                        >
                          {/* Цветовой пикер */}
                          <input
                            type="color"
                            value={curveColor}
                            onClick={e => e.stopPropagation()}
                            onChange={e => {
                              editor.setChartData(prev => prev.map(curve =>
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
                              editor.setChartData(prev => prev.map(curve =>
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
                {editor.mode === 'edit' && editor.activeCurveId && (
                  <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
                    {[['move', '✥ Двигать'], ['add', '+ Точка']].map(([val, label]) => (
                      <button key={val} onClick={() => editor.setEditTool(val)}
                        className={`px-3 py-1 rounded text-xs transition-colors
      ${editor.editTool === val
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
                    <button key={m} onClick={() => editor.setMode(m)}
                      className={`px-3 py-1 rounded text-xs transition-colors
                    ${editor.mode === m
                          ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'
                        }`}>
                      {m === 'view' ? 'Просмотр' : 'Редактор'}
                    </button>
                  ))}
                  <button
                    onClick={() => editor.setShowAxisSettings(v => !v)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors
    ${editor.showAxisSettings
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                      }`}
                  >
                    ⚙ Оси
                  </button>
                </div>
              </div>
            </div>

            {editor.showAxisSettings && editor.selectedChart && (
              <AxisSettingsPanel
                chart={editor.selectedChart}
                onApply={(updates) => {
                  editor.setSelectedChart(prev => ({ ...prev, ...updates }))
                  if (!String(editor.selectedChart.id).startsWith('new_')) {
                    selectionApi.fanChartSave(editor.selectedChart.id, {
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
                  editor.charts.forEach(chart => {
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
                  editor.setSelectedChart(prev => ({ ...prev, ...updates }))
                }}
              />
            )}

            <div style={{ height: editor.chartHeight, minHeight: 400, overflow: 'hidden' }}>
              <FanChartEditor
                width={editor.chartWidth}
                height={editor.chartHeight}
                curves={editor.allCurves}
                editable={editor.mode === 'edit'}
                xDomain={editor.xDomain}
                yDomain={editor.yDomain}
                scaleType={editor.scaleType}
                onChange={editor.handleCurvesChange}
                activeCurveId={editor.mode === 'edit' ? editor.activeCurveId : null}
                editTool={editor.mode === 'edit' ? editor.editTool : 'move'}
                onAddPoint={editor.handleAddPoint}
                operatingPoint={editor.operatingPoint}
                xLabel={editor.selectedChart?.x_label ?? 'Q, тыс.м³/ч'}
                yLabel={editor.selectedChart?.y_label ?? 'Pv, Па'}
              />
            </div>

            {editor.chartData !== null && (
              <NetworkCurvePanel
                xDomain={editor.xDomain}
                chartId={editor.selectedChart?.id}
                onNetworkCurve={editor.setNetworkCurve}
                onOperatingPoint={editor.setOperatingPoint}
                scaleType={editor.scaleType}
                xLabel={editor.selectedChart?.x_label ?? 'Q, тыс.м³/ч'}
                yLabel={editor.selectedChart?.y_label ?? 'Pv, Па'}
                xScaleFactor={editor.selectedChart?.x_scale_factor ?? 1.0}
                yScaleFactor={editor.selectedChart?.y_scale_factor ?? 1.0}
              />
            )}

            {editor.showSaveConfirm && (
              <ConfirmModal
                message="Сохранить изменения графика? Это перезапишет все кривые и точки. А также подписи"
                danger={false}
                onConfirm={() => {
                  editor.setShowSaveConfirm(false)
                  editor.handleSave()
                }}
                onCancel={() => editor.setShowSaveConfirm(false)}
              />
            )}

            {editor.chartData.length > 0 && <FanChartLegend curves={editor.chartData} />}

            {/* Подсказка если кривых нет */}
            {editor.chartData.length === 0 && editor.mode === 'edit' && (
              <div className="text-center py-8 text-sm text-gray-400 border-2 border-dashed
                          border-gray-200 dark:border-gray-700 rounded-xl">
                График пустой — добавьте первую кривую
              </div>
            )}
          </div>
        )}
      </div>

      {/* Модалки */}
      {editor.showCreateChart && (
        <CreateChartModal
          productExternalId={editor.productId}
          onCreated={editor.handleChartCreated}
          onClose={() => editor.setShowCreateChart(false)}
        />
      )}
      {editor.showAddCurve && (
        <AddCurveModal
          onAdd={editor.handleCurveAdded}
          onClose={() => editor.setShowAddCurve(false)}
        />
      )}
    </>
  )
}
