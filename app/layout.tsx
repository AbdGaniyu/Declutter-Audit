import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Manrope, Saira_Semi_Condensed } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/Header';
import { ClockSync } from '@/components/ClockSync';
import { ServiceWorker } from '@/components/ServiceWorker';

// Self-hosted at build time by next/font: no requests to Google from the browser.
const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-display', display: 'swap' });
const body = Manrope({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body', display: 'swap' });
// latin-ext carries the ₦ sign.
const num = Saira_Semi_Condensed({ subsets: ['latin', 'latin-ext'], weight: ['500', '600'], variable: '--font-num', display: 'swap' });

export const metadata: Metadata = {
  title: 'Declutter Auction',
  description: 'Sell what you no longer need in short live auctions across Lagos.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Declutter', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon.svg', apple: '/icons/icon-192.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FAF7F2',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={`${display.variable} ${body.variable} ${num.variable}`}>
      <body className="min-h-dvh bg-bg font-sans text-body text-ink antialiased">
        <ClockSync />
        <ServiceWorker />
        <Header />
        <main className="mx-auto w-full max-w-grid px-4 pb-28 pt-4">{children}</main>
      </body>
    </html>
  );
}
