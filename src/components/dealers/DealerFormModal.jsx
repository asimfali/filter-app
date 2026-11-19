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
});

// Разбор ошибок полей: конверт портала {"success": false, "error": {"fields": {...}}}
// или обычный DRF-ответ {"inn": ["..."], ...}
const FIELDS = ['inn', 'name', 'group', 'legal_address', 'phones', 'director', 'website', 'email', 'letter_sent_at', 'code'];
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

// Справочник дилеров: ИНН, группа контрагента, реквизиты, дата письма. Код D#####
// генерирует портал, поэтому во фронте он только отображается (и только в режиме редактирования).
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
        };

        try {
            // Портал правит дилера по id; ИНН редактируемый (unique проверяет бэкенд)
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
            setError('Не удалось сохранить дилера');
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
            title={isEdit ? 'Дилер' : 'Новый дилер'}
            subtitle={isEdit ? form.name : 'Код D##### присвоит портал после сохранения'}
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
                <div>
                    <label className={labelCls} htmlFor="dealer-code">Код авторизации</label>
                    <input
                        id="dealer-code"
                        className={inputCls}
                        value={isEdit ? (dealer.code ?? '') : ''}
                        placeholder={isEdit ? '' : 'присвоит портал'}
                        disabled
                        readOnly
                    />
                    <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                        Генерируется порталом, не редактируется.
                    </p>
                </div>
                {field('name', 'Название', { required: true, wide: true })}
                {field('group', 'Группа', { options: groups })}
                {field('legal_address', 'Юридический адрес', { wide: true })}
                {field('director', 'Директор')}
                {field('phones', 'Телефоны', { placeholder: 'через запятую' })}
                {field('website', 'Сайт')}
                {field('email', 'E-mail', { type: 'email' })}
                {field('letter_sent_at', 'Дата письма', { type: 'date' })}
                {/* Публикация контактов: телефоны/e-mail/сайт уходят на сайт только при
                    включённой галочке; снятая галочка данные не стирает */}
                <label className="md:col-span-2 flex items-start gap-2 text-sm
                    text-gray-700 dark:text-gray-300">
                    <input type="checkbox" className="mt-0.5 rounded"
                        aria-label="Публиковать контакты"
                        checked={form.contacts_published}
                        onChange={e => set('contacts_published', e.target.checked)} />
                    <span>
                        Публиковать контакты
                        <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                            Телефоны, e-mail и сайт уходят на сайт только при включённой галочке.
                            Снятая галочка данные не стирает — контакты просто перестают
                            отдаваться наружу.
                        </span>
                    </span>
                </label>
            </div>

            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </Modal>
    );
}
