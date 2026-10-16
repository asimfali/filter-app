export const ARCHIVED_NOTICE = 'Файл старше действующего — сохранён в архив';

export function parseError(data, status) {
    if (status === 403) return data?.detail || 'Недостаточно прав';
    if (data?.detail) return data.detail;
    if (data && typeof data === 'object') return Object.values(data).flat().join(', ');
    return 'Неизвестная ошибка';
}

// Ошибка из конверта {success:false, error:{code, message}} или {error: "строка"}, иначе DRF-форматы через parseError
export const envelopeError = (data, status) =>
    data?.error?.message || (typeof data?.error === 'string' && data.error) || parseError(data, status);

// Кириллица → латинский slug (a-z0-9_): «Вид нагрева» → «vid_nagreva»
const TRANSLIT = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l',
    м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch',
    ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
export const translitSlug = (text) => String(text ?? '').toLowerCase()
    .replace(/[а-яё]/g, ch => TRANSLIT[ch])
    .replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '');

// ISO-дата/время → «дд.мм.гггг[ чч:мм]» (ru-RU), пусто → '—'
export const fmtDate = (iso, withTime = false) => iso
    ? new Date(iso).toLocaleString('ru-RU', withTime
        ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

// Ошибка ответа {ok, data} без обёртки/статуса — строка как есть, иначе сериализуем объект
export function formatApiError(error) {
    return typeof error === 'string' ? error : JSON.stringify(error);
}

// Список из ответа API: либо сразу массив, либо пагинированный {results: [...]}
export function unwrapList(data) {
    return Array.isArray(data) ? data : (data?.results ?? []);
}