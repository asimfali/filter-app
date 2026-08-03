import { useModelViewer } from './useModelViewer';
import ViewCube from './ViewCube';
import ContextMenu from './ContextMenu';
import TreeNode from './TreeNode';
import PropertiesPanel from './PropertiesPanel';

// ── Главная страница ──────────────────────────────────────────────────────────

export default function ModelViewerPage({ relPath, fname, mtlPath, onBack }) {
    const {
        mountRef, cameraRef, dark,
        loading, error, tree,
        selectedNode, setSelectedNode,
        contextMenu, setContextMenu,
        objMap,
        setView, rotateView, showAll,
        handleCanvasClick, handleCanvasMouseDown, handleCanvasContextMenu,
        setVisible, isolate, focusOn, setOpacity, setColor, highlightMesh,
    } = useModelViewer({ relPath, fname, mtlPath });

    return (
        <div className={`flex flex-col ${dark ? 'bg-neutral-950' : 'bg-slate-200'}`} style={{ height: '100dvh', overflow: 'hidden' }}>

            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-2 border-b shrink-0
                ${dark ? 'bg-neutral-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${dark ? 'text-white' : 'text-gray-900'}`}>
                        {fname.replace(/\.[^.]+$/, '')}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={showAll}
                        className={`text-xs px-3 py-1 rounded transition-colors border
                            ${dark
                                ? 'text-gray-400 hover:text-white border-gray-700 hover:border-gray-500'
                                : 'text-gray-600 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                            }`}>
                        Показать все
                    </button>
                    <span className="text-xs text-gray-500 hidden lg:block">
                        ЛКМ — вращение · Колесо — зум · ПКМ — перемещение · 2×ЛКМ — скрыть · 3×ЛКМ — показать · СКМ — центр
                    </span>
                </div>
            </div>

            {/* Основной layout */}
            <div className="flex flex-1 min-h-0">

                {/* Дерево объектов */}
                <div className={`w-56 shrink-0 border-r flex flex-col overflow-hidden
                     ${dark ? 'bg-neutral-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <div className={`px-3 py-2 text-xs font-medium uppercase tracking-wide border-b shrink-0
                         ${dark ? 'text-gray-400 border-gray-700' : 'text-gray-500 border-gray-200'}`}>
                        Структура модели
                    </div>
                    <div className="flex-1 overflow-y-auto py-1">
                        {tree ? (
                            <TreeNode
                                node={tree}
                                depth={0}
                                selectedUuid={selectedNode?.uuid}
                                onSelect={(node) => {
                                    setSelectedNode(node);
                                }}
                                onContextMenu={(e, node) => {
                                    setContextMenu({ x: e.clientX, y: e.clientY, node });
                                }}
                                onHover={highlightMesh}
                                objMap={objMap}
                            />
                        ) : (
                            <div className="text-xs text-gray-500 text-center py-8">
                                {loading ? 'Загрузка...' : 'Нет данных'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Viewport */}
                <div className="relative flex-1 min-w-0">
                    {/* Фиксированная кнопка назад */}
                    <button onClick={onBack}
                        className={`absolute top-3 left-3 z-20 flex items-center gap-1.5
            text-sm px-3 py-1.5 rounded-lg border backdrop-blur-sm transition-colors
            ${dark
                                ? 'bg-neutral-900/80 hover:bg-neutral-800 text-gray-300 hover:text-white border-gray-700'
                                : 'bg-white/80 hover:bg-white text-gray-600 hover:text-gray-900 border-gray-300'
                            }`}>
                        ← Назад
                    </button>

                    <ViewCube
                        onSetView={setView}
                        onRotate={rotateView}
                        cameraRef={cameraRef}
                        dark={dark}
                    />

                    {loading && (
                        <div className={`absolute inset-0 flex items-center justify-center text-sm z-10
             ${dark ? 'bg-neutral-950 text-gray-500' : 'bg-slate-200 text-gray-400'}`}>
                            Загрузка модели...
                        </div>
                    )}
                    {error && (
                        <div className={`absolute inset-0 flex items-center justify-center text-red-500 text-sm z-10
             ${dark ? 'bg-neutral-950' : 'bg-slate-200'}`}>
                            {error}
                        </div>
                    )}
                    <div
                        ref={mountRef}
                        className="w-full h-full"
                        onClick={handleCanvasClick}
                        onMouseDown={handleCanvasMouseDown}
                        onContextMenu={handleCanvasContextMenu}
                    />
                </div>

                {/* Панель свойств */}
                <div className={`w-52 shrink-0 border-l flex flex-col overflow-hidden
                     ${dark ? 'bg-neutral-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <div className={`px-3 py-2 text-xs font-medium uppercase tracking-wide border-b shrink-0
                         ${dark ? 'text-gray-400 border-gray-700' : 'text-gray-500 border-gray-200'}`}>
                        Свойства
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <PropertiesPanel
                            node={selectedNode}
                            objMap={objMap}
                            onOpacityChange={setOpacity}
                            onColorChange={setColor}
                            onClose={() => setSelectedNode(null)}
                        />
                    </div>
                </div>
            </div>

            {/* Контекстное меню */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    node={contextMenu.node}
                    onHide={() => {
                        setVisible(contextMenu.node.uuid, false);
                        setContextMenu(null);
                    }}
                    onShow={() => {
                        setVisible(contextMenu.node.uuid, true);
                        setContextMenu(null);
                    }}
                    onIsolate={() => {
                        isolate(contextMenu.node.uuid);
                        setContextMenu(null);
                    }}
                    onFocus={() => {
                        focusOn(contextMenu.node.uuid);
                        setContextMenu(null);
                    }}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </div>
    );
}
