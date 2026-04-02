import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Seed whitelist domain if ORG_DOMAIN is set
  const orgDomain = process.env.ORG_DOMAIN
  if (orgDomain) {
    await prisma.emailWhitelist.upsert({
      where: {
        email_type: { email: orgDomain, type: 'DOMAIN' },
      },
      create: { email: orgDomain, type: 'DOMAIN' },
      update: {},
    })
    console.log(`Seeded whitelist domain: @${orgDomain}`)
  } else {
    console.log('No ORG_DOMAIN set, skipping whitelist domain seed')
  }

  // Create OrgSettings singleton if it does not exist
  const existingSettings = await prisma.orgSettings.findFirst()
  if (!existingSettings) {
    await prisma.orgSettings.create({
      data: {
        orgName: process.env.ORG_NAME || 'My Community',
        primaryColor: '#003262',
        accentColor: '#16a0ac',
        fromEmail: process.env.RESEND_FROM_EMAIL || null,
      },
    })
    console.log('Created default org settings')
  } else {
    console.log('Org settings already exist, skipping')
  }

  console.log('Seed complete')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
