import { Resend } from 'resend'
import { getOrgSettings } from '@/lib/org-settings'

let resend: Resend | null = null

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY)
  return resend
}

export async function sendEmail(options: {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
}): Promise<void> {
  const client = getResendClient()
  const org = await getOrgSettings()
  const from = org.fromEmail
    ? `${org.fromName || org.orgName} <${org.fromEmail}>`
    : process.env.RESEND_FROM_EMAIL
      ? `${org.orgName} <${process.env.RESEND_FROM_EMAIL}>`
      : null

  if (!client || !from) {
    console.log(
      `[Email${!client ? ' - no API key' : ' - no from address'}]`,
      `To: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`,
      `Subject: ${options.subject}`
    )
    return
  }

  const recipients = Array.isArray(options.to) ? options.to : [options.to]

  for (const to of recipients) {
    try {
      await client.emails.send({
        from,
        to,
        subject: options.subject,
        html: options.html,
        replyTo: options.replyTo,
      })
    } catch (error) {
      console.error(`Failed to send email to ${to}:`, error)
    }
  }
}
