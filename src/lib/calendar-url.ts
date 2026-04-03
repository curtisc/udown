export function generateGoogleCalendarUrl(event: {
  title: string
  description: string | null
  dateTime: Date
  endTime: Date | null
  placeName: string | null
  placeAddress: string | null
}): string {
  const formatDate = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

  const start = formatDate(event.dateTime)
  // Default to 1 hour if no end time
  const end = formatDate(event.endTime || new Date(event.dateTime.getTime() + 60 * 60 * 1000))

  const location = [event.placeName, event.placeAddress].filter(Boolean).join(', ')

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
  })

  if (event.description) params.set('details', event.description)
  if (location) params.set('location', location)

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
