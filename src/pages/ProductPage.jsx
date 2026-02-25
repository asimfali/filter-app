import React, { useState, useEffect } from 'react';
import { tokenStorage } from '../api/auth';

const API_BASE = '/api/v1/catalog';

export default function ProductPage({ productId, onBack }) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Редактирование характеристики
  const [editingSpecId, setEditingSpecId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/products/${productId}/card/`, {
      headers: { Authorization: `Bearer ${tokenStorage.getAccess()}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) setProduct(data.data);
        else setError('Ошибка загрузки');
      })
      .catch(() => setError('Ошибка сети'))
      .finally(() => setLoading(false));
  }, [productId]);

  const handleEditStart = (spec) => {
    setEditingSpecId(spec.id);
    setEditValue(spec.value);
    setSaveError(null);
  };

  const handleEditCancel = () => {
    setEditingSpecId(null);
    setEditValue('');
    setSaveError(null);
  };

  const handleEditSave = async (spec) => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`${API_BASE}/product-specs/${spec.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenStorage.getAccess()}`,
        },
        body: JSON.stringify({ value: editValue }),
      });
      const data = await res.json();
      if (res.ok) {
        // Обновляем локально без перезагрузки
        setProduct(prev => ({
          ...prev,
          specs: prev.specs.map(s =>
            s.id === spec.id ? { ...s, value: editValue, is_manual: true } : s
          ),
        }));
        setEditingSpecId(null);
      } else {
        setSaveError(data.detail || 'Ошибка сохранения');
      }
    } catch {
      setSaveError('Ошибка сети');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 dark:text-gray-500 text-sm">
        Загрузка...
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4">
          ← Назад
        </button>
        <div className="bg-red-50 rounded-lg p-4 text-red-600 text-sm">{error}</div>
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-4">

      {/* Шапка */}
      <div className="flex items-start gap-4">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700
                     dark:hover:text-gray-300 mt-1 shrink-0"
        >
          ← Назад
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {product.name}
          </h1>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {product.product_type}
            {product.sku && <> · <span className="font-mono">{product.sku}</span></>}
          </div>
        </div>
      </div>

      {/* Статусы подразделений */}
      {product.department_statuses.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow px-5 py-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Статусы подразделений
          </div>
          <div className="flex flex-wrap gap-2">
            {product.department_statuses.map(ds => (
              <span
                key={ds.department_code}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: ds.color }}
              >
                {ds.department} — {ds.status}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Параметры */}
      {product.parameters.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow px-5 py-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Параметры
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            {product.parameters.map(p => (
              <div key={p.axis_code} className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">{p.axis_name}</span>
                <span className="text-gray-900 dark:text-white font-medium">{p.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Характеристики */}
      {product.specs.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow px-5 py-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Характеристики
          </div>
          <div className="space-y-2">
            {product.specs.map(spec => (
              <div key={spec.id} className="flex items-center justify-between text-sm gap-4">
                <span className="text-gray-500 dark:text-gray-400 shrink-0">
                  {spec.definition_name}
                  {spec.is_manual && (
                    <span className="ml-1.5 text-xs text-violet-500" title="Введено вручную">✎</span>
                  )}
                </span>

                {editingSpecId === spec.id ? (
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <input
                      type="text"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleEditSave(spec);
                        if (e.key === 'Escape') handleEditCancel();
                      }}
                      autoFocus
                      className="border border-blue-400 rounded px-2 py-0.5 text-sm
                                 bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                                 focus:outline-none focus:ring-1 focus:ring-blue-500 w-32"
                    />
                    <button
                      onClick={() => handleEditSave(spec)}
                      disabled={saving}
                      className="text-xs text-white bg-blue-600 hover:bg-blue-700
                                 disabled:opacity-50 px-2 py-1 rounded transition-colors"
                    >
                      {saving ? '...' : 'Сохранить'}
                    </button>
                    <button
                      onClick={handleEditCancel}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      Отмена
                    </button>
                    {saveError && (
                      <span className="text-xs text-red-500">{saveError}</span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900 dark:text-white font-medium">
                      {spec.value}
                    </span>
                    {spec.can_edit && (
                      <button
                        onClick={() => handleEditStart(spec)}
                        className="text-xs text-gray-400 hover:text-blue-500
                                   dark:hover:text-blue-400 transition-colors"
                        title="Редактировать"
                      >
                        ✎
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Документы — заглушка до реализации media_library */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow px-5 py-4">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Документы
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Модуль документов в разработке
        </p>
      </div>

    </div>
  );
}