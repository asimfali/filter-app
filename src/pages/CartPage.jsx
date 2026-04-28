import React, { useState, useEffect, useCallback } from 'react';
import { useCart } from '../contexts/CartContext';
import { salesApi } from '../api/sales';
import Modal from '../components/common/Modal';
import ModalFooter from '../components/common/ModalFooter';
import ConfirmModal from '../components/common/ConfirmModal';
import SmartSelect from '../components/common/SmartSelect';

export default function CartPage({ onNavigate }) {
    const {
        carts, activeCartId, cartsNext, cartsLoading, cartsSearch,
        loadCarts, loadMoreCarts, searchCarts,
        selectCart, createCart, refreshCount,
    } = useCart();

    const [cartDetail, setCartDetail] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Модалки
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState({ name: '', client_name: '', notes: '' });
    const [creating, setCreating] = useState(false);

    const [confirmDelete, setConfirmDelete] = useState(null); // cart id
    const [confirmDeleteItem, setConfirmDeleteItem] = useState(null); // { itemId }

    const [searchInput, setSearchInput] = useState('');
    useEffect(() => {
        const t = setTimeout(() => searchCarts(searchInput), 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    // Загрузка детали активной корзины
    const loadDetail = useCallback(async () => {
        if (!activeCartId) { setCartDetail(null); return; }
        setLoadingDetail(true);
        const { ok, data } = await salesApi.getCart(activeCartId);
        if (ok) setCartDetail(data);
        setLoadingDetail(false);
    }, [activeCartId]);

    useEffect(() => { loadDetail(); }, [loadDetail]);

    // Создание корзины
    const handleCreate = async () => {
        if (!createForm.name.trim()) return;
        setCreating(true);
        await createCart(createForm);
        setCreateForm({ name: '', client_name: '', notes: '' });
        setShowCreate(false);
        setCreating(false);
    };

    // Удаление корзины
    const handleDeleteCart = async (cartId) => {
        await salesApi.deleteCart(cartId);
        if (cartId === activeCartId) selectCart(null);
        await loadCarts();
        setConfirmDelete(null);
    };

    // Удаление позиции
    const handleDeleteItem = async (itemId) => {
        await salesApi.deleteItem(activeCartId, itemId);
        await loadDetail();
        await refreshCount();
        setConfirmDeleteItem(null);
    };

    // Изменение кол-ва
    const handleQtyChange = async (item, delta) => {
        const newQty = item.quantity + delta;
        if (newQty < 1) return;
        if (item.parent_item === undefined || item.parent_item === null) {
            await salesApi.updateItem(activeCartId, item.id, { quantity: newQty });
        } else {
            await salesApi.updateAccessory(activeCartId, item.parent_id, item.id, { quantity: newQty });
        }
        await loadDetail();
        await refreshCount();
    };

    // Подбор комплектующих
    const handleSuggest = async (item) => {
        await salesApi.suggestAccessories(activeCartId, item.id, {
            quantity: item.quantity,
            is_manual: null,
            power: null,
        });
        await loadDetail();
        await refreshCount();
    };

    // Добавление товара через SmartSelect
    const handleAddProduct = async (product) => {
        if (!activeCartId) return;
        await salesApi.addItem(activeCartId, { product: product.id, quantity: 1 });
        await loadDetail();
        await refreshCount();
    };

    return (
        <div className="max-w-6xl mx-auto flex gap-6">

            {/* ── Левая панель: список корзин ──────────────────────────── */}
            <div className="w-64 shrink-0 space-y-2">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Корзины</h2>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="text-xs px-2 py-1 rounded-lg bg-emerald-600
                       hover:bg-emerald-700 text-white transition-colors">
                        + Новая
                    </button>
                </div>

                {/* Поиск */}
                <input
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    placeholder="Поиск по названию, клиенту..."
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg
                   px-3 py-1.5 text-xs bg-white dark:bg-neutral-800
                   text-gray-900 dark:text-white placeholder-gray-400
                   focus:outline-none focus:ring-1 focus:ring-blue-500"
                />

                {/* Список */}
                <div className="space-y-1.5 max-h-[calc(100vh-12rem)] overflow-y-auto pr-1">
                    {carts.length === 0 && !cartsLoading && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 py-2">
                            {cartsSearch ? 'Ничего не найдено' : 'Нет корзин. Создайте первую.'}
                        </p>
                    )}

                    {carts.map(cart => (
                        <div
                            key={cart.id}
                            onClick={() => selectCart(cart.id)}
                            className={`group relative px-3 py-2.5 rounded-lg cursor-pointer
                            border transition-colors
                            ${activeCartId === cart.id
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                }`}>
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate pr-5">
                                {cart.name}
                            </div>
                            {cart.client_name && (
                                <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                    {cart.client_name}
                                </div>
                            )}
                            <div className="text-xs text-gray-400 mt-0.5">
                                {cart.items_count} поз. ·{' '}
                                {new Date(cart.updated_at).toLocaleDateString('ru-RU')}
                            </div>
                            <button
                                onClick={e => { e.stopPropagation(); setConfirmDelete(cart.id); }}
                                className="absolute top-2 right-2 text-gray-300 dark:text-gray-600
                               hover:text-red-500 opacity-0 group-hover:opacity-100
                               transition-all text-sm">
                                ✕
                            </button>
                        </div>
                    ))}

                    {/* Подгрузка */}
                    {cartsNext && (
                        <button
                            onClick={loadMoreCarts}
                            disabled={cartsLoading}
                            className="w-full text-xs text-gray-400 hover:text-gray-600
                           dark:hover:text-gray-300 py-2 text-center
                           disabled:opacity-50 transition-colors">
                            {cartsLoading ? 'Загрузка...' : 'Показать ещё'}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Правая панель: содержимое корзины ────────────────────── */}
            <div className="flex-1 min-w-0">
                {!activeCartId && (
                    <div className="flex items-center justify-center h-48
                                    text-gray-400 dark:text-gray-500 text-sm">
                        Выберите корзину слева
                    </div>
                )}

                {activeCartId && (
                    <div className="space-y-4">
                        {/* Шапка корзины */}
                        {cartDetail && (
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        {cartDetail.name}
                                    </h1>
                                    {cartDetail.client_name && (
                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                            {cartDetail.client_name}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => onNavigate('cart-kp', activeCartId)}
                                    className="px-4 py-2 text-sm font-medium rounded-lg
                                               bg-blue-600 hover:bg-blue-700 text-white transition-colors">
                                    КП →
                                </button>
                            </div>
                        )}

                        {/* Поиск и добавление товара */}
                        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-4 py-3">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                Добавить изделие:
                            </div>
                            <SmartSelect
                                endpoint="/api/v1/catalog/products/search/"
                                placeholder="Поиск изделия..."
                                onSelect={handleAddProduct}
                                renderItem={item => (
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-white">
                                            {item.name}
                                        </div>
                                        {item.sku && (
                                            <div className="text-gray-400 text-[11px] font-mono">
                                                {item.sku}
                                            </div>
                                        )}
                                    </div>
                                )}
                            />
                        </div>

                        {/* Позиции */}
                        {loadingDetail && (
                            <div className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
                                Загрузка...
                            </div>
                        )}

                        {cartDetail && !loadingDetail && (
                            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow overflow-hidden">
                                {cartDetail.items?.length === 0 && (
                                    <p className="px-4 py-6 text-sm text-gray-400 dark:text-gray-500 text-center">
                                        Корзина пуста
                                    </p>
                                )}

                                {cartDetail.items?.map(item => (
                                    <CartItemRow
                                        key={item.id}
                                        item={item}
                                        cartId={activeCartId}
                                        onQtyChange={handleQtyChange}
                                        onDelete={() => setConfirmDeleteItem({ itemId: item.id })}
                                        onSuggest={() => handleSuggest(item)}
                                        onDeleteAccessory={(accId) =>
                                            salesApi.deleteAccessory(activeCartId, item.id, accId)
                                                .then(loadDetail)
                                        }
                                        onQtyChangeAccessory={async (acc, delta) => {
                                            const newQty = acc.quantity + delta;
                                            if (newQty < 1) return;
                                            await salesApi.updateAccessory(
                                                activeCartId, item.id, acc.id, { quantity: newQty }
                                            );
                                            await loadDetail();
                                        }}
                                    />
                                ))}

                                {/* Итог */}
                                {cartDetail.totals?.has_price && (
                                    <div className="border-t border-gray-100 dark:border-gray-800
                                                    px-4 py-3 flex justify-end">
                                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                            Итого: {cartDetail.totals.total?.toLocaleString('ru-RU')} ₽
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Модалки ──────────────────────────────────────────────── */}
            {showCreate && (
                <Modal title="Новая корзина" onClose={() => setShowCreate(false)}>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">
                                Название *
                            </label>
                            <input
                                autoFocus
                                value={createForm.name}
                                onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                placeholder="ТЦ Магнит — 2026"
                                className="mt-1 w-full border border-gray-200 dark:border-gray-700
                                           rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-800
                                           text-gray-900 dark:text-white focus:outline-none
                                           focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">
                                Клиент
                            </label>
                            <input
                                value={createForm.client_name}
                                onChange={e => setCreateForm(p => ({ ...p, client_name: e.target.value }))}
                                placeholder="Иванов И.И."
                                className="mt-1 w-full border border-gray-200 dark:border-gray-700
                                           rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-800
                                           text-gray-900 dark:text-white focus:outline-none
                                           focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">
                                Примечания
                            </label>
                            <textarea
                                value={createForm.notes}
                                onChange={e => setCreateForm(p => ({ ...p, notes: e.target.value }))}
                                rows={2}
                                className="mt-1 w-full border border-gray-200 dark:border-gray-700
                                           rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-800
                                           text-gray-900 dark:text-white focus:outline-none
                                           focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <ModalFooter
                            onClose={() => setShowCreate(false)}
                            onConfirm={handleCreate}
                            loading={creating}
                            confirmLabel="Создать"
                            disabled={!createForm.name.trim()}
                        />
                    </div>
                </Modal>
            )}

            {confirmDelete && (
                <ConfirmModal
                    message="Удалить корзину? Все позиции будут потеряны."
                    onConfirm={() => handleDeleteCart(confirmDelete)}
                    onCancel={() => setConfirmDelete(null)}
                />
            )}

            {confirmDeleteItem && (
                <ConfirmModal
                    message="Удалить позицию и все её комплектующие?"
                    onConfirm={() => handleDeleteItem(confirmDeleteItem.itemId)}
                    onCancel={() => setConfirmDeleteItem(null)}
                />
            )}
        </div>
    );
}

// ── Строка позиции ────────────────────────────────────────────────────────────

function CartItemRow({
    item, cartId,
    onQtyChange, onDelete, onSuggest,
    onDeleteAccessory, onQtyChangeAccessory,
}) {
    const price = item.price;
    const lineTotal = item.line_total;

    return (
        <div className="border-b border-gray-100 dark:border-gray-800 last:border-0">
            {/* Основное изделие */}
            <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {item.product_name}
                    </div>
                    {item.product_sku && (
                        <div className="text-xs font-mono text-gray-400">{item.product_sku}</div>
                    )}
                    {/* Параметры */}
                    {item.parameters && Object.keys(item.parameters).length > 0 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                            {Object.entries(item.parameters).map(([k, v]) => (
                                <span key={k} className="text-xs text-gray-400 dark:text-gray-500">
                                    {k}: <span className="text-gray-600 dark:text-gray-300">{v}</span>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Кол-во */}
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={() => onQtyChange(item, -1)}
                        className="w-6 h-6 rounded text-gray-500 hover:text-gray-900
                                   dark:hover:text-white hover:bg-neutral-100
                                   dark:hover:bg-neutral-800 transition-colors text-sm">
                        −
                    </button>
                    <span className="w-8 text-center text-sm text-gray-900 dark:text-white">
                        {item.quantity}
                    </span>
                    <button
                        onClick={() => onQtyChange(item, +1)}
                        className="w-6 h-6 rounded text-gray-500 hover:text-gray-900
                                   dark:hover:text-white hover:bg-neutral-100
                                   dark:hover:bg-neutral-800 transition-colors text-sm">
                        +
                    </button>
                </div>

                {/* Цена */}
                <div className="text-right shrink-0 w-28">
                    {price != null ? (
                        <>
                            <div className="text-sm text-gray-900 dark:text-white">
                                {lineTotal?.toLocaleString('ru-RU')} ₽
                            </div>
                            <div className="text-xs text-gray-400">
                                {price?.toLocaleString('ru-RU')} ₽/шт
                            </div>
                        </>
                    ) : (
                        <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                    )}
                </div>

                {/* Действия */}
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={onSuggest}
                        className="text-xs px-2 py-1 rounded text-gray-400 hover:text-blue-500
                                   hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        title="Подобрать комплектующие">
                        ⚙
                    </button>
                    <button
                        onClick={onDelete}
                        className="text-xs px-2 py-1 rounded text-gray-400 hover:text-red-500
                                   hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        ✕
                    </button>
                </div>
            </div>

            {/* Комплектующие */}
            {item.children?.map(acc => (
                <div key={acc.id}
                    className="flex items-center gap-3 px-4 py-2
                               bg-neutral-50/50 dark:bg-neutral-800/30
                               border-t border-gray-50 dark:border-gray-800/50">
                    <div className="w-3 shrink-0 text-gray-300 dark:text-gray-600 text-xs">└</div>
                    <div className="flex-1 min-w-0">
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                            {acc.product_name}
                        </span>
                        {acc.suggested_by_rule && (
                            <span className="ml-1.5 text-[10px] text-blue-400">авто</span>
                        )}
                        {acc.product_sku && (
                            <span className="ml-1.5 text-[10px] font-mono text-gray-400">
                                {acc.product_sku}
                            </span>
                        )}
                    </div>

                    {/* Кол-во */}
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={() => onQtyChangeAccessory(acc, -1)}
                            className="w-5 h-5 rounded text-gray-400 hover:text-gray-700
                                       dark:hover:text-white hover:bg-neutral-100
                                       dark:hover:bg-neutral-800 transition-colors text-xs">
                            −
                        </button>
                        <span className="w-6 text-center text-xs text-gray-700 dark:text-gray-300">
                            {acc.quantity}
                        </span>
                        <button
                            onClick={() => onQtyChangeAccessory(acc, +1)}
                            className="w-5 h-5 rounded text-gray-400 hover:text-gray-700
                                       dark:hover:text-white hover:bg-neutral-100
                                       dark:hover:bg-neutral-800 transition-colors text-xs">
                            +
                        </button>
                    </div>

                    {/* Цена */}
                    <div className="text-right shrink-0 w-28">
                        {acc.price != null ? (
                            <>
                                <div className="text-xs text-gray-700 dark:text-gray-300">
                                    {acc.line_total?.toLocaleString('ru-RU')} ₽
                                </div>
                                <div className="text-[10px] text-gray-400">
                                    {acc.price?.toLocaleString('ru-RU')} ₽/шт
                                </div>
                            </>
                        ) : (
                            <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                        )}
                    </div>

                    <button
                        onClick={() => onDeleteAccessory(acc.id)}
                        className="text-xs px-2 py-1 rounded text-gray-300 hover:text-red-500
                                   hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0">
                        ✕
                    </button>
                </div>
            ))}
        </div>
    );
}