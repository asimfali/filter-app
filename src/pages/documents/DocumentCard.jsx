import { useState, useEffect, useRef } from 'react';
import { mediaApi } from '../../api/media';
import DirectProductsPanel from '../../components/media/DirectProductsPanel';
import FiltersPanel from '../../components/media/FiltersPanel';
import { ChevronIcon } from './icons';
import FileRow, { DropZone, AddFileRow } from './FileRow';

function EditableName({ value, onSave, canEdit, placeholder }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (trimmed === (value || '')) { setEditing(false); return; }
    setSaving(true);
    await onSave(trimmed);
    setSaving(false);
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); }
  };

  if (!canEdit) {
    return (
      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
        {value || placeholder}
      </div>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={saving}
        className="text-sm font-medium text-gray-900 dark:text-white
                   bg-transparent border-b border-blue-400
                   focus:outline-none w-full py-0 leading-tight"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-sm font-medium text-left truncate
                 text-gray-900 dark:text-white
                 hover:text-blue-500 dark:hover:text-blue-400
                 transition-colors"
      title="Нажмите, чтобы изменить название">
      {value || <span className="text-gray-400 italic">{placeholder}</span>}
    </button>
  );
}

// ── Карточка документа ────────────────────────────────────────────────────

export default function DocumentCard({ item, canDelete, canManageFilters, axes, onDeleted, onOpenViewer }) {
  const isStandalone = item.doc_type?.upload_mode === 'standalone';
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [docName, setDocName] = useState(item.name || '');   // ← добавлено

  const handleDeleteDocument = async () => {
    if (!confirming) { setConfirming(true); return; }
    setDeleting(true);
    const { ok } = await mediaApi.deleteDocument(item.id);
    if (ok) onDeleted?.();
    else { setDeleting(false); setConfirming(false); }
  };

  const handleRename = async (newName) => {
    const { ok, data } = await mediaApi.renameDocument(item.id, newName);
    if (ok && data.success) setDocName(data.name);
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm
                      border border-gray-200 dark:border-gray-700 overflow-hidden">

      {!isStandalone && (
        <div className="flex items-center gap-3 px-5 pt-3 pb-1
                        border-b border-gray-100 dark:border-gray-800">
          {/* Название — компактно, в одну строку с фильтрами */}
          <div className="shrink-0 max-w-[40%]">
            <EditableName
              value={docName}
              onSave={handleRename}
              canEdit={canManageFilters}
              placeholder={`${item.doc_type?.name || 'Документ'} ${item.external_id}`}
            />
          </div>

          <div className="flex-1 min-w-0 overflow-x-auto">
            <FiltersPanel
              entityId={item.id}
              entityType="document"
              initialFilters={item.filters || []}
              axes={axes}
              canWrite={canManageFilters}
            />
          </div>

          {canDelete && item.current.length === 0 && (
            confirming ? (
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={handleDeleteDocument} disabled={deleting}
                  className="text-xs text-red-600 hover:text-red-800 font-medium transition-colors">
                  {deleting ? '···' : 'Удалить документ?'}
                </button>
                <button onClick={() => setConfirming(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  Отмена
                </button>
              </div>
            ) : (
              <button onClick={handleDeleteDocument}
                className="text-xs text-gray-300 hover:text-red-500 transition-colors shrink-0">
                ✕
              </button>
            )
          )}
        </div>
      )}

      {!isStandalone && (
        <DirectProductsPanel
          entityId={item.id}
          entityType="document"
          canWrite={canManageFilters}
        />
      )}

      {/* Файлы */}
      <div className="px-5 py-3 space-y-1">
        {item.current.length === 0 ? (
          <DropZone
            docTypeId={item.doc_type.id}
            externalId={item.external_id}
            onUploaded={onDeleted}
          />
        ) : (
          <>
            {item.current.map(f =>
              <FileRow
                key={f.rel_path}
                file={f}
                siblings={item.current}
                docTypeId={item.doc_type.id}
                externalId={item.external_id}
                canDelete={canDelete}
                onDeleted={onDeleted}
                onOpenViewer={onOpenViewer}
              />
            )}
            <AddFileRow
              docTypeId={item.doc_type.id}
              externalId={item.external_id}
              onUploaded={onDeleted}
            />
          </>
        )}

        {item.archive_visible && Object.keys(item.archive).length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setArchiveOpen(o => !o)}
              className="flex items-center gap-1.5 text-xs text-gray-400
                                     dark:text-gray-500 hover:text-gray-600
                                     dark:hover:text-gray-300 transition-colors px-3 py-1">
              <ChevronIcon className={`w-3 h-3 transition-transform
                                                   ${archiveOpen ? 'rotate-90' : ''}`} />
              Архив
            </button>
            {archiveOpen && (
              <div className="mt-1 ml-3">
                {Object.entries(item.archive).map(([date, files]) => (
                  <div key={date} className="mb-2">
                    <div className="text-xs text-gray-400 dark:text-gray-500
                                                      px-3 py-1">
                      {date}
                    </div>
                    {files.map(f =>
                      <FileRow
                        key={f.rel_path}
                        file={f}
                        siblings={[]}
                        docTypeId={item.doc_type.id}
                        externalId={item.external_id}
                        dimmed
                        canDelete={canDelete}
                        onDeleted={onDeleted}
                        onOpenViewer={onOpenViewer}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Группа документов одного типа ─────────────────────────────────────────

export function DocumentGroup({ typeName, items, canDelete, canManageFilters, axes, onDeleted, onOpenViewer }) {
  const [collapsed, setCollapsed] = useState(true);
  return (
    <div className="space-y-2">
      <button onClick={() => setCollapsed(o => !o)}
        className="w-full flex items-center gap-2 px-1 py-1 group">
        <ChevronIcon className={`w-4 h-4 text-gray-400 transition-transform shrink-0
                                       ${collapsed ? '' : 'rotate-90'}`} />
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300
                               uppercase tracking-wide">
          {typeName}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 font-normal normal-case">
          {items.length} {declDocs(items.length)}
        </span>
        <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700 ml-2" />
      </button>
      {!collapsed && (
        <div className="space-y-3 pl-2">
          {items.map(item =>
            <DocumentCard
              key={item.id}
              item={item}
              canDelete={canDelete}
              canManageFilters={canManageFilters}
              axes={axes}
              onDeleted={onDeleted}
              onOpenViewer={onOpenViewer}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Склонение: 1 документ / 2 документа / 5 документов */
export function declDocs(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return 'документов';
  if (mod10 === 1) return 'документ';
  if (mod10 >= 2 && mod10 <= 4) return 'документа';
  return 'документов';
}
