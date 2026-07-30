import { useState } from 'react';
import { useRefData } from '../../hooks/useBatchStages';
import GroupsTab from './GroupsTab';
import ProductsTab from './ProductsTab';

// ── Главная страница PLM ──────────────────────────────────────────────────

export default function PLMPage({ onOpenProduct }) {
    const [tab, setTab] = useState('groups');
    const refData = useRefData();

    const tabs = [
        { id: 'groups', label: 'Группы' },
        { id: 'products', label: 'Изделия' },
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            {/* Заголовок */}
            <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                    PLM — Жизненный цикл изделия
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Управление стадиями и согласованием
                </p>
            </div>

            {/* Вкладки */}
            <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg w-fit">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`px-4 py-1.5 rounded text-sm transition-colors
                            ${tab === t.id
                                ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800'
                            }`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Контент вкладок */}
            {tab === 'groups' && (
                <GroupsTab onOpenProduct={onOpenProduct} refData={refData} />
            )}
            {tab === 'products' && (
                <ProductsTab onOpenProduct={onOpenProduct} />
            )}
        </div>
    );
}
