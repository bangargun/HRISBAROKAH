import type { Metadata } from 'next';
import './globals.css';
import AuthGuard from '@/components/AuthGuard';

export const metadata: Metadata = {
  title: 'HRIS Barokah Group - Multi-Outlet Resto Portal',
  description: 'Sistem Informasi SDM & Operasional Multi-Outlet Restoran Barokah Group',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
