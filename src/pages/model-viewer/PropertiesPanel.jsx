// ── Панель свойств ────────────────────────────────────────────────────────────

export default function PropertiesPanel({ node, objMap, onOpacityChange, onColorChange, onClose }) {
    if (!node) return (
        <div className="p-4 text-xs text-gray-400 dark:text-gray-500 text-center">
            Выберите объект
        </div>
    );

    const obj = objMap[node.uuid];
    // Деталь может быть Group из нескольких Mesh — свойства берём по первому Mesh, полигоны суммируем
    let firstMesh = null;
    let polygons = 0;
    obj?.traverse(c => {
        if (!c.isMesh) return;
        firstMesh = firstMesh || c;
        const g = c.geometry;
        polygons += g ? (g.index ? g.index.count : g.attributes.position?.count || 0) / 3 : 0;
    });
    const isMesh = !!firstMesh;
    const material = isMesh
        ? (Array.isArray(firstMesh.material) ? firstMesh.material[0] : firstMesh.material)
        : null;

    const opacity = material?.opacity ?? 1;
    const color = material?.color
        ? `#${material.color.getHexString()}`
        : '#888888';

    return (
        <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
                    {node.name}
                </span>
                <button onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
            </div>

            <div className="text-xs text-gray-400 space-y-1">
                <div>Тип: <span className="text-gray-600 dark:text-gray-300">{node.type}</span></div>
                {isMesh && (
                    <div>Полигонов: <span className="text-gray-600 dark:text-gray-300">
                        {polygons.toLocaleString()}
                    </span></div>
                )}
            </div>

            {isMesh && material && (
                <>
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                            Прозрачность
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="range" min="0.02" max="1" step="0.02"
                                value={opacity}
                                onChange={e => onOpacityChange(node.uuid, parseFloat(e.target.value))}
                                className="flex-1 h-1 accent-blue-600"
                            />
                            <span className="text-xs text-gray-400 w-8 text-right">
                                {Math.round(opacity * 100)}%
                            </span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                            Цвет
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={color}
                                onChange={e => onColorChange(node.uuid, e.target.value)}
                                className="w-8 h-8 rounded cursor-pointer border
                                           border-gray-300 dark:border-gray-600"
                            />
                            <span className="text-xs text-gray-400">{color}</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
