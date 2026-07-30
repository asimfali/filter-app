import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { useTheme } from '../../contexts/ThemeContext';
import { getExt, authFetch, buildTree } from './utils';

export function useModelViewer({ relPath, fname, mtlPath }) {
    const mountRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const frameRef = useRef(null);
    const sceneRef = useRef(null);
    const raycasterRef = useRef(new THREE.Raycaster());
    const objMapRef = useRef({});  // uuid → THREE.Object3D
    const userMaterialStateRef = useRef({});
    const panDragRef = useRef(null);
    const panDidMoveRef = useRef(false);

    const { dark } = useTheme();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tree, setTree] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [contextMenu, setContextMenu] = useState(null); // {x, y, node}
    const [, forceUpdate] = useState(0); // для ре-рендера дерева

    const refresh = useCallback(() => forceUpdate(n => n + 1), []);
    const setView = useCallback(({ position, up }) => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        const scene = sceneRef.current;
        if (!camera || !controls || !scene) return;

        const box = new THREE.Box3();
        scene.traverse(c => { if (c.isMesh) box.expandByObject(c); });
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const dist = maxDim * 2;

        camera.position.set(
            position[0] * dist,
            position[1] * dist,
            position[2] * dist,
        );
        camera.up.set(up[0], up[1], up[2]);
        controls.target.set(0, 0, 0);
        controls.update();
    }, []);

    const rotateView = useCallback((direction) => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (!camera || !controls) return;

        const angle = Math.PI / 2;
        const q = new THREE.Quaternion();
        const pos = camera.position.clone().normalize();
        const right = new THREE.Vector3()
            .crossVectors(camera.position, camera.up)
            .normalize();

        switch (direction) {
            case 'up': q.setFromAxisAngle(right, -angle); break;
            case 'down': q.setFromAxisAngle(right, angle); break;
            case 'left': q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle); break;
            case 'right': q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -angle); break;
            case 'cw': q.setFromAxisAngle(pos, -angle); break;
            case 'ccw': q.setFromAxisAngle(pos, angle); break;
        }

        camera.position.applyQuaternion(q);
        camera.up.applyQuaternion(q);
        controls.target.set(0, 0, 0);
        controls.update();
    }, []);

    // ── Инициализация Three.js ────────────────────────────────────────────────

    useEffect(() => {
        const container = mountRef.current;
        if (!container) return;

        const ext = getExt(fname);

        const scene = new THREE.Scene();
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

        const controls = new TrackballControls(camera, renderer.domElement);
        controls.rotateSpeed = 6.0;
        controls.zoomSpeed = 1.2;
        controls.panSpeed = 0.8;
        controls.staticMoving = true;
        controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.ZOOM,
            RIGHT: THREE.MOUSE.PAN,
        };
        controlsRef.current = controls;

        const onPointerMove = (e) => {
            if (!panDragRef.current) return;
            panDidMoveRef.current = true;
            if (!(e.buttons & 3)) {
                panDragRef.current = null;
                controls.enabled = true;
                return;
            }

            const camera = cameraRef.current;
            if (!camera) return;

            const { startX, startY, startTarget, startCamPos } = panDragRef.current;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            const h = container.clientHeight;
            const scale = (camera.top - camera.bottom) / camera.zoom / h;

            const right = new THREE.Vector3()
                .crossVectors(camera.position.clone().sub(controls.target).normalize(), camera.up)
                .normalize()
                .negate();
            const up = camera.up.clone().normalize();

            const offset = right.multiplyScalar(-dx * scale).add(up.multiplyScalar(dy * scale));

            camera.position.copy(startCamPos).add(offset);
            controls.target.copy(startTarget).add(offset);
            controls.update();
        };

        const onPointerUp = () => {
            panDragRef.current = null;
            controls.enabled = true;
            // Сброс через setTimeout чтобы contextmenu сработал после
            setTimeout(() => { panDidMoveRef.current = false; }, 50);
        };

        container.addEventListener('pointermove', onPointerMove);
        container.addEventListener('pointerup', onPointerUp);

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
                } catch { /* пропускаем */ }
            });
        };

        const fitCamera = (object) => {
            const box = new THREE.Box3().setFromObject(object);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const aspect = container.clientWidth / container.clientHeight;

            object.position.sub(center);

            const orthoSize = maxDim;
            camera.left = -orthoSize * aspect;
            camera.right = orthoSize * aspect;
            camera.top = orthoSize;
            camera.bottom = -orthoSize;
            camera.near = -maxDim * 100;
            camera.far = maxDim * 100;

            const zoomX = (orthoSize * aspect * 2) / size.x;
            const zoomY = (orthoSize * 2) / size.z;
            camera.zoom = Math.min(zoomX, zoomY) * 0.85;
            camera.updateProjectionMatrix();

            // Изометрия спереди-сверху-справа
            camera.position.set(maxDim * 1.2, -maxDim * 1.5, maxDim * 0.8);
            camera.up.set(0, 0, 1);  // ← Z вверх как у нас
            controls.target.set(0, 0, 0);
            controls.update();
        };

        const onLoaded = (root) => {
            scene.background = new THREE.Color(dark ? 0x1a1f2e : 0xf1f5f9);
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

    useEffect(() => {
        if (!sceneRef.current) return;
        sceneRef.current.background = new THREE.Color(dark ? 0x1a1a2e : 0xf1f5f9);
    }, [dark]);

    // ── Raycast — клик по модели ──────────────────────────────────────────────

    const clickCountRef = useRef(0);
    const clickTimerRef = useRef(null);

    // ── На уровне компонента (рядом с другими refs) ───────────────────────
    const selectedHighlightRef = useRef(null);
    const originalColorsRef = useRef({});

    const highlightSelected = useCallback((uuid) => {
        // Сбросить предыдущую подсветку — восстанавливаем из userMaterialState
        if (selectedHighlightRef.current) {
            const prev = objMapRef.current[selectedHighlightRef.current];
            if (prev) {
                prev.traverse(child => {
                    if (!child.isMesh) return;
                    const userState = userMaterialStateRef.current[child.uuid];
                    const orig = originalColorsRef.current[child.uuid];

                    const restoreColor = userState?.color ?? orig;
                    const restoreOpacity = userState?.opacity ?? 1;

                    if (restoreColor !== undefined) {
                        const setMat = m => {
                            m.color.setHex(restoreColor);
                            m.opacity = restoreOpacity;
                        };
                        if (Array.isArray(child.material)) child.material.forEach(setMat);
                        else setMat(child.material);
                    }
                    delete originalColorsRef.current[child.uuid];
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
                // Сохраняем текущий цвет (с учётом userState)
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

    const mouseDownPosRef = useRef(null);

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
                    highlightSelected(null);
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
                    highlightSelected(hit.uuid);
                } else {
                    // Клик на пустое место — сбросить подсветку
                    highlightSelected(null);
                    setSelectedNode(null);
                }
            }
        }, 250);
    }, [refresh, highlightSelected]);

    const handleCanvasMouseDown = useCallback((e) => {
        const container = mountRef.current;
        const camera = cameraRef.current;
        const scene = sceneRef.current;
        const controls = controlsRef.current;

        if (e.button === 0) {
            mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
        }

        if (e.button === 2 && e.buttons === 3) {
            e.preventDefault();
            e.stopPropagation();
            if (!controls || !camera) return;
            controls.enabled = false;
            panDragRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                startTarget: controls.target.clone(),
                startCamPos: camera.position.clone(),
            };
            return;
        }

        if (e.button !== 1) return;
        e.preventDefault();
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
        if (panDidMoveRef.current) return;
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
        const container = mountRef.current;
        if (!obj || !camera || !controls || !container) return;

        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const aspect = container.clientWidth / container.clientHeight;

        const orthoSize = maxDim * 0.3;
        camera.left = -orthoSize * aspect;
        camera.right = orthoSize * aspect;
        camera.top = orthoSize;
        camera.bottom = -orthoSize;
        camera.updateProjectionMatrix();

        controls.target.copy(center);
        camera.position.set(
            center.x + maxDim,
            center.y + maxDim * 0.7,
            center.z + maxDim,
        );
        controls.update();
    }, []);

    const setOpacity = useCallback((uuid, value) => {
        const obj = objMapRef.current[uuid];
        if (!obj || !obj.isMesh) return;
        const setMat = m => { m.opacity = value; m.transparent = true; };
        if (Array.isArray(obj.material)) obj.material.forEach(setMat);
        else setMat(obj.material);

        // Запоминаем состояние
        userMaterialStateRef.current[uuid] = {
            ...userMaterialStateRef.current[uuid],
            opacity: value,
        };
        refresh();
    }, [refresh]);

    const setColor = useCallback((uuid, hex) => {
        const obj = objMapRef.current[uuid];
        if (!obj || !obj.isMesh) return;
        const color = new THREE.Color(hex);
        const setMat = m => m.color.set(color);
        if (Array.isArray(obj.material)) obj.material.forEach(setMat);
        else setMat(obj.material);

        // Запоминаем состояние
        userMaterialStateRef.current[uuid] = {
            ...userMaterialStateRef.current[uuid],
            color: color.getHex(),
        };
        refresh();
    }, [refresh]);

    const highlightMesh = useCallback((uuid, highlight) => {
        const obj = objMapRef.current[uuid];
        if (!obj) return;

        obj.traverse(child => {
            if (!child.isMesh) return;
            if (highlight) {
                const mat = Array.isArray(child.material) ? child.material[0] : child.material;
                // Не перезаписываем если уже в originalColors (деталь выделена)
                if (originalColorsRef.current[child.uuid] === undefined) {
                    originalColorsRef.current[child.uuid] = mat.color.getHex();
                }
                const setMat = m => m.color.setHex(0xff8c00);
                if (Array.isArray(child.material)) child.material.forEach(setMat);
                else setMat(child.material);
            } else {
                const orig = originalColorsRef.current[child.uuid];
                if (orig !== undefined) {
                    const userState = userMaterialStateRef.current[child.uuid];
                    const restoreColor = userState?.color ?? orig;
                    const setMat = m => m.color.setHex(restoreColor);
                    if (Array.isArray(child.material)) child.material.forEach(setMat);
                    else setMat(child.material);
                    delete originalColorsRef.current[child.uuid];
                }
            }
        });
    }, []);

    return {
        mountRef, cameraRef, dark,
        loading, error, tree,
        selectedNode, setSelectedNode,
        contextMenu, setContextMenu,
        objMap: objMapRef.current,
        setView, rotateView, showAll,
        handleCanvasClick, handleCanvasMouseDown, handleCanvasContextMenu,
        setVisible, isolate, focusOn, setOpacity, setColor, highlightMesh,
    };
}
