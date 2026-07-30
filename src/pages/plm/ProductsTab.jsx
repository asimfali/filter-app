import { useState } from 'react';
import { catalogApi } from '../../api/catalog';
import { useAuth } from '../../contexts/AuthContext';
import { can } from '../../utils/permissions';
import BatchCreateForm from '../../components/plm/BatchCreateForm';

// ── Вкладка: Изделия (поиск + индивидуальные стадии) ─────────────────────

export default function ProductsTab({ onOpenProduct }) {
    const { user } = useAuth();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [searched, setSearched] = useState(false);
    const [selectedProducts, setSelectedProducts] = useState(new Set());
    const [showBatchCreate, setShowBatchCreate] = useState(false);

    const canCreate = can(user, 'plm.stage.manage');

    const handleSearch = async (e) => {
        e.preventDefault();
        if (query.length < 2) return;
        setLoading(true);
        setSelectedProducts(new Set());

        const { data } = await catalogApi.searchProducts(query, { limit: 50 });
        if (data.success) setProducts(data.data);
        setLoading(false);
        setSearched(true);
    };

    const toggleProduct = (id) => {
        setSelectedProducts(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => setSelectedProducts(new Set(products.map(p => p.id)));
    const deselectAll = () => setSelectedProducts(new Set());

    return (
        <div className="space-y-4">
            {/* Поиск */}
            <form onSubmit={handleSearch} className="flex gap-2">
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Найти изделие (мин. 2 символа)..."
                    className="flex-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700
                               bg-white dark:bg-neutral-900 text-gray-900 dark:text-white
                               px-4 py-2 focus:outline-none focus:border-blue-500"
                />
                <button type="submit" disabled={loading || query.length < 2}
                    className="text-sm bg-blue-600 hover:bg-blue-700 text-white
                               px-4 py-2 rounded-lg disabled:opacity-50 transition-colors">
                    {loading ? '...' : 'Найти'}
                </button>
            </form>

            {/* Toolbar выбранных */}
            {products.length > 0 && canCreate && (
                <div className="flex items-center gap-3 bg-white dark:bg-neutral-900
                                rounded-lg shadow px-4 py-2.5">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Выбрано: {selectedProducts.size} из {products.length}</span>
                        <button onClick={selectAll}
                            className="text-blue-500 hover:text-blue-600">Все</button>
                        <button onClick={deselectAll}
                            className="text-gray-400 hover:text-gray-600">Снять</button>
                    </div>
                    {selectedProducts.size > 0 && (
                        <button
                            onClick={() => setShowBatchCreate(true)}
                            className="ml-auto text-xs bg-blue-600 hover:bg-blue-700 text-white
                                       px-3 py-1.5 rounded transition-colors"
                        >
                            Создать группу стадий ({selectedProducts.size})
                        </button>
                    )}
                </div>
            )}

            {/* Форма batch создания */}
            {showBatchCreate && (
                <BatchCreateForm
                    productIds={Array.from(selectedProducts)}
                    onCreated={() => {
                        setShowBatchCreate(false);
                        setSelectedProducts(new Set());
                    }}
                    onCancel={() => setShowBatchCreate(false)}
                />
            )}

            {/* Список изделий */}
            {searched && products.length === 0 && (
                <div className="text-sm text-gray-400 text-center py-8">Ничего не найдено</div>
            )}

            <div className="space-y-2">
                {products.map(product => (
                    <div key={product.id}
                        className="bg-white dark:bg-neutral-900 rounded-lg shadow
                                   flex items-center gap-3 px-4 py-3">
                        <input
                            type="checkbox"
                            checked={selectedProducts.has(product.id)}
                            onChange={() => toggleProduct(product.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {product.name}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">{product.product_type}</div>
                        </div>
                        <button
                            onClick={() => onOpenProduct(product.id)}
                            className="text-xs text-blue-500 hover:text-blue-600 shrink-0"
                        >
                            Открыть →
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
