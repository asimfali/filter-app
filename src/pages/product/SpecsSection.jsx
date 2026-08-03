import { useEditableSpecs } from '../../hooks/useEditableSpecs';

// ── Характеристики ────────────────────────────────────────────────────────

export default function SpecsSection({ specs, onSpecSaved }) {
  const {
    editingSpecId, editValue, setEditValue,
    saving, saveError,
    handleEditStart, handleEditCancel, handleEditSave,
  } = useEditableSpecs(onSpecSaved);

  if (!specs.length) return null;

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400
                    uppercase tracking-wide mb-3">
        Характеристики
      </div>
      <div className="space-y-2">
        {specs.map(spec => (
          <div key={spec.id}
            className="flex items-center justify-between text-sm gap-4">
            <span className="text-gray-500 dark:text-gray-400 shrink-0">
              {spec.definition_name}
              {spec.is_manual && (
                <span className="ml-1.5 text-xs text-violet-500"
                  title="Введено вручную">✎</span>
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
                  className="border border-blue-400 rounded px-2 py-0.5
                               text-sm bg-white dark:bg-neutral-800
                               text-gray-900 dark:text-white
                               focus:outline-none focus:ring-1
                               focus:ring-blue-500 w-32"
                />
                <button
                  onClick={() => handleEditSave(spec)}
                  disabled={saving}
                  className="text-xs text-white bg-blue-600 hover:bg-blue-700
                               disabled:opacity-50 px-2 py-1 rounded
                               transition-colors"
                >
                  {saving ? '...' : 'Сохранить'}
                </button>
                <button
                  onClick={handleEditCancel}
                  className="text-xs text-gray-500 hover:text-gray-700
                               dark:hover:text-gray-300"
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
  );
}
