import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { tokenStorage } from '../api/auth';
export { canPreview3D } from '../utils/fileUtils';

// ── Утилиты ───────────────────────────────────────────────────────────────────

function getExt(fname) {
    return (fname || '').split('.').pop().toLowerCase();
}

function downloadUrl(path) {
    return `/api/v1/media/download/?path=${encodeURIComponent(path)}`;
}

function authFetch(path, opts = {}) {
    return fetch(downloadUrl(path), {
        ...opts,
        headers: { Authorization: `Bearer ${tokenStorage.getAccess()}` },
    });
}

// Построить дерево узлов из Three.js объекта
function buildTree(obj, parentId = null) {
    const isVisible = obj.type === 'Mesh' || obj.type === 'Group'
        || obj.type === 'Object3D' || obj.type === 'Scene';
    if (!isVisible) return null;

    const node = {
        uuid: obj.uuid,
        name: obj.name || `(${obj.type})`,
        type: obj.type,
        isMesh: obj.isMesh || false,
        children: [],
        visible: obj.visible,
        opacity: obj.isMesh
            ? (Array.isArray(obj.material) ? obj.material[0]?.opacity ?? 1 : obj.material?.opacity ?? 1)
            : 1,
        color: obj.isMesh
            ? (Array.isArray(obj.material) ? obj.material[0]?.color?.getHexString() : obj.material?.color?.getHexString())
            : null,
    };

    for (const child of obj.children) {
        const childNode = buildTree(child, obj.uuid);
        if (childNode) node.children.push(childNode);
    }

    // Пропускаем пустые безымянные группы
    if (!obj.isMesh && !obj.name && node.children.length === 0) return null;

    return node;
}

// Собрать все uuid потомков (для скрытия группы)
function collectUuids(node) {
    const result = [node.uuid];
    for (const child of node.children) {
        result.push(...collectUuids(child));
    }
    return result;
}

// ── Контекстное меню ──────────────────────────────────────────────────────────

