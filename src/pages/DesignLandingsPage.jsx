import React, { useEffect, useState } from 'react';
import { catalogApi } from '../api/catalog';
import { mediaApi } from '../api/media';
import { parseError } from '../utils';
import { inputCls } from '../utils/styles';
import { useModals } from '../hooks/useModals';
import AuthImage from '../components/media/AuthImage';
import { AddFileRow } from './documents/FileRow';

const DESIGN_AXIS_CODE = 'design';
const DESIGN_LANDING_DOC_TYPE_CODE = 'design_landing';

// ── Блоки: типы, дефолты, подписи ─────────────────────────────────────────

const BLOCK_TYPES = ['intro', 'text_image', 'two_variants', 'finish', 'notes'];

const BLOCK_LABELS = {
    intro: 'Вступление',
    text_image: 'Текст + фото',
    two_variants: 'Два исполнения',
    finish: 'Отделка',
    notes: 'Заметки',
};

function makeBlock(type) {
    switch (type) {
        case 'intro': return { type, lead: '', tiles: [] };
        case 'text_image': return { type, title: '', text: '', image: '', image_position: 'left' };
        case 'two_variants': return { type, variants: [{ image: '', label: '' }, { image: '', label: '' }] };
        case 'finish': return { type, text: '', variants: [{ label: '', image: '' }] };
        case 'notes': return { type, text: '' };
        default: return { type };
    }
}

// Картинки блоков грузятся через существующий документный upload-флоу
// (doc_type code=design_landing, external_id=id значения оси, на которое
// "заякорен" лендинг) — тот же DocumentType/DropZone-пайплайн, что и у любых
// других документов с привязкой по осям, только с allow_multiple_files.
// В блок пишется просто имя файла (`image`), не URL — CDN-адрес по конвенции
// design_landing/{value_id}/{filename} резолвит сайт.
let designLandingDocTypePromise = null;
function getDesignLandingDocType() {
    if (!designLandingDocTypePromise) {
        designLandingDocTypePromise = mediaApi.getFormData().then(({ ok, data }) =>
            ok ? (data.doc_types || []).find(dt => dt.code === DESIGN_LANDING_DOC_TYPE_CODE) || null : null
        );
    }
    return designLandingDocTypePromise;
}

async function loadDesignLandingFiles(anchorValueId) {
    const { ok, data } = await mediaApi.getDocuments(String(anchorValueId));
    if (!ok) return [];
    const doc = (data.documents || []).find(
        d => d.doc_type?.code === DESIGN_LANDING_DOC_TYPE_CODE && d.external_id === String(anchorValueId)
    );
    return doc?.current || [];
}

function ImageField({ value, onChange, anchorValueId, label = 'Картинка' }) {
    const [open, setOpen] = useState(false);
    const [docType, setDocType] = useState(null);
    const [files, setFiles] = useState([]);
    const [loadingFiles, setLoadingFiles] = useState(false);

    useEffect(() => {
        if (!open || !anchorValueId) return;
        let cancelled = false;
        (async () => {
            setLoadingFiles(true);
            const [dt, current] = await Promise.all([
                getDesignLandingDocType(),
                loadDesignLandingFiles(anchorValueId),
            ]);
            if (cancelled) return;
            setDocType(dt);
            setFiles(current);
            setLoadingFiles(false);
        })();
        return () => { cancelled = true; };
    }, [open, anchorValueId]);

    const refreshFiles = async () => {
        if (!anchorValueId) return;
        setFiles(await loadDesignLandingFiles(anchorValueId));
    };

    return (
        <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
            <div className="flex gap-1.5">
                <input value={value || ''} onChange={e => onChange(e.target.value)}
                    placeholder="имя файла" className={`${inputCls} flex-1`} />
                <button type="button" onClick={() => setOpen(o => !o)} disabled={!anchorValueId}
                    className="text-xs px-2 rounded border border-gray-300 dark:border-gray-600
                               text-gray-600 dark:text-gray-300 hover:bg-neutral-50 dark:hover:bg-neutral-800
                               disabled:opacity-40 shrink-0">
                    {open ? 'Скрыть' : 'Выбрать'}
                </button>
            </div>
            {!anchorValueId && (
                <p className="text-[10px] text-gray-400 mt-1">Сначала выберите значение оси выше</p>
            )}
            {open && anchorValueId && (
                <div className="mt-1.5 border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1.5">
                    {loadingFiles ? (
                        <div className="text-xs text-gray-400">Загрузка...</div>
                    ) : files.length === 0 ? (
                        <div className="text-xs text-gray-400">Файлов ещё нет</div>
                    ) : (
                        <div className="grid grid-cols-4 gap-1.5">
                            {files.map(f => (
                                <button key={f.rel_path} type="button"
                                    onClick={() => { onChange(f.name); setOpen(false); }}
                                    className={`border rounded p-1 text-left ${value === f.name
                                        ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'}`}>
                                    <AuthImage relPath={f.rel_path} alt={f.name}
                                        className="w-full h-12 object-cover rounded mb-1" />
                                    <div className="text-[10px] text-gray-500 truncate">{f.name}</div>
                                </button>
                            ))}
                        </div>
                    )}
                    {docType && (
                        <AddFileRow docTypeId={docType.id} externalId={String(anchorValueId)}
                            onUploaded={refreshFiles} />
                    )}
                </div>
            )}
        </div>
    );
}

