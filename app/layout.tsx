import type { Metadata } from 'next'
import { Instrument_Serif, DM_Sans } from 'next/font/google'
import './globals.css'

const instrumentSerif = Instrument_Serif({
  subsets:  ['latin'],
  weight:   '400',
  display:  'swap',
  variable: '--font-display',
  fallback: ['Cormorant Garamond', 'Georgia', 'Cambria', 'serif'],
})

const dmSans = DM_Sans({
  subsets:  ['latin'],
  weight:   ['400', '500', '600'],
  display:  'swap',
  variable: '--font-dm-sans',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
})
import { AuthHydrator } from '@/components/providers/auth-hydrator'
import { ThemeSync } from '@/components/providers/theme-sync'
import { QueryProvider } from '@/components/providers/query-provider'
import { Toaster } from '@/components/ui/sonner'
import { PageTransition } from '@/components/shared/page-transition'
import { BlockedStateGuard } from '@/components/shared/blocked-state-guard'
import { SentryUserSync } from '@/components/providers/sentry-user-sync'

export const metadata: Metadata = {
  title: 'Lynq — Customer Support Dashboard',
  description: 'Premium customer support dashboard for e-commerce brands',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${instrumentSerif.variable} ${dmSans.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t='light';try{var z=localStorage.getItem('lynq-theme-store');if(z){t=JSON.parse(z).state.theme||'light'}}catch(e){}if(t!=='dark'&&t!=='light'){var l=localStorage.getItem('lynq-theme');if(l==='dark'||l==='light')t=l}document.documentElement.setAttribute('data-theme',t);if(t==='dark')document.documentElement.classList.add('dark');})();`,
          }}
        />
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700,800&display=swap"
        />
      </head>
      <body>
        <SentryUserSync />
        <AuthHydrator />
        <ThemeSync />
        <QueryProvider>
          <BlockedStateGuard>
            <PageTransition>{children}</PageTransition>
          </BlockedStateGuard>
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  )
}
