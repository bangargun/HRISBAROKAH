import type { Metadata } from 'next';
import './globals.css';
import AuthGuard from '@/components/AuthGuard';

export const metadata: Metadata = {
  title: 'HRIS Barokah Grup',
  description: 'Sistem SDM dan operasional outlet Barokah Grup',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen">
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