// ── Формы блоков ───────────────────────────────────────────────────────────

function IntroBlockForm({ block, onChange }) {
    const tiles = block.tiles || [];
    const updateTile = (i, patch) => onChange({ tiles: tiles.map((t, idx) => idx === i ? { ...t, ...patch } : t) });
    const addTile = () => tiles.length < 4 && onChange({ tiles: [...tiles, { icon: '', title: '', text: '' }] });
    const removeTile = (i) => onChange({ tiles: tiles.filter((_, idx) => idx !== i) });

    return (
        <div className="space-y-3">
            <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Лид-текст</label>
                <textarea rows={2} value={block.lead || ''} onChange={e => onChange({ lead: e.target.value })}
                    className={inputCls} />
            </div>
            <div>
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Тайлы (до 4)</span>
                    <button type="button" onClick={addTile} disabled={tiles.length >= 4}
                        className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-40">
                        + Тайл
                    </button>
                </div>
                <div className="space-y-2">
                    {tiles.map((t, i) => (
                        <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1.5">
                            <div className="flex gap-1.5">
                                <input value={t.icon || ''} onChange={e => updateTile(i, { icon: e.target.value })}
                                    placeholder="иконка (lucide, напр. thermometer)" className={`${inputCls} flex-1`} />
                                <button type="button" onClick={() => removeTile(i)}
                                    className="text-red-400 hover:text-red-600 text-xs px-2">✕</button>
                            </div>
                            <input value={t.title || ''} onChange={e => updateTile(i, { title: e.target.value })}
                                placeholder="Заголовок" className={inputCls} />
                            <textarea rows={2} value={t.text || ''} onChange={e => updateTile(i, { text: e.target.value })}
                                placeholder="Текст" className={inputCls} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function TextImageBlockForm({ block, onChange, anchorValueId }) {
    const variants = block.text_variants || {};
    const entries = Object.entries(variants);
    const [showVariants, setShowVariants] = useState(entries.length > 0);

    const updateVariantEntry = (oldKey, newKey, text) => {
        const next = { ...variants };
        if (oldKey !== newKey) delete next[oldKey];
        next[newKey] = text;
        onChange({ text_variants: next });
    };
    const removeVariantEntry = (key) => {
        const next = { ...variants };
        delete next[key];
        onChange({ text_variants: next });
    };
    const addVariantEntry = () => { setShowVariants(true); onChange({ text_variants: { ...variants, '': '' } }); };

    return (
        <div className="space-y-3">
            <input value={block.title || ''} onChange={e => onChange({ title: e.target.value })}
                placeholder="Заголовок" className={inputCls} />
            <textarea rows={3} value={block.text || ''} onChange={e => onChange({ text: e.target.value })}
                placeholder="Текст" className={inputCls} />
            <div className="flex gap-3 items-end">
                <div className="flex-1">
                    <ImageField value={block.image} onChange={v => onChange({ image: v })} anchorValueId={anchorValueId} />
                </div>
                <select value={block.image_position || 'left'} onChange={e => onChange({ image_position: e.target.value })}
                    className={`${inputCls} w-40`}>
                    <option value="left">Фото слева</option>
                    <option value="right">Фото справа</option>
                </select>
            </div>
            <div>
                <button type="button" onClick={() => setShowVariants(s => !s)}
                    className="text-xs text-gray-400 hover:text-gray-600 underline">
                    Текст по типу нагрева (опционально, только для «Колонны»)
                </button>
                {showVariants && (
                    <div className="mt-2 space-y-1.5">
                        {entries.map(([key, text]) => (
                            <div key={key} className="flex gap-1.5">
                                <input value={key} onChange={e => updateVariantEntry(key, e.target.value, text)}
                                    placeholder="слаг оси нагрева" className={`${inputCls} w-40`} />
                                <input value={text} onChange={e => updateVariantEntry(key, key, e.target.value)}
                                    placeholder="текст" className={`${inputCls} flex-1`} />
                                <button type="button" onClick={() => removeVariantEntry(key)}
                                    className="text-red-400 hover:text-red-600 text-xs px-2">✕</button>
                            </div>
                        ))}
                        <button type="button" onClick={addVariantEntry}
                            className="text-xs text-blue-600 hover:text-blue-800">+ Вариант</button>
                    </div>
                )}
            </div>
        </div>
    );
}

function TwoVariantsBlockForm({ block, onChange, anchorValueId }) {
    const variants = block.variants && block.variants.length === 2
        ? block.variants : [{ image: '', label: '' }, { image: '', label: '' }];
    const updateVariant = (i, patch) => onChange({ variants: variants.map((v, idx) => idx === i ? { ...v, ...patch } : v) });

    return (
        <div className="grid grid-cols-2 gap-3">
            {[0, 1].map(i => (
                <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1.5">
                    <input value={variants[i]?.label || ''} onChange={e => updateVariant(i, { label: e.target.value })}
                        placeholder={`Подпись исполнения ${i + 1}`} className={inputCls} />
                    <ImageField value={variants[i]?.image} onChange={v => updateVariant(i, { image: v })} anchorValueId={anchorValueId} />
                </div>
            ))}
        </div>
    );
}

function FinishBlockForm({ block, onChange, anchorValueId }) {
    const variants = block.variants || [];
    const updateVariant = (i, patch) => onChange({ variants: variants.map((v, idx) => idx === i ? { ...v, ...patch } : v) });
    const addVariant = () => onChange({ variants: [...variants, { label: '', image: '' }] });
    const removeVariant = (i) => onChange({ variants: variants.filter((_, idx) => idx !== i) });

    return (
        <div className="space-y-3">
            <textarea rows={2} value={block.text || ''} onChange={e => onChange({ text: e.target.value })}
                placeholder="Текст" className={inputCls} />
            <div>
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Варианты материала/цвета</span>
                    <button type="button" onClick={addVariant}
                        className="text-xs text-blue-600 hover:text-blue-800">+ Вариант</button>
                </div>
                <div className="space-y-2">
                    {variants.map((v, i) => (
                        <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-2 flex gap-1.5 items-end">
                            <input value={v.label || ''} onChange={e => updateVariant(i, { label: e.target.value })}
                                placeholder="Название" className={`${inputCls} flex-1`} />
                            <div className="flex-1">
                                <ImageField value={v.image} onChange={val => updateVariant(i, { image: val })} anchorValueId={anchorValueId} />
                            </div>
                            <button type="button" onClick={() => removeVariant(i)}
                                className="text-red-400 hover:text-red-600 text-xs px-2">✕</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function NotesBlockForm({ block, onChange }) {
    return (
        <textarea rows={3} value={block.text || ''} onChange={e => onChange({ text: e.target.value })}
            placeholder="Текст" className={inputCls} />
    );
}

const BLOCK_FORMS = {
    intro: IntroBlockForm,
    text_image: TextImageBlockForm,
    two_variants: TwoVariantsBlockForm,
    finish: FinishBlockForm,
    notes: NotesBlockForm,
};

// ── Черновой превью блока (структура, не вёрстка сайта) ───────────────────

function BlockPreview({ block }) {
    switch (block.type) {
        case 'intro':
            return (
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-2">
                    {block.lead && <p className="italic">{block.lead}</p>}
                    {(block.tiles || []).length > 0 && (
                        <div className="grid grid-cols-4 gap-2">
                            {block.tiles.map((t, i) => (
                                <div key={i} className="bg-neutral-50 dark:bg-neutral-950 rounded p-2 text-center">
                                    <div className="text-[10px] text-gray-400">{t.icon || '—'}</div>
                                    <div className="font-medium text-gray-700 dark:text-gray-300 truncate">{t.title || '—'}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        case 'text_image':
            return (
                <div className={`flex gap-3 text-xs text-gray-500 dark:text-gray-400 ${block.image_position === 'right' ? 'flex-row-reverse' : ''}`}>
                    <div className="w-20 h-14 shrink-0 bg-neutral-100 dark:bg-neutral-800 rounded flex items-center justify-center text-[10px] text-gray-400">
                        {block.image || 'фото'}
                    </div>
                    <div className="min-w-0">
                        <div className="font-medium text-gray-700 dark:text-gray-300">{block.title || '—'}</div>
                        <div className="line-clamp-2">{block.text || '—'}</div>
                    </div>
                </div>
            );
        case 'two_variants':
            return (
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {(block.variants || []).map((v, i) => (
                        <div key={i} className="bg-neutral-50 dark:bg-neutral-950 rounded p-2 text-center">
                            <div className="h-10 flex items-center justify-center text-[10px] text-gray-400">{v.image || 'фото'}</div>
                            <div>{v.label || '—'}</div>
                        </div>
                    ))}
                </div>
            );
        case 'finish':
            return (
                <div className="flex gap-1.5 flex-wrap text-xs text-gray-500 dark:text-gray-400">
                    {(block.variants || []).map((v, i) => (
                        <span key={i} className="px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800">{v.label || '—'}</span>
                    ))}
                </div>
            );
        case 'notes':
            return <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{block.text || '—'}</p>;
        default:
            return null;
    }
}

function BlockCard({ block, index, count, onChange, onMove, onRemove, anchorValueId }) {
    const Form = BLOCK_FORMS[block.type];
    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-neutral-900">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {index + 1}. {BLOCK_LABELS[block.type] || block.type}
                </span>
                <div className="flex gap-1">
                    <button type="button" onClick={() => onMove(-1)} disabled={index === 0}
                        className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30 px-1.5">↑</button>
                    <button type="button" onClick={() => onMove(1)} disabled={index === count - 1}
                        className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30 px-1.5">↓</button>
                    <button type="button" onClick={onRemove}
                        className="text-xs text-red-400 hover:text-red-600 px-1.5">Удалить</button>
                </div>
            </div>
            {Form && <Form block={block} onChange={patch => onChange({ ...block, ...patch })} anchorValueId={anchorValueId} />}
            <div className="mt-2 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                <div className="text-[10px] uppercase text-gray-400 mb-1">Черновой превью</div>
                <BlockPreview block={block} />
            </div>
        </div>
    );
}

// ── Редактор одного лендинга ────────────────────────────────────────────────

function DesignLandingEditor({ valueId, values, existingLanding, onBack, onSaved }) {
    const [selectedValueIds, setSelectedValueIds] = useState(
        existingLanding ? existingLanding.values : [valueId]
    );
    const [blocks, setBlocks] = useState(existingLanding?.blocks || []);
    const [isPublished, setIsPublished] = useState(existingLanding?.is_published || false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const { showConfirm, modals } = useModals();

    // Картинки блоков грузятся в папку одного "якорного" значения (external_id
    // документа = id значения) — для лендинга на несколько values (одна "семья"
    // дизайнов) поле image_folder_value хранит это явно на бэке (а не только
    // угадывается на UI), сайт резолвит CDN-ссылки по тому же полю.
    const [anchorValueId, setAnchorValueId] = useState(
        existingLanding?.image_folder_value ?? selectedValueIds[0] ?? null
    );
    useEffect(() => {
        if (!selectedValueIds.includes(anchorValueId)) {
            setAnchorValueId(selectedValueIds[0] ?? null);
        }
    }, [selectedValueIds]); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleValue = (id) => setSelectedValueIds(ids =>
        ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);

    const updateBlock = (i, next) => setBlocks(bs => bs.map((b, idx) => idx === i ? next : b));
    const removeBlock = (i) => setBlocks(bs => bs.filter((_, idx) => idx !== i));
    const moveBlock = (i, dir) => setBlocks(bs => {
        const j = i + dir;
        if (j < 0 || j >= bs.length) return bs;
        const next = [...bs];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
    });
    const addBlock = (type) => setBlocks(bs => [...bs, makeBlock(type)]);

    const handleSave = async () => {
        if (!selectedValueIds.length) { setError('Выберите хотя бы одно значение оси'); return; }
        setSaving(true);
        setError('');
        const payload = { values: selectedValueIds, blocks, is_published: isPublished, image_folder_value: anchorValueId };
        const res = existingLanding
            ? await catalogApi.updateDesignLanding(existingLanding.id, payload)
            : await catalogApi.createDesignLanding(payload);
        setSaving(false);
        if (res.ok) onSaved();
        else setError(parseError(res.data, res.status));
    };

    const handleDelete = () => {
        if (!existingLanding) return;
        showConfirm('Удалить лендинг целиком? Действие необратимо.', async () => {
            await catalogApi.deleteDesignLanding(existingLanding.id);
            onSaved();
        });
    };

    return (
        <div className="space-y-4">
            {modals}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                    <button onClick={onBack}
                        className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                        ← Назад
                    </button>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Лендинг дизайна
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
                        <button onClick={() => setIsPublished(false)}
                            className={`px-3 py-1.5 rounded text-sm transition-colors ${!isPublished
                                ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                                : 'text-gray-500 hover:text-gray-700'}`}>
                            Черновик
                        </button>
                        <button onClick={() => setIsPublished(true)}
                            className={`px-3 py-1.5 rounded text-sm transition-colors ${isPublished
                                ? 'bg-emerald-600 text-white shadow-sm font-medium'
                                : 'text-gray-500 hover:text-gray-700'}`}>
                            Опубликовано
                        </button>
                    </div>
                    {existingLanding && (
                        <button onClick={handleDelete}
                            className="text-sm text-red-500 hover:text-red-700 px-2">Удалить</button>
                    )}
                    <button onClick={handleSave} disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                                   text-white text-sm px-4 py-2 rounded-lg transition-colors">
                        {saving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
                    {error}
                </div>
            )}

            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-4">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    Значения оси «Дизайн», для которых этот лендинг
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {values.map(v => {
                        const isSelected = selectedValueIds.includes(v.id);
                        return (
                            <button key={v.id} type="button" onClick={() => toggleValue(v.id)}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all
                                    ${isSelected
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-neutral-100 dark:bg-neutral-700 text-gray-600 dark:text-gray-300 hover:bg-neutral-200'}`}>
                                {v.value}
                            </button>
                        );
                    })}
                </div>
                {selectedValueIds.length > 1 && (
                    <div className="mt-3 flex items-center gap-2">
                        <label className="text-xs text-gray-500 dark:text-gray-400">Папка для картинок:</label>
                        <select value={anchorValueId ?? ''} onChange={e => setAnchorValueId(Number(e.target.value))}
                            className={`${inputCls} w-auto`}>
                            {selectedValueIds.map(id => (
                                <option key={id} value={id}>{values.find(v => v.id === id)?.value || id}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Блоки</span>
                    <div className="flex gap-1 flex-wrap">
                        {BLOCK_TYPES.map(t => (
                            <button key={t} type="button" onClick={() => addBlock(t)}
                                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded transition-colors">
                                + {BLOCK_LABELS[t]}
                            </button>
                        ))}
                    </div>
                </div>
                {blocks.length === 0 ? (
                    <div className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center border-2 border-dashed
                            border-gray-200 dark:border-gray-700 rounded-lg">
                        Нет блоков. Добавьте первый.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {blocks.map((b, i) => (
                            <BlockCard key={i} block={b} index={i} count={blocks.length}
                                onChange={next => updateBlock(i, next)}
                                onMove={dir => moveBlock(i, dir)}
                                onRemove={() => removeBlock(i)}
                                anchorValueId={anchorValueId} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Список значений оси design ──────────────────────────────────────────────

export default function DesignLandingsPage() {
    // "design" — НЕ общая (global) ось: на бэке это отдельная ось на каждый
    // product_type (напр. «Завесы»/«Фанкойлы»), объединённых только code='design' —
    // ровно так это провалидировано и в ParameterValueLanding.values. Значит нужно
    // собрать значения со всех осей с этим кодом, а не искать одну общую ось.
    const [designAxes, setDesignAxes] = useState([]);
    const [values, setValues] = useState([]);
    const [landings, setLandings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingValueId, setEditingValueId] = useState(null);

    const load = async () => {
        setLoading(true);
        const axesRes = await catalogApi.parameterAxes();
        const axesList = Array.isArray(axesRes.data) ? axesRes.data : (axesRes.data.results || []);
        const matchingAxes = axesList.filter(a => a.code === DESIGN_AXIS_CODE);
        setDesignAxes(matchingAxes);
        if (!matchingAxes.length) {
            setValues([]);
            setLandings([]);
            setLoading(false);
            return;
        }

        const [valuesResList, landingsRes] = await Promise.all([
            Promise.all(matchingAxes.map(a => catalogApi.parameterValues(a.id))),
            catalogApi.designLandings(),
        ]);
        const merged = matchingAxes.flatMap((a, i) => {
            const res = valuesResList[i];
            const list = Array.isArray(res.data) ? res.data : (res.data.results || []);
            return list.map(v => ({ ...v, _axisId: a.id, _productTypeName: a.product_type_name }));
        });
        setValues(merged);
        setLandings(Array.isArray(landingsRes.data) ? landingsRes.data : (landingsRes.data.results || []));
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const landingByValueId = {};
    landings.forEach(l => (l.values || []).forEach(vid => { landingByValueId[vid] = l; }));

    if (editingValueId !== null) {
        return (
            <DesignLandingEditor
                valueId={editingValueId}
                values={values}
                existingLanding={landingByValueId[editingValueId] || null}
                onBack={() => setEditingValueId(null)}
                onSaved={async () => { await load(); setEditingValueId(null); }}
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                    Лендинги дизайна
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0">
                    Контент «рассказа о дизайне» для страниц товара на сайте — по значениям осей «Дизайн»
                    {designAxes.length > 0 && ` (${designAxes.map(a => a.product_type_name).join(', ')})`}
                </p>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-4">
                {loading ? (
                    <div className="text-sm text-gray-400 dark:text-gray-500 py-4">Загрузка...</div>
                ) : designAxes.length === 0 ? (
                    <div className="text-sm text-red-500 py-4">
                        Ни у одного типа продукции нет оси «design» — обратитесь к администратору каталога.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {designAxes.map(a => {
                            const axisValues = values.filter(v => v._axisId === a.id);
                            return (
                                <div key={a.id}>
                                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                                        {a.product_type_name}
                                    </div>
                                    {axisValues.length === 0 ? (
                                        <div className="text-sm text-gray-400 dark:text-gray-500 py-2">Нет значений.</div>
                                    ) : (
                                        <div className="space-y-1">
                                            {axisValues.map(v => {
                                                const landing = landingByValueId[v.id];
                                                return (
                                                    <div key={v.id} onClick={() => setEditingValueId(v.id)}
                                                        className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-950
                                                                   hover:bg-neutral-100 dark:hover:bg-neutral-800
                                                                   border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5
                                                                   cursor-pointer transition-colors">
                                                        <span className="text-sm text-gray-800 dark:text-gray-200">{v.value}</span>
                                                        {landing ? (
                                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                                                                ${landing.is_published
                                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                                                                {landing.is_published ? 'Опубликовано' : 'Черновик'} · {landing.blocks?.length || 0} блок.
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">Нет лендинга</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
