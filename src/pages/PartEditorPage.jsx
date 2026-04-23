import React, { useState, useEffect, useCallback, useRef } from 'react';
import { sessionsApi } from '../api/sessions';
import { bomApi } from '../api/bom';
import { useAuth } from '../contexts/AuthContext';
import { can } from '../utils/permissions';
import SpecList from './bom/SpecList';
import SpecEditor from './bom/SpecEditor';
import FolderPicker from '../components/bom/FolderPicker';

const SESSION_TYPE = 'bom_editor';

// ─── Хук сессии ───────────────────────────────────────────────────────────────
function useBomSession() {
    const [sessionId, setSessionId] = useState(null);

    // Восстановить сессию при монтировании
    const restore = useCallback(async () => {
        const data = await sessionsApi.list(SESSION_TYPE);

        // Один объект напрямую
        const session = data?.id ? data : (Array.isArray(data) ? data[0] : data?.results?.[0]);

        if (session?.id) {
            setSessionId(session.id);
            return session.data || {};
        }
        return {};
    }, []);

    // Сохранить состояние
    const save = useCallback(async (state) => {
        if (sessionId) {
            await sessionsApi.update(sessionId, { data: state });
        } else {
            const created = await sessionsApi.create(SESSION_TYPE, 'BOM редактор', state);
            if (created?.id) {
                setSessionId(created.id);
                await sessionsApi.activate(created.id);  // ← активируем
            }
        }
    }, [sessionId]);

    return { restore, save };
}

function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}
// ─── Константы ───────────────────────────────────────────────────────────────

const STATUS_LABEL = {
    draft: 'Черновик',
    ready: 'Готова к загрузке',
    pushing: 'Загружается...',
    pushed: 'Загружена в 1С',
    push_error: 'Ошибка загрузки',
};

const STATUS_COLOR = {
    draft: 'text-gray-500 dark:text-gray-400',
    ready: 'text-emerald-600 dark:text-emerald-400',
    pushing: 'text-blue-500 dark:text-blue-400',
    pushed: 'text-emerald-700 dark:text-emerald-300',
    push_error: 'text-red-600 dark:text-red-400',
};

const PROCESS_TYPES = [
    'Сборка',
    'Изготовление, сборка',
    'Ремонт',
    'Разборка',
    'БезСпецификаций',
];

// ─── Главная страница ─────────────────────────────────────────────────────────

export default function PartEditorPage() {
    const { user } = useAuth();
    const canView = can(user, 'bom.spec.view');
    const canWrite = can(user, 'bom.spec.write');
    const canPush = can(user, 'bom.spec.push');

    const [view, setView] = useState('list'); // list | editor
    const [specs, setSpecs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSpec, setSelectedSpec] = useState(null);

    const { restore, save } = useBomSession();

    useEffect(() => {
        restore().then(async (saved) => {
            if (saved?.spec_id) {
                const { ok, data } = await bomApi.getSpec(saved.spec_id);
                if (ok && data.success) {
                    setSelectedSpec(data.data);
                    setView('editor');
                    if (canWrite) await bomApi.lockSpec(saved.spec_id);
                }
            }
        });
    }, []);

    const loadSpecs = useCallback(async (q = '') => {
        setLoading(true);
        const { ok, data } = await bomApi.getSpecs({ q });
        if (ok && data.success) setSpecs(data.data);
        setLoading(false);
    }, []);

    const handleSearch = useRef(
        debounce((q) => loadSpecs(q), 400)
    ).current;

    useEffect(() => { loadSpecs(); }, [loadSpecs]);

    const handleOpenSpec = async (specId) => {
        const { ok, data } = await bomApi.getSpec(specId);
        if (ok && data.success) {
            setSelectedSpec(data.data);
            setView('editor');
            if (canWrite) await bomApi.lockSpec(specId);
            await save({ spec_id: specId });  // ← сохраняем
        }
    };

    const handleCloseEditor = async () => {
        if (selectedSpec) await bomApi.unlockSpec(selectedSpec.id);
        setSelectedSpec(null);
        setView('list');
        await save({});  // ← очищаем
        loadSpecs();
    };

    const handleSpecSaved = (updated) => {
        setSelectedSpec(updated);
        loadSpecs();
    };

    if (view === 'editor' && selectedSpec) {
        return (
            <SpecEditor
                spec={selectedSpec}
                onClose={handleCloseEditor}
                onSaved={handleSpecSaved}
                canWrite={canWrite}
                canView={canView}
                canPush={canPush}
            />
        );
    }

    return (
        <SpecList
            specs={specs}
            loading={loading}
            canWrite={canWrite}
            canView={canView}
            onOpen={handleOpenSpec}
            onRefresh={loadSpecs}
            onSearch={handleSearch}
        />
    );
}

// ─── Вспомогательные ──────────────────────────────────────────────────────────

function Field({ label, children, span = 1 }) {
    return (
        <div className={span === 2 ? 'col-span-2' : ''}>function
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {label}
            </label>
            {children}
        </div>
    );
}
