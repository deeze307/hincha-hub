export function TeamLogo({ url, name, size = 20 }: { url: string | null; name: string; size?: number }) {
  if (url) return <img src={url} alt={name} style={{ width: size, height: size }} className="object-contain shrink-0" />
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-elevated flex items-center justify-center text-[9px] font-bold text-muted shrink-0"
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}
