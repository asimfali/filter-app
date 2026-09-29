// Названия атрибутов НК только для показа (сервер отдаёт attr_id); неизвестный → «attr #N».
const NK_ATTR_NAME = {
    12: 'Вид товара', 36: 'Цвет', 619: 'Целевое использование', 2437: 'Высота (см)', 2438: 'Глубина (см)',
    2439: 'Ширина (см)', 2440: 'Вес брутто (кг)', 2463: 'Реестр РПП', 2478: 'Полное наименование',
    2504: 'Товарный знак', 2630: 'Страна', 2710: 'Тип упаковки', 2713: 'Материал упаковки',
    3959: 'Группа ТНВЭД', 23557: 'Декларация о соответствии', 3961: 'ОКПД2', 13756: 'Расчётный объём (см³)', 13875: 'Суббренд',
    13914: 'Артикул/Модель', 13933: 'Код ТНВЭД', 23811: 'Автоприкрепление ДС/СС', 23819: 'ФНН',
};

export const nkAttrName = (id) => NK_ATTR_NAME[id] ?? `attr #${id}`;

export const NK_COMPARE_LABEL = {
    same: 'Совпадает', differs: 'Отличается', only_ours: 'Только у нас', only_nk: 'Только в НК',
};
// Короткие метки для узкой колонки статуса (полный текст — в title).
export const NK_COMPARE_SHORT = { same: '=', differs: '≠', only_ours: '+ у нас', only_nk: '+ НК' };
export const NK_COMPARE_COLOR = {
    same: 'text-gray-500 dark:text-gray-400',
    differs: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
    only_ours: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    only_nk: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
};

const NK_STATUS_LABEL = { draft: 'Черновик', moderation: 'На модерации', published: 'Опубликована' };
export const nkStatusLabel = (s) => NK_STATUS_LABEL[s] ?? s;

// Состояние готовности для бейджа списка: нет профиля / проблемы N / готова / неизвестно.
export function readinessBadge(r) {
    if (!r) return { label: '…', cls: 'text-gray-400' };
    if (!r.has_profile) return { label: 'Нет профиля', cls: 'bg-gray-100 dark:bg-neutral-800 text-gray-500' };
    if (r.ready) return { label: 'Готова', cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' };
    return { label: `Проблем: ${r.problems?.length ?? 0}`, cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' };
}
