import React from 'react';

export default 
function ValidationReport({ result }) {
    if (!result) return null;

    // Ответ может быть строковой ошибкой (не массив errors)
    const errorMessage = typeof result.error === 'string' ? result.error : null;
    const errors = Array.isArray(result.errors) ? result.errors : [];
    const warnings = Array.isArray(result.warnings) ? result.warnings : [];

    return (
        <div className={`rounded-lg border p-4 space-y-2
            ${result.is_valid || result.success
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}>
            <div className={`text-sm font-medium
                ${result.is_valid || result.success
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-red-700 dark:text-red-300'
                }`}>
                {result.is_valid || result.success
                    ? '✓ Проверка пройдена'
                    : `✗ Найдено ошибок: ${errors.length || (errorMessage ? 1 : 0)}`
                }
            </div>

            {/* Строковая ошибка от 1С */}
            {errorMessage && (
                <p className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">
                    {errorMessage}
                </p>
            )}

            {errors.length > 0 && (
                <ul className="space-y-1 max-h-48 overflow-y-auto">
                    {errors.map((e, i) => (
                        <li key={i} className="text-xs text-red-600 dark:text-red-400 flex gap-2">
                            <span className="shrink-0">·</span>
                            <span>
                                {e.part_name && <strong>{e.part_name}: </strong>}
                                {e.message}
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            {warnings.length > 0 && (
                <ul className="space-y-1">
                    {warnings.map((w, i) => (
                        <li key={i} className="text-xs text-amber-600 dark:text-amber-400 flex gap-2">
                            <span className="shrink-0">⚠</span>
                            <span>{w.message}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}