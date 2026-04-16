import React, { useState, useEffect, useRef, useCallback } from 'react';
import CreateThreadModal from '../issues/CreateThreadModal.jsx';
import cytoscape from 'cytoscape';
import ProductBindingPanel, { ChainProductsPanel } from './ProductBindingPanel.jsx';
import BindingGraph from './BindingGraph.jsx';
import { catalogApi } from '../../api/catalog';
import { useAuth } from '../../contexts/AuthContext';
import { can } from '../../utils/permissions';
import { useChainSearch } from '../../hooks/useChainSearch';


const FilterTreeGraph = ({ onOpenSpecEditor, onOpenSpecPreview }) => {
  const cyRef = useRef(null);
  const cyInstanceRef = useRef(null);
  const { user, loading: authLoading } = useAuth();
  const canViewBinding = !authLoading && can(user, 'portal.page.binding');
  const canEditBindings = !authLoading && can(user, 'catalog.binding.write');
  const canEditSpecs = !authLoading && can(user, 'catalog.spec.write');
  const [partialSearch, setPartialSearch] = useState(true);
  const [dragMissingAxes, setDragMissingAxes] = useState([]);

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
  const [dropResult, setDropResult] = useState(null);
  const bindingGraphRef = useRef(null);
  const [intersectionIds, setIntersectionIds] = useState([]);

  // ── Теги ──────────────────────────────────────────────────────────────────
  const [tagValues, setTagValues] = useState([]);        // все доступные теги
  const [selectedTags, setSelectedTags] = useState([]);  // выбранные tag value_ids
  const [bindingTags, setBindingTags] = useState([]);
  const [bindingMode, setBindingMode] = useState('attach');
  const [bindingTagValues, setBindingTagValues] = useState([]);

  const [chainProducts, setChainProducts] = useState([]);
  const [chainLoading, setChainLoading] = useState(false);
  const [chainFilters, setChainFilters] = useState([]);

  // ── Хуки поиска ───────────────────────────────────────────────────────────
  const chainSearch = useChainSearch(selectedTypeId, { partial: partialSearch });
  const filterSearch = useChainSearch(selectedTypeId, { partial: partialSearch });

  const axisValues = useRef({});
  const pendingGraphData = useRef(null);

  const handleChainSelection = useCallback(async (chainValueIds) => {
    setChainFilters(chainValueIds);
    if (!chainValueIds.length) {
      chainSearch.reset();
      setChainProducts([]);  // ← добавь
      return;
    }
    await chainSearch.search(chainValueIds);
  }, [chainSearch])

  useEffect(() => {
    setChainProducts(chainSearch.products);
    setChainLoading(chainSearch.loading);
}, [chainSearch.products, chainSearch.loading]);

  // ── Загрузка типов продукции ───────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      const { ok, data } = await catalogApi.productTypes();
      if (!ok) return;
      const types = Array.isArray(data) ? data : (data.results || []);
      setProductTypes(types);
      if (types.length > 0) {
        const zavesy = types.find(t => t.name === 'Завесы');
        setSelectedTypeId(zavesy ? zavesy.id : types[0].id);
      }
    };
    load();
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

    const load = async () => {
      try {
        // Теги для фильтра графа — только первые две оси
        const { ok: ok1, data: data1 } = await catalogApi.filteredConfiguration(selectedTypeId);
        if (!ok1 || !data1.success) throw new Error('API error');
        setProductType(data1.data.product_type);
        setTagValues(data1.data.tag_values || []);  // ← для фильтра графа

        // Теги для редактора привязок — все оси
        const { ok: ok3, data: data3 } = await catalogApi.filteredConfiguration(selectedTypeId, [], true);
        if (ok3 && data3.success) {
          setBindingTagValues(data3.data.tag_values || []);  // ← для редактора
        }

        // Оси
        const { ok: ok2, data: data2 } = await catalogApi.configuration(selectedTypeId);
        if (!ok2 || !data2.success) throw new Error('API error');
        const axes = data2.data.nodes
          .filter(n => n.data.type === 'axis')
          .sort((a, b) => a.data.order - b.data.order)
          .map(n => ({
            id: n.data.id.replace('axis-', ''),
            label: n.data.label,
            order: n.data.order,
          }));
        setAllAxes(axes);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    load();
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

    const load = async () => {
      try {
        const { ok, data } = await catalogApi.filteredConfiguration(selectedTypeId, selectedTags);
        if (!ok || !data.success) throw new Error('API error');

        const { nodes, edges } = data.data;

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

        pendingGraphData.current = {
          nodes, edges, byOrder,
          selectedIds: data.data.selected_ids,
          productPaths: data.data.product_paths || [],
      };
        setGraphLoading(false);
      } catch (err) {
        setError(err.message);
        setGraphLoading(false);
      }
    };

    load();
  }, [selectedTags, selectedTypeId]);

  // ── Инициализация графа после рендера ─────────────────────────────────────

  useEffect(() => {
    if (graphLoading) return;
    if (!pendingGraphData.current) return;
    if (!cyRef.current) return;

    const { nodes, edges, byOrder, selectedIds, productPaths } = pendingGraphData.current;
    pendingGraphData.current = null;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        initCytoscape(nodes, edges, byOrder, selectedIds, productPaths);
      });
    });
  }, [graphLoading]);

  // ── Инициализация Cytoscape ────────────────────────────────────────────────

  const initCytoscape = (nodes, edges, byOrder, selectedIds = [], productPaths = []) => {
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

      // ── Вспомогательная функция: обход только по реальным рёбрам ──
      const getReachableNodes = (startNode) => {
        const startVid = startNode.id().replace('value-', '');
    const matchingPaths = productPaths.filter(path =>
        path.map(String).includes(startVid)
    );
    
        if (!matchingPaths.length) {
            return cy.collection().merge(startNode);
        }
    
        // Объединяем все value_ids из подходящих товаров
        const allowed = new Set();
        matchingPaths.forEach(path => {
            path.forEach(vid => allowed.add(String(vid)));
        });
    
        return cy.nodes('[type="value"]').filter(n =>
            allowed.has(n.id().replace('value-', ''))
        );
    };

      // ── Пересечение цепочек всех выбранных узлов ──
      const allChains = [];
      selected.forEach(node => {
        allChains.push(getReachableNodes(node));
      });

      let intersection = allChains[0];
      for (let i = 1; i < allChains.length; i++) {
        intersection = intersection.filter(node => allChains[i].has(node));
      }

      setIntersectionIds(
        intersection
          .filter(n => n.data('type') === 'value')
          .map(n => n.id().replace('value-', ''))
      );

      // ── Подсветка ──
      const connectingEdges = intersection.edgesWith(intersection);
      connectingEdges.addClass('highlighted');
      intersection.not(selected).addClass('highlighted');
      cy.nodes('[type="value"]').not(intersection).addClass('dimmed');
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
        setIntersectionIds([]);
        cy.nodes().unselect();
        cy.elements().removeClass('highlighted dimmed');
        setSelectedNodes([]);
        setFilterResult(null);
        setAttachResult(null);
      }
    });

    cyInstanceRef.current = cy;
  };

  const handleBindingDrop = async (productIds, valueId, valueLabel) => {
    try {
        const { ok, data } = await catalogApi.attachByIds(productIds, valueId);
        if (ok && data.success) {
            setDropResult({
                ok: true,
                message: `✓ ${valueLabel}: привязано ${data.data.created}, обновлено ${data.data.updated}`,
            });
            // ← обновляем список — товары должны уйти из неполных
            await chainSearch.search(chainFilters);
        } else {
            setDropResult({ ok: false, message: data.error || 'Ошибка' });
        }
    } catch {
        setDropResult({ ok: false, message: 'Ошибка сети' });
    }

    setTimeout(() => setDropResult(null), 3000);
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

  const tagsByAxis = tagValues.reduce((acc, tag) => {
    if (!acc[tag.axis_id]) {
      acc[tag.axis_id] = { axis_name: tag.axis_name, tags: [] };
    }
    acc[tag.axis_id].tags.push(tag);
    return acc;
  }, {});

  // Группируем теги по оси для отображения
  const bindingTagsByAxis = bindingTagValues.reduce((acc, tag) => {
    if (!acc[tag.axis_id]) {
      acc[tag.axis_id] = { axis_name: tag.axis_name, tags: [] };
    }
    acc[tag.axis_id].tags.push(tag);
    return acc;
  }, {});

  // ── Остальные handlers (без изменений) ────────────────────────────────────

  const handleFilterCount = async () => {
    if (!intersectionIds.length) return;
    setCounting(true);
    try {
      const result = await filterSearch.search(intersectionIds);
      if (result) {
        setFilterResult({
          count: result.count,
          product_ids: result.products.map(p => p.id),
          product_external_ids: result.products.map(p => p.external_id).filter(Boolean),
        });
      }
    } finally {
      setCounting(false);
    }
  };

  const handleAttach = async () => {
    if (!attachAxis || !attachValue || !filterResult?.product_ids?.length) return;
    setAttaching(true);
    setAttachResult(null);
    try {
      const { ok, data } = await catalogApi.bulkAttachParameter(
        selectedNodes.map(n => ({ axis_id: n.axisId, value_id: n.valueId })), attachAxis, attachValue);
      if (ok && data.success) setAttachResult(data.data);
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

    if (cyInstanceRef.current) {
      cyInstanceRef.current.nodes('.attached').removeClass('attached');
    }

    if (!axisId) { setAvailableValues([]); return; }

    const { ok, data } = await catalogApi.parameterValues(axisId);
    const vals = ok ? (Array.isArray(data) ? data : (data.results || [])) : [];
    setAvailableValues(vals.map(v => ({ id: v.id, label: v.value })));

    if (!selectedNodes.length) return;

    const { ok: ok2, data: data2 } = await catalogApi.currentParameters(
      selectedNodes.map(n => ({ axis_id: n.axisId, value_id: n.valueId })),
      axisId,
    );
    if (ok2 && data2.success && data2.data.value_ids.length > 0) {
      const cy = cyInstanceRef.current;
      data2.data.value_ids.forEach(vid => {
        const node = cy.getElementById(`value-${vid}`);
        if (node.length) {
          node.removeClass('dimmed');
          node.addClass('attached');
        }
      });
    }
  };

  const handleDetach = async () => {
    if (!attachAxis || !filterResult?.count) return;
    setDetaching(true);
    setDetachResult(null);
    try {
      const { ok, data } = await catalogApi.bulkDetachParameter(selectedNodes.map(n => ({ axis_id: n.axisId, value_id: n.valueId })),
        attachAxis);
      if (ok && data.success) {
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
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4">
        <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          Тип продукции
        </label>
        <select
          value={selectedTypeId}
          onChange={e => setSelectedTypeId(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-800
                     text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— выберите —</option>
          {productTypes.map(pt => (
            <option key={pt.id} value={pt.id}>{pt.name}</option>
          ))}
        </select>
      </div>

      {/* ── Переключатель режимов (показываем если тип выбран) ── */}
      {selectedTypeId && !loading && (
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-3">
          <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg w-fit">
            <button
              onClick={() => setMode('filter')}
              className={`px-4 py-1.5 rounded text-sm transition-colors ${mode === 'filter'
                ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800'
                }`}
            >
              Фильтр графа
            </button>
            {canViewBinding && (
              <button
                onClick={() => setMode('binding')}
                className={`px-4 py-1.5 rounded text-sm transition-colors ${mode === 'binding'
                  ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800'
                  }`}
              >
                Редактор привязок 🔧
                {!canEditBindings && (
                  <span className="ml-1.5 text-[10px] text-gray-400">(только просмотр)</span>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Загрузка типа */}
      {selectedTypeId && loading && (
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-8 text-center
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
      {mode === 'filter' && selectedTypeId && !loading && tagValues.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4">
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
                            : 'bg-neutral-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
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
      {mode === 'filter' && (
        <>
          {/* Пока не выбраны теги */}
          {selectedTypeId && !loading && selectedTags.length === 0 && (
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-12 text-center
                        text-gray-400 dark:text-gray-500 text-sm">
              Выберите фильтр выше для отображения графа
            </div>
          )}

          {/* Загрузка графа */}
          {selectedTags.length > 0 && graphLoading && (
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-8 text-center
                        text-gray-400 dark:text-gray-500 text-sm">
              Загрузка графа...
            </div>
          )}

          {/* Граф + панель */}
          {selectedTypeId && !loading && !graphLoading && selectedTags.length > 0 && !error && (
            <div className="flex gap-4 w-full">

              {/* Граф */}
              <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-4 flex-1 min-w-0 flex flex-col">
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
              <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-4 w-72 shrink-0
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
                      <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={partialSearch}
                          onChange={e => setPartialSearch(e.target.checked)}
                          className="rounded"
                        />
                        Неполные данные
                      </label>
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
                    : 'bg-neutral-50 dark:bg-neutral-950 text-gray-500'
                    }`}>
                    {filterResult.count > 0
                      ? <>Найдено: <strong>{filterResult.count}</strong> изделий</>
                      : 'Изделий не найдено'}
                  </div>
                )}

                {filterResult?.count > 0 && (
                  <div className="border-t pt-4">
                    {canEditSpecs && (
                    <button
                      onClick={() => onOpenSpecEditor(filterResult.product_ids)}
                      className="w-full bg-violet-600 hover:bg-violet-700 text-white
                 text-sm py-2 rounded-lg transition-colors"
                    >
                      Редактировать характеристики ({filterResult.count})
                    </button>
                    )}
                    <button
                      onClick={() => onOpenSpecPreview(filterResult.product_ids)}
                      className="w-full bg-neutral-100 dark:bg-neutral-800
                       hover:bg-neutral-200 dark:hover:bg-neutral-700
                       text-gray-700 dark:text-gray-300
                       text-sm py-2 rounded-lg transition-colors">
                      👁 Просмотр ({filterResult.count})
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
                               focus:ring-blue-500 dark:bg-neutral-800 dark:text-white"
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
                      <div className="mb-2 p-2 bg-neutral-50 dark:bg-neutral-950 rounded text-xs text-gray-400">
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
                                 focus:ring-blue-500 dark:bg-neutral-800 dark:text-white"
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
        </>
      )}

      {/* ── Редактор привязок ── */}
      {mode === 'binding' && canViewBinding && selectedTypeId && !loading && (
        <>
          {/* 🔐 Показываем предупреждение если нет права на запись */}
          {!canEditBindings && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 
                      dark:border-amber-800 rounded-lg px-4 py-2 mb-4">
              <p className="text-xs text-amber-800 dark:text-amber-400">
                🔒 Режим только для чтения. У вас нет прав на изменение привязок.
              </p>
            </div>
          )}
          {/* Теги редактора — все оси */}
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Фильтр товаров
              </span>
              {bindingTags.length > 0 && (
                <button
                  onClick={() => setBindingTags([])}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Сбросить
                </button>
              )}
            </div>
            <div className="space-y-3">
              {Object.entries(bindingTagsByAxis).map(([axisId, { axis_name, tags }]) => (
                <div key={axisId}>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">
                    {axis_name}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => {
                      const isSelected = bindingTags.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          onClick={() => setBindingTags(prev =>
                            prev.includes(tag.id)
                              ? prev.filter(id => id !== tag.id)
                              : [...prev, tag.id]
                          )}
                          className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${isSelected
                            ? 'bg-orange-500 text-white shadow-sm'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300 hover:bg-neutral-200'
                            }`}
                        >
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {bindingTags.length === 0 && (
              <p className="text-xs text-gray-400 mt-3">
                Выберите значения для фильтрации товаров в панели
              </p>
            )}
          </div>

          {/* Граф + панель */}
          <div className="flex gap-3 items-stretch">
            <div className="flex-1 min-w-0 bg-white dark:bg-neutral-900 rounded-lg shadow p-4">

              {/* Переключатель режимов */}
              {canEditBindings && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Режим:</span>
                  <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
                    <button
                      onClick={() => setBindingMode('attach')}
                      className={`px-3 py-1 rounded text-xs transition-colors ${bindingMode === 'attach'
                        ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      Привязать товар
                    </button>
                    <button
                      onClick={() => setBindingMode('connect')}
                      className={`px-3 py-1 rounded text-xs transition-colors ${bindingMode === 'connect'
                        ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      Связать узлы
                    </button>
                  </div>
                  {/* Неполные данные — только в режиме attach */}
                  {bindingMode === 'attach' && (
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none ml-2">
                      <input
                        type="checkbox"
                        checked={partialSearch}
                        onChange={e => setPartialSearch(e.target.checked)}
                        className="rounded"
                      />
                      Неполные данные
                    </label>
                  )}
                </div>
              )}

              {/* Уведомление */}
              {dropResult && (
                <div className={`mb-3 px-3 py-2 rounded-lg text-sm ${dropResult.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'
                  }`}>
                  {dropResult.message}
                </div>
              )}

              <BindingGraph
                productTypeId={selectedTypeId}
                selectedTagIds={bindingTags}
                mode={bindingMode}
                readOnly={!canEditBindings}
                dragMissingAxes={dragMissingAxes}
                onDrop={handleBindingDrop}
                onSelectionChange={ids => {
                  handleChainSelection(ids);
                }}
                onConnect={async (fromId, toId, addEdge) => {
                  const { ok, data } = await catalogApi.connectValues(fromId, toId);
                  setDropResult(
                    ok && data.success
                      ? { ok: true, message: `✓ Связь создана: ${data.data.from} → ${data.data.to}` }
                      : { ok: false, message: data.error || 'Ошибка' }
                  );
                  if (ok && data.success) {
                    addEdge(); // ← добавляем ребро в граф
                  }
                  setTimeout(() => setDropResult(null), 3000);
                }}
                onDisconnect={async (fromId, toId, removeEdge) => {
                  const { ok, data } = await catalogApi.disconnectValues(fromId, toId);
                  setDropResult(
                    ok && data.success
                      ? { ok: true, message: `✓ Связь удалена: ${data.data.from} → ${data.data.to}` }
                      : { ok: false, message: data.error || 'Ошибка' }
                  );
                  if (ok && data.success) {
                    removeEdge();
                  }
                  setTimeout(() => setDropResult(null), 3000);
                }}
                onDropBulk={async (productIds, valueIds) => {
                  const { ok, data } = await catalogApi.attachByIdsBulk(productIds, valueIds);
                  setDropResult(
                    ok && data.success
                      ? { ok: true, message: `✓ Привязано к ${data.data.axes} осям: создано ${data.data.created}, обновлено ${data.data.updated}` }
                      : { ok: false, message: data.error || 'Ошибка' }
                  );
                  setTimeout(() => setDropResult(null), 3000);
                }}
                onBulkConnect={async (sourceId, targetIds, addEdges) => {
                  const connections = targetIds.map(tid => ({
                    from_value_id: sourceId,
                    to_value_id: tid,
                  }));
                  const { ok, data } = await catalogApi.bulkConnect(connections);
                  setDropResult(
                    ok && data.success
                      ? { ok: true, message: `✓ Создано ${data.data.created} связей` }
                      : { ok: false, message: data.error || 'Ошибка' }
                  );
                  if (ok && data.success) addEdges();
                  setTimeout(() => setDropResult(null), 3000);
                }}
              />
            </div>
            {/* Панель изделий цепочки — слева от поиска */}
            {chainFilters.length > 0 && (
              <ChainProductsPanel
                products={chainProducts}
                partialProducts={chainSearch.partialProducts}
                loading={chainLoading}
                filters={chainFilters}
                chainValueIds={chainFilters}
                onPartialDragStart={axes => setDragMissingAxes(axes)}
                onDrop={async (productIds) => {
                  // Перепроверяем paths_count перед привязкой
                  const result = await chainSearch.search(chainFilters);
                  if (!result) return;

                  if (result.paths_count > 1) {
                    setDropResult({
                      ok: false,
                      message: `Неоднозначная цепочка (${result.paths_count} путей). Уточните фильтр.`
                    });
                    setTimeout(() => setDropResult(null), 4000);
                    return;
                  }

                  const { ok, data } = await catalogApi.attachByIdsBulk(productIds, chainFilters);
                  setDropResult(
                    ok && data.success
                      ? { ok: true, message: `✓ Привязано к ${data.data.axes} осям: создано ${data.data.created}` }
                      : { ok: false, message: data.error || 'Ошибка' }
                  );
                  await handleChainSelection(chainFilters);
                  setTimeout(() => setDropResult(null), 3000);
                }}
                onDetach={async (productIds) => {
                  // Отвязываем все оси цепочки от выбранных товаров
                  for (const axisValueId of chainFilters) {
                    // Получаем axis_id для каждого value_id
                  }
                  // Проще — отвязать все параметры из цепочки у этих товаров
                  const { ok, data } = await catalogApi.detachChain(productIds, chainFilters);
                  if (ok && data.success) {
                    setDropResult({ ok: true, message: `✓ Отвязано ${productIds.length} изделий` });
                    handleChainSelection(chainFilters);
                  }
                  setTimeout(() => setDropResult(null), 3000);
                }}
              />
            )}
            <div className="w-64 shrink-0" style={{ height: 600 }}>
              <ProductBindingPanel
                productTypeId={selectedTypeId}
                filterValueIds={[]}
                readOnly={!canEditBindings}
                pendingAssignments={pendingAssignments}
                onDragStart={(ids) => console.log('drag:', ids)}
                onSelectionChange={(ids) => console.log('selected:', ids)}
              />
            </div>
          </div>
        </>
      )}

    </div>
  );
};

export default FilterTreeGraph;