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
