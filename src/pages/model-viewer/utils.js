import * as THREE from 'three';
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
        name: displayName(obj),
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

    // Деталь (isPart без вложенных деталей) — лист дерева: тела/примитивы внутри не показываем
    if (obj.userData?.isPart && !hasPartDescendant(obj)) return node;

    for (const child of obj.children) {
        const childNode = buildTree(child);
        if (childNode) node.children.push(childNode);
    }

    // Пропускаем пустые безымянные группы
    if (!obj.isMesh && !obj.name && node.children.length === 0) return null;

    return node;
}

// Оригинальное имя узла glTF (GLTFLoader санитизирует obj.name: пробелы → «_»)
function displayName(obj) {
    return obj.userData?.name || obj.name || `(${obj.type})`;
}

function hasPartDescendant(obj) {
    return obj.children.some(c => c.userData?.isPart || hasPartDescendant(c));
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
    return { uuid: obj.uuid, name: displayName(obj), type: obj.type, isMesh: !!obj.isMesh, children: [] };
}

// ── Прозрачные вырезы (текстура-маска отверстий, alphaTest) ───────────────────

// Таблица сумм (summed-area table) по признаку «альфа ≥ 128»: число непрозрачных в любом окне — O(1).
// Размер (w+1)×(h+1), нулевые строка/столбец — чтобы не проверять границы.
export function buildOpaqueSAT(alpha, w, h) {
    const W = w + 1;
    const sat = new Uint32Array(W * (h + 1));
    for (let y = 0; y < h; y++) {
        let row = 0;
        for (let x = 0; x < w; x++) {
            row += alpha[y * w + x] >= 128 ? 1 : 0;
            sat[(y + 1) * W + x + 1] = sat[y * W + x + 1] + row;
        }
    }
    return { sat, w, h };
}

function countOpaque({ sat, w, h }, x0, y0, x1, y1) {
    x0 = Math.max(0, x0); y0 = Math.max(0, y0);
    x1 = Math.min(w - 1, x1); y1 = Math.min(h - 1, y1);
    const W = w + 1;
    return sat[(y1 + 1) * W + x1 + 1] - sat[y0 * W + x1 + 1] - sat[(y1 + 1) * W + x0] + sat[y0 * W + x0];
}

// texture → SAT | null; RGBA после построения не держим
const satCache = new WeakMap();
let alphaCanvas = null;

function textureOpaqueSAT(texture) {
    if (satCache.has(texture)) return satCache.get(texture);
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
            res = buildOpaqueSAT(alpha, w, h);
        } catch { res = null; }
    }
    satCache.set(texture, res);
    return res;
}

// Текселей на единицу мировой длины в треугольнике попадания (по рёбрам ab, ac)
function texelsPerWorld(hit, w, h) {
    const geo = hit.object.geometry;
    const pos = geo?.attributes?.position, uv = geo?.attributes?.uv;
    if (!pos || !uv || !hit.face) return 0;
    const m = hit.object.matrixWorld;
    const { a, b, c } = hit.face;
    const pa = new THREE.Vector3().fromBufferAttribute(pos, a).applyMatrix4(m);
    let best = 0;
    for (const v of [b, c]) {
        const dPos = new THREE.Vector3().fromBufferAttribute(pos, v).applyMatrix4(m).distanceTo(pa);
        if (dPos < 1e-9) continue;
        const du = (uv.getX(v) - uv.getX(a)) * w, dv = (uv.getY(v) - uv.getY(a)) * h;
        best = Math.max(best, Math.hypot(du, dv) / dPos);
    }
    return best;
}

// Попадание в вырез: у материала map + alphaTest, и все тексели в окне ~2 экранных пикселя вокруг точки
// прозрачны. Иначе мелкая перфорация (доли пикселя на экране) пропускала бы клик насквозь.
// pxWorld — размер экранного пикселя в мире; без него проверяется один тексель.
export function isCutoutHit(hit, { pxWorld = 0 } = {}, sample = textureOpaqueSAT) {
    const mats = hit.object?.material;
    const mat = Array.isArray(mats) ? mats[hit.face?.materialIndex ?? 0] : mats;
    if (!mat?.map || !(mat.alphaTest > 0) || !hit.uv) return false;
    const data = sample(mat.map);
    if (!data) return false;
    // transformUv: матрица текстуры + wrap; при flipY=false (glTF) v не переворачивается
    const uv = mat.map.transformUv ? mat.map.transformUv(hit.uv.clone()) : hit.uv;
    const x = Math.min(data.w - 1, Math.max(0, Math.floor(uv.x * data.w)));
    const y = Math.min(data.h - 1, Math.max(0, Math.floor(uv.y * data.h)));
    const r = pxWorld > 0 ? Math.max(1, Math.ceil(2 * pxWorld * texelsPerWorld(hit, data.w, data.h))) : 0;
    return countOpaque(data, x - r, y - r, x + r, y + r) === 0;
}
