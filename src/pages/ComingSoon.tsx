import { Construction } from 'lucide-react'

export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-elevated flex items-center justify-center">
        <Construction size={28} className="text-brand" />
      </div>
      <div>
        <h1 className="text-text text-xl font-semibold">{title}</h1>
        <p className="text-muted text-sm mt-1">Próximamente disponible</p>
      </div>
    </div>
  )
}
