import { useState } from 'react'

const NOW = new Date()

export const TODAY    = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate())
export const MIN_DATE = new Date(NOW.getFullYear(), NOW.getMonth() - 1, NOW.getDate())
export const MAX_DATE = new Date(NOW.getFullYear(), NOW.getMonth() + 1, NOW.getDate())

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate()
}

function addDays(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n)
}

function clamp(date: Date, min: Date, max: Date): Date {
  if (date < min) return new Date(min)
  if (date > max) return new Date(max)
  return date
}

export function useMatchDate() {
  const [date,         setDate]         = useState<Date>(new Date(TODAY))
  const [showCalendar, setShowCalendar] = useState(false)

  function goDay(delta: number) {
    setDate(prev => clamp(addDays(prev, delta), MIN_DATE, MAX_DATE))
  }

  const isToday   = isSameDay(date, TODAY)
  const canPrev   = date > MIN_DATE
  const canNext   = date < MAX_DATE
  const dateLabel = isToday
    ? 'Hoy'
    : date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })

  return { date, setDate, showCalendar, setShowCalendar, goDay, canPrev, canNext, dateLabel, isToday }
}
