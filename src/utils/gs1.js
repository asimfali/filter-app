import { parseError } from './index';

export const GS1_STATUS_LABEL = {
    new: 'Новая',
    matched: 'Сопоставлена',
    conflict: 'Конфликт',
    unmatched: 'Не найдена',
    ignored: 'Игнорируется',
};

export const GS1_STATUS_COLOR = {
    new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    matched: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    conflict: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    unmatched: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    ignored: 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
};

export const GS1_REASON_LABEL = {
    ambiguous: 'Несколько подходящих товаров',
    product_has_other_gtin: 'У товара уже другой GTIN',
    duplicate_in_gs1: 'Несколько GTIN ГС1 на один товар',
    gtin_taken: 'GTIN занят другим товаром',
    no_match: 'Товар не найден',
};

export const GS1_RUN_STATUS_LABEL = { running: 'Выполняется', success: 'Успешно', failed: 'Ошибка' };

export const fmtGs1Date = (iso, withTime = false) => iso
    ? new Date(iso).toLocaleString('ru-RU', withTime
        ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

// Ошибки ГС1-эндпоинтов приходят в трёх форматах: конверт {success:false, error:{message}},
// DRF {detail} (403) и валидация тела {field: [...]} — parseError знает только два последних.
export const gs1Error = (data, status) => data?.error?.message || parseError(data, status);
