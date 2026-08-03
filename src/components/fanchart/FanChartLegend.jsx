import { CURVE_COLORS } from '../../pages/fanchart/constants'

export default function FanChartLegend({ curves }) {
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
