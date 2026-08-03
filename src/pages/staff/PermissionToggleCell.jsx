// ── Ячейка-переключатель в матрице прав (роль × право/характеристика) ────

export default function PermissionToggleCell({ enabled, busy, onToggle }) {
    return (
        <td className="px-2 py-1.5 text-center border-b border-gray-100 dark:border-gray-800">
            <button
                onClick={onToggle}
                disabled={busy}
                className={`w-5 h-5 rounded transition-colors mx-auto flex
                            items-center justify-center
                            ${busy ? 'opacity-40' : ''}
                            ${enabled
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'border-2 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                    }`}>
                {busy ? '·' : enabled ? '✓' : ''}
            </button>
        </td>
    );
}
