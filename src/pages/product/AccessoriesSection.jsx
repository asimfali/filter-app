import { useState, useMemo } from 'react';

// ── Комплектующие / Автоматика ────────────────────────────────────────────

export default function AccessoriesSection({ accessories }) {
    if (!accessories?.length) return null;

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400
                            uppercase tracking-wide mb-3">
                Комплектующие / Автоматика
            </div>
            <div className="space-y-5">
                {accessories.map(kit => (
                    <AccessoryKitView key={kit.id} kit={kit} />
                ))}
            </div>
        </div>
    );
}

function AccessoryKitView({ kit }) {
    const [quantity, setQuantity] = useState('');
    const [isManual, setIsManual] = useState(null); // null=не выбрано
    const [power, setPower] = useState('');

    const { controls, is_manual: kitIsManual } = kit;

    // Подбор правил по введённым параметрам
    const resolvedItems = useMemo(() => {
        if (kitIsManual) return kit.items;
        if (!kit.rules?.length) return kit.items;

        const qty = quantity ? parseInt(quantity) : null;
        const pwr = power ? parseFloat(power) : null;

        const matching = kit.rules.filter(rule => {
            // Количество
            if (rule.quantity_from != null && qty != null && qty < rule.quantity_from) return false;
            if (rule.quantity_to != null && qty != null && qty > rule.quantity_to) return false;
            // Тип управления
            if (rule.is_manual != null && isManual != null && rule.is_manual !== isManual) return false;
            // Мощность
            if (rule.power_from != null && pwr != null && pwr < parseFloat(rule.power_from)) return false;
            if (rule.power_to != null && pwr != null && pwr > parseFloat(rule.power_to)) return false;
            return true;
        });

        if (!matching.length) return [];

        // Берём с минимальным приоритетом
        const minPriority = Math.min(...matching.map(r => r.priority));
        const best = matching.filter(r => r.priority === minPriority);

        return best.flatMap(r => r.rule_items || []);
    }, [kit, quantity, isManual, power, kitIsManual]);

    // Нужно ли показывать контролы
    const showControls = !kitIsManual && (
        controls.has_quantity || controls.has_manual_switch || controls.has_power
    );

    return (
        <div>
            {/* Название набора если наборов несколько — выводится снаружи */}

            {/* Контролы подбора */}
            {showControls && (
                <div className="flex flex-wrap gap-3 mb-3 p-3 bg-neutral-50
                                dark:bg-neutral-800/50 rounded-lg">
                    {controls.has_quantity && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                Кол-во завес:
                            </span>
                            <input
                                type="number" min="1"
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                                placeholder="—"
                                className="w-16 border border-gray-300 dark:border-gray-600
                                           rounded px-2 py-1 text-sm text-center
                                           bg-white dark:bg-neutral-800
                                           text-gray-900 dark:text-white
                                           focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    )}
                    {controls.has_manual_switch && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                Управление:
                            </span>
                            {[
                                { value: null, label: 'Любое' },
                                { value: false, label: 'Авто' },
                                { value: true, label: 'Ручное' },
                            ].map(opt => (
                                <button
                                    key={String(opt.value)}
                                    onClick={() => setIsManual(opt.value)}
                                    className={`text-xs px-2 py-1 rounded-full transition-colors
                                        ${isManual === opt.value
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-neutral-100 dark:bg-neutral-800 text-gray-500 hover:text-blue-500'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}
                    {controls.has_power && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                Мощность, кВт:
                            </span>
                            <input
                                type="number" min="0" step="0.1"
                                value={power}
                                onChange={e => setPower(e.target.value)}
                                placeholder="—"
                                className="w-20 border border-gray-300 dark:border-gray-600
                                           rounded px-2 py-1 text-sm
                                           bg-white dark:bg-neutral-800
                                           text-gray-900 dark:text-white
                                           focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Результат подбора */}
            {resolvedItems.length === 0 ? (
                showControls && (quantity || isManual !== null || power) ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                        Нет подходящих комплектующих
                    </p>
                ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                        {showControls ? 'Введите параметры для подбора' : 'Позиций нет'}
                    </p>
                )
            ) : (
                <div className="space-y-1">
                    {resolvedItems.map(item => (
                        <div key={item.id}
                            className="flex items-center justify-between text-sm py-1 gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.is_required
                                    ? 'bg-emerald-500'
                                    : 'bg-gray-300 dark:bg-gray-600'
                                    }`} />
                                <span className="text-gray-900 dark:text-white truncate">
                                    {item.name}
                                </span>
                                {item.sku && (
                                    <span className="text-xs text-gray-400 font-mono shrink-0">
                                        {item.sku}
                                    </span>
                                )}
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded-full
                                             bg-neutral-100 dark:bg-neutral-800
                                             text-gray-500 shrink-0">
                                ×{item.quantity}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
