import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'
import { getProviders } from './auth-providers'
import { isWhitelisted } from './whitelist'
import { notifyAdminsOfAccessRequest } from '@/lib/notifications/access-request-email'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: getProviders(),
  pages: {
    signIn: '/sign-in',
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false

      // Bootstrap: first user ever can sign in without whitelist and becomes org admin
      const userCount = await prisma.user.count()
      if (userCount === 0) return true

      // Existing users can always sign in — whitelist only gates new sign-ups
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email },
      })
      if (existingUser) return true

      const whitelisted = await isWhitelisted(user.email)

      if (!whitelisted) {
        // Create a pending access request (skip if one already exists)
        const existing = await prisma.accessRequest.findFirst({
          where: { email: user.email, status: 'PENDING' },
        })
        if (!existing) {
          const newRequest = await prisma.accessRequest.create({
            data: {
              name: user.name || 'Unknown',
              email: user.email,
              image: user.image || null,
              status: 'PENDING',
            },
          })
          void notifyAdminsOfAccessRequest(newRequest.id).catch(console.error)
        }
        // Redirect to the access request confirmation page
        return `/request-access?email=${encodeURIComponent(user.email)}`
      }

      return true
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
  },
  events: {
    async createUser({ user }) {
      // On first-ever sign-up, create the default org group with this user as owner.
      // For subsequent sign-ups, add the user as a member of the default group.
      let defaultGroup = await prisma.group.findFirst({
        where: { isDefault: true },
      })

      if (!defaultGroup) {
        defaultGroup = await prisma.group.create({
          data: {
            name: 'My Community',
            slug: 'default',
            isDefault: true,
            ownerId: user.id!,
          },
        })
        await prisma.groupMember.create({
          data: {
            userId: user.id!,
            groupId: defaultGroup.id,
            role: 'ADMIN',
          },
        })
      } else {
        await prisma.groupMember.create({
          data: {
            userId: user.id!,
            groupId: defaultGroup.id,
            role: 'MEMBER',
          },
        })
      }
    },
  },
})
