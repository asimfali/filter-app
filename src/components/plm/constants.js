// Общие константы для стадий PLM — переиспользуются в PLMPage/ProductStages/LiteraSelector/PLMSidePanel.

export const STAGE_STATUS_LABEL = {
    draft: 'Черновик',
    pending_approval: 'На согласовании',
    active: 'Активна',
    archived: 'В архиве',
};

export const STAGE_STATUS_COLOR = {
    draft: 'bg-neutral-100 text-gray-500 dark:bg-neutral-800 dark:text-gray-400',
    pending_approval: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    archived: 'bg-neutral-100 text-gray-400 dark:bg-neutral-800 dark:text-gray-500',
};

export const DECISION_ICON = { pending: '○', approved: '✓', rejected: '✗' };

export const DECISION_COLOR = {
    pending: 'text-gray-400',
    approved: 'text-emerald-500',
    rejected: 'text-red-500',
};
