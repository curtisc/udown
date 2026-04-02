import { formatEventDate, formatEventTime, formatCost } from '@/lib/format'

type OrgBranding = {
  orgName: string
  orgLogo: string | null
  primaryColor: string
  accentColor: string
}

export function baseEmailHtml(options: OrgBranding & {
  preheader: string
  content: string
}): string {
  const { orgName, orgLogo, accentColor, preheader, content } = options
  const bgDark = '#0f0f1a'
  const bgCard = '#1a1a2e'
  const textSecondary = '#94a3b8'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${orgName}</title>
</head>
<body style="margin:0;padding:0;background-color:${bgDark};font-family:Arial,Helvetica,sans-serif;">
  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bgDark};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <!-- Logo / Org Name -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              ${orgLogo
                ? `<img src="${orgLogo}" alt="${orgName}" height="48" style="height:48px;width:auto;" />`
                : `<span style="font-size:20px;font-weight:bold;color:${accentColor};">${orgName}</span>`
              }
            </td>
          </tr>
          <!-- Content Card -->
          <tr>
            <td style="background-color:${bgCard};border-radius:12px;padding:24px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <span style="font-size:12px;color:${textSecondary};">
                Sent by ${orgName} via uDown
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

type EmailContent = { subject: string; content: string }

export function newEventEmailContent(event: {
  title: string
  dateTime: Date
  placeName: string | null
  estimatedCost: number | null
  eventUrl: string
  creatorName: string
}): EmailContent {
  const cost = formatCost(event.estimatedCost)
  const textPrimary = '#f1f5f9'
  const textSecondary = '#94a3b8'
  const accentColor = '#16a0ac'

  return {
    subject: `New event: ${event.title}`,
    content: `
      <h2 style="margin:0 0 4px;font-size:20px;color:${textPrimary};">${event.title}</h2>
      <p style="margin:0 0 16px;font-size:14px;color:${textSecondary};">
        Posted by ${event.creatorName}
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>
          <td style="padding:4px 0;font-size:14px;color:${textPrimary};">
            ${formatEventDate(event.dateTime)} at ${formatEventTime(event.dateTime)}
          </td>
        </tr>
        ${event.placeName ? `<tr><td style="padding:4px 0;font-size:14px;color:${textSecondary};">${event.placeName}</td></tr>` : ''}
        ${cost ? `<tr><td style="padding:4px 0;font-size:14px;color:${textSecondary};">~${cost}/person</td></tr>` : ''}
      </table>
      <a href="${event.eventUrl}" style="display:inline-block;background-color:${accentColor};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Check it out
      </a>
    `,
  }
}

export function eventUpdateEmailContent(event: {
  title: string
  changes: string[]
  eventUrl: string
}): EmailContent {
  const textPrimary = '#f1f5f9'
  const textSecondary = '#94a3b8'
  const accentColor = '#16a0ac'

  return {
    subject: `${event.title} was updated`,
    content: `
      <h2 style="margin:0 0 12px;font-size:20px;color:${textPrimary};">${event.title} was updated</h2>
      <ul style="margin:0 0 20px;padding-left:20px;">
        ${event.changes.map((c) => `<li style="padding:4px 0;font-size:14px;color:${textSecondary};">${c}</li>`).join('')}
      </ul>
      <a href="${event.eventUrl}" style="display:inline-block;background-color:${accentColor};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        View Event
      </a>
    `,
  }
}

export function eventReminderEmailContent(event: {
  title: string
  dateTime: Date
  placeName: string | null
  eventUrl: string
}): EmailContent {
  const textPrimary = '#f1f5f9'
  const textSecondary = '#94a3b8'
  const accentColor = '#16a0ac'

  return {
    subject: `Tomorrow: ${event.title}`,
    content: `
      <h2 style="margin:0 0 12px;font-size:20px;color:${textPrimary};">Tomorrow: ${event.title}</h2>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>
          <td style="padding:4px 0;font-size:14px;color:${textPrimary};">
            ${formatEventTime(event.dateTime)}
          </td>
        </tr>
        ${event.placeName ? `<tr><td style="padding:4px 0;font-size:14px;color:${textSecondary};">${event.placeName}</td></tr>` : ''}
      </table>
      <a href="${event.eventUrl}" style="display:inline-block;background-color:${accentColor};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        View Event
      </a>
    `,
  }
}

export function rsvpMilestoneEmailContent(event: {
  title: string
  count: number
  eventUrl: string
}): EmailContent {
  const textPrimary = '#f1f5f9'
  const accentColor = '#16a0ac'

  return {
    subject: `${event.count} people are down for ${event.title}!`,
    content: `
      <h2 style="margin:0 0 12px;font-size:20px;color:${textPrimary};">
        ${event.count} people are down for ${event.title}!
      </h2>
      <a href="${event.eventUrl}" style="display:inline-block;background-color:${accentColor};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        See who&apos;s coming
      </a>
    `,
  }
}
