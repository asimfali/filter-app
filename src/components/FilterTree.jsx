// src/components/FilterTree.jsx — полная замена

import React, { useState, useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';

const API_BASE = '/api/v1/catalog';

const FilterTreeGraph = () => {
  const cyRef = useRef(null);
  const cyInstanceRef = useRef(null);

  const [productTypes, setProductTypes] = useState([]);         // список типов
  const [selectedTypeId, setSelectedTypeId] = useState('');       // выбранный тип
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [productType, setProductType] = useState(null);
  const [allAxes, setAllAxes] = useState([]);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [filterResult, setFilterResult] = useState(null);
  const [counting, setCounting] = useState(false);
  const [attachAxis, setAttachAxis] = useState('');
  const [attachValue, setAttachValue] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [attachResult, setAttachResult] = useState(null);
  const [availableValues, setAvailableValues] = useState([]);

  const axisValues = useRef({});

  // ── Загрузка списка типов продукции при старте ─────────────────────────

  useEffect(() => {
    fetch(`${API_BASE}/product-types/`)
      .then(r => r.json())
      .then(data => {
        // Без пагинации — просто массив
        const types = Array.isArray(data) ? data : (data.results || []);
        setProductTypes(types);
        if (types.length === 1) setSelectedTypeId(types[0].id);
      })
      .catch(err => setError(err.message));
  }, []);

  // ── Загрузка конфигурации при выборе типа ─────────────────────────────

  useEffect(() => {
    if (!selectedTypeId) return;

    setLoading(true);
    setError(null);
    setSelectedNodes([]);
    setFilterResult(null);
    setAttachResult(null);
    setAttachAxis('');
    setAttachValue('');

    // Уничтожаем старый граф
    if (cyInstanceRef.current) {
      cyInstanceRef.current.destroy();
      cyInstanceRef.current = null;
    }

    fetch(`${API_BASE}/product-types/${selectedTypeId}/configuration/`)
      .then(r => r.json())
      .then(json => {
        if (!json.success) throw new Error('API error');
        setProductType(json.data.product_type);

        const axes = json.data.nodes
          .filter(n => n.data.type === 'axis')
          .sort((a, b) => a.data.order - b.data.order)
          .map(n => ({
            id: n.data.id.replace('axis-', ''),
            label: n.data.label,
            order: n.data.order,
          }));
        setAllAxes(axes);
        axisValues.current = {};

        // Сохраняем данные для инициализации после рендера
        pendingGraphData.current = { nodes: json.data.nodes, edges: json.data.edges };
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [selectedTypeId]);

  // Новый ref для хранения данных графа
  const pendingGraphData = useRef(null);

  // Инициализируем граф после того как DOM обновился (loading стал false)
  useEffect(() => {
    if (loading) return;
    if (!pendingGraphData.current) return;
    if (!cyRef.current) return;

    const { nodes, edges } = pendingGraphData.current;
    pendingGraphData.current = null;
    initCytoscape(nodes, edges);
  }, [loading]);

  // ── Инициализация Cytoscape ────────────────────────────────────────────────

  const initCytoscape = (nodes, edges) => {
    if (!cyRef.current) return;

    const valueNodes = nodes.filter(n => n.data.type === 'value');
    const byOrder = {};
    valueNodes.forEach(n => {
      const o = n.data.order;
      if (!byOrder[o]) byOrder[o] = [];
      byOrder[o].push(n.data.id);
    });

    const positions = {};
    const COL_W = 160, ROW_H = 65;
    Object.entries(byOrder).forEach(([order, ids]) => {
      ids.forEach((id, i) => {
        positions[id] = { x: parseInt(order) * COL_W + 100, y: i * ROW_H + 60 };
      });
    });
    nodes.filter(n => n.data.type === 'axis').forEach(n => {
      positions[n.data.id] = { x: n.data.order * COL_W + 100, y: -20 };
    });

    const cy = cytoscape({
      container: cyRef.current,
      elements: [...nodes, ...edges],
      layout: {
        name: 'preset',
        positions: node => positions[node.id()] || { x: 0, y: 0 },
      },
      style: [
        {
          selector: 'node[type="axis"]',
          style: {
            'label': 'data(label)', 'background-color': '#1e40af',
            'color': '#ffffff', 'font-size': 11, 'font-weight': 'bold',
            'width': 130, 'height': 28, 'shape': 'roundrectangle',
            'text-valign': 'center', 'text-halign': 'center', 'events': 'no',
          },
        },
        {
          selector: 'node[type="value"]',
          style: {
            'label': 'data(label)', 'background-color': '#f1f5f9',
            'border-color': '#cbd5e1', 'border-width': 1,
            'color': '#334155', 'font-size': 12,
            'width': 130, 'height': 34, 'shape': 'roundrectangle',
            'text-valign': 'center', 'text-halign': 'center',
          },
        },
        {
          selector: 'node[type="value"]:selected',
          style: {
            'background-color': '#3b82f6', 'border-color': '#1d4ed8',
            'border-width': 2, 'color': '#ffffff',
          },
        },
        {
          selector: 'node.highlighted',
          style: {
            'background-color': '#dbeafe', 'border-color': '#3b82f6',
            'border-width': 2, 'color': '#1e40af',
          },
        },
        {
          selector: 'node.dimmed',
          style: { 'background-color': '#f8fafc', 'border-color': '#e2e8f0', 'color': '#94a3b8', 'opacity': 0.35 },
        },
        {
          selector: 'node.attached',
          style: {
            'background-color': '#d1fae5',
            'border-color': '#10b981',
            'border-width': 2,
            'color': '#065f46',
            'opacity': 1,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2, 'line-color': '#94a3b8',
            'target-arrow-color': '#94a3b8', 'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
          },
        },
        { selector: 'edge.highlighted', style: { 'line-color': '#3b82f6', 'target-arrow-color': '#3b82f6', 'width': 3 } },
        { selector: 'edge.dimmed', style: { 'opacity': 0.1 } },
      ],
      selectionType: 'additive',
      boxSelectionEnabled: true,
    });

    const updateSelection = () => {
      const selected = cy.nodes('[type="value"]:selected');
      cy.elements().removeClass('highlighted dimmed');

      if (selected.length === 0) {
        setSelectedNodes([]);
        setFilterResult(null);
        setAttachResult(null);
        return;
      }

      const connectedEdges = selected.connectedEdges();
      const connectedNodes = connectedEdges.connectedNodes().filter('[type="value"]');
      connectedNodes.not(selected).addClass('highlighted');
      connectedEdges.addClass('highlighted');
      cy.nodes('[type="value"]').not(selected.union(connectedNodes)).addClass('dimmed');
      cy.edges().not(connectedEdges).addClass('dimmed');

      setFilterResult(null);
      setAttachResult(null);
      setSelectedNodes(
        selected.map(n => ({
          id: n.id(),
          label: n.data('label'),
          axisId: n.data('axis_id'),
          valueId: n.id().replace('value-', ''),
          // Находим название оси из заголовков
          axisLabel: cy.getElementById(`axis-${n.data('axis_id')}`).data('label') || '',
        }))
      );
    };

    cy.on('select unselect', 'node[type="value"]', updateSelection);
    cy.on('tap', e => {
      if (e.target === cy) {
        cy.nodes().unselect();
        cy.elements().removeClass('highlighted dimmed');
        setSelectedNodes([]);
        setFilterResult(null);
        setAttachResult(null);
      }
    });

    cyInstanceRef.current = cy;
  };

  // ── Найти изделия ─────────────────────────────────────────────────────────

  const handleFilterCount = async () => {
    if (!selectedNodes.length) return;
    setCounting(true);
    try {
      const res = await fetch(`${API_BASE}/products/filter-count/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: selectedNodes.map(n => ({ axis_id: n.axisId, value_id: n.valueId })),
        }),
      });
      const data = await res.json();
      if (data.success) setFilterResult(data.data);
    } finally {
      setCounting(false);
    }
  };

  // ── Привязать ось ─────────────────────────────────────────────────────────

  const handleAttach = async () => {
    if (!attachAxis || !attachValue || !filterResult?.product_ids?.length) return;
    setAttaching(true);
    setAttachResult(null);
    try {
      const res = await fetch(`${API_BASE}/products/bulk-attach-parameter/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: selectedNodes.map(n => ({ axis_id: n.axisId, value_id: n.valueId })),
          axis_id: attachAxis,
          value_id: attachValue,
        }),
      });
      const data = await res.json();
      if (data.success) setAttachResult(data.data);
    } finally {
      setAttaching(false);
    }
  };

  const [detaching, setDetaching] = useState(false);
  const [detachResult, setDetachResult] = useState(null);
  const [attachedValueIds, setAttachedValueIds] = useState([]);

  const handleAxisChange = async (axisId) => {
    setAttachAxis(axisId);
    setAttachValue('');
    setAttachResult(null);
    setDetachResult(null);
    setAttachedValueIds([]);

    if (!cyInstanceRef.current) return;
    // Снимаем старую подсветку
    cyInstanceRef.current.nodes('.attached').removeClass('attached');

    if (!axisId) { setAvailableValues([]); return; }

    // Загружаем значения оси
    const res = await fetch(`${API_BASE}/parameter-values/?axis=${axisId}&is_active=true`);
    const data = await res.json();
    const vals = Array.isArray(data) ? data : (data.results || []);
    setAvailableValues(vals.map(v => ({ id: v.id, label: v.value })));

    // Загружаем текущие привязки — используем selectedNodes напрямую
    if (!selectedNodes.length) return;

    const filters = selectedNodes.map(n => ({
      axis_id: n.axisId,
      value_id: n.valueId,
    }));

    try {
      const res2  = await fetch(`${API_BASE}/products/current-parameters/`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ filters, axis_id: axisId }),
      });
      const data2 = await res2.json();
      console.log('current-parameters response:', data2);  // ← добавить

      if (data2.success && data2.data.value_ids.length > 0) {
          const ids = data2.data.value_ids;
          console.log('value_ids:', ids);  // ← добавить

          const cy = cyInstanceRef.current;
          ids.forEach(vid => {
              const node = cy.getElementById(`value-${vid}`);
              console.log(`node value-${vid}:`, node.length);  // ← добавить
              if (node.length) {
                  node.removeClass('dimmed');
                  node.addClass('attached');
              }
          });
      }
  } catch (e) {
      console.error(e);
  }
  };

  // Отвязка
  const handleDetach = async () => {
    if (!attachAxis || !filterResult?.count) return;
    setDetaching(true);
    setDetachResult(null);
    try {
      const res = await fetch(`${API_BASE}/products/bulk-detach-parameter/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: selectedNodes.map(n => ({ axis_id: n.axisId, value_id: n.valueId })),
          axis_id: attachAxis,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDetachResult(data.data);
        setAttachedValueIds([]);
        // Снимаем подсветку привязок
        cyInstanceRef.current?.nodes('.attached').removeClass('attached');
      }
    } finally {
      setDetaching(false);
    }
  };

  // ── Рендер ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Выбор типа продукции */}
      <div className="bg-white rounded-lg shadow px-5 py-4">
        <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">
          Тип продукции
        </label>
        <select
          value={selectedTypeId}
          onChange={e => setSelectedTypeId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-48"
        >
          <option value="">— выберите —</option>
          {productTypes.map(pt => (
            <option key={pt.id} value={pt.id}>{pt.name}</option>
          ))}
        </select>
      </div>

      {/* Пока не выбран тип */}
      {!selectedTypeId && (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400 text-sm">
          Выберите тип продукции для отображения графа
        </div>
      )}

      {/* Загрузка */}
      {selectedTypeId && loading && (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400 text-sm">
          Загрузка графа...
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="bg-red-50 rounded-lg p-4 text-red-600 text-sm">
          Ошибка: {error}
        </div>
      )}

      {/* Граф + панель — показываем только когда загружено */}
      {selectedTypeId && !loading && !error && (
        <div className="flex gap-4">

          {/* Граф */}
          <div className="bg-white rounded-lg shadow p-4 flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">{productType?.name}</span>
              <span className="text-xs text-gray-400">
                Клик — выделить · Shift+клик — добавить · Drag — область
              </span>
            </div>
            <div ref={cyRef} className="border border-gray-200 rounded-lg" style={{ height: 500 }} />
          </div>

          {/* Панель привязки — без изменений */}
          <div className="bg-white rounded-lg shadow p-4 w-72 shrink-0 flex flex-col gap-4">
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Фильтр
              </div>
              {selectedNodes.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {selectedNodes.map(n => (
                      <span key={n.id}
                        className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                        <span className="opacity-60">{n.axisLabel}: </span>{n.label}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={handleFilterCount}
                    disabled={counting}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                               text-white text-sm py-2 rounded-lg transition-colors"
                  >
                    {counting ? 'Поиск...' : 'Найти изделия'}
                  </button>
                </>
              ) : (
                <p className="text-xs text-gray-400">Выделите узлы на графе</p>
              )}
            </div>

            {filterResult !== null && (
              <div className={`rounded-lg p-3 text-sm ${filterResult.count > 0 ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-500'
                }`}>
                {filterResult.count > 0
                  ? <>Найдено: <strong>{filterResult.count}</strong> изделий</>
                  : 'Изделий не найдено'}
              </div>
            )}

            {filterResult?.count > 0 && (
              <div className="border-t pt-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                  Привязать ось
                </div>

                <div className="mb-2">
                  <label className="block text-xs text-gray-600 mb-1">Ось</label>
                  <select
                    value={attachAxis}
                    onChange={e => handleAxisChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5
                           text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— выберите —</option>
                    {allAxes.map(a => (
                      <option key={a.id} value={a.id}>{a.label}</option>
                    ))}
                  </select>
                </div>

                {/* Подсветка текущих привязок */}
                {attachAxis && attachedValueIds.length > 0 && (
                  <div className="mb-2 p-2 bg-emerald-50 rounded text-xs text-emerald-700">
                    Уже привязано: {availableValues
                      .filter(v => attachedValueIds.includes(v.id))
                      .map(v => v.label)
                      .join(', ')}
                  </div>
                )}
                {attachAxis && attachedValueIds.length === 0 && availableValues.length > 0 && (
                  <div className="mb-2 p-2 bg-gray-50 rounded text-xs text-gray-400">
                    Привязок нет
                  </div>
                )}

                {/* Выбор значения */}
                {attachAxis && (
                  <div className="mb-3">
                    <label className="block text-xs text-gray-600 mb-1">Значение</label>
                    <select
                      value={attachValue}
                      onChange={e => { setAttachValue(e.target.value); setAttachResult(null); }}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5
                               text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— выберите —</option>
                      {availableValues.map(v => (
                        <option key={v.id} value={v.id}>
                          {attachedValueIds.includes(v.id) ? '✓ ' : ''}{v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Кнопки */}
                <div className="flex gap-2">
                  <button
                    onClick={handleAttach}
                    disabled={!(filterResult?.count > 0 && attachAxis && attachValue) || attaching}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40
                           text-white text-sm py-2 rounded-lg transition-colors"
                  >
                    {attaching ? 'Привязываю...' : 'Привязать'}
                  </button>
                  <button
                    onClick={handleDetach}
                    disabled={!attachAxis || !filterResult?.count || detaching}
                    className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-40
                           text-white text-sm py-2 rounded-lg transition-colors"
                  >
                    {detaching ? 'Удаляю...' : 'Отвязать'}
                  </button>
                </div>

                {/* Результаты */}
                {attachResult && (
                  <div className="mt-2 p-2 bg-emerald-50 rounded-lg text-xs text-emerald-800">
                    ✓ Привязано: {attachResult.updated} · Обновлено: {attachResult.skipped}
                    <div className="text-emerald-600">{attachResult.axis} = {attachResult.value}</div>
                  </div>
                )}
                {detachResult && (
                  <div className="mt-2 p-2 bg-red-50 rounded-lg text-xs text-red-800">
                    ✓ Отвязано: {detachResult.deleted} изделий от оси {detachResult.axis}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


export default FilterTreeGraph;