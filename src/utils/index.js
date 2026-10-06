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