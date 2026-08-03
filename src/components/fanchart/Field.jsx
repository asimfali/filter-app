export default function Field({ label, value, onChange, placeholder = '' }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-500 dark:text-gray-400">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700
                   bg-white dark:bg-neutral-800 text-gray-900 dark:text-white
                   px-3 py-2 focus:outline-none focus:border-blue-500"
      />
    </div>
  )
}
