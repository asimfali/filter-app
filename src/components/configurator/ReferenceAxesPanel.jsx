// Панель «Справочные оси» в подрежиме «Привязать товар» редактора привязок.
// selection: { [axisId]: { on: bool, choice: valueId | REF_DETACH | null } }

export const REF_DETACH = 'detach';

const activeAxes = (axes, selection) =>
    axes.filter(a => selection[a.axis_id]?.on && selection[a.axis_id].choice);

// id значений отмеченных осей (без «снять»)
export const refAttachValueIds = (axes, selection) =>
    activeAxes(axes, selection)
        .filter(a => selection[a.axis_id].choice !== REF_DETACH)
        .map(a => String(selection[a.axis_id].choice));

// id осей, отмеченных как «снять»
export const refDetachAxisIds = (axes, selection) =>
    activeAxes(axes, selection)
        .filter(a => selection[a.axis_id].choice === REF_DETACH)
        .map(a => a.axis_id);

// value_ids цепочки + значения панели; значения цепочки на отмеченных осях панель перекрывает
export const withRefValues = (valueIds, axes, selection) => {
    const overridden = new Set(
        activeAxes(axes, selection).flatMap(a => a.values.map(v => String(v.id)))
    );
    return [
        ...valueIds.map(String).filter(id => !overridden.has(id)),
        ...refAttachValueIds(axes, selection),
    ];
};

// Сводка по оси для выделенных товаров из current-parameters (by_product/parent_ok):
// value — общее значение (null — у всех пусто), mixed — значения различаются,
// orphans — сколько товаров без родительского значения, total — сколько товаров в ответе
export const refAxisStats = (axisId, current) => {
    if (!current?.by_product) return null;
    const key = String(axisId);
    const pids = Object.keys(current.by_product);
    const values = new Set(pids.map(pid => current.by_product[pid]?.[key] ?? null));
    const orphans = pids.filter(pid => current.parent_ok?.[pid]?.[key] === false).length;
    return {
        total: pids.length,
        mixed: values.size > 1,
        value: values.size === 1 ? [...values][0] : null,
        orphans,
    };
};

export default function ReferenceAxesPanel({ axes, selection, onChange, current = null, selectedCount = 0, onApply, applying = false }) {
    if (!axes.length) return null;

    const setAxis = (axisId, patch) =>
        onChange({ ...selection, [axisId]: { on: false, choice: null, ...selection[axisId], ...patch } });

    const hasActive = activeAxes(axes, selection).length > 0;
    const sorted = [...axes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    return (
        <div className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-3">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Справочные оси
            </div>
            <div className="space-y-2">
                {sorted.map(axis => {
                    const sel = selection[axis.axis_id] || {};
                    const name = `ref-axis-${axis.axis_id}`;
                    const stats = refAxisStats(axis.axis_id, current);
                    const currentLabel = !stats ? null
                        : stats.mixed ? 'смешано'
                            : stats.value === null ? 'не задано'
                                : axis.values.find(v => String(v.id) === String(stats.value))?.label ?? stats.value;
                    const showOrphans = sel.on && sel.choice && sel.choice !== REF_DETACH && stats?.orphans > 0;
                    return (
                        <div key={axis.axis_id}>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                <label className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none min-w-40">
                                    <input
                                        type="checkbox"
                                        checked={!!sel.on}
                                        onChange={e => setAxis(axis.axis_id, { on: e.target.checked })}
                                        className="rounded"
                                    />
                                    {axis.axis_name}{' '}
                                    {currentLabel && (
                                        <span className={`font-normal ${stats.mixed ? 'text-amber-500' : 'text-gray-400'}`}
                                            title="Текущее значение у выделенных товаров">
                                            ({currentLabel})
                                        </span>
                                    )}
                                </label>
                                {[...axis.values]
                                    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                                    .map(v => (
                                        <label key={v.id} className="flex items-center gap-1 text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                                            <input
                                                type="radio"
                                                name={name}
                                                checked={String(sel.choice) === String(v.id)}
                                                onChange={() => setAxis(axis.axis_id, { on: true, choice: String(v.id) })}
                                            />
                                            {v.label}
                                        </label>
                                    ))}
                                <label className="flex items-center gap-1 text-red-500 cursor-pointer select-none">
                                    <input
                                        type="radio"
                                        name={name}
                                        checked={sel.choice === REF_DETACH}
                                        onChange={() => setAxis(axis.axis_id, { on: true, choice: REF_DETACH })}
                                    />
                                    снять
                                </label>
                            </div>
                            {showOrphans && (
                                <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 ml-5">
                                    ⚠ {stats.orphans} из {stats.total} товаров без родительского значения —
                                    привязка у них станет «сиротой»
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="flex items-center gap-3 mt-3">
                <button
                    onClick={onApply}
                    disabled={!hasActive || !selectedCount || applying}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                >
                    {applying ? 'Применение...' : `Применить к выделенным (${selectedCount})`}
                </button>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                    Отмеченные значения добавляются и при перетаскивании на цепочку
                </span>
            </div>
        </div>
    );
}
