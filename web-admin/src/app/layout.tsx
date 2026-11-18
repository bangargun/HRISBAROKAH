import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AuthGuard from '@/components/AuthGuard';

// Inter: dibuat untuk teks layar ukuran kecil (13-14px) dan punya angka tabular untuk kolom rupiah/jam
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-sans' });

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
    <html lang="id" className={inter.variable}>
      <body className="min-h-screen">
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
