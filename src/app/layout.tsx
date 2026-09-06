import ConfigureAmplify from '@/components/ConfigureAmplify'
import AuthDebug from '@/components/debug/AuthDebug'
import { NavigationEvents } from '@/components/layout/NavigationEvents'
import { SessionProvider } from '@/components/providers/SessionProvider'
import ThemeInit from '@/components/ThemeInit'
import { LoadingProvider } from '@/contexts/LoadingContext'
import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Sans, Jost, Montserrat, Noto_Sans } from 'next/font/google'
import Script from 'next/script'
import { Toaster } from 'sonner'
import './globals.css'

// Initialize Montserrat font
const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-montserrat',
})
const jost = Jost({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jost',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-dm-sans',
})

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-cormorant',
})

const notoSans = Noto_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-noto-sans',
})

export const metadata: Metadata = {
  title: 'Midas - Your AI CFO for Exceptional Growth',
  description:
    'Transform financial complexity into strategic advantage with AI-driven platform that delivers institutional-grade insights.',
  keywords: [
    'AI CFO',
    'financial intelligence',
    'business analytics',
    'financial dashboard',
    'startup CFO',
  ],
  authors: [{ name: 'Midas Team' }],
  creator: 'Midas',
  publisher: 'Midas',
  icons: {
    icon: '/images/hero/favicon.ico',
    shortcut: '/images/hero/favicon.ico',
    apple: '/images/hero/favicon.ico',
  },
  openGraph: {
    title: 'Midas - Your AI CFO for Exceptional Growth',
    description: 'Transform financial complexity into strategic advantage with AI-driven insights.',
    url: 'https://www.midascfo.com/',
    siteName: 'Midas',
    images: [
      {
        url: 'https://www.midascfo.com/images/og-image.png',
        width: 2000,
        height: 1200,
        alt: 'Midas - Turn Data Into Gold',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Midas - Your AI CFO',
    description: 'AI-driven financial intelligence for exceptional growth.',
    creator: '@MidasCFO',
    images: ['https://www.midascfo.com/images/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${montserrat.variable} ${dmSans.variable} ${cormorantGaramond.variable} ${notoSans.variable}`}
    >
      <head>
        {process.env.NODE_ENV === 'development' && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
        <ThemeInit />
      </head>
      <body suppressHydrationWarning>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-NRKR7RS8"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}

        {/* Google Tag Manager */}
        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','GTM-NRKR7RS8');
            `,
          }}
        />
        {/* End Google Tag Manager */}

        <ConfigureAmplify />
        <LoadingProvider>
          <NavigationEvents />
          <SessionProvider>
            {children}
            <AuthDebug />
            <Toaster
              position="top-right"
              toastOptions={{
                className: 'sonner-toast',
                duration: 4000,
              }}
              richColors
            />
          </SessionProvider>
        </LoadingProvider>
      </body>
    </html>
  )
}
