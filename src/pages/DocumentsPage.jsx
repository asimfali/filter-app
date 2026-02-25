import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch, tokenStorage } from '../api/auth';
const token = tokenStorage.getAccess();

const MEDIA = '/media';  // базовый URL для файлов

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

// ── Хуки ─────────────────────────────────────────────────────────────────

function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await apiFetch('/api/v1/media/documents/');
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch {
      setError('Ошибка загрузки документов');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  return { documents, loading, error, reload: load };
}

function useFormData() {
    const [docTypes, setDocTypes] = useState([]);
    const [axes, setAxes]         = useState([]);
  
    useEffect(() => {
      apiFetch('/api/v1/media/form-data/')  // ← apiFetch вместо fetch
        .then(r => r.json())
        .then(data => {
          setDocTypes(data.doc_types || []);
          setAxes(data.axes || []);
        });
    }, []);
  
    return { docTypes, axes };
  }

// ── Строка файла ─────────────────────────────────────────────────────────

function FileRow({ file, dimmed = false }) {
  const token = localStorage.getItem('access_token');

  const handleClick = async (e) => {
    e.preventDefault();
    // Получаем файл через fetch с токеном
    const res = await fetch(`/api/v1/media/download/?path=${encodeURIComponent(file.rel_path)}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);

    // Открываем в новой вкладке
    window.open(url, '_blank');

    // Освобождаем память через 60 сек
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  return (
    <a href="#" onClick={handleClick}
      className="flex items-center justify-between py-2 px-3 rounded-lg
                 hover:bg-gray-50 dark:hover:bg-gray-800 group transition-colors">
      <div className="flex items-center gap-2">
        <PdfIcon className={`w-5 h-5 shrink-0 ${dimmed ? 'text-gray-300 dark:text-gray-600' : 'text-red-400'}`} />
        <span className={`text-sm ${dimmed ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
          {file.name}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 dark:text-gray-500">{file.size}</span>
        <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
          Скачать ↓
        </span>
      </div>
    </a>
  );
}

// ── Карточка документа ────────────────────────────────────────────────────

function DocumentCard({ item }) {
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm
                    border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Заголовок */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700
                      flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
            {item.doc_type.name}
          </span>
          <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-0.5">
            {item.axis.name}
            {item.value && (
              <span className="text-gray-400 dark:text-gray-500"> = {item.value.value}</span>
            )}
          </div>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
          {item.external_id}
        </span>
      </div>

      {/* Файлы */}
      <div className="px-5 py-3 space-y-1">
        {item.current.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-2 px-3">Файлов нет</p>
        ) : (
          item.current.map(f => <FileRow key={f.rel_path} file={f} />)
        )}

        {/* Архив */}
        {item.archive_visible && Object.keys(item.archive).length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setArchiveOpen(o => !o)}
              className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500
                         hover:text-gray-600 dark:hover:text-gray-300 transition-colors px-3 py-1">
              <ChevronIcon className={`w-3 h-3 transition-transform ${archiveOpen ? 'rotate-90' : ''}`} />
              Архив
            </button>

            {archiveOpen && (
              <div className="mt-1 ml-3">
                {Object.entries(item.archive).map(([date, files]) => (
                  <div key={date} className="mb-2">
                    <div className="text-xs text-gray-400 dark:text-gray-500 px-3 py-1">
                      {date}
                    </div>
                    {files.map(f => <FileRow key={f.rel_path} file={f} dimmed />)}
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

// ── Форма загрузки ────────────────────────────────────────────────────────

function UploadForm({ docTypes, axes, onUploaded }) {
  const [form, setForm]         = useState({ doc_type_id: '', axis_id: '', value_id: '' });
  const [values, setValues]     = useState([]);
  const [file, setFile]         = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null); // { success, message }

  // Загрузка значений оси при смене
  useEffect(() => {
    if (!form.axis_id) { setValues([]); return; }
    apiFetch(`/api/v1/media/values/${form.axis_id}/`)
      .then(r => r.json())
      .then(data => setValues(data.values || []));
    setForm(f => ({ ...f, value_id: '' }));
  }, [form.axis_id]);

  const handleFile = (f) => {
    if (f?.type !== 'application/pdf') {
      setResult({ success: false, message: 'Допустимы только PDF файлы' });
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
  
    setLoading(true);
    setResult(null);
  
    const fd = new FormData();
    fd.append('doc_type_id', form.doc_type_id);
    fd.append('axis_id',     form.axis_id);
    if (form.value_id) fd.append('value_id', form.value_id);
    fd.append('file', file);
  
    try {
      const res = await fetch('/api/v1/media/upload/', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenStorage.getAccess()}` },
        body: fd,
      });
      const data = await res.json();
      if (data.success) {
        setResult({ success: true, message: `Загружен: ${data.path}` });
        setFile(null);
        setForm({ doc_type_id: '', axis_id: '', value_id: '' });
        onUploaded();
      } else {
        setResult({ success: false, message: data.error });
      }
    } catch {
      setResult({ success: false, message: 'Ошибка соединения' });
    } finally {
      setLoading(false);
    }
  };

  const sel = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm " +
              "bg-white dark:bg-gray-800 text-gray-900 dark:text-white " +
              "focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Тип документа */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Тип документа
        </label>
        <select required value={form.doc_type_id}
          onChange={e => setForm(f => ({ ...f, doc_type_id: e.target.value }))}
          className={sel}>
          <option value="">— выберите —</option>
          {docTypes.map(dt => (
            <option key={dt.id} value={dt.id}>{dt.name}</option>
          ))}
        </select>
      </div>

      {/* Ось */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Ось параметра
        </label>
        <select required value={form.axis_id}
          onChange={e => setForm(f => ({ ...f, axis_id: e.target.value }))}
          className={sel}>
          <option value="">— выберите —</option>
          {axes.map(a => (
            <option key={a.id} value={a.id}>{a.product_type__name}: {a.name}</option>
          ))}
        </select>
      </div>

      {/* Значение */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Значение <span className="text-gray-400 font-normal">(не обязательно)</span>
        </label>
        <select value={form.value_id}
          onChange={e => setForm(f => ({ ...f, value_id: e.target.value }))}
          className={sel}
          disabled={!form.axis_id}>
          <option value="">— не указывать —</option>
          {values.map(v => (
            <option key={v.id} value={v.id}>{v.value}</option>
          ))}
        </select>
      </div>

      {/* Дроп-зона */}
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
                      cursor-pointer transition-colors ${
            dragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30'
          }`}>
          <input id="fileInput" type="file" accept=".pdf" className="hidden"
            onChange={e => handleFile(e.target.files[0])} />

          {file ? (
            <div className="flex items-center justify-center gap-2 text-sm text-green-700 dark:text-green-400">
              <span>✓</span>
              <span className="truncate max-w-xs">{file.name}</span>
              <button type="button"
                onClick={e => { e.stopPropagation(); setFile(null); }}
                className="text-gray-400 hover:text-red-500 ml-1">✕</button>
            </div>
          ) : (
            <>
              <PdfIcon className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Перетащите PDF сюда</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">или кликните для выбора</p>
            </>
          )}
        </div>
      </div>

      {/* Результат */}
      {result && (
        <div className={`text-xs px-3 py-2 rounded-lg ${
          result.success
            ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
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

// ── Вспомогательные ───────────────────────────────────────────────────────

function getCsrf() {
  return document.cookie.split('; ')
    .find(r => r.startsWith('csrftoken='))
    ?.split('=')[1] || '';
}

// ── Главная страница ──────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { documents, loading, error, reload } = useDocuments();
  const { docTypes, axes }                    = useFormData();
  const [showUpload, setShowUpload]           = useState(false);
  const [search, setSearch]                   = useState('');

  const filtered = documents.filter(doc => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      doc.doc_type.name.toLowerCase().includes(q) ||
      doc.axis.name.toLowerCase().includes(q) ||
      doc.value?.value?.toLowerCase().includes(q) ||
      doc.external_id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow px-5 py-4
                      flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Документы</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Паспорта, сертификаты и другие документы
          </p>
        </div>
        <button onClick={() => setShowUpload(o => !o)}
          className={`text-sm px-4 py-2 rounded-lg transition-colors ${
            showUpload
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}>
          {showUpload ? '← Назад' : '+ Загрузить'}
        </button>
      </div>

      {showUpload ? (
        /* Форма загрузки */
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-5 max-w-lg">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Загрузка документа
          </h3>
          <UploadForm
            docTypes={docTypes}
            axes={axes}
            onUploaded={() => { reload(); setShowUpload(false); }}
          />
        </div>
      ) : (
        <>
          {/* Поиск */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow px-4 py-3">
            <input
              type="search" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по типу, оси, значению..."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg
                         px-3 py-2 text-sm bg-white dark:bg-gray-800
                         text-gray-900 dark:text-white
                         placeholder-gray-400 dark:placeholder-gray-500
                         focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Список */}
          {loading ? (
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8
                            text-center text-gray-400 dark:text-gray-500 text-sm">
              Загрузка...
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800
                            rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 text-center">
              <p className="text-gray-400 dark:text-gray-500 text-sm mb-3">
                {search ? 'Ничего не найдено' : 'Документов пока нет'}
              </p>
              {!search && (
                <button onClick={() => setShowUpload(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm
                             px-4 py-2 rounded-lg transition-colors">
                  + Загрузить первый документ
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
                Найдено: {filtered.length}
              </div>
              {filtered.map(item => (
                <DocumentCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}