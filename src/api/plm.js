import { tokenStorage } from './auth';

const BASE = '/api/v1/plm';

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

export const plmApi = {
    // Справочники
    getLiteras: () => request('GET', `${BASE}/litera/`),
    getVisibilityGroups: () => request('GET', `${BASE}/visibility-groups/`),
    getPresets: (literaId = null) =>
        request('GET', `${BASE}/presets/${literaId ? `?litera_id=${literaId}` : ''}`),

    // Стадии
    getStages: (productId) => request('GET', `${BASE}/products/${productId}/stages/`),
    createStage: (productId, payload) => request('POST', `${BASE}/products/${productId}/stages/`, payload),
    getStage: (stageId) => request('GET', `${BASE}/stages/${stageId}/`),
    getApprovals: (stageId) => request('GET', `${BASE}/stages/${stageId}/approvals/`),

    // Workflow
    submit: (stageId, presetId = null) =>
        request('POST', `${BASE}/stages/${stageId}/submit/`, presetId ? { preset_id: presetId } : {}),
    approve: (stageId, departmentId, comment = '') =>
        request('POST', `${BASE}/stages/${stageId}/approve/`, { department_id: departmentId, comment }),
    reject: (stageId, departmentId, comment = '') =>
        request('POST', `${BASE}/stages/${stageId}/reject/`, { department_id: departmentId, comment }),
    archive: (stageId) =>
        request('POST', `${BASE}/stages/${stageId}/archive/`, {}),

    // Документы стадии
    attachDocument: (stageId, documentId) =>
        request('POST', `${BASE}/stages/${stageId}/documents/`, { document_id: documentId }),
    detachDocument: (stageId, documentId) =>
        request('DELETE', `${BASE}/stages/${stageId}/documents/${documentId}/`),

    // Batch
    batchCreate: (payload) => request('POST', `${BASE}/stages/batch/`, payload),
    batchSubmit: (stageIds, presetId = null) =>
        request('POST', `${BASE}/stages/batch-submit/`, {
            stage_ids: stageIds,
            ...(presetId && { preset_id: presetId }),
        }),
    batchApprove: (stageIds, departmentId, comment = '') =>
        request('POST', `${BASE}/stages/batch-approve/`, {
            stage_ids: stageIds,
            department_id: departmentId,
            comment,
        }),

    // Группы
    getGroups: () => request('GET', `${BASE}/groups/`),
    getGroup: (groupId) => request('GET', `${BASE}/groups/${groupId}/`),
};
