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

    // Fan Charts — редактор графиков вынесен в filter-app-graphs (/graphs/),
    // см. src/status/FANCHART_EXTRACTION_PLAN.md. dxfCheckExists/dxfImportUpload/
    // dxfImportStatus ниже — часть SyncModal (импорт кривых из DXF), не вынесены,
    // остаются здесь.

    async proposal(params, combo) {
        const res = await apiFetch(`${BASE}/proposal/`, {
            method: 'POST',
            body: JSON.stringify({ params, combo }),
        });
        return res;  // raw response — caller делает blob()
    },

    async accessories(productIds) {
        const res = await apiFetch(`${BASE}/accessories/`, {
            method: 'POST',
            body: JSON.stringify({ product_ids: productIds }),
        });
        return { ok: res.ok, data: await res.json() };
    },

    // Proposals (журнал подборов)
    async proposalsList(params = {}) {
        const query = new URLSearchParams();
        if (params.customer) query.set('customer', params.customer);
        if (params.type) query.set('type', params.type);
        if (params.status) query.set('status', params.status);
        const qs = query.toString();
        const res = await apiFetch(`${BASE}/proposals/${qs ? '?' + qs : ''}`);
        return { ok: res.ok, data: await res.json() };
    },

    async proposalsCreate(payload) {
        const res = await apiFetch(`${BASE}/proposals/`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async proposalsUpdate(id, payload) {
        const res = await apiFetch(`${BASE}/proposals/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
        return { ok: res.ok, data: await res.json() };
    },

    async proposalsByNumber(number) {
        const res = await apiFetch(`${BASE}/proposals/by-number/?n=${encodeURIComponent(number)}`);
        return { ok: res.ok, data: await res.json() };
    },

    async proposalsDetail(id) {
        const res = await apiFetch(`${BASE}/proposals/${id}/`);
        return { ok: res.ok, data: await res.json() };
    },

    async dxfImportUpload(files, product = '', temperature = 20.0, autoDetect = true, merge = false, configFile = null) {
        const formData = new FormData()
        files.forEach(f => formData.append('files', f))
        if (configFile) formData.append('files', configFile)  // config.json идёт как обычный файл
        if (product) formData.append('product', product)
        formData.append('temperature', String(temperature))
        formData.append('auto_detect_d_ratio', String(autoDetect))
        formData.append('merge', String(merge))
        const res = await apiFetch(`${BASE}/fan-chart-import/upload/`, {
            method: 'POST',
            body: formData,
        })
        return { ok: res.ok, data: await res.json() }
    },
    
    // Проверка существования графика перед загрузкой
    async dxfCheckExists(product, dRatio = null, temperature = 20.0) {
        const params = new URLSearchParams({ product, temperature: String(temperature) });
        if (dRatio !== null) params.set('d_ratio', String(dRatio));
        const res = await apiFetch(`${BASE}/fan-charts/?${params}`);
        return { ok: res.ok, data: await res.json() };
    },
    
    async dxfImportStatus(taskId) {
        const res = await apiFetch(`${BASE}/fan-chart-import/${taskId}/status/`);
        return { ok: res.ok, data: await res.json() };
    },

    // Персональный конфиг подбора
    async getConfig() {
        const res = await apiFetch(`${BASE}/config/me/`);
        return { ok: res.ok, data: await res.json() };
    },

    async updateConfig(payload) {
        const res = await apiFetch(`${BASE}/config/me/`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
        return { ok: res.ok, data: await res.json() };
    },

    // Доступные опции для ручного режима
    async availableOptions(series, design, heatType, ip) {
        const params = new URLSearchParams({
            series,
            design,
            heat_type: heatType,
            ip: String(ip),
        });
        const res = await apiFetch(`${BASE}/available-options/me/?${params}`);
        return { ok: res.ok, data: await res.json() };
    },

    async allOptions() {
        const res = await apiFetch(`${BASE}/available-options/me/?all_options=1`);
        return { ok: res.ok, data: await res.json() };
    },
};