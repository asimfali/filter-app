import { mediaApi } from '../../api/media';
import { IconPdf } from '../../components/common/Icons';

// ── Теплообменник ─────────────────────────────────────────────────────────

export default function HeatExchangerSection({ heatExchangers }) {
    if (!heatExchangers?.length) return null;

    const handleDrawingClick = async (e, relPath) => {
        e.preventDefault();
        const res = await mediaApi.downloadFile(relPath);
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    };

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400
                            uppercase tracking-wide mb-3">
                Теплообменник{heatExchangers.length > 1 ? 'и' : ''}
            </div>
            <div className="space-y-4">
                {heatExchangers.map(he => (
                    <div key={he.id}>
                        {/* Характеристики в одну строку */}
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-2">
                            <span className="text-sm font-semibold text-gray-900
                                             dark:text-white shrink-0">
                                {he.mark}
                            </span>
                            {[
                                ['Габариты', he.overall_dimensions],
                                ['Тело', he.body_dimensions],
                                ['Объем воды', `${he.water_volume} л`],
                                ['Рядов', he.row_count],
                                ['Трубка', `${he.tube_thickness} мм`],
                                ['Шаг рёбер', `${he.fin_pitch} мм`],
                                ['Ребро', `${he.fin_thickness} мм`],
                                ['Контуры', he.circuit_count],
                                ['Коллектор', he.collector_type],
                                ['Конфиг.', he.configuration],
                            ].map(([label, value]) => (
                                <div key={label} className="flex items-baseline gap-1">
                                    <span className="text-xs text-gray-400 dark:text-gray-500
                                                     whitespace-nowrap">
                                        {label}
                                    </span>
                                    <span className="text-sm text-gray-900 dark:text-white
                                                     font-medium whitespace-nowrap">
                                        {value}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Чертёж */}
                        {he.drawing_files?.length > 0 && (
                            <div className="space-y-0.5">
                                {he.drawing_files.map(f => (
                                    <button
                                        key={f.rel_path}
                                        onClick={e => handleDrawingClick(e, f.rel_path)}
                                        className="flex items-center gap-2 w-full text-left
                                                   px-3 py-1.5 rounded-lg
                                                   hover:bg-neutral-50 dark:hover:bg-neutral-800
                                                   transition-colors group"
                                    >
                                        <IconPdf className="w-4 h-4 text-red-400 shrink-0" />
                                        <span className="text-sm text-gray-700 dark:text-gray-300
                                                         flex-1 truncate">
                                            {f.name}
                                        </span>
                                        <span className="text-xs text-blue-500 opacity-0
                                                         group-hover:opacity-100 transition-opacity">
                                            Открыть ↗
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
