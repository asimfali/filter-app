import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// ─── Видовой куб ──────────────────────────────────────────────────────────────

export default function ViewCube({ onSetView, onRotate, cameraRef, dark }) {
    const mountRef = useRef(null);
    const frameRef = useRef(null);

    useEffect(() => {
        const container = mountRef.current;
        if (!container) return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
        camera.position.set(0, 0, 3);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(80, 80);
        renderer.setClearColor(0x000000, 0);
        container.appendChild(renderer.domElement);

        const faceLabels = ['Справа', 'Слева', 'Сзади', 'Спереди', 'Сверху', 'Снизу'];
        const faceColors = [
            0x2563eb, 0x1d4ed8,
            0x9333ea, 0x7e22ce,
            0x16a34a, 0x15803d,
        ];

        const cubeGroup = new THREE.Group();
        const directions = [
            [1, 0, 0], [-1, 0, 0],
            [0, 1, 0], [0, -1, 0],
            [0, 0, 1], [0, 0, -1],
        ];

        directions.forEach((dir, i) => {
            const geo = new THREE.PlaneGeometry(0.9, 0.9);
            const mat = new THREE.MeshBasicMaterial({
                color: faceColors[i],
                transparent: true,
                opacity: 0.85,
                side: THREE.DoubleSide,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(dir[0] * 0.5, dir[1] * 0.5, dir[2] * 0.5);
            mesh.lookAt(dir[0], dir[1], dir[2]);
            mesh.userData.label = faceLabels[i];
            cubeGroup.add(mesh);
        });

        const edgeGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
        const edgeMat = new THREE.MeshBasicMaterial({
            color: 0xffffff, wireframe: true, transparent: true, opacity: 0.3,
        });
        cubeGroup.add(new THREE.Mesh(edgeGeo, edgeMat));
        scene.add(cubeGroup);
        scene.add(new THREE.AmbientLight(0xffffff, 1));

        const raycaster = new THREE.Raycaster();
        const VIEWS = {
            'Спереди': { position: [0, -1, 0], up: [0, 0, 1] },
            'Сзади': { position: [0, 1, 0], up: [0, 0, -1] },
            'Слева': { position: [-1, 0, 0], up: [0, 0, 1] },
            'Справа': { position: [1, 0, 0], up: [0, 0, 1] },
            'Сверху': { position: [0, 0, 1], up: [0, 1, 0] },
            'Снизу': { position: [0, 0, -1], up: [0, 1, 0] },
        };

        const handleClick = (e) => {
            const rect = container.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((e.clientX - rect.left) / rect.width) * 2 - 1,
                -((e.clientY - rect.top) / rect.height) * 2 + 1,
            );
            raycaster.setFromCamera(mouse, camera);
            const hits = raycaster.intersectObjects(cubeGroup.children, false);
            const hit = hits.find(h => h.object.userData.label);
            if (hit) {
                const view = VIEWS[hit.object.userData.label];
                if (view) onSetView(view);
            }
        };
        renderer.domElement.addEventListener('click', handleClick);

        const animate = () => {
            frameRef.current = requestAnimationFrame(animate);
            const mainCamera = cameraRef.current;
            if (mainCamera) {
                cubeGroup.quaternion.copy(mainCamera.quaternion).invert();
            }
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            cancelAnimationFrame(frameRef.current);
            renderer.domElement.removeEventListener('click', handleClick);
            renderer.dispose();
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
        };
    }, []);

    const arrowBtn = (label, onClick, style) => (
        <button
            onClick={onClick}
            title={label}
            style={{
                position: 'absolute',
                width: 18, height: 18,
                background: dark ? 'rgba(30,41,59,0.7)' : 'rgba(241,245,249,0.85)',
                border: dark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.15)',
                borderRadius: 3,
                color: dark ? '#94a3b8' : '#475569',
                fontSize: 9,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                ...style,
            }}>
            {label}
        </button>
    );

    return (
        <div style={{
            position: 'absolute',
            top: 12, right: 12,
            zIndex: 30,
            width: 120, height: 120,
        }}>
            {/* Стрелки */}
            {arrowBtn('↑', () => onRotate('up'), { top: 0, left: 51 })}
            {arrowBtn('↓', () => onRotate('down'), { bottom: 0, left: 51 })}
            {arrowBtn('←', () => onRotate('left'), { top: 51, left: 0 })}
            {arrowBtn('→', () => onRotate('right'), { top: 51, right: 0 })}
            {arrowBtn('↺', () => onRotate('ccw'), { top: 0, left: 0 })}
            {arrowBtn('↻', () => onRotate('cw'), { top: 0, right: 0 })}

            {/* Куб по центру */}
            <div
                ref={mountRef}
                style={{
                    position: 'absolute',
                    top: 20, left: 20,
                    width: 80, height: 80,
                    cursor: 'pointer',
                }}
            />
        </div>
    );
}
