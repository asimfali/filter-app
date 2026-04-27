export function parseError(data, status) {
    if (status === 403) return data?.detail || 'Недостаточно прав';
    if (data?.detail) return data.detail;
    if (typeof data === 'object') return Object.values(data).flat().join(', ');
    return 'Неизвестная ошибка';
}