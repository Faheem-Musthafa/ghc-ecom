import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import '../index.css';
import Providers from './providers';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'Glockery Home Centre Vengara | Crockery & Kitchenware',
    template: '%s | Glockery Home Centre',
  },
  description: 'Shop premium crockery, dinner sets, tea sets, serving dishes, canisters and kitchenware from Glockery Home Centre in Vengara, Malappuram.',
  openGraph: {
    type: 'website',
    siteName: 'Glockery Home Centre',
    locale: 'en_IN',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#080807',
};

const RouteFallback = () => (
  <div className="grid min-h-screen place-items-center bg-obsidian text-gold-300" role="status">
    <span className="text-xs uppercase tracking-[0.28em]">Loading Glockery…</span>
  </div>
);

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <Suspense fallback={<RouteFallback />}>
          <Providers>{children}</Providers>
        </Suspense>
      </body>
    </html>
  );
}
