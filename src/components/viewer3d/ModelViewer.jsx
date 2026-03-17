import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { tokenStorage } from '../../api/auth';

function getExt(fname) {
    return fname.split('.').pop().toLowerCase();
}

export function canPreview3D(fname) {
    return ['stl', 'gltf', 'glb', 'obj'].includes(getExt(fname));
}

export default function ModelViewer({ relPath, fname, mtlPath, onClose }) {
    const mountRef = useRef(null);
    const rendererRef = useRef(null);
    const frameRef = useRef(null);
    const sceneRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Панель тел
    const [meshList, setMeshList] = useState([]); // [{uuid, name, visible, opacity}]
    const meshMapRef = useRef({});  // uuid → THREE.Mesh

    useEffect(() => {
        const container = mountRef.current;
        if (!container) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf1f5f9);
        sceneRef.current = scene;

        const w = container.clientWidth;
        const h = container.clientHeight;

        const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 10000);
        camera.position.set(0, 0, 5);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        scene.add(new THREE.AmbientLight(0xffffff, 1.2));  // было 0.5

        const dir1 = new THREE.DirectionalLight(0xffffff, 1.5);  // было 0.8
        dir1.position.set(5, 10, 7);
        scene.add(dir1);

        const dir2 = new THREE.DirectionalLight(0xffffff, 0.8);  // было 0.3
        dir2.position.set(-5, -5, -5);
        scene.add(dir2);

        // Добавить третий свет снизу — убирает тёмные низы
        const dir3 = new THREE.DirectionalLight(0xffffff, 0.5);
        dir3.position.set(0, -10, 0);
        scene.add(dir3);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,    // ЛКМ — вращение
            MIDDLE: THREE.MOUSE.DOLLY,   // Колесо — зум
            RIGHT: THREE.MOUSE.PAN,      // ПКМ — перемещение
        };
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
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        window.addEventListener('resize', onResize);

        const headers = { Authorization: `Bearer ${tokenStorage.getAccess()}` };
        const downloadUrl = (path) =>
            `/api/v1/media/download/?path=${encodeURIComponent(path)}`;

        const fitCamera = (object) => {
            const box = new THREE.Box3().setFromObject(object);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            const dist = Math.abs(maxDim / Math.sin(fov / 2)) * 0.8;
            object.position.sub(center);
            camera.position.set(dist * 0.6, dist * 0.4, dist);
            camera.near = dist / 100;
            camera.far = dist * 100;
            camera.updateProjectionMatrix();
            controls.target.set(0, 0, 0);
            controls.update();
        };

        // Собрать список mesh после загрузки
        const collectMeshes = (root) => {
            const list = [];
            const map = {};
            root.traverse(child => {
                if (child.isMesh) {
                    // Клонируем материал чтобы управлять прозрачностью независимо
                    if (Array.isArray(child.material)) {
                        child.material = child.material.map(m => {
                            const c = m.clone();
                            c.transparent = true;
                            return c;
                        });
                    } else {
                        child.material = child.material.clone();
                        child.material.transparent = true;
                    }
                    map[child.uuid] = child;
                    list.push({
                        uuid: child.uuid,
                        name: child.name || `Mesh_${list.length + 1}`,
                        visible: true,
                        opacity: 1.0,
                    });
                }
            });
            meshMapRef.current = map;
            setMeshList(list);
        };

        const ext = getExt(fname);

        if (ext === 'stl') {
            fetch(downloadUrl(relPath), { headers })
                .then(r => r.arrayBuffer())
                .then(buffer => {
                    const geometry = new STLLoader().parse(buffer);
                    const material = new THREE.MeshPhongMaterial({
                        color: 0x6b7280, specular: 0x444444, shininess: 60,
                        transparent: true, opacity: 1.0,
                    });
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.name = fname;
                    scene.add(mesh);
                    collectMeshes(scene);
                    fitCamera(mesh);
                    setLoading(false);
                })
                .catch(() => { setError('Ошибка загрузки STL'); setLoading(false); });

            } else if (ext === 'glb' || ext === 'gltf') {
                console.log('Загружаю:', relPath);
                fetch(downloadUrl(relPath), { headers })
                    .then(r => {
                        console.log('Fetch статус:', r.status, r.ok);
                        return r.blob();
                    })
                    .then(blob => {
                        console.log('Blob размер:', blob.size);
                        const blobUrl = URL.createObjectURL(blob);
                        new GLTFLoader().load(
                            blobUrl,
                            (gltf) => {
                                console.log('GLB загружен:', gltf);
                                const printTree = (obj, indent = 0) => {
                                    console.log(' '.repeat(indent) + obj.type + ': ' + (obj.name || '(unnamed)'));
                                    obj.children.forEach(c => printTree(c, indent + 2));
                                };
                                printTree(gltf.scene);
                                // ...
                            },
                            (progress) => {
                                console.log('Прогресс:', progress.loaded, '/', progress.total);
                            },
                            (error) => {
                                console.error('Ошибка GLTFLoader:', error);
                                setError('Ошибка загрузки GLTF');
                                setLoading(false);
                            }
                        );
                    })
                    .catch(err => {
                        console.error('Ошибка fetch:', err);
                        setLoading(false);
                    });

        } else if (ext === 'obj') {
            const fetchText = (path) =>
                fetch(downloadUrl(path), { headers }).then(r => r.text());

            const loadObj = (objText, materials = null) => {
                const loader = new OBJLoader();
                if (materials) loader.setMaterials(materials);
                const object = loader.parse(objText);
                if (!materials) {
                    object.traverse(child => {
                        if (child.isMesh) {
                            child.material = new THREE.MeshPhongMaterial({
                                color: 0x6b7280, specular: 0x444444, shininess: 60,
                            });
                        }
                    });
                }
                scene.add(object);
                collectMeshes(object);
                fitCamera(object);
                setLoading(false);
            };

            if (mtlPath) {
                Promise.all([fetchText(mtlPath), fetchText(relPath)])
                    .then(([mtlText, objText]) => {
                        const materials = new MTLLoader().parse(mtlText, '');
                        materials.preload();
                        loadObj(objText, materials);
                    })
                    .catch(() => { setError('Ошибка загрузки OBJ+MTL'); setLoading(false); });
            } else {
                fetchText(relPath)
                    .then(text => loadObj(text))
                    .catch(() => { setError('Ошибка загрузки OBJ'); setLoading(false); });
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

    // Переключение видимости
    const toggleVisible = (uuid) => {
        setMeshList(prev => prev.map(m => {
            if (m.uuid !== uuid) return m;
            const next = !m.visible;
            const mesh = meshMapRef.current[uuid];
            if (mesh) mesh.visible = next;
            return { ...m, visible: next };
        }));
    };

    // Изменение прозрачности
    const setOpacity = (uuid, value) => {
        setMeshList(prev => prev.map(m => {
            if (m.uuid !== uuid) return m;
            const mesh = meshMapRef.current[uuid];
            if (mesh) {
                const setMat = (mat) => { mat.opacity = value; };
                if (Array.isArray(mesh.material)) mesh.material.forEach(setMat);
                else setMat(mesh.material);
            }
            return { ...m, opacity: value };
        }));
    };

    const handleCanvasMouseDown = useCallback((e) => {
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
        scene.traverse(c => { if (c.isMesh && c.name !== '__grid__') meshes.push(c); });
        const hits = raycasterRef.current.intersectObjects(meshes, false);
    
        if (hits.length > 0) {
            controls.target.copy(hits[0].point);
            controls.update();
        }
    }, []);

    // Скрыть / показать все
    const toggleAll = (visible) => {
        setMeshList(prev => prev.map(m => {
            const mesh = meshMapRef.current[m.uuid];
            if (mesh) mesh.visible = visible;
            return { ...m, visible };
        }));
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center
                        justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl
                            w-full max-w-6xl flex flex-col"
                style={{ height: '85vh' }}>

                {/* Шапка */}
                <div className="flex items-center justify-between px-5 py-3
                                border-b border-gray-200 dark:border-gray-700 shrink-0">
                    <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {fname}
                        </span>
                        <span className="ml-2 text-xs text-gray-400 uppercase">
                            {getExt(fname)}
                        </span>
                        {meshList.length > 0 && (
                            <span className="ml-2 text-xs text-gray-400">
                                {meshList.length} тел
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 hidden md:block">
                            ЛКМ — вращение · Колесо — зум · ПКМ — смещение
                        </span>
                        <button onClick={onClose}
                            className="text-gray-400 hover:text-gray-600
                                       dark:hover:text-gray-300 text-xl leading-none">
                            ✕
                        </button>
                    </div>
                </div>

                {/* Контент */}
                <div className="flex flex-1 min-h-0">

                    {/* Вьюпорт */}
                    <div className="relative flex-1 min-w-0">
                        {loading && (
                            <div className="absolute inset-0 flex items-center justify-center
                                            text-gray-400 text-sm z-10">
                                Загрузка модели...
                            </div>
                        )}
                        {error && (
                            <div className="absolute inset-0 flex items-center justify-center
                                            text-red-500 text-sm z-10">
                                {error}
                            </div>
                        )}
                        <div ref={mountRef} className="w-full h-full" />
                    </div>

                    {/* Панель тел — только если есть mesh */}
                    {meshList.length > 0 && (
                        <div className="w-56 shrink-0 border-l border-gray-200
                                        dark:border-gray-700 flex flex-col">

                            {/* Заголовок панели */}
                            <div className="px-3 py-2 border-b border-gray-100
                                            dark:border-gray-800 flex items-center
                                            justify-between shrink-0">
                                <span className="text-xs font-medium text-gray-600
                                                 dark:text-gray-400 uppercase tracking-wide">
                                    Тела
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => toggleAll(true)}
                                        className="text-xs text-blue-500 hover:text-blue-700
                                                   transition-colors">
                                        Все
                                    </button>
                                    <button
                                        onClick={() => toggleAll(false)}
                                        className="text-xs text-gray-400 hover:text-gray-600
                                                   transition-colors">
                                        Скрыть
                                    </button>
                                </div>
                            </div>

                            {/* Список тел */}
                            <div className="overflow-y-auto flex-1">
                                {meshList.map(m => (
                                    <div key={m.uuid}
                                        className="px-3 py-2 border-b border-gray-50
                                                    dark:border-gray-800 hover:bg-gray-50
                                                    dark:hover:bg-gray-800 transition-colors">

                                        {/* Имя + чекбокс видимости */}
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <button
                                                onClick={() => toggleVisible(m.uuid)}
                                                className={`w-4 h-4 rounded border-2 shrink-0
                                                    flex items-center justify-center
                                                    transition-colors
                                                    ${m.visible
                                                        ? 'bg-blue-600 border-blue-600 text-white'
                                                        : 'border-gray-300 dark:border-gray-600'
                                                    }`}>
                                                {m.visible && (
                                                    <svg className="w-2.5 h-2.5" fill="none"
                                                        stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={3}
                                                            d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </button>
                                            <span className="text-xs text-gray-700
                                                             dark:text-gray-300 truncate"
                                                title={m.name}>
                                                {m.name}
                                            </span>
                                        </div>

                                        {/* Слайдер прозрачности */}
                                        {m.visible && (
                                            <div className="flex items-center gap-2 pl-6">
                                                <input
                                                    type="range"
                                                    min="0.05"
                                                    max="1"
                                                    step="0.05"
                                                    value={m.opacity}
                                                    onChange={e =>
                                                        setOpacity(m.uuid, parseFloat(e.target.value))
                                                    }
                                                    className="flex-1 h-1 accent-blue-600"
                                                />
                                                <span className="text-xs text-gray-400
                                                                 w-7 text-right shrink-0">
                                                    {Math.round(m.opacity * 100)}%
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}