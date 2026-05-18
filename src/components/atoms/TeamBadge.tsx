const TEAMS: Record<string, { bg: string; text: string; border: string }> = {
  racing:        { bg: '#5DA8D0', text: '#fff',    border: '#fff' },
  boca:          { bg: '#003DA5', text: '#FFC200', border: '#FFC200' },
  river:         { bg: '#CC1421', text: '#fff',    border: '#fff' },
  independiente: { bg: '#CC0000', text: '#fff',    border: '#fff' },
  'san lorenzo': { bg: '#1C4B9C', text: '#fff',    border: '#CC1421' },
  huracán:       { bg: '#1A2A6E', text: '#fff',    border: '#fff' },
  talleres:      { bg: '#004FA2', text: '#fff',    border: '#fff' },
  belgrano:      { bg: '#00529B', text: '#FFC200', border: '#FFC200' },
}

interface Props {
  name: string
  size?: number
}

export default function TeamBadge({ name, size = 30 }: Props) {
  const key = name.toLowerCase()
  const t = Object.entries(TEAMS).find(([k]) => key.includes(k))?.[1]
    ?? { bg: '#1E243B', text: '#AAB3C5', border: '#2A3352' }
  const abbr = name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()

  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-bold select-none"
      style={{
        width: size, height: size,
        background: t.bg, color: t.text,
        fontSize: size * 0.31,
        boxShadow: `0 0 0 2px ${t.border}33`,
      }}
    >
      {abbr}
    </div>
  )
}
