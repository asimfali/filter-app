import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { mediaApi } from '../api/media';
import { can } from '../utils/permissions';
import CreateFilterModal from '../components/media/CreateFilterModal.jsx';
import { canPreview3D } from '../utils/fileUtils';
import { useCommonDocUpload } from '../hooks/useDocUpload';
import DirectProductsPanel from '../components/media/DirectProductsPanel';
import FiltersPanel from '../components/media/FiltersPanel';
import { IconFolder, IconImage } from '../components/common/Icons';

const MEDIA = '/media';

// ── Иконки ────────────────────────────────────────────────────────────────

function PdfIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586
           a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function ChevronIcon({ className = "w-3 h-3" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ── Хуки ──────────────────────────────────────────────────────────────────

function useDocuments(search) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (q = '') => {
    setLoading(true);
    setError('');
    try {
      const { ok, data } = await mediaApi.getDocuments(q);
      if (ok) setDocuments(data.documents || []);
      else setError('Ошибка загрузки документов');
    } catch {
      setError('Ошибка загрузки документов');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(''); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load(search), 350);
    return () => clearTimeout(t);
  }, [search, load]);

  return { documents, loading, error, reload: () => load(search) };
}

function useFormData() {
  const [docTypes, setDocTypes] = useState([]);
  const [axes, setAxes] = useState([]);

  useEffect(() => {
    mediaApi.getFormData()
      .then(({ ok, data }) => {
        if (ok) {
          setDocTypes(data.doc_types || []);
          setAxes(data.axes || []);   // ← добавить
        }
      });
  }, []);

  return { docTypes, axes };   // ← добавить axes
}

function DropZone({ docTypeId, externalId, onUploaded }) {
  const [draggingOver, setDraggingOver] = useState(false);
  const { upload, uploading, uploadResult } = useCommonDocUpload({ onUploaded });

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(false);
    await upload(e.dataTransfer.files[0], docTypeId, externalId);
  };

  return (
    <div
      className={`flex items-center justify-center rounded-lg
                      border-2 border-dashed py-4 px-3 transition-colors cursor-default
                      ${draggingOver
          ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700'
        }`}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDraggingOver(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDraggingOver(false); }}
      onDrop={handleDrop}
    >
      {uploading ? (
        <span className="text-xs text-gray-400">Загрузка...</span>
      ) : uploadResult ? (
        <span className={`text-xs ${uploadResult.ok
          ? 'text-green-600 dark:text-green-400'
          : 'text-red-500'}`}>
          {uploadResult.message}
        </span>
      ) : draggingOver ? (
        <span className="text-xs text-blue-500">Отпустите для загрузки</span>
      ) : (
        <span className="text-xs text-gray-300 dark:text-gray-600">
          Файлов нет — перетащите для загрузки
        </span>
      )}
    </div>
  );
}

