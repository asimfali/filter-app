export function parseError(data, status) {
    if (status === 403) return data?.detail || 'Недостаточно прав';
    if (data?.detail) return data.detail;
    if (data && typeof data === 'object') return Object.values(data).flat().join(', ');
    return 'Неизвестная ошибка';
}

// Ошибка ответа {ok, data} без обёртки/статуса — строка как есть, иначе сериализуем объект
export function formatApiError(error) {
    return typeof error === 'string' ? error : JSON.stringify(error);
}