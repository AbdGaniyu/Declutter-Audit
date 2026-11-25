import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/Header';
import { ClockSync } from '@/components/ClockSync';
import { ServiceWorker } from '@/components/ServiceWorker';

// Inter is the fallback after SF Pro (DESIGN.md › Typography). Self-hosted at build
// time by next/font: no requests to Google from the browser. latin-ext carries ₦.
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter', display: 'swap' });

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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F5F7' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={inter.variable}>
      <body className="min-h-dvh bg-bg font-sans text-body text-label antialiased">
        <ClockSync />
        <ServiceWorker />
        <Header />
        <main className="mx-auto w-full max-w-grid px-4 pb-28 pt-4">{children}</main>
      </body>
    </html>
  );
}
