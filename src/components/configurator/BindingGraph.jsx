import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { catalogApi } from '../../api/catalog';


/**
 * Граф редактора привязок.
 * 
 * Показывает только узлы отфильтрованные тегами (value_ids).
 * Каждый узел-значение — drop-зона для товаров из ProductBindingPanel.
 * 
 * При drop вызывает onDrop(productIds, valueId).
 */
const BindingGraph = forwardRef(function BindingGraph({ productTypeId, selectedTagIds, onDrop, onDropBulk, onConnect,
    onDisconnect, onSelectionChange, onBulkConnect, mode = 'attach', readOnly = false, dragMissingAxes = [], }, ref) {

    const dragMissingAxesRef = useRef([]);
    const cyRef = useRef(null);
    const cyInstanceRef = useRef(null);
    const selectedChainRef = useRef([]);
    const selectedNodesRef = useRef([]);
    const isPartialDragRef = useRef(false);

    const modeRef = useRef(mode);
    const bulkSourceRef = useRef(null);      // узел-источник
    const bulkTargetsRef = useRef([]);       // целевые узлы
    const onBulkConnectRef = useRef(onBulkConnect);

    useEffect(() => { onBulkConnectRef.current = onBulkConnect; }, [onBulkConnect]);
    useEffect(() => { modeRef.current = mode; }, [mode]);
    useEffect(() => {
        dragMissingAxesRef.current = dragMissingAxes;
    }, [dragMissingAxes]);

    useEffect(() => {
        if (!productTypeId || selectedTagIds.length === 0) {
            if (cyInstanceRef.current) {
                cyInstanceRef.current.destroy();
                cyInstanceRef.current = null;
            }
            return;
        }
        const load = async () => {
            const { ok, data } = await catalogApi.filteredConfiguration(productTypeId, selectedTagIds, false, true, false);
            if (!ok || !data.success || !data.data.nodes.length) return;
            initCytoscape(data.data.nodes, data.data.edges, data.data.reference_axes || []);
        };

        load();
    }, [productTypeId, selectedTagIds]);

    useEffect(() => {
        const cy = cyInstanceRef.current;
        if (!cy) return;

        if (mode === 'connect') {
            // В режиме connect отключаем HTML5 drag на контейнере
            if (cyRef.current) cyRef.current.draggable = false;
        } else {
            if (cyRef.current) cyRef.current.draggable = false; // HTML5 DnD управляется извне
        }
    }, [mode]);

    const initCytoscape = (nodes, edges, referenceAxes = []) => {

        if (!cyRef.current) return;

        if (cyInstanceRef.current) {
            cyInstanceRef.current.destroy();
            cyInstanceRef.current = null;
        }
        let connectSource = null;

        // Позиции — колонки по order, строки по индексу внутри оси
        const byOrder = {};
        nodes.filter(n => n.data.type === 'value').forEach(n => {
            const o = n.data.order;
            if (!byOrder[o]) byOrder[o] = [];
            byOrder[o].push(n.data.id);
        });

        const COL_W = 200, ROW_H = 50;
        const positions = {};
        Object.entries(byOrder).forEach(([order, ids]) => {
            ids.forEach((id, i) => {
                positions[id] = { x: parseInt(order) * COL_W + 100, y: i * ROW_H + 60 };
            });
        });
        nodes.filter(n => n.data.type === 'axis').forEach(n => {
            positions[n.data.id] = { x: n.data.order * COL_W + 100, y: -20 };
        });

        referenceAxes.forEach(refAxis => {
            const refOrder = refAxis.order;
            const axisNodeId = `axis-${refAxis.axis_id}`;

            // Заголовок reference-оси
            nodes = [...nodes, {
                data: {
                    id: axisNodeId,
                    label: refAxis.axis_name,
                    type: 'axis',
                    order: refOrder,
                    is_reference: true,
                }
            }];
            positions[axisNodeId] = { x: refOrder * COL_W + 100, y: -20 };

            // Значения — под каждым parent_value
            refAxis.parent_value_ids.forEach(parentValueId => {
                const parentPos = positions[`value-${parentValueId}`];
                if (!parentPos) return;

                refAxis.values.forEach((val, i) => {
                    const nodeId = `value-${val.id}`;
                    nodes = [...nodes, {
                        data: {
                            id: nodeId,
                            label: val.label,
                            type: 'value',
                            axis_id: refAxis.axis_id,
                            order: refOrder,
                            is_reference: true,
                        }
                    }];
                    positions[nodeId] = {
                        x: refOrder * COL_W + 100,
                        y: parentPos.y + i * ROW_H,
                    };
                    // Пунктирное ребро parent → reference
                    edges = [...edges, {
                        data: {
                            id: `ref-edge-${parentValueId}-${val.id}`,
                            source: `value-${parentValueId}`,
                            target: nodeId,
                            is_reference: true,
                        }
                    }];
                });
            });
        });

        const maxNodes = Math.max(...Object.values(byOrder).map(ids => ids.length));
        const height = Math.max(400, maxNodes * ROW_H + 150);
        if (cyRef.current) cyRef.current.style.height = `${height}px`;

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
                        label: 'data(label)',
                        'background-color': '#1e40af',
                        color: '#ffffff',
                        'font-size': 9,
                        'font-weight': 'bold',
                        width: 130, height: 28,
                        shape: 'roundrectangle',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'text-wrap': 'wrap',
                        'text-max-width': 120,
                        events: 'no',
                    },
                },
                {
                    selector: 'node.bulk-target',
                    style: {
                        'background-color': '#818cf8',
                        'border-color': '#4f46e5',
                        'border-width': 2,
                        color: '#fff',
                    },
                },
                {
                    selector: 'node[type="value"]',
                    style: {
                        label: 'data(label)',
                        'background-color': '#f1f5f9',
                        'border-color': '#cbd5e1',
                        'border-width': 1,
                        color: '#334155',
                        'font-size': 12,
                        width: 130, height: 34,
                        shape: 'roundrectangle',
                        'text-valign': 'center',
                        'text-halign': 'center',
                    },
                },
                {
                    // Подсветка drop-зоны при драге над узлом
                    selector: 'node.drop-target',
                    style: {
                        'background-color': '#bbf7d0',
                        'border-color': '#16a34a',
                        'border-width': 3,
                        color: '#14532d',
                    },
                },
                {
                    selector: 'node.drop-success',
                    style: {
                        'background-color': '#86efac',
                        'border-color': '#16a34a',
                        'border-width': 2,
                        color: '#14532d',
                    },
                },
                {
                    selector: 'edge',
                    style: {
                        width: 2,
                        'line-color': '#94a3b8',
                        'curve-style': 'taxi',
                        'taxi-direction': 'rightward',
                        'source-endpoint': '90deg',
                        'target-endpoint': '270deg',
                    },
                },
                {
                    selector: 'node.connect-source',
                    style: {
                        'background-color': '#f59e0b',
                        'border-color': '#d97706',
                        'border-width': 3,
                        color: '#fff',
                    },
                },
                {
                    selector: 'node.chain-selected',
                    style: {
                        'background-color': '#3b82f6',
                        'border-color': '#1d4ed8',
                        'border-width': 2,
                        color: '#ffffff',
                    },
                },
                {
                    selector: 'node.chain-dimmed',
                    style: {
                        opacity: 0.35,
                    },
                },
                {
                    selector: 'node[?is_reference][type="value"]',
                    style: {
                        'background-color': '#fef3c7',
                        'border-color': '#f59e0b',
                        'border-width': 1,
                        'border-style': 'dashed',
                        color: '#92400e',
                        'font-size': 11,
                        width: 130, height: 34,
                        shape: 'roundrectangle',
                        'text-valign': 'center',
                        'text-halign': 'center',
                    },
                },
                {
                    selector: 'node[?is_reference][type="axis"]',
                    style: {
                        'background-color': '#92400e',
                        color: '#fff',
                        'font-size': 9,
                        'font-weight': 'bold',
                        width: 130,
                        height: 28,
                        shape: 'roundrectangle',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'text-wrap': 'wrap',
                        'text-max-width': 120,
                        events: 'no',
                    },
                },
                {
                    selector: 'edge[?is_reference]',
                    style: {
                        'line-style': 'dashed',
                        'line-color': '#f59e0b',
                        width: 1,
                        opacity: 0.6,
                        'curve-style': 'taxi',
                        'taxi-direction': 'rightward',
                        'source-endpoint': '90deg',
                        'target-endpoint': '270deg',
                    },
                },
            ],
            userZoomingEnabled: true,
            userPanningEnabled: true,
            boxSelectionEnabled: false,
            selectionType: 'none',
        });

        setTimeout(() => {
            cy.resize();
            cy.fit(undefined, 40);
        }, 100);

        cy.on('tap', 'node[type="value"]', (e) => {
            const node = e.target;
            const nodeId = node.id().replace('value-', '');

            // ── Режим connect ──────────────────────────────────────────
            if (modeRef.current === 'connect' && !readOnly) {
                if (e.originalEvent?.shiftKey) {
                    if (!bulkSourceRef.current) return;
                    const alreadyIdx = bulkTargetsRef.current.indexOf(nodeId);
                    if (alreadyIdx !== -1) {
                        bulkTargetsRef.current.splice(alreadyIdx, 1);
                        node.removeClass('bulk-target');
                    } else {
                        bulkTargetsRef.current.push(nodeId);
                        node.addClass('bulk-target');
                    }
                    return;
                }
                if (bulkSourceRef.current) {
                    bulkSourceRef.current.removeClass('connect-source');
                    cy.nodes('.bulk-target').removeClass('bulk-target');
                    bulkTargetsRef.current = [];
                }
                bulkSourceRef.current = node;
                node.addClass('connect-source');
                return;
            }

            // ── Режим attach — выделение цепочек ──────────────────────
            if (modeRef.current === 'attach') {
                const clickedAxisId = node.data('axis_id');

                // Снять если уже выделен
                const selectedIndex = selectedNodesRef.current.indexOf(nodeId);
                if (selectedIndex !== -1) {
                    selectedNodesRef.current.splice(selectedIndex, 1);
                    if (selectedNodesRef.current.length === 0) {
                        cy.nodes().removeClass('chain-selected chain-dimmed');
                        selectedChainRef.current = [];
                        onSelectionChange?.([]);
                        return;
                    }
                    highlightIntersection(cy, selectedNodesRef.current);
                    return;
                }

                // Если на этой оси уже есть выделенный узел — заменяем его
                const sameAxisIndex = selectedNodesRef.current.findIndex(id => {
                    const n = cy.getElementById(`value-${id}`);
                    return n.data('axis_id') === clickedAxisId;
                });

                if (e.originalEvent?.ctrlKey || e.originalEvent?.metaKey) {
                    // Ctrl+клик — мультивыбор на одной оси, просто добавляем
                    selectedNodesRef.current = [...selectedNodesRef.current, nodeId];
                } else if (sameAxisIndex !== -1) {
                    // Обычный клик на той же оси — заменяем
                    selectedNodesRef.current.splice(sameAxisIndex, 1, nodeId);
                } else {
                    // Новая ось — добавляем
                    selectedNodesRef.current = [...selectedNodesRef.current, nodeId];
                }

                highlightIntersection(cy, selectedNodesRef.current);
            }
        });

        cy.on('mousedown', 'node[type="value"]', (e) => {
            if (modeRef.current !== 'connect' || readOnly) return;

            // Shift+клик — добавляем в bulk targets
            if (e.originalEvent?.shiftKey) return; // обрабатываем в tap

            connectSource = e.target;
            connectSource.addClass('connect-source');
            cy.userPanningEnabled(false);
        });

        cy.on('mouseover', 'edge', (e) => {
            if (modeRef.current !== 'connect' || readOnly) return;
            e.target.style({
                'line-color': '#ef4444',
                'width': 3,
            });
        });

        cy.on('mouseout', 'edge', (e) => {
            if (modeRef.current !== 'connect' || readOnly) return;
            e.target.style({
                'line-color': '#94a3b8',
                'width': 2,
            });
        });

        cy.on('mouseup', 'node[type="value"]', (e) => {
            if (modeRef.current !== 'connect' || readOnly || !connectSource) return;
            const target = e.target;

            // Если это был drag (не просто клик) — одиночный connect
            if (target.id() !== connectSource.id() && !e.originalEvent?.shiftKey) {
                const fromId = connectSource.id().replace('value-', '');
                const toId = target.id().replace('value-', '');

                onConnect?.(fromId, toId, () => {
                    const edgeId = `conn-new-${fromId}-${toId}`;
                    if (!cy.getElementById(edgeId).length) {
                        cy.add({ data: { id: edgeId, source: `value-${fromId}`, target: `value-${toId}` } });
                    }
                });
            }

            connectSource.removeClass('connect-source');
            connectSource = null;
            cy.userPanningEnabled(true);
        });

        cy.on('mouseup', (e) => {
            if (e.target === cy && connectSource) {
                connectSource.removeClass('connect-source');
                connectSource = null;
                cy.userPanningEnabled(true);
            }
        });

        cy.on('tap', 'node[type="value"]', (e) => {
            if (modeRef.current !== 'connect' || readOnly) return;

            const node = e.target;
            const nodeId = node.id().replace('value-', '');

            if (e.originalEvent?.shiftKey) {
                // Shift+клик — bulk режим
                if (!bulkSourceRef.current) {
                    // Источник ещё не выбран — первый клик без Shift должен быть источником
                    return;
                }

                const alreadyIdx = bulkTargetsRef.current.indexOf(nodeId);
                if (alreadyIdx !== -1) {
                    // Снимаем выделение
                    bulkTargetsRef.current.splice(alreadyIdx, 1);
                    node.removeClass('bulk-target');
                } else {
                    bulkTargetsRef.current.push(nodeId);
                    node.addClass('bulk-target');
                }
                return;
            }

            // Обычный клик — выбираем источник
            // Если уже был источник — сбрасываем bulk
            if (bulkSourceRef.current) {
                bulkSourceRef.current.removeClass('connect-source');
                cy.nodes('.bulk-target').removeClass('bulk-target');
                bulkTargetsRef.current = [];
            }

            bulkSourceRef.current = node;
            node.addClass('connect-source');
        });

        cy.on('tap', 'edge', (e) => {
            if (modeRef.current !== 'connect' || readOnly) return;
            const edge = e.target;
            const fromId = edge.data('source').replace('value-', '');
            const toId = edge.data('target').replace('value-', '');

            onDisconnect?.(fromId, toId, () => {
                edge.remove();
            });
        });

        const getReachableNodes = (cy, startNode) => {
            const visited = new Set();
            const result = cy.collection();

            const traverse = (node, direction) => {
                const id = node.id();
                if (visited.has(id)) return;
                visited.add(id);
                result.merge(node);

                if (direction !== 'backward') {
                    node.outgoers('[type="value"]').forEach(n => traverse(n, 'forward'));
                }
                if (direction !== 'forward') {
                    node.incomers('[type="value"]').forEach(n => traverse(n, 'backward'));
                }
            };

            traverse(startNode, null);
            return result;
        };

        const highlightIntersection = (cy, selectedNodeIds) => {
            if (selectedNodeIds.length === 0) {
                cy.nodes().removeClass('chain-selected chain-dimmed');
                selectedChainRef.current = [];
                onSelectionChange?.([]);
                return;
            }

            // Группируем выбранные узлы по оси
            const byAxis = {};
            selectedNodeIds.forEach(id => {
                const node = cy.getElementById(`value-${id}`);
                const axisId = node.data('axis_id');
                if (!byAxis[axisId]) byAxis[axisId] = [];
                byAxis[axisId].push(id);
            });

            // Для каждой оси — объединение цепочек её узлов
            const chainPerAxis = Object.values(byAxis).map(ids => {
                // Объединяем цепочки всех узлов одной оси
                let union = cy.collection();
                ids.forEach(id => {
                    const node = cy.getElementById(`value-${id}`);
                    if (node.length) union = union.union(getReachableNodes(cy, node));
                });
                return union;
            });

            // Между осями — пересечение
            let intersection = chainPerAxis[0];
            for (let i = 1; i < chainPerAxis.length; i++) {
                intersection = intersection.filter(node => chainPerAxis[i].has(node));
            }

            // Добавляем сами выбранные узлы (они могут не быть в пересечении)
            selectedNodeIds.forEach(id => {
                const node = cy.getElementById(`value-${id}`);
                if (node.length) intersection = intersection.union(node);
            });

            cy.nodes('[type="value"]').removeClass('chain-selected chain-dimmed');
            intersection.addClass('chain-selected');
            cy.nodes('[type="value"]').not(intersection).addClass('chain-dimmed');

            selectedChainRef.current = intersection
                .filter(n => n.data('type') === 'value')
                .map(n => n.id().replace('value-', ''));

            // ← передаём только non-reference узлы в поиск
            const classifierChain = intersection
                .filter(n => n.data('type') === 'value' && !n.data('is_reference'))
                .map(n => n.id().replace('value-', ''));

            onSelectionChange?.(classifierChain);
        };

        // Клик на пустое место — сброс
        cy.on('tap', (e) => {
            if (e.target !== cy) return;
            // attach
            cy.nodes().removeClass('chain-selected chain-dimmed');
            selectedNodesRef.current = [];
            selectedChainRef.current = [];
            onSelectionChange?.([]);
            // connect
            if (bulkSourceRef.current) {
                bulkSourceRef.current.removeClass('connect-source');
                cy.nodes('.bulk-target').removeClass('bulk-target');
                bulkSourceRef.current = null;
                bulkTargetsRef.current = [];
            }
        });

        cy.nodes().ungrabify();
        cyInstanceRef.current = cy;
    };

    // ── Drag & Drop через HTML5 DnD API ───────────────────────────────────

    const handleDragOver = (e) => {
        if (modeRef.current === 'connect') return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';

        const cy = cyInstanceRef.current;
        if (!cy) return;

        const missingAxes = dragMissingAxesRef.current;
        isPartialDragRef.current = missingAxes.length > 0;

        const rect = cyRef.current.getBoundingClientRect();
        cy.nodes('[type="value"]').removeClass('drop-target');

        // Если drag из partial — подсвечиваем только узлы отсутствующих осей
        const candidateNodes = missingAxes.length > 0
            ? cy.nodes('[type="value"]').filter(node => {
                const axisNode = cy.getElementById(`axis-${node.data('axis_id')}`);
                return missingAxes.includes(axisNode.data('label'));
            })
            : cy.nodes('[type="value"]');

        const hoveredNode = candidateNodes.filter(node => {
            const nodePos = node.renderedPosition();
            const w = node.renderedWidth() / 2;
            const h = node.renderedHeight() / 2;
            return (
                e.clientX - rect.left >= nodePos.x - w &&
                e.clientX - rect.left <= nodePos.x + w &&
                e.clientY - rect.top >= nodePos.y - h &&
                e.clientY - rect.top <= nodePos.y + h
            );
        });

        if (hoveredNode.length) {
            hoveredNode.addClass('drop-target');
        }
    };

    const handleDragLeave = () => {
        if (readOnly) return;
        cyInstanceRef.current?.nodes().removeClass('drop-target');
    };

    const handleDrop = (e) => {
        if (modeRef.current === 'connect') return;
        e.preventDefault();
        const cy = cyInstanceRef.current;
        if (!cy) return;

        const targetNode = cy.nodes('[type="value"].drop-target').first();
        cy.nodes().removeClass('drop-target');

        if (!targetNode.length) return;

        let productIds = [];
        try {
            productIds = JSON.parse(e.dataTransfer.getData('productIds'));
        } catch { return; }
        if (!productIds.length) return;

        const valueId = targetNode.id().replace('value-', '');
        const isReference = targetNode.data('is_reference');  // ← проверяем reference

        // Partial drag — только одна ось
        if (isPartialDragRef.current) {
            isPartialDragRef.current = false;
            onDrop?.(productIds, valueId, targetNode.data('label'));
            return;
        }

        const chain = selectedChainRef.current;

        targetNode.addClass('drop-success');
        setTimeout(() => targetNode.removeClass('drop-success'), 1500);

        // Reference-узел — всегда только к одному узлу
        if (isReference || chain.length <= 1) {
            onDrop?.(productIds, valueId, targetNode.data('label'));
        } else {
            onDropBulk?.(productIds, chain);
        }
    };

    return (
        <div style={{ position: 'relative' }}>
            <div
                ref={cyRef}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg
                           bg-white dark:bg-neutral-900"
                style={{ minHeight: 400 }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            />
            {/* Bulk connect панель */}
            <BulkConnectPanel
                bulkSourceRef={bulkSourceRef}
                bulkTargetsRef={bulkTargetsRef}
                cyInstanceRef={cyInstanceRef}
                onBulkConnect={onBulkConnect}
            />
        </div>
    );
});

