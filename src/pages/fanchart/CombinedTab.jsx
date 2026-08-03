import FanChartEditor from '../../components/common/FanChartEditor'
import NetworkCurvePanel from '../../components/fanchart/NetworkCurvePanel'

export default function CombinedTab({ combined, editorSelectedChart, onCurveClick }) {
  const combinedWidth = window.innerWidth - 80
  const combinedHeight = window.innerHeight - 280

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={combined.combinedProduct}
          onChange={e => combined.setCombinedProduct(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && combined.handleCombinedSearch()}
          placeholder="Серия, напр. ВЦ 4-70"
          className="flex-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700
                   bg-white dark:bg-neutral-900 text-gray-900 dark:text-white
                   px-4 py-2 focus:outline-none focus:border-blue-500"
        />
        <button onClick={combined.handleCombinedSearch} disabled={combined.combinedLoading}
          className="text-sm bg-blue-600 hover:bg-blue-700 text-white
                   px-4 py-2 rounded-lg disabled:opacity-50 transition-colors">
          {combined.combinedLoading ? '...' : 'Показать'}
        </button>
      </div>

      {combined.combinedDomain && (
        <div className="space-y-3">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {combined.combinedCurves.length} кривых давления
          </div>
          <div className="flex flex-wrap gap-4">
            {Object.entries(combined.combinedDomain.colorMap).map(([d, color]) => (
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
              curves={combined.displayCurves}
              xDomain={combined.combinedDomain.x}
              yDomain={combined.combinedDomain.y}
              scaleType="log"
              editable={false}
              activeCurveId={null}
              editTool="move"
              operatingPoint={combined.selectionPoints}
              onCurveClick={combined.selectedCurves ? onCurveClick : null}
              xLabel={editorSelectedChart?.x_label ?? 'Q, тыс.м³/ч'}
              yLabel={editorSelectedChart?.y_label ?? 'Pv, Па'}
            />
          </div>
          <NetworkCurvePanel
            xDomain={combined.combinedDomain.x}
            chartId={null}
            onNetworkCurve={combined.setCombinedNetworkCurve}
            onOperatingPoint={() => { }}
            productFilter={combined.combinedProduct}
            onSelection={combined.handleSelection}
            onCalc={({ q, pv }) => { combined.setLastQRef(q); combined.setLastPvRef(pv) }}
            scaleType={combined.combinedDomain.scaleType ?? 'log'}
            xLabel={combined.combinedDomain.xLabel ?? 'Q, тыс.м³/ч'}
            yLabel={combined.combinedDomain.yLabel ?? 'Pv, Па'}
            xScaleFactor={combined.combinedDomain.xScaleFactor ?? 1.0}
            yScaleFactor={combined.combinedDomain.yScaleFactor ?? 1.0}
          />
        </div>
      )}
    </div>
  )
}
