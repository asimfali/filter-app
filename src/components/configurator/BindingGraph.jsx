import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
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
const BindingGraph = forwardRef(function BindingGraph({ productTypeId, selectedTagIds, onDrop, onConnect, onDisconnect, mode = 'attach' }, ref) {
    const cyRef = useRef(null);
    const cyInstanceRef = useRef(null);

    const modeRef = useRef(mode);
    useEffect(() => { modeRef.current = mode; }, [mode]);

    useEffect(() => {
        if (!productTypeId || selectedTagIds.length === 0) {
            if (cyInstanceRef.current) {
                cyInstanceRef.current.destroy();
                cyInstanceRef.current = null;
            }
            return;
        }
        const load = async () => {
            const { ok, data } = await catalogApi.filteredConfiguration(productTypeId, selectedTagIds);
            if (!ok || !data.success || !data.data.nodes.length) return;
            initCytoscape(data.data.nodes, data.data.edges);
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

    const initCytoscape = (nodes, edges) => {
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
                        'font-size': 11,
                        'font-weight': 'bold',
                        width: 130, height: 28,
                        shape: 'roundrectangle',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        events: 'no',
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
            ],
            userZoomingEnabled: true,
            userPanningEnabled: true,
            boxSelectionEnabled: false,
            selectionType: 'single',
        });

        setTimeout(() => {
            cy.resize();
            cy.fit(undefined, 40);
        }, 100);

        cy.on('tap', 'edge', (e) => {
            if (modeRef.current !== 'connect') return;
            const edge = e.target;
            const sourceId = edge.data('source').replace('value-', '');
            const targetId = edge.data('target').replace('value-', '');
        
            onDisconnect?.(sourceId, targetId, () => {
                cy.remove(edge);
            });
        });

        cy.on('mousedown', 'node[type="value"]', (e) => {
            if (modeRef.current !== 'connect') return;
            connectSource = e.target;
            connectSource.addClass('connect-source');
            cy.userPanningEnabled(false); // отключаем панорамирование пока тащим
        });

        cy.on('mouseover', 'edge', (e) => {
            if (modeRef.current !== 'connect') return;
            e.target.style({
                'line-color': '#ef4444',
                'width': 3,
            });
        });
        
        cy.on('mouseout', 'edge', (e) => {
            if (modeRef.current !== 'connect') return;
            e.target.style({
                'line-color': '#94a3b8',
                'width': 2,
            });
        });

        cy.on('mouseup', 'node[type="value"]', (e) => {
            if (modeRef.current !== 'connect' || !connectSource) return;
            const target = e.target;
        
            if (target.id() !== connectSource.id()) {
                const fromId = connectSource.id().replace('value-', '');
                const toId = target.id().replace('value-', '');
        
                // Передаём колбэк который добавит ребро в граф при успехе
                onConnect?.(fromId, toId, () => {
                    // Добавляем ребро сразу в граф без перезагрузки
                    const edgeId = `conn-new-${fromId}-${toId}`;
                    if (!cy.getElementById(edgeId).length) {
                        cy.add({
                            data: {
                                id: edgeId,
                                source: `value-${fromId}`,
                                target: `value-${toId}`,
                            }
                        });
                    }
                });
            }
        
            connectSource.removeClass('connect-source');
            connectSource = null;
            cy.userPanningEnabled(true);
        });

        cy.on('mouseup', (e) => {
            // Если отпустили не на узле — сбрасываем
            if (e.target === cy && connectSource) {
                connectSource.removeClass('connect-source');
                connectSource = null;
                cy.userPanningEnabled(true);
            }
        });

        cy.nodes().ungrabify();
        cyInstanceRef.current = cy;
    };

    // ── Drag & Drop через HTML5 DnD API ───────────────────────────────────

    const handleDragOver = (e) => {
        if (modeRef.current === 'connect') return; // ← добавь
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';

        // Подсвечиваем узел под курсором
        const cy = cyInstanceRef.current;
        if (!cy) return;

        const rect = cyRef.current.getBoundingClientRect();
        const pos = cy.renderer().projectIntoViewport(
            e.clientX - rect.left,
            e.clientY - rect.top,
        );

        cy.nodes('[type="value"]').removeClass('drop-target');
        const hoveredNode = cy.nodes('[type="value"]').filter(node => {
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
        cyInstanceRef.current?.nodes().removeClass('drop-target');
    };

    const handleDrop = (e) => {
        if (modeRef.current === 'connect') return;
        e.preventDefault();
        const cy = cyInstanceRef.current;
        if (!cy) return;

        // Находим узел под курсором
        const rect = cyRef.current.getBoundingClientRect();
        const targetNode = cy.nodes('[type="value"].drop-target').first();
        cy.nodes().removeClass('drop-target');

        if (!targetNode.length) return;

        // Получаем productIds из dataTransfer
        let productIds = [];
        try {
            productIds = JSON.parse(e.dataTransfer.getData('productIds'));
        } catch {
            return;
        }

        if (!productIds.length) return;

        const valueId = targetNode.id().replace('value-', '');

        // Анимация успеха
        targetNode.addClass('drop-success');
        setTimeout(() => targetNode.removeClass('drop-success'), 1500);

        onDrop?.(productIds, valueId, targetNode.data('label'));
    };

    return (
        <div
            ref={cyRef}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg
                       bg-white dark:bg-gray-900"
            style={{ minHeight: 400 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        />
    );
});

export default BindingGraph;