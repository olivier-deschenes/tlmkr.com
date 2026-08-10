const DAY_IN_MS = 86_400_000
const AVERAGE_DAYS_PER_MONTH = 365.2425 / 12
const AVERAGE_DAYS_PER_YEAR = 365.2425

function formatUnit(value: number, unit: string): string {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${unit}${value === 1 ? '' : 's'}`
}

export function formatEventDuration(
  startDate: string,
  endDate?: string,
): string {
  if (!endDate) return '1 day'

  const start = Date.parse(`${startDate}T00:00:00.000Z`)
  const end = Date.parse(`${endDate}T00:00:00.000Z`)
  const days = Math.round((end - start) / DAY_IN_MS) + 1

  if (days < 14) return formatUnit(days, 'day')
  if (days < 60) return formatUnit(Math.round(days / 7), 'week')
  if (days < 730) {
    return formatUnit(Math.round(days / AVERAGE_DAYS_PER_MONTH), 'month')
  }

  const years = Number((days / AVERAGE_DAYS_PER_YEAR).toFixed(1))
  return formatUnit(years, 'year')
}
