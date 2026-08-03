// Общие константы статуса спецификации — переиспользуются в SpecEditor/SpecList/PartEditorPage.

export const SPEC_STATUS_LABEL = {
    draft: 'Черновик',
    ready: 'Готова к загрузке',
    pushing: 'Загружается...',
    pushed: 'Загружена в 1С',
    push_error: 'Ошибка загрузки',
};

export const SPEC_STATUS_COLOR = {
    draft: 'text-gray-500 dark:text-gray-400',
    ready: 'text-emerald-600 dark:text-emerald-400',
    pushing: 'text-blue-500 dark:text-blue-400',
    pushed: 'text-emerald-700 dark:text-emerald-300',
    push_error: 'text-red-600 dark:text-red-400',
};