export default BindingGraph;

function BulkConnectPanel({ bulkSourceRef, bulkTargetsRef, cyInstanceRef, onBulkConnect }) {
    const [count, setCount] = useState(0);
    const [sourceLabel, setSourceLabel] = useState('');

    // Опрашиваем refs каждые 300ms — простое решение без усложнения архитектуры
    useEffect(() => {
        const interval = setInterval(() => {
            setCount(bulkTargetsRef.current.length);
            setSourceLabel(bulkSourceRef.current?.data('label') || '');
        }, 300);
        return () => clearInterval(interval);
    }, []);

    if (!sourceLabel) return null;

    const handleConnect = () => {
        const sourceId = bulkSourceRef.current?.id().replace('value-', '');
        const targetIds = [...bulkTargetsRef.current];
        if (!sourceId || !targetIds.length) return;

        onBulkConnect?.(sourceId, targetIds, () => {
            // Добавляем рёбра в граф
            const cy = cyInstanceRef.current;
            targetIds.forEach(tid => {
                const edgeId = `conn-bulk-${sourceId}-${tid}`;
                if (!cy.getElementById(edgeId).length) {
                    cy.add({ data: { id: edgeId, source: `value-${sourceId}`, target: `value-${tid}` } });
                }
            });
            // Сброс
            bulkSourceRef.current?.removeClass('connect-source');
            cy.nodes('.bulk-target').removeClass('bulk-target');
            bulkSourceRef.current = null;
            bulkTargetsRef.current = [];
        });
    };

    const handleReset = () => {
        bulkSourceRef.current?.removeClass('connect-source');
        cyInstanceRef.current?.nodes('.bulk-target').removeClass('bulk-target');
        bulkSourceRef.current = null;
        bulkTargetsRef.current = [];
    };

    return (
        <div className="absolute top-2 right-2 bg-white dark:bg-neutral-800 border
                        border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2
                        shadow-md flex items-center gap-3 text-sm">
            <span className="text-gray-600 dark:text-gray-300">
                Источник: <strong>{sourceLabel}</strong>
            </span>
            {count > 0 && (
                <span className="text-indigo-600 font-medium">
                    + {count} узлов
                </span>
            )}
            <span className="text-xs text-gray-400">Shift+клик для выбора целей</span>
            {count > 0 && (
                <button
                    onClick={handleConnect}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs
                               px-3 py-1.5 rounded-lg transition-colors"
                >
                    Связать {count}
                </button>
            )}
            <button
                onClick={handleReset}
                className="text-gray-400 hover:text-red-500 text-xs px-2 py-1 rounded"
            >
                ✕
            </button>
        </div>
    );
}