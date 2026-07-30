import { useState, useEffect, useCallback } from 'react';
import { apiFetch, authApi } from '../api/auth';
import { unwrapList } from '../utils';

export const API = '/api/v1/auth';

// ── Утилиты ───────────────────────────────────────────────────────────────

function flattenDepartments(departments, level = 0) {
    const result = [];
    for (const dept of departments) {
        result.push({ ...dept, _level: level });
        if (dept.children?.length) {
            result.push(...flattenDepartments(dept.children, level + 1));
        }
    }
    return result;
}

// ── Хуки ─────────────────────────────────────────────────────────────────

export function useDepartments() {
    const [departments, setDepartments] = useState([]);
    const load = useCallback(async () => {
        const res = await apiFetch(`${API}/departments/?root_only=true`);
        const data = await res.json();
        setDepartments(unwrapList(data));
    }, []);
    useEffect(() => { load(); }, [load]);

    // Дерево для DepartmentTree, плоский список для дропдаунов
    const flat = flattenDepartments(departments);

    return { departments, flat, reload: load };
}

export function useRoles() {
    const [roles, setRoles] = useState([]);
    useEffect(() => {
        apiFetch(`${API}/roles/`)
            .then(r => r.json())
            .then(data => setRoles(unwrapList(data)));
    }, []);
    return roles;
}

export function useUsers(search = '') {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const q = search ? `?search=${encodeURIComponent(search)}` : '';
        const res = await apiFetch(`${API}/users-list/${q}`);
        const data = await res.json();
        setUsers(unwrapList(data));
        setLoading(false);
    }, [search]);

    useEffect(() => {
        const t = setTimeout(load, 300);
        return () => clearTimeout(t);
    }, [load]);

    return { users, loading, reload: load };
}

export function useStaffRequests() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async (status = 'pending') => {
        setLoading(true);
        try {
            const res = await apiFetch(`${API}/staff-requests/?status=${status}`);
            const data = await res.json();
            setRequests(unwrapList(data));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load('pending'); }, [load]);

    return { requests, loading, reload: load };
}

export function useSpecMatrix(deptId) {
    const [matrix, setMatrix] = useState(null); // { roles: [], specs: [] }
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(null); // `${roleId}-${specId}`

    const load = useCallback(async () => {
        if (!deptId) return;
        setLoading(true);
        try {
            const { ok, data } = await authApi.specMatrix(deptId);
            if (ok) setMatrix(data);
        } finally {
            setLoading(false);
        }
    }, [deptId]);

    useEffect(() => { load(); }, [load]);

    const toggle = useCallback(async (roleId, specId) => {
        const key = `${roleId}-${specId}`;
        setBusy(key);
        try {
            const { ok, data } = await authApi.specToggle(deptId, roleId, specId);
            if (!ok) return;

            // Оптимистичное обновление матрицы без перезагрузки
            setMatrix(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    specs: prev.specs.map(spec => {
                        if (spec.spec_id !== specId) return spec;
                        return {
                            ...spec,
                            roles: {
                                ...spec.roles,
                                [String(roleId)]: data.action === 'created' ? data.drp_id : null,
                            },
                        };
                    }),
                };
            });
        } finally {
            setBusy(null);
        }
    }, [deptId]);

    return { matrix, loading, busy, toggle };
}

// ── Хук прав подразделения ────────────────────────────────────────────────

export function useDeptPermissions(deptId) {
    const [perms, setPerms] = useState([]);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        if (!deptId) return;
        setLoading(true);
        try {
            const res = await apiFetch(`${API}/departments/${deptId}/permissions/`);
            const data = await res.json();
            setPerms(unwrapList(data));
        } finally {
            setLoading(false);
        }
    }, [deptId]);

    useEffect(() => { load(); }, [load]);

    const add = async (roleId, permissionId) => {
        const res = await apiFetch(`${API}/departments/${deptId}/permissions/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: roleId, permission: permissionId }),
        });
        if (res.ok) await load();
        return res;
    };

    const remove = async (id) => {
        await apiFetch(`${API}/departments/${deptId}/permissions/${id}/`, {
            method: 'DELETE',
        });
        await load();
    };

    return { perms, loading, add, reload: load, remove };
}

// ── Хук всех доступных прав (для дропдауна) ───────────────────────────────

export function useAllPermissions() {
    const [permissions, setPermissions] = useState([]);
    useEffect(() => {
        apiFetch(`${API}/permissions/`)
            .then(r => r.json())
            .then(data => setPermissions(unwrapList(data)));
    }, []);
    return permissions;
}
