import { apiFetch } from './auth';

const BASE = '/api/v1/selection';

export const selectionApi = {
    async formData() {
        const res = await apiFetch(`${BASE}/form-data/`);
        return { ok: res.ok, data: await res.json() };
    },

    async regions(search) {
        const res = await apiFetch(`${BASE}/regions/?search=${encodeURIComponent(search)}`);
        return { ok: res.ok, data: await res.json() };
    },

    async calculate(payload) {
        const res = await apiFetch(`${BASE}/calculate/`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async report(params, data) {
        const res = await apiFetch('/api/v1/selection/report/', {
            method: 'POST',
            body: JSON.stringify({ params, data }),
        });
        return res;  // raw response — caller делает blob()
    },

    async nearestRegion(lat, lon) {
        const res = await apiFetch(`${BASE}/regions/nearest/?lat=${lat}&lon=${lon}`);
        return { ok: res.ok, data: await res.json() };
    },

    async extractUpload(configSlug, file, page = null) {
        const formData = new FormData();
        formData.append('config_slug', configSlug);
        formData.append('file', file);
        if (page) formData.append('page', String(page));
        const res = await apiFetch(`${BASE}/extract/upload/`, {
            method: 'POST',
            body: formData,
        });
        return { ok: res.ok, data: await res.json() };
    },

    async extractStatus(taskId) {
        const res = await apiFetch(`${BASE}/extract/${taskId}/status/`);
        return { ok: res.ok, data: await res.json() };
    },

    async extractResult(taskId) {
        const res = await apiFetch(`${BASE}/extract/${taskId}/result/`);
        return { ok: res.ok, data: await res.json() };
    },

    async extractApply(taskId, dryRun = false) {
        const res = await apiFetch(`${BASE}/extract/${taskId}/apply/`, {
            method: 'POST',
            body: JSON.stringify({ dry_run: dryRun }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    // Fan Charts
    async fanCharts(productExternalId = '') {
        const url = productExternalId
            ? `${BASE}/fan-charts/?product=${encodeURIComponent(productExternalId)}`
            : `${BASE}/fan-charts/`
        const res = await apiFetch(url)
        return { ok: res.ok, data: await res.json() }
    },

    async fanChartDetail(chartId) {
        const res = await apiFetch(`${BASE}/fan-charts/${chartId}/`);
        return { ok: res.ok, data: await res.json() };
    },

    async fanChartCreate(payload) {
        const res = await apiFetch(`${BASE}/fan-charts/`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async fanChartSave(chartId, payload) {
        const res = await apiFetch(`${BASE}/fan-charts/${chartId}/save/`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async fanChartInterpolated(chartId, n = 100) {
        const res = await apiFetch(`${BASE}/fan-charts/${chartId}/interpolated/?n=${n}`);
        return { ok: res.ok, data: await res.json() };
    },

    async fanChartDelete(chartId) {
        const res = await apiFetch(`${BASE}/fan-charts/${chartId}/`, { method: 'DELETE' });
        return { ok: res.ok };
    },

    async fanChartOperatingPoint(chartId, qRef, pvRef, curveId = null) {
        const body = { q_ref: qRef, pv_ref: pvRef };
        if (curveId) body.curve_id = curveId;
        const res = await apiFetch(`${BASE}/fan-charts/${chartId}/operating-point/`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
        return { ok: res.ok, data: await res.json() };
    },
};