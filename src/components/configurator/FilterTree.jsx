import React, { useState, useEffect, useRef } from 'react';
import CreateThreadModal from '../issues/CreateThreadModal.jsx';
import cytoscape from 'cytoscape';
import ProductBindingPanel from './ProductBindingPanel.jsx';

const API_BASE = '/api/v1/catalog';

const FilterTreeGraph = ({ onOpenSpecEditor }) => {
  const cyRef = useRef(null);
  const cyInstanceRef = useRef(null);

  const [productTypes, setProductTypes] = useState([]);
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [graphLoading, setGraphLoading] = useState(false);
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
  const [detaching, setDetaching] = useState(false);
  const [detachResult, setDetachResult] = useState(null);
  const [attachedValueIds, setAttachedValueIds] = useState([]);
  const [graphHeight, setGraphHeight] = useState(500);
  const [showCreateThread, setShowCreateThread] = useState(false);
  // ── Редактор привязок ──────────────────────────────────────────────────────
  const [mode, setMode] = useState('filter');
  const [pendingAssignments, setPendingAssignments] = useState({});

  // ── Теги ──────────────────────────────────────────────────────────────────
  const [tagValues, setTagValues] = useState([]);        // все доступные теги
  const [selectedTags, setSelectedTags] = useState([]);  // выбранные tag value_ids

  const axisValues = useRef({});
  const pendingGraphData = useRef(null);

  // ── Загрузка типов продукции ───────────────────────────────────────────────

  useEffect(() => {
    fetch(`${API_BASE}/product-types/`)
      .then(r => r.json())
      .then(data => {
        const types = Array.isArray(data) ? data : (data.results || []);
        setProductTypes(types);
        if (types.length === 1) setSelectedTypeId(types[0].id);
      })
      .catch(err => setError(err.message));
  }, []);

  // ── Загрузка тегов при выборе типа ────────────────────────────────────────

  useEffect(() => {
    if (!selectedTypeId) return;

    setLoading(true);
    setError(null);
    setSelectedNodes([]);
    setFilterResult(null);
    setAttachResult(null);
    setAttachAxis('');
    setAttachValue('');
    setSelectedTags([]);
    setTagValues([]);

    if (cyInstanceRef.current) {
      cyInstanceRef.current.destroy();
      cyInstanceRef.current = null;
    }

    // Загружаем только теги (без value_ids — граф не нужен)
    fetch(`${API_BASE}/product-types/${selectedTypeId}/filtered-configuration/`)
      .then(r => r.json())
      .then(json => {
        if (!json.success) throw new Error('API error');
        setProductType(json.data.product_type);
        setTagValues(json.data.tag_values || []);

        // Оси для панели привязки берём из обычного configuration
        return fetch(`${API_BASE}/product-types/${selectedTypeId}/configuration/`);
      })
      .then(r => r.json())
      .then(json => {
        if (!json.success) throw new Error('API error');
        const axes = json.data.nodes
          .filter(n => n.data.type === 'axis')
          .sort((a, b) => a.data.order - b.data.order)
          .map(n => ({
            id: n.data.id.replace('axis-', ''),
            label: n.data.label,
            order: n.data.order,
          }));
        setAllAxes(axes);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [selectedTypeId]);

  // ── Загрузка отфильтрованного графа при изменении тегов ───────────────────

  useEffect(() => {
    if (!selectedTypeId || selectedTags.length === 0) {
      // Теги сброшены — уничтожаем граф
      if (cyInstanceRef.current) {
        cyInstanceRef.current.destroy();
        cyInstanceRef.current = null;
      }
      pendingGraphData.current = null;
      setSelectedNodes([]);
      setFilterResult(null);
      return;
    }

    setGraphLoading(true);

    const valueIds = selectedTags.join(',');
    fetch(
      `${API_BASE}/product-types/${selectedTypeId}/filtered-configuration/?value_ids=${valueIds}`
    )
      .then(r => r.json())
      .then(json => {
        if (!json.success) throw new Error('API error');

        const { nodes, edges } = json.data;

        // Уничтожаем старый граф
        if (cyInstanceRef.current) {
          cyInstanceRef.current.destroy();
          cyInstanceRef.current = null;
        }

        setSelectedNodes([]);
        setFilterResult(null);

        if (!nodes.length) {
          setGraphLoading(false);
          return;
        }

        // Считаем высоту
        const valueNodes = nodes.filter(n => n.data.type === 'value');
        const byOrder = {};
        valueNodes.forEach(n => {
          const o = n.data.order;
          if (!byOrder[o]) byOrder[o] = [];
          byOrder[o].push(n.data.id);
        });
        const maxNodes = Object.values(byOrder).reduce(
          (m, ids) => Math.max(m, ids.length), 0
        );
        setGraphHeight(Math.max(500, maxNodes * 50 + 150));

        pendingGraphData.current = { nodes, edges, byOrder, selectedIds: json.data.selected_ids };
        setGraphLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setGraphLoading(false);
      });
  }, [selectedTags, selectedTypeId]);

  // ── Инициализация графа после рендера ─────────────────────────────────────

  useEffect(() => {
    if (graphLoading) return;
    if (!pendingGraphData.current) return;
    if (!cyRef.current) return;

    const { nodes, edges, byOrder, selectedIds } = pendingGraphData.current;
    pendingGraphData.current = null;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        initCytoscape(nodes, edges, byOrder, selectedIds);
      });
    });
  }, [graphLoading]);

  // ── Инициализация Cytoscape ────────────────────────────────────────────────

  const initCytoscape = (nodes, edges, byOrder, selectedIds = []) => {
    if (!cyRef.current) return;

    if (!byOrder) {
      byOrder = {};
      nodes.filter(n => n.data.type === 'value').forEach(n => {
        const o = n.data.order;
        if (!byOrder[o]) byOrder[o] = [];
        byOrder[o].push(n.data.id);
      });
    }

    const positions = {};
    const COL_W = 200, ROW_H = 50;
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
          // Узлы выбранные через теги — особый стиль
          selector: 'node[?selected]',
          style: {
            'background-color': '#7c3aed', 'border-color': '#5b21b6',
            'border-width': 2, 'color': '#ffffff',
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
          style: {
            'background-color': '#f8fafc', 'border-color': '#e2e8f0',
            'color': '#94a3b8', 'opacity': 0.35,
          },
        },
        {
          selector: 'node.attached',
          style: {
            'background-color': '#d1fae5', 'border-color': '#10b981',
            'border-width': 2, 'color': '#065f46', 'opacity': 1,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2, 'line-color': '#94a3b8',
            'target-arrow-color': '#94a3b8', 'target-arrow-shape': 'none',
            'curve-style': 'taxi',
            'taxi-direction': 'rightward',
            'source-endpoint': '90deg',
            'target-endpoint': '270deg',
          },
        },
        {
          selector: 'edge.highlighted',
          style: {
            'line-color': '#3b82f6',
            'target-arrow-shape': 'none',
            'width': 2,
            'curve-style': 'taxi',
            'taxi-direction': 'rightward',   // ← повторяем
            'source-endpoint': '90deg',          // ← правая сторона узла
            'target-endpoint': '270deg',         // ← левая сторона узла
          },
        },
        { selector: 'edge.dimmed', style: { 'opacity': 0.1 } },
      ],
      selectionType: 'additive',
      boxSelectionEnabled: true,
    });

    setTimeout(() => {
      cy.resize();
      cy.fit(undefined, 40);
      cy.minZoom(0.3);
      cy.maxZoom(3);
    }, 100);

    const updateSelection = () => {
      const selected = cy.nodes('[type="value"]:selected');
      cy.elements().removeClass('highlighted dimmed');

      if (selected.length === 0) {
        setSelectedNodes([]);
        setFilterResult(null);
        setAttachResult(null);
        return;
      }

      let reachable = cy.collection();
      selected.forEach(node => {
        reachable = reachable
          .union(node.successors('[type="value"]'))
          .union(node.predecessors('[type="value"]'));
      });

      const allNodes = reachable.union(selected);
      const connectingEdges = allNodes.edgesWith(allNodes);
      connectingEdges.addClass('highlighted');
      reachable.not(selected).addClass('highlighted');
      cy.nodes('[type="value"]').not(allNodes).addClass('dimmed');
      cy.edges().not(connectingEdges).addClass('dimmed');

      setFilterResult(null);
      setAttachResult(null);
      setSelectedNodes(
        selected.map(n => ({
          id: n.id(),
          label: n.data('label'),
          axisId: n.data('axis_id'),
          valueId: n.id().replace('value-', ''),
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

  // ── Обработка тегов ───────────────────────────────────────────────────────

  const handleTagClick = (valueId) => {
    setSelectedTags(prev => {
      if (prev.includes(valueId)) {
        return prev.filter(id => id !== valueId);
      }
      return [...prev, valueId];  // ← просто добавляем
    });
  };

  const handleClearTags = () => {
    setSelectedTags([]);
  };

  // Группируем теги по оси для отображения
  const tagsByAxis = tagValues.reduce((acc, tag) => {
    if (!acc[tag.axis_id]) {
      acc[tag.axis_id] = { axis_name: tag.axis_name, tags: [] };
    }
    acc[tag.axis_id].tags.push(tag);
    return acc;
  }, {});

  // ── Остальные handlers (без изменений) ────────────────────────────────────

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

  const handleAxisChange = async (axisId) => {
    setAttachAxis(axisId);
    setAttachValue('');
    setAttachResult(null);
    setDetachResult(null);
    setAttachedValueIds([]);

    if (!cyInstanceRef.current) return;
    cyInstanceRef.current.nodes('.attached').removeClass('attached');

    if (!axisId) { setAvailableValues([]); return; }

    const res = await fetch(`${API_BASE}/parameter-values/?axis=${axisId}&is_active=true`);
    const data = await res.json();
    const vals = Array.isArray(data) ? data : (data.results || []);
    setAvailableValues(vals.map(v => ({ id: v.id, label: v.value })));

    if (!selectedNodes.length) return;

    try {
      const res2 = await fetch(`${API_BASE}/products/current-parameters/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: selectedNodes.map(n => ({ axis_id: n.axisId, value_id: n.valueId })),
          axis_id: axisId,
        }),
      });
      const data2 = await res2.json();
      if (data2.success && data2.data.value_ids.length > 0) {
        const ids = data2.data.value_ids;
        const cy = cyInstanceRef.current;
        ids.forEach(vid => {
          const node = cy.getElementById(`value-${vid}`);
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
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow px-5 py-4">
        <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          Тип продукции
        </label>
        <select
          value={selectedTypeId}
          onChange={e => setSelectedTypeId(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800
                     text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— выберите —</option>
          {productTypes.map(pt => (
            <option key={pt.id} value={pt.id}>{pt.name}</option>
          ))}
        </select>
      </div>

      {/* Загрузка типа */}
      {selectedTypeId && loading && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 text-center
                        text-gray-400 dark:text-gray-500 text-sm">
          Загрузка...
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="bg-red-50 rounded-lg p-4 text-red-600 text-sm">
          Ошибка: {error}
        </div>
      )}

      {/* Теги — показываем сразу после загрузки типа */}
      {selectedTypeId && !loading && tagValues.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Фильтр графа
            </span>
            {selectedTags.length > 0 && (
              <button
                onClick={handleClearTags}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Сбросить
              </button>
            )}
          </div>

          {/* Группы тегов по осям */}
          <div className="space-y-3">
            {Object.entries(tagsByAxis).map(([axisId, { axis_name, tags }]) => (
              <div key={axisId}>
                <div className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">
                  {axis_name}
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => {
                    const isSelected = selectedTags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleTagClick(tag.id)}
                        className={`
                          px-3 py-1 rounded-full text-sm font-medium transition-all
                          ${isSelected
                            ? 'bg-violet-600 text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }
                        `}
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Подсказка */}
          {selectedTags.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
              Выберите значения для фильтрации графа
            </p>
          )}
        </div>
      )}

      {/* Пока не выбраны теги */}
      {selectedTypeId && !loading && selectedTags.length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-12 text-center
                        text-gray-400 dark:text-gray-500 text-sm">
          Выберите фильтр выше для отображения графа
        </div>
      )}

      {/* Загрузка графа */}
      {selectedTags.length > 0 && graphLoading && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 text-center
                        text-gray-400 dark:text-gray-500 text-sm">
          Загрузка графа...
        </div>
      )}

      {/* Граф + панель */}
      {selectedTypeId && !loading && !graphLoading && selectedTags.length > 0 && !error && (
        <div className="flex gap-4 w-full">

          {/* Граф */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 flex-1 min-w-0 flex flex-col">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {productType?.name}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Клик — выделить · Shift+клик — добавить · Drag — область
              </span>
            </div>
            <div
              ref={cyRef}
              className="border border-gray-200 dark:border-gray-700 rounded-lg"
              style={{ height: graphHeight }}
            />
          </div>

          {/* Панель привязки */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 w-72 shrink-0
                          flex flex-col gap-4 self-start sticky top-4">
            <div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400
                              uppercase tracking-wide mb-2">
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
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Выделите узлы на графе
                </p>
              )}
            </div>

            {filterResult !== null && (
              <div className={`rounded-lg p-3 text-sm ${filterResult.count > 0
                ? 'bg-green-50 text-green-800'
                : 'bg-gray-50 dark:bg-gray-950 text-gray-500'
                }`}>
                {filterResult.count > 0
                  ? <>Найдено: <strong>{filterResult.count}</strong> изделий</>
                  : 'Изделий не найдено'}
              </div>
            )}

            {filterResult?.count > 0 && (
              <div className="border-t pt-4">
                <button
                  onClick={() => onOpenSpecEditor(filterResult.product_ids)}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white
                 text-sm py-2 rounded-lg transition-colors"
                >
                  Редактировать характеристики ({filterResult.count})
                </button>
                <button
                  onClick={() => setShowCreateThread(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white
                 text-sm py-2 rounded-lg transition-colors"
                >
                  Создать тред ({filterResult.count})
                </button>
                {showCreateThread && (
                  <CreateThreadModal
                    productIds={filterResult.product_external_ids}
                    graphContext={{
                      filters: selectedNodes.map(n => ({ axis_id: n.axisId, value_id: n.valueId })),
                      tags: selectedTags,
                    }}
                    onClose={() => setShowCreateThread(false)}
                    onCreated={(thread) => {
                      setShowCreateThread(false);
                      // thread создан — можно перейти к нему
                    }}
                  />
                )}
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400
                                uppercase tracking-wide mb-3">
                  Привязать ось
                </div>


                <div className="mb-2">
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Ось</label>
                  <select
                    value={attachAxis}
                    onChange={e => handleAxisChange(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg
                               px-2 py-1.5 text-sm focus:outline-none focus:ring-2
                               focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">— выберите —</option>
                    {allAxes.map(a => (
                      <option key={a.id} value={a.id}>{a.label}</option>
                    ))}
                  </select>
                </div>

                {attachAxis && attachedValueIds.length > 0 && (
                  <div className="mb-2 p-2 bg-emerald-50 rounded text-xs text-emerald-700">
                    Уже привязано: {availableValues
                      .filter(v => attachedValueIds.includes(v.id))
                      .map(v => v.label)
                      .join(', ')}
                  </div>
                )}
                {attachAxis && attachedValueIds.length === 0 && availableValues.length > 0 && (
                  <div className="mb-2 p-2 bg-gray-50 dark:bg-gray-950 rounded text-xs text-gray-400">
                    Привязок нет
                  </div>
                )}

                {attachAxis && (
                  <div className="mb-3">
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Значение
                    </label>
                    <select
                      value={attachValue}
                      onChange={e => { setAttachValue(e.target.value); setAttachResult(null); }}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg
                                 px-2 py-1.5 text-sm focus:outline-none focus:ring-2
                                 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
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

                {attachResult && (
                  <div className="mt-2 p-2 bg-emerald-50 rounded-lg text-xs text-emerald-800">
                    ✓ Привязано: {attachResult.updated} · Обновлено: {attachResult.skipped}
                    <div className="text-emerald-600">
                      {attachResult.axis} = {attachResult.value}
                    </div>
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
      {/* ── Переключатель режимов (показываем если тип выбран) ── */}
      {selectedTypeId && !loading && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow px-5 py-3">
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
            <button
              onClick={() => setMode('filter')}
              className={`px-4 py-1.5 rounded text-sm transition-colors ${
                mode === 'filter'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800'
              }`}
            >
              Фильтр графа
            </button>
            <button
              onClick={() => setMode('binding')}
              className={`px-4 py-1.5 rounded text-sm transition-colors ${
                mode === 'binding'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800'
              }`}
            >
              Редактор привязок 🔧
            </button>
          </div>
        </div>
      )}

      {/* ── Редактор привязок ── */}
      {mode === 'binding' && selectedTypeId && !loading && (
        <div className="flex gap-4">
          <div className="flex-1 bg-white dark:bg-gray-900 rounded-lg shadow p-4
                          min-h-96 flex items-center justify-center text-gray-400 text-sm">
            Граф редактора — следующий шаг
          </div>
          <div className="w-72 shrink-0" style={{ height: 600 }}>
            <ProductBindingPanel
              productTypeId={selectedTypeId}
              filterValueIds={[]}
              pendingAssignments={pendingAssignments}
              onDragStart={(ids) => console.log('drag:', ids)}
              onSelectionChange={(ids) => console.log('selected:', ids)}
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default FilterTreeGraph;