import { useState, useEffect } from 'react';
import { mediaApi } from '../../api/media';
import { SELECT_CLS } from './constants';
import { PdfIcon } from './icons';

export default function UploadForm({ docTypes, onUploaded }) {
  const [form, setForm] = useState({ doc_type_id: '', external_id: '' });
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const selectedDocType = docTypes.find(dt => String(dt.id) === String(form.doc_type_id));
  const isStandalone = selectedDocType?.upload_mode === 'standalone';
  const [multiFiles, setMultiFiles] = useState([]);
  const [multiUploading, setMultiUploading] = useState(false);
  const [multiResults, setMultiResults] = useState([]);

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

  function isFileAllowed(f) {
    const ALLOWED_TYPES = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp',
      'video/webm', 'video/mp4',
      'model/stl', 'application/octet-stream',
      'model/gltf+json', 'model/gltf-binary',
      'text/plain',
      'application/step', 'application/stp',
    ];

    const name = f?.name?.toLowerCase() || '';
    const isStl = name.endsWith('.stl');
    const isObj = name.endsWith('.obj');
    const isMtl = name.endsWith('.mtl');
    const isGltf = name.endsWith('.gltf');
    const isGlb = name.endsWith('.glb');
    const isStep = name.endsWith('.step') || name.endsWith('.stp');
    const isRvt = name.endsWith('.rvt') || name.endsWith('.rfa');

    return ALLOWED_TYPES.includes(f?.type) || isStl || isObj || isMtl
        || isGltf || isGlb || isStep || isRvt;
  }

  const handleFile = (f) => {
    if (!isFileAllowed(f)) {
      setResult({ success: false, message: 'Допустимы PDF, изображения, STL, OBJ, GLTF, GLB, STEP и RVT/RFA' });
      return;
    }
    setFile(f);
    setResult(null);

    if (!query && f?.name) {
      const nameWithoutExt = f.name.replace(/\.[^/.]+$/, '');
      setQuery(nameWithoutExt);
      setForm(prev => ({ ...prev, external_id: nameWithoutExt }));
      setIsNew(true);
    }
  };

  const handleMultipleFiles = (files) => {
    const allowed = files.filter(isFileAllowed);
    const rejected = files.filter(f => !isFileAllowed(f));

    if (rejected.length > 0) {
      setResult({
        success: false,
        message: `Отклонены файлы (недопустимый тип): ${rejected.map(f => f.name).join(', ')}`,
      });
    }

    if (allowed.length === 0) {
      setMultiFiles([]);
      return;
    }

    setMultiFiles(allowed);
    setFile(null);
    if (rejected.length === 0) setResult(null);

    if (!query && allowed[0]?.name) {
      const nameWithoutExt = allowed[0].name.replace(/\.[^/.]+$/, '');
      setQuery(nameWithoutExt);
      setForm(prev => ({ ...prev, external_id: nameWithoutExt }));
      setIsNew(true);
    }
  };

  const handleSubmitMultiple = async (e) => {
    e.preventDefault();
    if (!multiFiles.length) return;
    if (!form.external_id) {
      setResult({ success: false, message: 'Укажите документ' });
      return;
    }

    setMultiUploading(true);
    const results = [];

    for (const f of multiFiles) {
      const { ok, data } = await mediaApi.uploadDocument(
        form.doc_type_id, form.external_id, f,
      );
      results.push({ name: f.name, ok: ok && data.success, message: data.error });
    }

    setMultiResults(results);
    setMultiUploading(false);

    if (results.every(r => r.ok)) {
      setMultiFiles([]);
      setForm({ doc_type_id: '', external_id: '' });
      setQuery('');
      setIsNew(false);
      onUploaded();
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 1) {
      handleMultipleFiles(files);
    } else {
      handleFile(files[0]);
    }
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
      setFile(null);
      setForm({ doc_type_id: '', external_id: '' });
      setQuery('');
      setIsNew(false);
      if (data.converting) {
        // Не закрываем форму сразу — пользователю нужно время прочитать
        // инструкцию про конвертацию и обновление страницы позже.
        setResult({
          success: true,
          message: `STEP загружен — конвертация в GLB ~30 сек, обновите страницу позже`
        });
      } else {
        setResult({ success: true, message: `Загружен: ${data.path}` });
        // onUploaded() закрывает форму (родитель делает setShowUpload(false)) —
        // с задержкой, чтобы сообщение об успехе успело отрендериться.
        setTimeout(onUploaded, 1500);
      }
    } else {
      setResult({ success: false, message: data.error });
    }
    setLoading(false);
  };

  return (
    <form onSubmit={multiFiles.length > 0 ? handleSubmitMultiple : handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Тип документа
        </label>
        <select required value={form.doc_type_id}
          onChange={handleDocTypeChange}
          className={SELECT_CLS}>
          <option value="">— выберите —</option>
          {docTypes.map(dt => (
            <option key={dt.id} value={dt.id}>{dt.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          {isStandalone ? 'Слаг (произвольный идентификатор)' : 'Документ'}
        </label>

        {isStandalone ? (
          <input
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setForm(f => ({ ...f, external_id: e.target.value.trim() }));
              setIsNew(true);
            }}
            placeholder="hero-1, hero-2..."
            disabled={!form.doc_type_id}
            className={SELECT_CLS}
          />
        ) : (
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
              className={SELECT_CLS}
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
        )}

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
            accept=".pdf,.jpg,.jpeg,.png,.webp,.webm,.mp4,.stl,.obj,.mtl,.gltf,.glb,.step,.stp,.rvt,.rfa"
            multiple
            className="hidden"
            onChange={e => {
              const files = Array.from(e.target.files);
              if (files.length > 1) {
                handleMultipleFiles(files);
              } else {
                handleFile(files[0]);
              }
            }} />

          {multiFiles.length > 0 ? (
            <div className="space-y-1.5 text-left">
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-2">
                {multiFiles.length} файлов выбрано
              </p>
              {multiFiles.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-sm
                                    text-green-700 dark:text-green-400">
                  <span className="truncate max-w-[200px]">{f.name}</span>
                  {multiResults[i] && (
                    <span className={multiResults[i].ok ? 'text-green-500' : 'text-red-500 text-xs'}>
                      {multiResults[i].ok ? '✓' : `✗ ${multiResults[i].message}`}
                    </span>
                  )}
                </div>
              ))}
              <button type="button"
                onClick={(e) => { e.stopPropagation(); setMultiFiles([]); setMultiResults([]); }}
                className="text-xs text-gray-400 hover:text-red-500 mt-1">
                ✕ Очистить
              </button>
            </div>
          ) : file ? (
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
              <p className="text-xs text-gray-400 mt-1">PDF, изображение, видео (webm, mp4), 3D модель (stl, glb, obj), STEP (конвертируется в GLB) или BIM модель (rvt, rfa)</p>
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

      <button type="submit" disabled={loading || multiUploading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50
               text-white text-sm font-medium py-2 rounded-lg transition-colors">
        {multiFiles.length > 0
          ? (multiUploading ? `Загрузка... (${multiResults.length}/${multiFiles.length})` : `Загрузить ${multiFiles.length} файлов`)
          : (loading ? 'Загрузка...' : 'Загрузить')}
      </button>
    </form>
  );
}
