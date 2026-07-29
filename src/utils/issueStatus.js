// Общие константы статуса замечания — переиспользуются в IssueThreadPage/ProductPage.

export const ISSUE_STATUS_LABEL = {
    open: 'Открыто',
    in_progress: 'В работе',
    resolved: 'Решено',
    verified: 'Подтверждено ✓',
    rejected: 'Отклонено',
};

export const ISSUE_STATUS_COLOR = {
    open: 'bg-neutral-100 text-gray-500 dark:bg-neutral-800 dark:text-gray-400',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    resolved: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    verified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};
