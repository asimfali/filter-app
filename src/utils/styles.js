export const inputCls = `w-full px-3 py-1.5 text-sm rounded-lg
    bg-neutral-50 dark:bg-neutral-800
    border border-gray-200 dark:border-gray-700
    text-gray-900 dark:text-white
    focus:outline-none focus:border-blue-500
    disabled:opacity-60 disabled:cursor-not-allowed
    transition-colors`;

// Стиль полей на экранах авторизации (RegisterForm/PasswordResetForm) — отдельный
// от inputCls набор классов (focus:ring вместо focus:border), исторически сложился так.
export const authInputCls = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-800 dark:text-white";