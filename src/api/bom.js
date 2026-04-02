import { tokenStorage } from './auth';

const BASE = '/api/v1/bom';

const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokenStorage.getAccess()}`,
});

const request = async (method, url, body = null) => {
    const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: body ? JSON.stringify(body) : null,
    });
    const data = await res.json();
    return { ok: res.ok, data };
};

export const bomApi = {
    // Папки
    getFolders: (type = 'nomenclature', parentPath = null, root = null) => {
        const qs = new URLSearchParams({ type });
        if (parentPath !== null) qs.set('parent_path', parentPath);
        if (root !== null) qs.set('root', root);
        return request('GET', `${BASE}/folders/?${qs}`);
    },
    syncFolders: () =>
        request('POST', `${BASE}/folders/sync/`, {}),
    createFolder: (payload) =>
        request('POST', `${BASE}/folders/create/`, payload),
    searchFolders: (type, q, root = null) => {
        const qs = new URLSearchParams({
            type,
            search: q
        });

        if (root !== null) {
            qs.set('root', root);
        }

        return request('GET', `${BASE}/folders/?${qs}`);
    },

    syncNomenclatureFolders: (root = 'ПРОИЗВОДСТВО') =>
        request('POST', `${BASE}/folders/sync-nomenclature/`, { root }),

    // Номенклатура
    getParts: (params = {}) => {
        const qs = new URLSearchParams();
        if (params.q) qs.set('q', params.q);
        if (params.is_assembly !== undefined) qs.set('is_assembly', params.is_assembly);
        if (params.is_synced !== undefined) qs.set('is_synced', params.is_synced);
        if (params.limit) qs.set('limit', params.limit);
        return request('GET', `${BASE}/parts/?${qs}`);
    },
    getPart: (partId) =>
        request('GET', `${BASE}/parts/${partId}/`),
    createPart: (payload) =>
        request('POST', `${BASE}/parts/`, payload),
    syncParts: (search = '', limit = 50) =>
        request('POST', `${BASE}/parts/sync/`, { search, limit }),
    getSyncConfigs: () => request('GET', `${BASE}/sync-configs/`),
    syncBomConfig: (configId) =>
        request('POST', `${BASE}/sync-folder/`, { config_id: configId }),
    getTaskStatus: (taskId) =>
        request('GET', `${BASE}/task-status/${taskId}/`),
    createPartIn1C: (partId) =>
        request('POST', `${BASE}/parts/create-in-1c/`, { part_id: partId }),
    searchPartsUnitWeight: (q) => {
        const qs = new URLSearchParams({ q });
        return request('GET', `${BASE}/parts/unit-weight/?${qs}`);
    },
    savePartsUnitWeight: (items) =>
        request('PATCH', `${BASE}/parts/unit-weight/`, { items }),

    // Спецификации
    getSpecs: (params = {}) => {
        const qs = new URLSearchParams();
        if (params.status) qs.set('status', params.status);
        if (params.part_id) qs.set('part_id', params.part_id);
        return request('GET', `${BASE}/specs/?${qs}`);
    },
    getSpec: (specId) =>
        request('GET', `${BASE}/specs/${specId}/`),
    createSpec: (payload) =>
        request('POST', `${BASE}/specs/`, payload),
    updateSpec: (specId, payload) =>
        request('PATCH', `${BASE}/specs/${specId}/`, payload),
    deleteSpec: (specId) =>
        request('DELETE', `${BASE}/specs/${specId}/`),
    pullSpec: (payload) =>
        request('POST', `${BASE}/specs/pull/`, payload),
    cloneSpec: (specId, newName) =>
        request('POST', `${BASE}/specs/${specId}/clone/`, { new_name: newName }),

    // Пак Тара
    getPackaging: () => request('GET', `${BASE}/packaging/`),
    setPackaging: (nomenclature_name, package_name) =>
        request('POST', `${BASE}/packaging/set/`, { nomenclature_name, package_name }),
    updatePackaging: (payload) =>
        request('POST', `${BASE}/packaging/update/`, payload),

    // Этапы и материалы
    updateStages: (specId, stages) =>
        request('PUT', `${BASE}/specs/${specId}/stages/`, { stages }),
    updateMaterials: (specId, materials) =>
        request('PUT', `${BASE}/specs/${specId}/materials/`, { materials }),
    updateDetails: (specId) =>
        request('POST', `${BASE}/specs/${specId}/update-details/`, {}),

    // Workflow
    validateSpec: (specId) =>
        request('POST', `${BASE}/specs/${specId}/validate/`, {}),
    pushSpec: (specId) =>
        request('POST', `${BASE}/specs/${specId}/push/`, {}),
    lockSpec: (specId) =>
        request('POST', `${BASE}/specs/${specId}/lock/`, {}),
    unlockSpec: (specId) =>
        request('POST', `${BASE}/specs/${specId}/unlock/`, {}),
    importFromExcel: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return fetch(`${BASE}/specs/import-excel/`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokenStorage.getAccess()}` },
            body: formData,
        }).then(async res => ({ ok: res.ok, data: await res.json() }));
    },
    getStagePresets: () => request('GET', `${BASE}/stage-presets/`),
    createDetails: (specId, nomenclatureFolderId = null) =>
        request('POST', `${BASE}/specs/${specId}/create-details/`, {
            ...(nomenclatureFolderId && { nomenclature_folder_id: nomenclatureFolderId }),
        }),
    getSheetMappings: () => request('GET', `${BASE}/sheet-mappings/`),
    getMaterialGroup: (material_type, thickness, q = '', context = 'detail') => {
        const qs = new URLSearchParams();
        if (material_type) qs.set('material_type', material_type);
        if (thickness) qs.set('thickness', thickness);
        if (q) qs.set('q', q);
        if (context) qs.set('context', context);
        return request('GET', `${BASE}/material-group/?${qs}`);
    },
    getMaterialGroups: () => request('GET', `${BASE}/material-groups/`),
    createMaterialGroup: (payload) => request('POST', `${BASE}/material-groups/`, payload),
    getMaterialGroupDetail: (id) => request('GET', `${BASE}/material-groups/${id}/`),
    updateMaterialGroup: (id, payload) => request('PATCH', `${BASE}/material-groups/${id}/`, payload),
    deleteMaterialGroup: (id) => request('DELETE', `${BASE}/material-groups/${id}/`),
    addPartToGroup: (groupId, partId) =>
        request('POST', `${BASE}/material-groups/${groupId}/parts/add/`, { part_id: partId }),
    removePartFromGroup: (groupId, partId) =>
        request('POST', `${BASE}/material-groups/${groupId}/parts/remove/`, { part_id: partId }),
    getSpecs: (params = {}) => {
        const qs = new URLSearchParams();
        if (params.status) qs.set('status', params.status);
        if (params.part_id) qs.set('part_id', params.part_id);
        if (params.q) qs.set('q', params.q);      // ← добавить
        return request('GET', `${BASE}/specs/?${qs}`);
    },
    mergeExcel: (specId, file) => {
        const formData = new FormData();
        formData.append('file', file);
        return fetch(`${BASE}/specs/${specId}/merge-excel/`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokenStorage.getAccess()}` },
            body: formData,
        }).then(async res => ({ ok: res.ok, data: await res.json() }));
    },
    mergeJson: (specId, file) => {
        const formData = new FormData();
        formData.append('file', file);
        return fetch(`${BASE}/specs/${specId}/merge-json/`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokenStorage.getAccess()}` },
            body: formData,
        }).then(async res => ({ ok: res.ok, data: await res.json() }));
    },

    // Локальная тара
    getPackagingItems: (q = '') => {
        const qs = new URLSearchParams();
        if (q) qs.set('q', q);
        return request('GET', `${BASE}/packaging-items/?${qs}`);
    },
    createPackagingItem: (payload) =>
        request('POST', `${BASE}/packaging-items/`, payload),
    updatePackagingItem: (id, payload) =>
        request('PATCH', `${BASE}/packaging-items/${id}/`, payload),
    deletePackagingItem: (id) =>
        request('DELETE', `${BASE}/packaging-items/${id}/`),
    addPackagingMaterial: (id, payload) =>
        request('POST', `${BASE}/packaging-items/${id}/materials/`, payload),
    removePackagingMaterial: (id, materialId) =>
        request('DELETE', `${BASE}/packaging-items/${id}/materials/${materialId}/`),
    syncPackagingItems: () =>
        request('POST', `${BASE}/packaging-items/sync/`),
    importPackagingFrom1C: () =>
        request('POST', `${BASE}/packaging-items/import-from-1c/`),

    getUnits: () => request('GET', `${BASE}/units/`),
    togglePriority: (partId) =>
        request('PATCH', `${BASE}/parts/${partId}/priority/`),
    importPackagingFrom1C: () =>
        request('POST', `${BASE}/packaging-items/import-from-1c/`),
    trackPartUse: (partId) =>
        request('POST', `${BASE}/parts/${partId}/use/`),
};