import { useState, useEffect, useRef, useCallback } from 'react';
import { IconEye, IconEyeOff } from '../../components/common/Icons';

// ── Узел дерева ───────────────────────────────────────────────────────────────

export default function TreeNode({ node, depth, selectedUuid, onSelect, onContextMenu, onHover, objMap }) {
    const [expanded, setExpanded] = useState(depth < 2);
    const [tooltip, setTooltip] = useState(null);
    const hasChildren = node.children.length > 0;
    const isSelected = selectedUuid === node.uuid;
    const obj = objMap[node.uuid];
    const visible = obj?.visible ?? node.visible;
    const nodeRef = useRef(null);

    const containsSelected = useCallback((n, uuid) => {
        if (n.uuid === uuid) return true;
        return n.children.some(child => containsSelected(child, uuid));
    }, []);

    // Раскрываем если выбранный узел внутри
    useEffect(() => {
        if (selectedUuid && !isSelected && containsSelected(node, selectedUuid)) {
            setExpanded(true);
        }
    }, [selectedUuid]);

    // Скролл к выбранному
    useEffect(() => {
        if (isSelected && nodeRef.current) {
            nodeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [isSelected]);

    return (
        <div>
            <div
                ref={nodeRef}
                className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer
                            group transition-colors text-xs
                            ${isSelected
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300'
                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300'
                    }
                            ${!visible ? 'opacity-40' : ''}`}
                style={{ paddingLeft: `${depth * 14 + 8}px` }}
                onClick={() => onSelect(node)}
                onMouseEnter={() => onHover?.(node.uuid, true)}
                onMouseLeave={() => onHover?.(node.uuid, false)}
                onContextMenu={e => {
                    e.preventDefault();
                    onContextMenu(e, node);
                }}
            >
                <span
                    className="w-3 h-3 shrink-0 flex items-center justify-center text-gray-400"
                    onClick={e => { e.stopPropagation(); setExpanded(o => !o); }}
                >
                    {hasChildren ? (expanded ? '▾' : '▸') : '·'}
                </span>

                <span className="shrink-0">
                    {node.isMesh ? '▪' : '▫'}
                </span>

                {/* Имя с быстрым tooltip */}
                <span
                    className="truncate text-xs block"
                    onMouseEnter={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({ x: rect.right + 8, y: rect.top, name: node.name });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                >
                    {node.name}
                </span>

                {/* Tooltip рендерится через portal или просто fixed */}
                {tooltip && (
                    <div
                        className="fixed z-[9999] bg-neutral-900 text-white text-xs
                   px-2 py-1 rounded whitespace-nowrap pointer-events-none shadow-lg
                   border border-gray-700"
                        style={{ left: tooltip.x, top: tooltip.y }}
                    >
                        {tooltip.name}
                    </div>
                )}

                {/* Кнопка глаза — всегда видна если скрыто */}
                <button
                    className={`shrink-0 text-gray-400 hover:text-gray-200 transition-all
                        ${visible
                            ? 'opacity-0 group-hover:opacity-100'
                            : 'opacity-100'
                        }`}
                    onClick={e => {
                        e.stopPropagation();
                        if (obj) obj.visible = !obj.visible;
                        onSelect(node);
                    }}
                    title={visible ? 'Скрыть' : 'Показать'}
                >
                    {visible ? <IconEye className="w-4 h-4" /> : <IconEyeOff className="w-4 h-4" />}
                </button>
            </div>

            {expanded && hasChildren && (
                <div>
                    {node.children.map(child => (
                        <TreeNode
                            key={child.uuid}
                            node={child}
                            depth={depth + 1}
                            selectedUuid={selectedUuid}
                            onSelect={onSelect}
                            onContextMenu={onContextMenu}
                            onHover={onHover}
                            objMap={objMap}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
