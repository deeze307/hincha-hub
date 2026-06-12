export function ScoreBox({
  value, onChange, locked,
}: {
  value: string; onChange: (v: string) => void; locked: boolean
}) {
  const hasPred = locked && value !== ''
  return (
    <input
      type="number" min={0} max={99}
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={locked}
      className={`w-9 h-8 text-center text-sm font-semibold bg-elevated border border-border rounded focus:outline-none focus:border-brand disabled:cursor-not-allowed transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
        hasPred ? 'text-orange-400/80' : 'text-text disabled:opacity-40'
      }`}
    />
  )
}
