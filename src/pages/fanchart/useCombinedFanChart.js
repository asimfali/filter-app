import { useState } from 'react'
import { selectionApi } from '../../api/selection'
import { D_RATIO_COLORS } from './constants'

export default function useCombinedFanChart() {
  const [combinedProduct, setCombinedProduct] = useState('')
  const [combinedCurves, setCombinedCurves] = useState([])
  const [combinedDomain, setCombinedDomain] = useState(null)
  const [combinedLoading, setCombinedLoading] = useState(false)
  const [combinedNetworkCurve, setCombinedNetworkCurve] = useState(null)
  const [selectedCurves, setSelectedCurves] = useState(null)
  const [selectionPoints, setSelectionPoints] = useState(null)
  const [lastQRef, setLastQRef] = useState(null)
  const [lastPvRef, setLastPvRef] = useState(null)
  const [lastSelection, setLastSelection] = useState(null)

  const allCombinedCurves = combinedNetworkCurve
    ? [...combinedCurves, combinedNetworkCurve]
    : combinedCurves

  const displayCurves = selectedCurves
    ? [...selectedCurves, ...(combinedNetworkCurve ? [combinedNetworkCurve] : [])]
    : allCombinedCurves

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

  return {
    combinedProduct, setCombinedProduct,
    combinedCurves,
    combinedDomain,
    combinedLoading,
    combinedNetworkCurve, setCombinedNetworkCurve,
    selectedCurves,
    selectionPoints,
    lastQRef, setLastQRef,
    lastPvRef, setLastPvRef,
    lastSelection,
    displayCurves,
    handleCombinedSearch,
    handleSelection,
  }
}
