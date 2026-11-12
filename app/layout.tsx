import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ExamS | Multi-Round Examination Platform',
  description: 'Enterprise multi-round examination and automated student qualification system.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-white text-gray-900 antialiased selection:bg-gray-100 selection:text-gray-900">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'border border-gray-200 bg-white text-gray-900 shadow-sm rounded-lg text-sm',
          }}
        />
      </body>
    </html>
  );
}
