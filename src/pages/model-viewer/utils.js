import { tokenStorage } from '../../api/auth';
import { getExt } from '../../utils/fileUtils';

export { getExt };

export function downloadUrl(path) {
    return `/api/v1/media/download/?path=${encodeURIComponent(path)}`;
}

export function authFetch(path, opts = {}) {
    return fetch(downloadUrl(path), {
        ...opts,
        headers: { Authorization: `Bearer ${tokenStorage.getAccess()}` },
    });
}

// Построить дерево узлов из Three.js объекта
export function buildTree(obj) {
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
        const childNode = buildTree(child);
        if (childNode) node.children.push(childNode);
    }

    // Пропускаем пустые безымянные группы
    if (!obj.isMesh && !obj.name && node.children.length === 0) return null;

    return node;
}

// ── Детали сборки ─────────────────────────────────────────────────────────────
// GLTFLoader превращает меш из нескольких примитивов в Group из Mesh (по одному на материал),
// поэтому «деталь» — именованный узел glTF, а не отдельный Mesh-примитив.

// Помечает объекты, соответствующие именованным узлам glTF (userData.isPart)
export function markGltfParts(gltf) {
    const nodes = gltf.parser?.json?.nodes ?? [];
    for (const [obj, assoc] of gltf.parser?.associations ?? []) {
        if (assoc?.nodes !== undefined && nodes[assoc.nodes]?.name && obj.userData) {
            obj.userData.isPart = true;
        }
    }
}

// Ближайшая деталь-предок; если не найдена (STL/OBJ) — сам объект
export function partOf(obj) {
    for (let o = obj; o; o = o.parent) {
        if (o.userData?.isPart) return o;
    }
    return obj;
}

// Эффективная видимость: сам объект и все предки visible
export function isEffectivelyVisible(obj) {
    for (let o = obj; o; o = o.parent) {
        if (!o.visible) return false;
    }
    return true;
}

// Mesh-и сцены с эффективной видимостью === visible
export function collectMeshes(root, visible = true) {
    const meshes = [];
    root.traverse(c => {
        if (c.isMesh && isEffectivelyVisible(c) === visible) meshes.push(c);
    });
    return meshes;
}

// Показать объект целиком вместе с цепочкой предков
export function showWithAncestors(obj) {
    obj.traverse(c => { c.visible = true; });
    for (let o = obj.parent; o; o = o.parent) o.visible = true;
}

// Узел для selectedNode/contextMenu
export function nodeOf(obj) {
    return { uuid: obj.uuid, name: obj.name || `(${obj.type})`, type: obj.type, isMesh: !!obj.isMesh, children: [] };
}

// ── Прозрачные вырезы (текстура-маска отверстий, alphaTest) ───────────────────

// texture → { alpha: Uint8Array, w, h } | null; только альфа-канал, чтобы не держать RGBA больших текстур
const alphaCache = new WeakMap();
let alphaCanvas = null;

function textureAlpha(texture) {
    if (alphaCache.has(texture)) return alphaCache.get(texture);
    let res = null;
    const img = texture.image;
    const w = img?.width, h = img?.height;
    if (w && h) {
        try {
            alphaCanvas = alphaCanvas || document.createElement('canvas');
            alphaCanvas.width = w;
            alphaCanvas.height = h;
            const ctx = alphaCanvas.getContext('2d', { willReadFrequently: true });
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0);
            const rgba = ctx.getImageData(0, 0, w, h).data;
            const alpha = new Uint8Array(w * h);
            for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
            res = { alpha, w, h };
        } catch { res = null; }
    }
    alphaCache.set(texture, res);
    return res;
}

// Попадание в вырез: у материала есть map + alphaTest, альфа текстуры в точке uv < 128
export function isCutoutHit(hit, sampleAlpha = textureAlpha) {
    const mats = hit.object?.material;
    const mat = Array.isArray(mats) ? mats[hit.face?.materialIndex ?? 0] : mats;
    if (!mat?.map || !(mat.alphaTest > 0) || !hit.uv) return false;
    const data = sampleAlpha(mat.map);
    if (!data) return false;
    // transformUv: матрица текстуры + wrap; при flipY=false (glTF) v не переворачивается
    const uv = mat.map.transformUv ? mat.map.transformUv(hit.uv.clone()) : hit.uv;
    const x = Math.min(data.w - 1, Math.max(0, Math.floor(uv.x * data.w)));
    const y = Math.min(data.h - 1, Math.max(0, Math.floor(uv.y * data.h)));
    return data.alpha[y * data.w + x] < 128;
}
