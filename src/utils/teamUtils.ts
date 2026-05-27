const SA_COUNTRIES = new Set([
  'Argentina', 'Brazil', 'Brasil', 'Uruguay', 'Paraguay',
  'Bolivia', 'Colombia', 'Venezuela', 'Ecuador', 'Peru', 'Perú', 'Chile',
])

const SA_COMP_KEYWORDS = ['libertadores', 'sudamericana', 'conmebol', 'recopa']

export function teamAbbr(name: string, competitionCountry?: string, competitionName?: string): string {
  const bySACountry = !!competitionCountry && SA_COUNTRIES.has(competitionCountry)
  const bySAName    = !!competitionName && SA_COMP_KEYWORDS.some(k => competitionName.toLowerCase().includes(k))

  if (bySACountry || bySAName) {
    return name.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/g, '').slice(0, 3).toUpperCase()
  }

  const words = name.trim().split(/\s+/).filter(w => w.length > 0)
  if (words.length === 0) return '???'
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase()
  if (words.length === 2) return (words[0][0] + words[1].slice(0, 2)).toUpperCase()
  return words.slice(0, 3).map(w => w[0]).join('').toUpperCase()
}
