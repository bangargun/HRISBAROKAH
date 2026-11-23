import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Absen Barokah Group',
  description: 'Absen kru di tablet cabang Barokah Group',
  manifest: '/absen.webmanifest',
  icons: { icon: '/icons/absen-192.png', apple: '/icons/absen-192.png' },
  appleWebApp: { capable: true, title: 'Absen', statusBarStyle: 'black' },
};

export const viewport: Viewport = {
  themeColor: '#15181e',
  width: 'device-width',
  initialScale: 1,
  // Tablet kios: cegah zoom cubit yang membuat tata letak bergeser
  maximumScale: 1,
  userScalable: false,
};

export default function AbsenLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-ink text-slate-100">{children}</div>;
}
