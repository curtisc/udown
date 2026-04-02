import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { getOrgSettings } from '@/lib/org-settings'

const inter = Inter({ subsets: ['latin'] })

export async function generateMetadata(): Promise<Metadata> {
  const org = await getOrgSettings()
  return {
    title: org.orgName,
    description: `${org.orgName} - see what's happening`,
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const org = await getOrgSettings()

  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={
        {
          '--brand-primary': org.primaryColor,
          '--brand-accent': org.accentColor,
        } as React.CSSProperties
      }
    >
      <body className={inter.className}>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