// ── Строка файла ──────────────────────────────────────────────────────────
function FileRow({ file, siblings = [], dimmed = false, canDelete = false,
  onDeleted, onOpenViewer, docTypeId, externalId }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draggingOver, setDraggingOver] = useState(false);
  const { upload, uploading, uploadResult } = useCommonDocUpload({ onUploaded: onDeleted });

  const getMtlPath = () => {
    if (!file.name.toLowerCase().endsWith('.obj')) return null;
    const baseName = file.name.replace(/\.obj$/i, '');
    const mtl = siblings.find(s =>
      s.name.toLowerCase() === `${baseName.toLowerCase()}.mtl`
    );
    return mtl?.rel_path || null;
  };

  const handleClick = async (e) => {
    e.preventDefault();

    const name = file.name.toLowerCase();
    const isImage = /\.(jpg|jpeg|png|webp)$/.test(name);
    const isPdf = name.endsWith('.pdf');
    const is3D = canPreview3D(name);

    if (is3D) {
      // Открыть в 3D редакторе
      onOpenViewer?.({
        relPath: file.rel_path,
        fname: file.name,
        mtlPath: getMtlPath(),
      });
      return;
    }

    if (isPdf || isImage) {
      // Открыть в новой вкладке
      const res = await mediaApi.downloadFile(file.rel_path);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }

    // Всё остальное — скачать
    const res = await mediaApi.downloadFile(file.rel_path);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    if (!confirming) { setConfirming(true); return; }
    setDeleting(true);
    const { ok } = await mediaApi.deleteFile(file.rel_path);
    if (ok) onDeleted?.();
    else setDeleting(false);
    setConfirming(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(true);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDraggingOver(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(false);
    await upload(e.dataTransfer.files[0], docTypeId, externalId);
  };

  return (
    <div
      className={`flex flex-col py-2 px-3 rounded-lg transition-colors group
       ${draggingOver
          ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-400'
          : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
        }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between">
        <a href="#" onClick={handleClick} className="flex items-center gap-2 flex-1 min-w-0">
          {/* Иконка зависит от типа */}
          {(() => {
            const name = file.name.toLowerCase();
            if (canPreview3D(name)) return <span className="text-violet-400 shrink-0">◈</span>;
            if (/\.(jpg|jpeg|png|webp)$/.test(name)) return <IconImage className="text-green-400 shrink-0 w-4 h-4" />;
            if (name.endsWith('.pdf')) return <PdfIcon className={`w-5 h-5 shrink-0 ${dimmed ? 'text-gray-300 dark:text-gray-600' : 'text-red-400'}`} />;
            return <IconFile className="text-gray-400 shrink-0 w-4 h-4" />;
          })()}
          <span className={`text-sm truncate ${dimmed
            ? 'text-gray-400 dark:text-gray-500'
            : 'text-gray-700 dark:text-gray-300'}`}>
            {file.name}
          </span>
        </a>

        <div className="flex items-center gap-3 shrink-0 ml-3">
          {uploading ? (
            <span className="text-xs text-gray-400">···</span>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {file.size}
            </span>
          )}
          <span className="text-xs text-blue-500
                    opacity-0 group-hover:opacity-100 transition-opacity">
            Скачать ↓
          </span>
          {canDelete && (
            confirming ? (
              <div className="flex items-center gap-1">
                <button onClick={handleDelete} disabled={deleting}
                  className="text-xs text-red-600 hover:text-red-800
                              font-medium transition-colors">
                  {deleting ? '···' : 'Удалить?'}
                </button>
                <button onClick={() => setConfirming(false)}
                  className="text-xs text-gray-400 hover:text-gray-600
                              transition-colors">
                  Отмена
                </button>
              </div>
            ) : (
              <button onClick={handleDelete}
                className="text-xs text-gray-300 hover:text-red-500
                          opacity-0 group-hover:opacity-100 transition-all">
                ✕
              </button>
            )
          )}
        </div>
      </div>

      {uploadResult && (
        <div className={`mt-1 text-xs px-1 ${uploadResult.ok
          ? 'text-green-600 dark:text-green-400'
          : 'text-red-500 dark:text-red-400'}`}>
          {uploadResult.message}
        </div>
      )}

      {draggingOver && (
        <div className="mt-1 text-xs text-blue-500 dark:text-blue-400 px-1">
          Отпустите для добавления файла
        </div>
      )}
    </div>
  );
}

// ── Карточка документа ────────────────────────────────────────────────────

function DocumentCard({ item, canDelete, canManageFilters, axes, onDeleted, onOpenViewer }) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(item.filters || []);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteDocument = async () => {
    if (!confirming) { setConfirming(true); return; }
    setDeleting(true);
    const { ok } = await mediaApi.deleteDocument(item.id);
    if (ok) onDeleted?.();
    else { setDeleting(false); setConfirming(false); }
  };

  const handleRemoveFilter = async (filterId) => {
    setRemovingId(filterId);
    const { ok } = await mediaApi.removeFilterFromDocument(item.id, filterId);
    if (ok) setFilters(prev => prev.filter(f => f.id !== filterId));
    setRemovingId(null);
  };

  const handleFilterCreated = (newFilter) => {
    setFilters(prev => [...prev, newFilter]);
    setShowCreateModal(false);
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm
                      border border-gray-200 dark:border-gray-700 overflow-hidden">

      {/* Название документа */}
      {item.name && (
        <div className="px-5 pt-3 pb-1 text-sm font-medium
                        text-gray-900 dark:text-white">
          {item.name}
        </div>
      )}

      <FiltersPanel
        entityId={item.id}
        entityType="document"
        initialFilters={item.filters || []}
        axes={axes}
        canWrite={canManageFilters}
      />

      <DirectProductsPanel
        entityId={item.id}
        entityType="document"
        canWrite={canManageFilters}
      />

      {/* Файлы */}
      <div className="px-5 py-3 space-y-1">
        {item.current.length === 0 ? (
          <DropZone
            docTypeId={item.doc_type.id}
            externalId={item.external_id}
            onUploaded={onDeleted}
          />
        ) : (
          item.current.map(f =>
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
          )
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

function DocumentGroup({ typeName, items, canDelete, canManageFilters, axes, onDeleted, onOpenViewer }) {
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
function declDocs(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return 'документов';
  if (mod10 === 1) return 'документ';
  if (mod10 >= 2 && mod10 <= 4) return 'документа';
  return 'документов';
}

function BulkCreateForm({ docTypes, onCreated }) {
  const [docTypeId, setDocTypeId] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!docTypeId || !lines.length) return;

    setLoading(true);
    setResult(null);

    const { ok, data } = await mediaApi.bulkCreateDocuments(docTypeId, lines);

    if (ok) {
      setResult(data);
      if (data.created > 0) {
        setText('');
        onCreated();
      }
    } else {
      setResult({ success: false, error: data.error });
    }
    setLoading(false);
  };

  const sel = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm " +
    "bg-white dark:bg-neutral-800 text-gray-900 dark:text-white " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Тип документа */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Тип документа
        </label>
        <select required value={docTypeId} onChange={e => setDocTypeId(e.target.value)}
          className={sel}>
          <option value="">— выберите —</option>
          {docTypes.map(dt => (
            <option key={dt.id} value={dt.id}>{dt.name}</option>
          ))}
        </select>
      </div>

      {/* Текстареа */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          External ID — каждый с новой строки
        </label>
        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setResult(null); }}
          rows={6}
          placeholder={"passport-001\npassport-002\npassport-003"}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2
                     text-sm bg-white dark:bg-neutral-800 text-gray-900 dark:text-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500
                     resize-none font-mono"
        />
        {lines.length > 0 && (
          <div className="text-xs text-gray-400 mt-1">{lines.length} записей</div>
        )}
      </div>

      {/* Результат */}
      {result && (
        <div className="space-y-1">
          {result.created > 0 && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200
                            px-3 py-2 rounded-lg">
              ✓ Создано: {result.created}
              {result.skipped > 0 && ` · Уже существовало: ${result.skipped}`}
            </div>
          )}
          {result.skipped > 0 && result.created === 0 && (
            <div className="text-xs text-gray-500 bg-neutral-50 border border-gray-200
                            px-3 py-2 rounded-lg">
              Все {result.skipped} записей уже существуют
            </div>
          )}
          {result.errors?.map((err, i) => (
            <div key={i} className="text-xs text-red-700 bg-red-50 border border-red-200
                                    px-3 py-2 rounded-lg">
              ✗ {err}
            </div>
          ))}
        </div>
      )}

      <button type="submit" disabled={loading || !docTypeId || !lines.length}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                   text-white text-sm font-medium py-2 rounded-lg transition-colors">
        {loading ? 'Создание...' : `Создать ${lines.length || ''} записей`}
      </button>
    </form>
  );
}

// ── Форма загрузки ────────────────────────────────────────────────────────

function UploadForm({ docTypes, onUploaded }) {
  const [form, setForm] = useState({ doc_type_id: '', external_id: '' });
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (!form.doc_type_id || query.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const { ok, data } = await mediaApi.searchDocuments(form.doc_type_id, query);
      if (ok) setSuggestions(data.results || []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, form.doc_type_id]);

  const handleDocTypeChange = (e) => {
    setForm(f => ({ ...f, doc_type_id: e.target.value, external_id: '' }));
    setQuery('');
    setSuggestions([]);
    setIsNew(false);
  };

  const handleSelect = (doc) => {
    setForm(f => ({ ...f, external_id: doc.external_id }));
    setQuery(doc.external_id);
    setSuggestions([]);
    setIsNew(false);
  };

  const handleCreateNew = () => {
    setForm(f => ({ ...f, external_id: query }));
    setSuggestions([]);
    setIsNew(true);
  };

  const handleFile = (f) => {
    const ALLOWED_TYPES = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp',
      'model/stl', 'application/octet-stream',
      'model/gltf+json', 'model/gltf-binary',
      'text/plain',
      'application/step', 'application/stp', // STEP MIME (редко)
    ];

    const name = f?.name?.toLowerCase() || '';
    const isStl = name.endsWith('.stl');  // ← S заглавная
    const isObj = name.endsWith('.obj');
    const isMtl = name.endsWith('.mtl');
    const isGltf = name.endsWith('.gltf');
    const isGlb = name.endsWith('.glb');
    const isStep = name.endsWith('.step') || name.endsWith('.stp');
    const isRvt = name.endsWith('.rvt') || name.endsWith('.rfa');

    if (!ALLOWED_TYPES.includes(f?.type) && !isStl && !isObj && !isMtl
      && !isGltf && !isGlb && !isStep && !isRvt) {
      setResult({ success: false, message: 'Допустимы PDF, изображения, STL, OBJ, GLTF, GLB, STEP и RVT/RFA' });
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { setResult({ success: false, message: 'Выберите файл' }); return; }
    if (!form.external_id) { setResult({ success: false, message: 'Укажите документ' }); return; }

    setLoading(true);
    setResult(null);

    const { ok, data } = await mediaApi.uploadDocument(
      form.doc_type_id,
      form.external_id,
      file,
    );

    if (ok && data.success) {
      // ← заменить блок с setResult
      if (data.converting) {
        setResult({
          success: true,
          message: `STEP загружен — конвертация в GLB ~30 сек, обновите страницу позже`
        });
      } else {
        setResult({ success: true, message: `Загружен: ${data.path}` });
      }
      setFile(null);
      setForm({ doc_type_id: '', external_id: '' });
      setQuery('');
      setIsNew(false);
      onUploaded();
    } else {
      setResult({ success: false, message: data.error });
    }
    setLoading(false);
  };

  const sel = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm " +
    "bg-white dark:bg-neutral-800 text-gray-900 dark:text-white " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Тип документа
        </label>
        <select required value={form.doc_type_id}
          onChange={handleDocTypeChange}
          className={sel}>
          <option value="">— выберите —</option>
          {docTypes.map(dt => (
            <option key={dt.id} value={dt.id}>{dt.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Документ
        </label>
        <div className="relative">
          <input
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setForm(f => ({ ...f, external_id: '' }));
              setIsNew(false);
            }}
            placeholder={form.doc_type_id ? 'Введите название...' : 'Сначала выберите тип'}
            disabled={!form.doc_type_id}
            className={sel}
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">···</span>
          )}

          {(suggestions.length > 0 || (query.length >= 2 && !isNew && !form.external_id)) && (
            <div className="absolute top-full left-0 right-0 mt-1 z-20
                            bg-white dark:bg-neutral-900
                            border border-gray-200 dark:border-gray-700
                            rounded-lg shadow-lg overflow-hidden">
              {suggestions.map(doc => (
                <button key={doc.id} type="button"
                  onClick={() => handleSelect(doc)}
                  className="w-full text-left px-3 py-2 text-sm
                             hover:bg-neutral-50 dark:hover:bg-neutral-800
                             border-b border-gray-100 dark:border-gray-800
                             last:border-0 text-gray-800 dark:text-gray-200">
                  {doc.external_id}
                  <span className="ml-2 text-xs text-blue-500">обновить</span>
                </button>
              ))}
              {query.length >= 2 && (
                <button type="button"
                  onClick={handleCreateNew}
                  className="w-full text-left px-3 py-2 text-sm
                             hover:bg-neutral-50 dark:hover:bg-neutral-800
                             text-green-600 dark:text-green-400">
                  + Создать «{query}»
                </button>
              )}
            </div>
          )}
        </div>

        {form.external_id && (
          <div className={`mt-1.5 text-xs px-2 py-1 rounded ${isNew
            ? 'text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400'
            : 'text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400'
            }`}>
            {isNew ? '+ Новый документ' : '↻ Обновление существующего'}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          PDF файл
        </label>
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => document.getElementById('fileInput').click()}
          className={`relative border-2 border-dashed rounded-lg p-6 text-center
                      cursor-pointer transition-colors ${dragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
            }`}>
          <input id="fileInput" type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.stl,.obj,.mtl,.gltf,.glb,.step,.stp,.rvt,.rfa"
            className="hidden"
            onChange={e => handleFile(e.target.files[0])} />
          {file ? (
            <div className="flex items-center justify-center gap-2 text-sm
                            text-green-700 dark:text-green-400">
              <span>✓</span>
              <span className="truncate max-w-xs">{file.name}</span>
              <button type="button"
                onClick={e => { e.stopPropagation(); setFile(null); }}
                className="text-gray-400 hover:text-red-500 ml-1">✕</button>
            </div>
          ) : (
            <>
              <PdfIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Перетащите файл сюда</p>
              <p className="text-xs text-gray-400 mt-1">PDF, изображение, 3D модель (stl, glb, obj), STEP (конвертируется в GLB) или BIM модель (rvt, rfa)</p>
            </>
          )}
        </div>
      </div>

      {result && (
        <div className={`text-xs px-3 py-2 rounded-lg ${result.success
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
          {result.success ? '✓ ' : '✗ '}{result.message}
        </div>
      )}

      <button type="submit" disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                   text-white text-sm font-medium py-2 rounded-lg transition-colors">
        {loading ? 'Загрузка...' : 'Загрузить'}
      </button>
    </form>
  );
}

// ── Главная страница ──────────────────────────────────────────────────────

export default function DocumentsPage({ onOpenViewer, onFolderUpload }) {
  const { user } = useAuth();
  const canUpload = can(user, 'portal.documents.upload');
  const canDelete = can(user, 'portal.documents.delete');
  const canUploadGallery = can(user, 'portal.gallery.upload');
  const canDeleteGallery = can(user, 'portal.gallery.delete');
  const canManageFilters = can(user, 'portal.documents.upload');
  const [uploadMode, setUploadMode] = useState('single');

  // ← сначала search
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  // ← потом хук который search использует
  const { documents, loading, error, reload } = useDocuments(search);
  const { docTypes, axes } = useFormData();

  // Группировка по типу документа
  const groups = documents.reduce((acc, doc) => {
    const key = doc.doc_type?.name ?? 'Без типа';
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  const totalCount = documents.length;

  return (
    <div className="space-y-4">
      {/* Шапка */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4
                      flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Документы</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Паспорта, сертификаты и другие документы
          </p>
        </div>
        {canUpload && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowUpload(o => !o)}
              className={`text-sm px-4 py-2 rounded-lg transition-colors ${showUpload
                ? 'bg-neutral-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}>
              {showUpload ? '← Назад' : '+ Загрузить'}
            </button>
            <button onClick={onFolderUpload}
              className="text-sm px-4 py-2 rounded-lg transition-colors
                       bg-neutral-100 dark:bg-neutral-800
                       text-gray-700 dark:text-gray-300
                       hover:bg-neutral-200 dark:hover:bg-neutral-700">
              <IconFolder /> Из папки
            </button>
          </div>
        )}
      </div>

      {showUpload ? (
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-5 max-w-lg">
          {/* Переключатель */}
          <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg w-fit mb-4">
            <button onClick={() => setUploadMode('single')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${uploadMode === 'single'
                ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800'
                }`}>
              Загрузить файл
            </button>
            <button onClick={() => setUploadMode('bulk')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${uploadMode === 'bulk'
                ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800'
                }`}>
              Добавить несколько
            </button>
          </div>

          {uploadMode === 'single' && (
            <>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Загрузка документа
              </h3>
              <UploadForm
                docTypes={docTypes}
                onUploaded={() => { reload(); setShowUpload(false); }}
              />
            </>
          )}
          {uploadMode === 'bulk' && (
            <>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Пакетное создание документов
              </h3>
              <BulkCreateForm
                docTypes={docTypes}
                onCreated={reload}
              />
            </>
          )}
        </div>
      ) : (
        <>
          {/* Поиск */}
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-4 py-3">
            <div className="relative">
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск по типу, оси, значению..."
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg
                 px-3 py-2 text-sm bg-white dark:bg-neutral-800
                 text-gray-900 dark:text-white
                 placeholder-gray-400 dark:placeholder-gray-500
                 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {loading && search && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2
                       text-gray-400 text-xs animate-pulse">···</span>
              )}
            </div>
          </div>

          {/* Контент */}
          {loading ? (
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-8
                            text-center text-gray-400 dark:text-gray-500 text-sm">
              Загрузка...
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800
                            rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          ) : totalCount === 0 ? (
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-8 text-center">
              <p className="text-gray-400 dark:text-gray-500 text-sm mb-3">
                {search ? 'Ничего не найдено' : 'Документов пока нет'}
              </p>
              {!search && canUpload && (
                <button onClick={() => setShowUpload(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm
                             px-4 py-2 rounded-lg transition-colors">
                  + Загрузить первый документ
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Счётчик */}
              <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
                Найдено: {totalCount} {declDocs(totalCount)}
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="ml-3 text-blue-500 hover:text-blue-700 transition-colors"
                  >
                    Сбросить ×
                  </button>
                )}
              </div>

              {/* Группы */}
              {Object.entries(groups).map(([typeName, items]) => (
                <DocumentGroup
                  key={typeName}
                  typeName={typeName}
                  items={items}
                  canDelete={canDelete}
                  canManageFilters={canManageFilters}
                  axes={axes}
                  onDeleted={reload}
                  onOpenViewer={onOpenViewer}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}