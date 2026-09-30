import { useState, useEffect, useRef } from 'react';
import { mediaApi } from '../../api/media';
import { useAuth } from '../../contexts/AuthContext';
import { envelopeError, fmtDate } from '../../utils';
import { can, PERM } from '../../utils/permissions';

const KIND_LABEL = { declaration: 'декларация', certificate: 'сертификат' };

// Локальная дата «гггг-мм-дд» — valid_until приходит датой без времени, сравниваем строками
function todayIso() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function StatusBadge({ registry }) {
  if (registry.id) {
    const label = `В реестре · ${KIND_LABEL[registry.kind] || registry.kind} ${registry.id}`;
    return registry.url ? (
      <a href={registry.url} target="_blank" rel="noopener noreferrer"
        className="text-emerald-600 dark:text-emerald-400 hover:underline">
        {label} ↗
      </a>
    ) : <span className="text-emerald-600 dark:text-emerald-400">{label}</span>;
  }
  if (registry.checked_at) {
    return (
      <span className="text-amber-600 dark:text-amber-400"
        title="Запись появляется в реестре на следующий день после регистрации; портал перепроверяет ежедневно в 05:00">
        Не найдено в реестре
      </span>
    );
  }
  return <span className="text-gray-400 dark:text-gray-500">Ещё не проверялось</span>;
}

// ── Привязка документа к записи реестра Росаккредитации ───────────────────
// registry — блок из GET documents/ (null не передаём: тип не ведётся в реестре)

export default function RegistryBlock({ docId, registry: initial, onDocNumberChange }) {
  const { user } = useAuth();
  const canEdit = can(user, PERM.PORTAL_DOCUMENTS_REGISTRY_EDIT);
  const [registry, setRegistry] = useState(initial);
  const [busy, setBusy] = useState(null); // 'resolve' | 'save' | null
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { setRegistry(initial); }, [initial]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const run = async (kind, call) => {
    setBusy(kind);
    setError('');
    const { ok, status, data } = await call();
    setBusy(null);
    if (!ok || !data?.success) { setError(envelopeError(data, status)); return null; }
    setRegistry(data.data);
    return data.data;
  };

  const handleResolve = async () => {
    const res = await run('resolve', () => mediaApi.resolveDocumentRegistry(docId));
    if (res?.doc_number) onDocNumberChange?.(res.doc_number);
  };

  const handleSave = async (value) => {
    const res = await run('save', () => mediaApi.setDocumentRegistry(docId, value));
    if (res) { setEditing(false); setDraft(''); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (draft.trim()) handleSave(draft.trim()); }
    if (e.key === 'Escape') { setEditing(false); setDraft(''); setError(''); }
  };

  const expired = registry.valid_until && registry.valid_until < todayIso();
  const btnCls = 'text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors disabled:opacity-50';

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-1.5 text-xs
                    border-b border-gray-100 dark:border-gray-800">
      <span className="text-gray-500 dark:text-gray-400">Реестр Росаккредитации:</span>
      <StatusBadge registry={registry} />

      {registry.valid_until && (
        <span className={expired ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}>
          {expired ? 'истёк' : 'действует до'} {fmtDate(registry.valid_until)}
        </span>
      )}
      {registry.checked_at && (
        <span className="text-gray-400 dark:text-gray-500">
          проверено {fmtDate(registry.checked_at, true)}
        </span>
      )}

      {canEdit && (
        <div className="flex items-center gap-3 ml-auto">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => { if (!draft.trim()) setEditing(false); }}
              disabled={busy === 'save'}
              placeholder="id записи или ссылка, Enter — сохранить"
              className="w-72 bg-transparent border-b border-blue-400 focus:outline-none
                         text-gray-900 dark:text-white py-0 leading-tight"
            />
          ) : (
            <button onClick={() => setEditing(true)} disabled={!!busy} className={btnCls}>
              Указать вручную
            </button>
          )}
          {registry.id && !editing && (
            <button onClick={() => handleSave(null)} disabled={!!busy}
              className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50">
              Сбросить
            </button>
          )}
          <button onClick={handleResolve} disabled={!!busy} className={btnCls}>
            {busy === 'resolve' ? 'Проверка в реестре…' : 'Проверить в реестре'}
          </button>
        </div>
      )}

      {error && <span className="w-full text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
