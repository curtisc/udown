import { prisma } from '@/lib/prisma'
import { getOrgSettings } from '@/lib/org-settings'
import { sendEmail } from './send-email'
import { baseEmailHtml } from './templates'
import { generateAccessRequestUrl } from '@/lib/signed-url'

export async function notifyAdminsOfAccessRequest(requestId: string): Promise<void> {
  const request = await prisma.accessRequest.findUnique({
    where: { id: requestId },
  })
  if (!request) return

  const org = await getOrgSettings()

  const defaultGroup = await prisma.group.findFirst({
    where: { isDefault: true },
  })
  if (!defaultGroup) return

  const admins = await prisma.groupMember.findMany({
    where: { groupId: defaultGroup.id, role: 'ADMIN' },
    include: { user: { select: { email: true, emailNotifications: true } } },
  })

  const notifiableAdmins = admins.filter((a) => a.user.emailNotifications)
  if (notifiableAdmins.length === 0) return

  const approveUrl = generateAccessRequestUrl(requestId, 'approve')
  const denyUrl = generateAccessRequestUrl(requestId, 'deny')

  const textPrimary = '#f1f5f9'
  const textSecondary = '#94a3b8'
  const accentColor = '#16a0ac'

  const content = `
    <h2 style="margin:0 0 12px;font-size:20px;color:${textPrimary};">New Access Request</h2>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="padding:4px 0;font-size:14px;color:${textPrimary};">
          <strong>${request.name}</strong>
        </td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:14px;color:${textSecondary};">
          ${request.email}
        </td>
      </tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding-right:8px;">
          <a href="${approveUrl}" style="display:inline-block;background-color:${accentColor};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            Approve
          </a>
        </td>
        <td>
          <a href="${denyUrl}" style="display:inline-block;background-color:#374151;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            Deny
          </a>
        </td>
      </tr>
    </table>
  `

  const subject = `Access request from ${request.name}`
  const html = baseEmailHtml({ ...org, preheader: subject, content })

  await sendEmail({
    to: notifiableAdmins.map((a) => a.user.email),
    subject,
    html,
  })
}

export async function notifyAccessApproved(email: string): Promise<void> {
  const org = await getOrgSettings()
  const base = process.env.AUTH_URL || 'http://localhost:3000'

  const textPrimary = '#f1f5f9'
  const accentColor = '#16a0ac'

  const content = `
    <h2 style="margin:0 0 12px;font-size:20px;color:${textPrimary};">You're in!</h2>
    <p style="margin:0 0 20px;font-size:14px;color:${textPrimary};">
      Your access request to ${org.orgName} has been approved. Sign in to get started.
    </p>
    <a href="${base}/sign-in" style="display:inline-block;background-color:${accentColor};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
      Sign In
    </a>
  `

  const subject = `Welcome to ${org.orgName}!`
  const html = baseEmailHtml({ ...org, preheader: subject, content })

  await sendEmail({ to: email, subject, html })
}
