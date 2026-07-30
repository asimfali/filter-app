import { useSpecMatrix } from '../../hooks/useStaff';
import PermissionToggleCell from './PermissionToggleCell';

// ── Вкладка прав подразделения ────────────────────────────────────────────

export default function SpecPermissionsTab({ deptId }) {
    const { matrix, loading, busy, toggle } = useSpecMatrix(deptId);

    if (loading) return (
        <div className="text-xs text-gray-400 py-4 text-center">Загрузка...</div>
    );
    if (!matrix) return null;

    const { roles, specs } = matrix;

    if (!specs.length) return (
        <div className="text-xs text-gray-400 py-4 text-center">
            Характеристики не найдены
        </div>
    );

    return (
        <div className="overflow-auto max-h-96">
            <table className="w-full text-xs border-collapse">
                <thead>
                    <tr>
                        <th className="text-left px-2 py-1.5 text-gray-500 font-medium
                                       border-b border-gray-200 dark:border-gray-700
                                       sticky top-0 bg-white dark:bg-neutral-900 min-w-48">
                            Характеристика
                        </th>
                        {roles.map(role => (
                            <th key={role.id}
                                className="px-2 py-1.5 text-center text-gray-600 dark:text-gray-400
                                           font-medium border-b border-gray-200 dark:border-gray-700
                                           sticky top-0 bg-white dark:bg-neutral-900 min-w-24">
                                {role.name}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {specs.map(spec => (
                        <tr key={spec.spec_id}
                            className="hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                            <td className="px-2 py-1.5 border-b border-gray-100 dark:border-gray-800">
                                <div className="font-medium text-gray-700 dark:text-gray-300">
                                    {spec.spec_name}
                                </div>
                                {spec.spec_unit && (
                                    <div className="text-gray-400 dark:text-gray-500 text-[11px]">
                                        {spec.spec_unit}
                                    </div>
                                )}
                            </td>
                            {roles.map(role => {
                                const key = `${role.id}-${spec.spec_id}`;
                                return (
                                    <PermissionToggleCell key={role.id}
                                        enabled={spec.roles[String(role.id)] != null}
                                        busy={busy === key}
                                        onToggle={() => toggle(role.id, spec.spec_id)} />
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
