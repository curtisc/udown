import { getOrgSettings } from '@/lib/org-settings'
import { sendEmail } from './send-email'
import { baseEmailHtml } from './templates'

export async function sendInviteEmail(email: string): Promise<void> {
  const org = await getOrgSettings()
  const base = process.env.AUTH_URL || 'http://localhost:3000'

  const textPrimary = '#f1f5f9'
  const accentColor = '#16a0ac'

  const subject = `You're invited to ${org.orgName}`
  const content = `
    <h2 style="margin:0 0 12px;font-size:20px;color:${textPrimary};">
      You're invited to ${org.orgName}
    </h2>
    <p style="margin:0 0 20px;font-size:14px;color:${textPrimary};">
      Sign in to join the community and see what's happening.
    </p>
    <a href="${base}/sign-in" style="display:inline-block;background-color:${accentColor};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
      Join ${org.orgName}
    </a>
  `

  const html = baseEmailHtml({ ...org, preheader: subject, content })

  await sendEmail({ to: email, subject, html })
}
