import { useState } from 'react';
import { tokenStorage } from '../api/auth';

const API_BASE = '/api/v1/catalog';

/** onSaved(specId, newValue) вызывается после успешного сохранения на бэкенде. */
export function useEditableSpecs(onSaved) {
  const [editingSpecId, setEditingSpecId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

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
        onSaved(spec.id, editValue);
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

  return {
    editingSpecId, editValue, setEditValue,
    saving, saveError,
    handleEditStart, handleEditCancel, handleEditSave,
  };
}
