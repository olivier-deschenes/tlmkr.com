const DAY_IN_MS = 86_400_000
const AVERAGE_DAYS_PER_MONTH = 365.2425 / 12
const AVERAGE_DAYS_PER_YEAR = 365.2425

interface DateRangeEvent {
  startDate: string
  endDate?: string
}

interface CalendarDuration {
  years: number
  months: number
  days: number
}

const datePartsPattern = /^(\d{4})-(\d{2})-(\d{2})$/

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

function parseUtcDate(date: string): Date {
  const match = datePartsPattern.exec(date)
  if (!match) throw new Error(`Invalid ISO date: ${date}`)

  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  )
}

function addYearsClamped(date: Date, years: number): Date {
  const year = date.getUTCFullYear() + years
  const month = date.getUTCMonth()
  const day = Math.min(
    date.getUTCDate(),
    new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
  )

  return new Date(Date.UTC(year, month, day))
}

function addMonthsClamped(date: Date, months: number): Date {
  const absoluteMonth = date.getUTCFullYear() * 12 + date.getUTCMonth() + months
  const year = Math.floor(absoluteMonth / 12)
  const month = absoluteMonth - year * 12
  const day = Math.min(
    date.getUTCDate(),
    new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
  )

  return new Date(Date.UTC(year, month, day))
}

export function calculatePreciseDuration(
  startDate: string,
  endDate: string,
): CalendarDuration {
  const start = parseUtcDate(startDate)
  const inclusiveEnd = parseUtcDate(endDate)
  inclusiveEnd.setUTCDate(inclusiveEnd.getUTCDate() + 1)

  let years = inclusiveEnd.getUTCFullYear() - start.getUTCFullYear()
  if (addYearsClamped(start, years) > inclusiveEnd) years -= 1

  const afterYears = addYearsClamped(start, years)
  let months =
    (inclusiveEnd.getUTCFullYear() - afterYears.getUTCFullYear()) * 12 +
    inclusiveEnd.getUTCMonth() -
    afterYears.getUTCMonth()
  if (addMonthsClamped(afterYears, months) > inclusiveEnd) months -= 1

  const afterMonths = addMonthsClamped(afterYears, months)
  const days = Math.round(
    (inclusiveEnd.getTime() - afterMonths.getTime()) / DAY_IN_MS,
  )

  return { years, months, days }
}

export function formatPreciseDuration(duration: CalendarDuration): string {
  const parts = [
    duration.years ? formatUnit(duration.years, 'year') : null,
    duration.months ? formatUnit(duration.months, 'month') : null,
    duration.days ? formatUnit(duration.days, 'day') : null,
  ].filter((part): part is string => part !== null)

  return parts.join(', ') || '0 days'
}

export function formatLayerDuration(
  events: ReadonlyArray<DateRangeEvent>,
): string | null {
  if (events.length === 0) return null

  const startDate = events.reduce(
    (earliest, event) =>
      event.startDate < earliest ? event.startDate : earliest,
    events[0].startDate,
  )
  const endDate = events.reduce((latest, event) => {
    const eventEnd = event.endDate ?? event.startDate
    return eventEnd > latest ? eventEnd : latest
  }, events[0].endDate ?? events[0].startDate)

  return formatPreciseDuration(calculatePreciseDuration(startDate, endDate))
}
