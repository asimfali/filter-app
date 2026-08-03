import { useState } from 'react';
import { mediaApi } from '../../api/media';
import { SELECT_CLS } from './constants';

export default function BulkCreateForm({ docTypes, onCreated }) {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Тип документа */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Тип документа
        </label>
        <select required value={docTypeId} onChange={e => setDocTypeId(e.target.value)}
          className={SELECT_CLS}>
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
