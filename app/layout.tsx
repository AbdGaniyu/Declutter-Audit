import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { ClockSync } from '@/components/ClockSync';
import { ServiceWorker } from '@/components/ServiceWorker';

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
  themeColor: '#0F7B4F',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG">
      <body className="min-h-dvh font-sans text-body antialiased">
        <ClockSync />
        <ServiceWorker />
        <Header />
        <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4">{children}</main>
      </body>
    </html>
  );
}
