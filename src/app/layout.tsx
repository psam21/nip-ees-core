import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NIP-EES Core',
  description: 'Minimal reference implementation of NIP-EES + NIP-17 1:1 DMs',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
