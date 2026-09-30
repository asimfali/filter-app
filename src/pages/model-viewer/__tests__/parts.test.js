import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
    markGltfParts, partOf, isEffectivelyVisible, collectMeshes, showWithAncestors, nodeOf, isCutoutHit, buildTree,
} from '../utils';

// Структура наших GLB: именованный узел вхождения → безымянный узел деквантизации → Group из Mesh
function buildPart() {
    const part = new THREE.Object3D();
    part.name = 'КЭВ-01:1';
    const dequant = new THREE.Object3D();
    const group = new THREE.Group();
    const face = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    const edge = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    group.add(face, edge);
    dequant.add(group);
    part.add(dequant);
    const gltf = {
        parser: {
            json: { nodes: [{ name: 'КЭВ-01:1' }, {}] },
            associations: new Map([
                [part, { nodes: 0 }],
                [dequant, { nodes: 1 }],
                [face, { meshes: 0, primitives: 0 }],
            ]),
        },
    };
    return { part, dequant, group, face, edge, gltf };
}

describe('markGltfParts / partOf', () => {
    it('деталь — ближайший именованный узел glTF; безымянный узел деквантизации не деталь', () => {
        const { part, dequant, face, edge, gltf } = buildPart();
        markGltfParts(gltf);
        expect(part.userData.isPart).toBe(true);
        expect(dequant.userData.isPart).toBeUndefined();
        expect(partOf(face)).toBe(part);
        expect(partOf(edge)).toBe(part);
    });

    it('без помеченных предков (STL/OBJ) — сам объект', () => {
        const mesh = new THREE.Mesh();
        new THREE.Group().add(mesh);
        expect(partOf(mesh)).toBe(mesh);
    });
});

describe('видимость', () => {
    it('isEffectivelyVisible учитывает предков; collectMeshes делит на видимые/скрытые', () => {
        const scene = new THREE.Scene();
        const { part, face, edge } = buildPart();
        const other = new THREE.Mesh();
        scene.add(part, other);
        part.visible = false;
        expect(face.visible).toBe(true);
        expect(isEffectivelyVisible(face)).toBe(false);
        expect(collectMeshes(scene)).toEqual([other]);
        expect(collectMeshes(scene, false)).toEqual([face, edge]);
    });

    it('showWithAncestors показывает поддерево и цепочку предков', () => {
        const scene = new THREE.Scene();
        const { part, group, face } = buildPart();
        scene.add(part);
        part.traverse(c => { c.visible = false; });
        showWithAncestors(group);
        expect(isEffectivelyVisible(face)).toBe(true);
    });

    it('nodeOf — узел для дерева/меню', () => {
        const g = new THREE.Group();
        expect(nodeOf(g)).toMatchObject({ uuid: g.uuid, name: '(Group)', type: 'Group', isMesh: false, children: [] });
    });
});

describe('isCutoutHit', () => {
    // Текстура 2×2: верхняя строка (v≈0) — вырез (альфа 0), нижняя — непрозрачная
    const alpha = { alpha: new Uint8Array([0, 0, 255, 255]), w: 2, h: 2 };
    const sample = () => alpha;
    const mkHit = (u, v, matOpts = {}) => {
        const map = new THREE.Texture();
        map.flipY = false;
        const material = new THREE.MeshBasicMaterial({ map, alphaTest: 0.5, ...matOpts });
        return { object: new THREE.Mesh(new THREE.BufferGeometry(), material), uv: new THREE.Vector2(u, v) };
    };

    it('альфа < 128 — вырез, иначе попадание', () => {
        expect(isCutoutHit(mkHit(0.25, 0.25), sample)).toBe(true);
        expect(isCutoutHit(mkHit(0.75, 0.75), sample)).toBe(false);
    });

    it('без alphaTest, map или uv — не вырез', () => {
        expect(isCutoutHit(mkHit(0.25, 0.25, { alphaTest: 0 }), sample)).toBe(false);
        expect(isCutoutHit(mkHit(0.25, 0.25, { map: null }), sample)).toBe(false);
        expect(isCutoutHit({ ...mkHit(0.25, 0.25), uv: undefined }, sample)).toBe(false);
    });

    it('UV вне [0,1] оборачивается по wrap текстуры (glTF по умолчанию Repeat)', () => {
        const hit = mkHit(1.25, 1.25);
        hit.object.material.map.wrapS = hit.object.material.map.wrapT = THREE.RepeatWrapping;
        expect(isCutoutHit(hit, sample)).toBe(true);
    });
});

describe('buildTree с деталями glTF', () => {
    it('деталь — лист (тела внутри скрыты), сборка раскрывается; имя — оригинальное из userData.name', () => {
        const { part, gltf } = buildPart();
        part.userData.name = 'Заклепка тяговая:1';
        part.name = 'Заклепка_тяговая1';
        markGltfParts(gltf);
        const asm = new THREE.Object3D();
        asm.name = 'Сборка';
        asm.userData.isPart = true;
        asm.add(part);

        const tree = buildTree(asm);
        expect(tree.children).toHaveLength(1);
        expect(tree.children[0]).toMatchObject({ uuid: part.uuid, name: 'Заклепка тяговая:1', children: [] });
        expect(nodeOf(part).name).toBe('Заклепка тяговая:1');
    });
});
