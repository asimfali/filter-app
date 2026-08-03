import { useRef, useEffect, useState } from 'react'
import { selectionApi } from '../../api/selection'

export default function useFanChartData() {
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
  const containerRef = useRef(null)
  const [chartSize, setChartSize] = useState({ width: 800, height: 600 })
  const [pendingNetwork, setPendingNetwork] = useState(null)
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [showAxisSettings, setShowAxisSettings] = useState(false)

  useEffect(() => {
    const update = () => {
      const sideW = charts.length > 0 ? 272 : 0
      setChartSize({
        width: window.innerWidth - sideW - 128,
        height: window.innerHeight - 340,
      })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [charts.length])

  const allCurves = networkCurve
    ? [...(chartData || []), networkCurve]
    : (chartData || [])

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
      // chart может быть локальным объектом только что созданного (ещё не перезагруженного
      // с бэкенда) графика — тогда x_min/x_max/y_min/y_max отсутствуют, есть только xDomain/yDomain
      const xMin = chart.x_min ?? chart.xDomain?.[0]
      const xMax = chart.x_max ?? chart.xDomain?.[1]
      const yMin = chart.y_min ?? chart.yDomain?.[0]
      const yMax = chart.y_max ?? chart.yDomain?.[1]

      setSelectedChart({
        ...chart,
        xDomain: [xMin * ratio.x, xMax * ratio.x],
        yDomain: [yMin * ratio.y, yMax * ratio.y],
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
      // chart.x_min и т.п. отсутствуют сразу после создания нового графика (там только
      // xDomain/yDomain из CreateChartModal) — падать в них, а не в дефолты, иначе только
      // что сохранённые границы графика молча перезатираются обратно на 0.3/2/60/1000
      x_min: chart.x_min ?? chart.xDomain?.[0] ?? 0.3,
      x_max: chart.x_max ?? chart.xDomain?.[1] ?? 2.0,
      y_min: chart.y_min ?? chart.yDomain?.[0] ?? 60,
      y_max: chart.y_max ?? chart.yDomain?.[1] ?? 1000,
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

  const chartHeight = window.innerHeight - 340
  const chartWidth = scaleRatio
    ? Math.round(chartHeight / scaleRatio)
    : chartSize.width

  return {
    productId, setProductId,
    charts, setCharts,
    selectedChart, setSelectedChart,
    chartData, setChartData,
    loading,
    mode, setMode,
    showCreateChart, setShowCreateChart,
    showAddCurve, setShowAddCurve,
    activeCurveId, setActiveCurveId,
    editTool, setEditTool,
    saving, saveStatus,
    networkCurve, setNetworkCurve,
    operatingPoint, setOperatingPoint,
    containerRef,
    pendingNetwork, setPendingNetwork,
    showSaveConfirm, setShowSaveConfirm,
    showAxisSettings, setShowAxisSettings,
    allCurves,
    handleSearch,
    handleSelectChart,
    handleSave,
    handleChartCreated,
    handleCurvesChange,
    handleAddPoint,
    handleCurveAdded,
    xScaleFactor, yScaleFactor,
    xDomain, yDomain, scaleType, scaleRatio,
    chartWidth, chartHeight,
  }
}