function ContextMenu({ x, y, node, onHide, onShow, onIsolate, onFocus, onClose }) {
    useEffect(() => {
        const handler = () => onClose();
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    return (
        <div
            className="fixed z-50 bg-white dark:bg-gray-900 border border-gray-200
                       dark:border-gray-700 rounded-lg shadow-xl py-1 min-w-40"
            style={{ left: x, top: y }}
            onMouseDown={e => e.stopPropagation()}
        >
            <div className="px-3 py-1.5 text-xs font-medium text-gray-500
                            dark:text-gray-400 border-b border-gray-100
                            dark:border-gray-800 truncate max-w-48">
                {node.name}
            </div>
            <button onClick={onHide}
                className="w-full text-left px-3 py-2 text-sm text-gray-700
                           dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                👁 Скрыть
            </button>
            <button onClick={onShow}
                className="w-full text-left px-3 py-2 text-sm text-gray-700
                           dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                ✓ Показать
            </button>
            <button onClick={onIsolate}
                className="w-full text-left px-3 py-2 text-sm text-gray-700
                           dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                ◎ Изолировать
            </button>
            <button onClick={onFocus}
                className="w-full text-left px-3 py-2 text-sm text-gray-700
                           dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                ⊙ Фокус
            </button>
        </div>
    );
}

// ── Узел дерева ───────────────────────────────────────────────────────────────

function TreeNode({ node, depth, selectedUuid, onSelect, onContextMenu, onHover, objMap }) {
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
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
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
                        className="fixed z-[9999] bg-gray-900 text-white text-xs
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
                    {visible ? '👁' : '🙈'}
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

// ── Панель свойств ────────────────────────────────────────────────────────────

function PropertiesPanel({ node, objMap, onOpacityChange, onColorChange, onClose }) {
    if (!node) return (
        <div className="p-4 text-xs text-gray-400 dark:text-gray-500 text-center">
            Выберите объект
        </div>
    );

    const obj = objMap[node.uuid];
    const isMesh = obj?.isMesh;
    const material = isMesh
        ? (Array.isArray(obj.material) ? obj.material[0] : obj.material)
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
                {obj?.geometry && (
                    <div>Полигонов: <span className="text-gray-600 dark:text-gray-300">
                        {(obj.geometry.index
                            ? obj.geometry.index.count / 3
                            : obj.geometry.attributes.position?.count / 3 || 0
                        ).toLocaleString()}
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

// ── Главная страница ──────────────────────────────────────────────────────────

export default function ModelViewerPage({ relPath, fname, mtlPath, onBack }) {
    const mountRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const frameRef = useRef(null);
    const sceneRef = useRef(null);
    const raycasterRef = useRef(new THREE.Raycaster());
    const objMapRef = useRef({});  // uuid → THREE.Object3D

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tree, setTree] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [contextMenu, setContextMenu] = useState(null); // {x, y, node}
    const [highlightedUuid, setHighlightedUuid] = useState(null);
    const [, forceUpdate] = useState(0); // для ре-рендера дерева

    const refresh = useCallback(() => forceUpdate(n => n + 1), []);

    // ── Инициализация Three.js ────────────────────────────────────────────────

    useEffect(() => {
        const container = mountRef.current;
        if (!container) return;

        const ext = getExt(fname);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);
        sceneRef.current = scene;

        const w = container.clientWidth;
        const h = container.clientHeight;
        const aspect = w / h;
        const orthoSize = 5;
        const camera = new THREE.OrthographicCamera(
            -orthoSize * aspect,
            orthoSize * aspect,
            orthoSize,
            -orthoSize,
            -100000,
            100000
        );
        camera.position.set(0, 0, 10);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // scene.add(new THREE.AmbientLight(0xffffff, 0.5));
        // const dir1 = new THREE.DirectionalLight(0xffffff, 0.8);
        // dir1.position.set(5, 10, 7);
        // scene.add(dir1);
        // const dir2 = new THREE.DirectionalLight(0xffffff, 0.3);
        // dir2.position.set(-5, -5, -5);
        // scene.add(dir2);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = false;
        controlsRef.current = controls;

        const animate = () => {
            frameRef.current = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        const onResize = () => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            const aspect = w / h;
            const cam = cameraRef.current;  // ← через ref

            const orthoSize = cam.top;
            cam.left = -orthoSize * aspect;
            cam.right = orthoSize * aspect;
            cam.updateProjectionMatrix();

            renderer.setSize(w, h);
        };
        window.addEventListener('resize', onResize);

        controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN,    // ← средняя кнопка = перемещение
            RIGHT: THREE.MOUSE.PAN,     // ← ПКМ тоже перемещение
        };

        // ── Загрузка модели ───────────────────────────────────────────────────

        const prepareObject = (root) => {
            root.traverse(child => {
                if (child.isMesh) {
                    const processMat = (m) => {
                        const color = m.color ? m.color.clone() : new THREE.Color(0x888888);

                        return new THREE.MeshBasicMaterial({
                            color: color,  // ← без осветления
                            transparent: true,
                            opacity: 1.0,
                            side: THREE.DoubleSide,
                        });
                    };

                    if (Array.isArray(child.material)) {
                        child.material = child.material.map(processMat);
                    } else {
                        child.material = processMat(child.material);
                    }

                    objMapRef.current[child.uuid] = child;
                } else {
                    objMapRef.current[child.uuid] = child;
                }
            });
        };

        const buildEdges = (root) => {
            const edgeMaterial = new THREE.LineBasicMaterial({
                color: 0x000000,
                transparent: true,
                opacity: 0.5,
            });

            root.traverse(child => {
                if (!child.isMesh) return;
                try {
                    const edges = new THREE.EdgesGeometry(child.geometry, 15);
                    const line = new THREE.LineSegments(edges, edgeMaterial.clone());
                    child.add(line);  // линии внутри mesh — следуют за ним автоматически
                } catch (e) { /* пропускаем */ }
            });
        };

        const fitCamera = (object) => {
            const box = new THREE.Box3().setFromObject(object);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const aspect = container.clientWidth / container.clientHeight;

            object.position.sub(center);

            // Подбираем размер ortho по bounding box
            camera.near = -maxDim * 10;  // отрицательный near для ortho
            camera.far = maxDim * 10;
            camera.updateProjectionMatrix();

            camera.position.set(maxDim, maxDim * 0.7, maxDim * 1.2);
            controls.target.set(0, 0, 0);
            controls.update();
        };

        const onLoaded = (root) => {
            scene.add(root);
            prepareObject(root);
            buildEdges(root);
            fitCamera(root);
            const treeData = buildTree(root);
            setTree(treeData);
            setLoading(false);
        };

        if (ext === 'glb' || ext === 'gltf') {
            authFetch(relPath)
                .then(r => r.blob())
                .then(blob => {
                    const url = URL.createObjectURL(blob);
                    new GLTFLoader().load(url, gltf => {
                        onLoaded(gltf.scene);
                        URL.revokeObjectURL(url);
                    }, undefined, () => {
                        setError('Ошибка загрузки GLTF/GLB');
                        setLoading(false);
                    });
                });

        } else if (ext === 'stl') {
            authFetch(relPath)
                .then(r => r.arrayBuffer())
                .then(buf => {
                    const geometry = new STLLoader().parse(buf);
                    const material = new THREE.MeshPhongMaterial({
                        color: 0x6b7280, transparent: true, opacity: 1,
                    });
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.name = fname;
                    onLoaded(mesh);
                })
                .catch(() => { setError('Ошибка загрузки STL'); setLoading(false); });

        } else if (ext === 'obj') {
            const fetchText = (p) => authFetch(p).then(r => r.text());
            const loadObj = (objText, mats = null) => {
                const loader = new OBJLoader();
                if (mats) loader.setMaterials(mats);
                else {
                    objText && new THREE.Group(); // noop
                }
                const obj = loader.parse(objText);
                if (!mats) {
                    obj.traverse(c => {
                        if (c.isMesh) c.material = new THREE.MeshPhongMaterial({
                            color: 0x6b7280, transparent: true, opacity: 1,
                        });
                    });
                }
                onLoaded(obj);
            };

            if (mtlPath) {
                Promise.all([fetchText(mtlPath), fetchText(relPath)])
                    .then(([mtl, obj]) => {
                        const mats = new MTLLoader().parse(mtl, '');
                        mats.preload();
                        loadObj(obj, mats);
                    })
                    .catch(() => { setError('Ошибка OBJ+MTL'); setLoading(false); });
            } else {
                fetchText(relPath)
                    .then(text => loadObj(text))
                    .catch(() => { setError('Ошибка OBJ'); setLoading(false); });
            }
        } else {
            setError(`Формат .${ext} не поддерживается`);
            setLoading(false);
        }

        return () => {
            cancelAnimationFrame(frameRef.current);
            window.removeEventListener('resize', onResize);
            controls.dispose();
            renderer.dispose();
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
        };
    }, [relPath, fname, mtlPath]);

    // ── Raycast — клик по модели ──────────────────────────────────────────────

    const clickCountRef = useRef(0);
    const clickTimerRef = useRef(null);

    // ── На уровне компонента (рядом с другими refs) ───────────────────────
    const selectedHighlightRef = useRef(null);

    const highlightSelected = useCallback((uuid) => {
        // Сбросить предыдущую подсветку
        if (selectedHighlightRef.current) {
            const prev = objMapRef.current[selectedHighlightRef.current];
            if (prev) {
                prev.traverse(child => {
                    if (!child.isMesh) return;
                    const orig = originalColorsRef.current[child.uuid];
                    if (orig !== undefined) {
                        const setMat = m => m.color.setHex(orig);
                        if (Array.isArray(child.material)) child.material.forEach(setMat);
                        else setMat(child.material);
                        delete originalColorsRef.current[child.uuid];
                    }
                });
            }
            selectedHighlightRef.current = null;
        }

        if (!uuid) return;

        const obj = objMapRef.current[uuid];
        if (obj) {
            obj.traverse(child => {
                if (!child.isMesh) return;
                const mat = Array.isArray(child.material) ? child.material[0] : child.material;
                if (originalColorsRef.current[child.uuid] === undefined) {
                    originalColorsRef.current[child.uuid] = mat.color.getHex();
                }
                const setMat = m => m.color.setHex(0x4488ff);
                if (Array.isArray(child.material)) child.material.forEach(setMat);
                else setMat(child.material);
            });
            selectedHighlightRef.current = uuid;
        }
    }, []);

    // ── handleCanvasClick — чистый, без хуков внутри ──────────────────────
    const handleCanvasClick = useCallback((e) => {
        if (mouseDownPosRef.current) {
            const dx = e.clientX - mouseDownPosRef.current.x;
            const dy = e.clientY - mouseDownPosRef.current.y;
            if (Math.sqrt(dx * dx + dy * dy) > 5) return;
        }
        clickCountRef.current += 1;

        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = setTimeout(() => {
            const count = clickCountRef.current;
            clickCountRef.current = 0;

            const container = mountRef.current;
            const camera = cameraRef.current;
            const scene = sceneRef.current;
            if (!container || !camera || !scene) return;

            const rect = container.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((e.clientX - rect.left) / rect.width) * 2 - 1,
                -((e.clientY - rect.top) / rect.height) * 2 + 1,
            );
            raycasterRef.current.setFromCamera(mouse, camera);

            if (count === 3) {
                const hiddenMeshes = [];
                scene.traverse(c => {
                    if (c.isMesh && !c.visible) {
                        c.visible = true;
                        hiddenMeshes.push(c);
                    }
                });
                const hits = raycasterRef.current.intersectObjects(hiddenMeshes, false);
                hiddenMeshes.forEach(c => { c.visible = false; });

                if (hits.length > 0) {
                    const farthest = hits[hits.length - 1].object;
                    farthest.visible = true;
                    setSelectedNode({
                        uuid: farthest.uuid,
                        name: farthest.name,
                        type: farthest.type,
                        isMesh: true,
                        children: [],
                    });
                    refresh();
                }

            } else if (count === 2) {
                const visibleMeshes = [];
                scene.traverse(c => {
                    if (c.isMesh && c.visible) visibleMeshes.push(c);
                });
                const hits = raycasterRef.current.intersectObjects(visibleMeshes, false);

                if (hits.length > 0) {
                    hits[0].object.visible = false;
                    highlightSelected(null); // сбросить подсветку скрытой детали
                    refresh();
                }

            } else if (count === 1) {
                const visibleMeshes = [];
                scene.traverse(c => {
                    if (c.isMesh && c.visible) visibleMeshes.push(c);
                });
                const hits = raycasterRef.current.intersectObjects(visibleMeshes, false);

                if (hits.length > 0) {
                    const hit = hits[0].object;
                    setSelectedNode({
                        uuid: hit.uuid,
                        name: hit.name,
                        type: hit.type,
                        isMesh: true,
                        children: [],
                    });
                    setHighlightedUuid(hit.uuid);
                    highlightSelected(hit.uuid);
                } else {
                    // Клик на пустое место — сбросить подсветку
                    highlightSelected(null);
                    setSelectedNode(null);
                }
            }
        }, 250);
    }, [refresh, highlightSelected]);

    const mouseDownPosRef = useRef(null);

    const handleCanvasMouseDown = useCallback((e) => {
        if (e.button === 0) {
            mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
        }
        if (e.button !== 1) return; // только средняя кнопка
        e.preventDefault();

        const container = mountRef.current;
        const camera = cameraRef.current;
        const scene = sceneRef.current;
        const controls = controlsRef.current;
        if (!container || !camera || !scene || !controls) return;

        const rect = container.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );

        raycasterRef.current.setFromCamera(mouse, camera);
        const meshes = [];
        scene.traverse(c => { if (c.isMesh && c.visible) meshes.push(c); });
        const hits = raycasterRef.current.intersectObjects(meshes, false);

        if (hits.length > 0) {
            controls.target.copy(hits[0].point);
            controls.update();
        }
    }, []);


    const handleCanvasContextMenu = useCallback((e) => {
        e.preventDefault();
        const container = mountRef.current;
        const camera = cameraRef.current;
        const scene = sceneRef.current;
        if (!container || !camera || !scene) return;

        const rect = container.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );

        raycasterRef.current.setFromCamera(mouse, camera);
        const meshes = [];
        scene.traverse(c => { if (c.isMesh && c.visible) meshes.push(c); });
        const hits = raycasterRef.current.intersectObjects(meshes, false);

        if (hits.length > 0) {
            const hit = hits[0].object;
            setContextMenu({
                x: e.clientX, y: e.clientY,
                node: { uuid: hit.uuid, name: hit.name, type: hit.type, isMesh: true, children: [] },
            });
        }
    }, []);

    // ── Операции с объектами ──────────────────────────────────────────────────

    const setVisible = useCallback((uuid, visible, recursive = true) => {
        const obj = objMapRef.current[uuid];
        if (!obj) return;
        if (recursive) {
            obj.traverse(c => { c.visible = visible; });
        } else {
            obj.visible = visible;
        }
        refresh();
    }, [refresh]);

    const isolate = useCallback((uuid) => {
        // Скрыть всё кроме выбранного
        const scene = sceneRef.current;
        if (!scene) return;
        scene.traverse(c => {
            if (c.name === '__grid__' || c.type === 'DirectionalLight'
                || c.type === 'AmbientLight') return;
            if (c.isMesh) c.visible = false;
        });
        const obj = objMapRef.current[uuid];
        if (obj) obj.traverse(c => { c.visible = true; });
        refresh();
    }, [refresh]);

    const showAll = useCallback(() => {
        const scene = sceneRef.current;
        if (!scene) return;
        scene.traverse(c => { if (c.isMesh) c.visible = true; });
        refresh();
    }, [refresh]);

    const focusOn = useCallback((uuid) => {
        const obj = objMapRef.current[uuid];
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (!obj || !camera || !controls) return;

        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        const dist = Math.abs(maxDim / Math.sin(fov / 2)) * 1.5;

        controls.target.copy(center);
        camera.position.set(
            center.x + dist * 0.7,
            center.y + dist * 0.5,
            center.z + dist,
        );
        controls.update();
    }, []);

    const setOpacity = useCallback((uuid, value) => {
        const obj = objMapRef.current[uuid];
        if (!obj || !obj.isMesh) return;
        const setMat = m => { m.opacity = value; m.transparent = true; };
        if (Array.isArray(obj.material)) obj.material.forEach(setMat);
        else setMat(obj.material);
        refresh();
    }, [refresh]);

    const setColor = useCallback((uuid, hex) => {
        const obj = objMapRef.current[uuid];
        if (!obj || !obj.isMesh) return;
        const color = new THREE.Color(hex);
        const setMat = m => m.color.set(color);
        if (Array.isArray(obj.material)) obj.material.forEach(setMat);
        else setMat(obj.material);
        refresh();
    }, [refresh]);

    const originalColorsRef = useRef({});

    const highlightMesh = useCallback((uuid, highlight) => {
        const obj = objMapRef.current[uuid];
        if (!obj) return;

        obj.traverse(child => {
            if (!child.isMesh) return;
            if (highlight) {
                const mat = Array.isArray(child.material) ? child.material[0] : child.material;
                originalColorsRef.current[child.uuid] = mat.color.getHex();
                const setMat = m => m.color.setHex(0xff8c00);
                if (Array.isArray(child.material)) child.material.forEach(setMat);
                else setMat(child.material);
            } else {
                const orig = originalColorsRef.current[child.uuid];
                if (orig !== undefined) {
                    const setMat = m => m.color.setHex(orig);
                    if (Array.isArray(child.material)) child.material.forEach(setMat);
                    else setMat(child.material);
                    delete originalColorsRef.current[child.uuid];
                }
            }
        });
    }, []);

    // ── Рендер ────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-screen bg-gray-950">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2
                            bg-gray-900 border-b border-gray-700 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onBack}
                        className="text-sm text-gray-400 hover:text-white transition-colors">
                        ← Назад
                    </button>
                    <span className="text-sm font-medium text-white">{fname}</span>
                    <span className="text-xs text-gray-500 uppercase">{getExt(fname)}</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={showAll}
                        className="text-xs text-gray-400 hover:text-white
                                   border border-gray-700 hover:border-gray-500
                                   px-3 py-1 rounded transition-colors">
                        Показать все
                    </button>
                    <span className="text-xs text-gray-500 hidden lg:block">
                        ЛКМ — вращение · Колесо — зум · ПКМ — перемещение · 2×ЛКМ — скрыть · 3×ЛКМ — показать скрытое · СКМ — центр вращения
                    </span>
                </div>
            </div>

            {/* Основной layout */}
            <div className="flex flex-1 min-h-0">

                {/* Дерево объектов */}
                <div className="w-56 shrink-0 bg-gray-900 border-r border-gray-700
                                flex flex-col overflow-hidden">
                    <div className="px-3 py-2 text-xs font-medium text-gray-400
                                    uppercase tracking-wide border-b border-gray-700 shrink-0">
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
                                    setHighlightedUuid(node.uuid);
                                }}
                                onContextMenu={(e, node) => {
                                    setContextMenu({ x: e.clientX, y: e.clientY, node });
                                }}
                                onHover={highlightMesh}
                                objMap={objMapRef.current}
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
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center
                                        bg-gray-100 text-gray-500 text-sm z-10">
                            Загрузка модели...
                        </div>
                    )}
                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center
                                        bg-gray-100 text-red-500 text-sm z-10">
                            {error}
                        </div>
                    )}
                    <div
                        ref={mountRef}
                        className="w-full h-full"
                        onClick={handleCanvasClick}
                        onMouseDown={handleCanvasMouseDown}  // ← добавить
                        onContextMenu={handleCanvasContextMenu}
                    />
                </div>

                {/* Панель свойств */}
                <div className="w-52 shrink-0 bg-gray-900 border-l border-gray-700
                                flex flex-col overflow-hidden">
                    <div className="px-3 py-2 text-xs font-medium text-gray-400
                                    uppercase tracking-wide border-b border-gray-700 shrink-0">
                        Свойства
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <PropertiesPanel
                            node={selectedNode}
                            objMap={objMapRef.current}
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