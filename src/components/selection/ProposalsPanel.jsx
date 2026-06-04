import { useState, useEffect } from 'react';
import { selectionApi } from '../../api/selection';

const STATUS_LABEL = {
    DRAFT:    'Черновик',
    SENT:     'Отправлено',
    ACCEPTED: 'Принято',
    REJECTED: 'Отклонено',
};

const STATUS_COLOR = {
    DRAFT:    'text-gray-400',
    SENT:     'text-blue-500',
    ACCEPTED: 'text-emerald-500',
    REJECTED: 'text-red-500',
};

const TYPE_LABEL = {
    CURTAIN_SHUTTER: 'Завеса шиберующая',
    CURTAIN_MIX:     'Завеса смесительная',
    FAN:             'Вентилятор',
};

export default function ProposalsPanel({ open, onClose, onRestore }) {
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        selectionApi.proposalsList().then(({ ok, data }) => {
            if (ok) setProposals(Array.isArray(data) ? data : (data.results || data.data || []));
            setLoading(false);
        });
    }, [open]);

    const filtered = proposals.filter(p =>
        !search ||
        p.customer?.toLowerCase().includes(search.toLowerCase()) ||
        p.proposal_number?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <>
            {/* Оверлей */}
            {open && (
                <div
                    className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40"
                    onClick={onClose}
                />
            )}

            {/* Панель */}
            <div className={`fixed top-0 right-0 z-50 h-full w-96 max-w-full
                bg-white dark:bg-neutral-900
                shadow-2xl border-l border-gray-200 dark:border-gray-700
                flex flex-col
                transition-transform duration-300
                ${open ? 'translate-x-0' : 'translate-x-full'}`}>

                {/* Шапка */}
                <div className="flex items-center justify-between px-5 py-4
                    border-b border-gray-200 dark:border-gray-700 shrink-0">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        История подборов
                    </span>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                            text-xl leading-none">
                        ×
                    </button>
                </div>

                {/* Поиск */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Заказчик или номер..."
                        className="w-full text-sm rounded-lg border border-gray-200
                            dark:border-gray-700 bg-white dark:bg-neutral-800
                            text-gray-900 dark:text-white placeholder-gray-400
                            px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>

                {/* Список */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                    {loading && (
                        <div className="text-xs text-gray-400 text-center py-8 animate-pulse">
                            Загрузка...
                        </div>
                    )}
                    {!loading && filtered.length === 0 && (
                        <div className="text-xs text-gray-400 text-center py-8">
                            Подборов нет
                        </div>
                    )}
                    {filtered.map(p => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={async () => {
                                const { ok, data } = await selectionApi.proposalsDetail(p.id);
                                if (ok) { onRestore(data); onClose(); }
                            }}
                            className="w-full text-left rounded-lg border border-gray-200
                                dark:border-gray-700 px-4 py-3 space-y-1
                                hover:border-blue-400 hover:bg-blue-50/40
                                dark:hover:bg-blue-900/10 transition-colors">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-mono font-semibold
                                    text-blue-600 dark:text-blue-400">
                                    {p.proposal_number}
                                </span>
                                <span className={`text-xs ${STATUS_COLOR[p.status]}`}>
                                    {STATUS_LABEL[p.status]}
                                </span>
                            </div>
                            <div className="text-sm text-gray-900 dark:text-white truncate">
                                {p.customer || <span className="text-gray-400">Без заказчика</span>}
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-400">
                                <span>{TYPE_LABEL[p.selection_type]}</span>
                                <span>{new Date(p.created_at).toLocaleDateString('ru-RU')}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
}