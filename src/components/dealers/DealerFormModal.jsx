import { useState } from 'react';
import Modal from '../common/Modal';
import ModalFooter from '../common/ModalFooter';
import { inputCls } from '../../utils/styles';
import { envelopeError } from '../../utils';
import { dealersApi } from '../../api/dealers';

const EMPTY = {
    inn: '',
    name: '',
    group: 'dealer',
    legal_address: '',
    phones: '',
    director: '',
    website: '',
    email: '',
    letter_sent_at: '',
    contacts_published: false,
    is_published: true,
};

const fromDealer = (dealer) => ({
    inn: dealer.inn ?? '',
    name: dealer.name ?? '',
    group: dealer.group ?? 'dealer',
    legal_address: dealer.legal_address ?? '',
    phones: dealer.phones ?? '',
    director: dealer.director ?? '',
    website: dealer.website ?? '',
    email: dealer.email ?? '',
    letter_sent_at: dealer.letter_sent_at ? String(dealer.letter_sent_at).slice(0, 10) : '',
    contacts_published: dealer.contacts_published === true,
    // Старый портал флаг не отдаёт — считаем запись опубликованной, как оно и было
    is_published: dealer.is_published !== false,
});

// Разбор ошибок полей: конверт портала {"success": false, "error": {"fields": {...}}}
// или обычный DRF-ответ {"inn": ["..."], ...}
const FIELDS = ['inn', 'name', 'group', 'legal_address', 'phones', 'director', 'website', 'email', 'letter_sent_at'];
const fieldErrors = (body) => {
    const raw = body?.error?.fields ?? body;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out = {};
    FIELDS.forEach((key) => {
        if (!raw[key]) return;
        out[key] = Array.isArray(raw[key]) ? raw[key].join(' ') : String(raw[key]);
    });
    return out;
};

const labelCls = 'block text-xs text-gray-500 dark:text-gray-400 mb-1';
const errCls = 'mt-1 text-xs text-red-500 dark:text-red-400';

// Справочник партнёров: ИНН, группа контрагента, реквизиты, дата письма. Код авторизации
// (только у группы dealer) генерирует портал — в форме его нет, он виден в таблице.
export default function DealerFormModal({ dealer, groups = [], onClose, onSaved }) {
    const isEdit = Boolean(dealer);
    const [form, setForm] = useState(() => (isEdit ? fromDealer(dealer) : { ...EMPTY }));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [fields, setFields] = useState({});

    const set = (key, value) => {
        setForm(prev => ({ ...prev, [key]: value }));
        setFields(prev => (prev[key] ? { ...prev, [key]: '' } : prev));
    };

    const validate = () => {
        const errs = {};
        const inn = form.inn.trim();
        if (!inn) errs.inn = 'Укажите ИНН';
        else if (!/^\d{4,14}$/.test(inn)) errs.inn = 'ИНН — только цифры, от 4 до 14';
        if (!form.name.trim()) errs.name = 'Укажите название';
        setFields(errs);
        return Object.keys(errs).length === 0;
    };

    const submit = async () => {
        if (saving || !validate()) return;
        setSaving(true);
        setError('');
        setFields({});

        const payload = {
            inn: form.inn.trim(),
            name: form.name.trim(),
            group: form.group,
            legal_address: form.legal_address.trim(),
            phones: form.phones.trim(),
            director: form.director.trim(),
            website: form.website.trim(),
            email: form.email.trim(),
            letter_sent_at: form.letter_sent_at || null,
            contacts_published: form.contacts_published,
            is_published: form.is_published,
        };

        try {
            // Портал правит партнёра по id; ИНН редактируемый (unique проверяет бэкенд)
            const { ok, data: body, status } = isEdit
                ? await dealersApi.update(dealer.id, payload)
                : await dealersApi.create(payload);

            if (!ok || body?.success === false) {
                const errs = fieldErrors(body);
                setFields(errs);
                // если ошибки разложены по полям, общий текст не дублируем
                setError(Object.keys(errs).length ? '' : envelopeError(body, status));
                return;
            }
            onSaved?.();
        } catch {
            setError('Не удалось сохранить партнёра');
        } finally {
            setSaving(false);
        }
    };

    // options — тогда вместо input рисуем select (группа: значения и подписи с портала)
    const field = (key, label, { required, wide, options, ...rest } = {}) => (
        <div className={wide ? 'md:col-span-2' : ''}>
            <label className={labelCls} htmlFor={`dealer-${key}`}>
                {label}{required ? ' *' : ''}
            </label>
            {options ? (
                <select
                    id={`dealer-${key}`}
                    className={inputCls}
                    value={form[key]}
                    onChange={e => set(key, e.target.value)}
                >
                    {options.map(({ value, label: optionLabel }) => (
                        <option key={value} value={value}>{optionLabel}</option>
                    ))}
                </select>
            ) : (
                <input
                    id={`dealer-${key}`}
                    className={inputCls}
                    value={form[key]}
                    onChange={e => set(key, e.target.value)}
                    {...rest}
                />
            )}
            {fields[key] && <p className={errCls}>{fields[key]}</p>}
        </div>
    );

    return (
        <Modal
            title={isEdit ? 'Партнёр' : 'Новый партнёр'}
            subtitle={isEdit ? form.name : undefined}
            onClose={onClose}
            maxWidth="xl"
            scrollBody
            footer={(
                <ModalFooter
                    onClose={onClose}
                    onConfirm={submit}
                    loading={saving}
                    confirmLabel={isEdit ? 'Сохранить' : 'Создать'}
                />
            )}
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {field('inn', 'ИНН', { required: true, inputMode: 'numeric', placeholder: '0123456789' })}
                {field('name', 'Название', { required: true, wide: true })}
                {field('group', 'Группа', { options: groups })}
                {field('legal_address', 'Юридический адрес', { wide: true })}
                {field('director', 'Директор')}
                {field('phones', 'Телефоны', { placeholder: 'через запятую' })}
                {field('website', 'Сайт')}
                {field('email', 'E-mail', { type: 'email' })}
                {field('letter_sent_at', 'Дата письма', { type: 'date' })}
                {/* Два уровня публикации: запись целиком уходит на сайт по is_published
                    (карта «Сеть присутствия» + проверка партнёра), а телефоны/e-mail/сайт —
                    только при contacts_published. Снятая галочка данные не стирает. */}
                <div className="md:col-span-2 space-y-2 pt-1">
                    <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input type="checkbox" className="mt-0.5 rounded"
                            aria-label="Показывать на сайте"
                            checked={form.is_published}
                            onChange={e => set('is_published', e.target.checked)} />
                        <span>
                            Показывать запись на сайте
                            <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                                Запись уходит в выгрузку для сайта: карта «Сеть присутствия» и
                                проверка авторизации. Снятая галочка убирает партнёра с сайта
                                целиком, данные на портале остаются.
                            </span>
                        </span>
                    </label>
                    <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input type="checkbox" className="mt-0.5 rounded"
                            aria-label="Публиковать контакты"
                            checked={form.contacts_published}
                            onChange={e => set('contacts_published', e.target.checked)} />
                        <span>
                            Публиковать контакты
                            <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                                Телефоны, e-mail и сайт показываются на сайте только при этой
                                галочке — даже если запись опубликована. Снятая галочка данные
                                не стирает.
                            </span>
                        </span>
                    </label>
                </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </Modal>
    );
}
