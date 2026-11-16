export default function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}