import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ExamS | Enterprise Multi-Round Examination Platform',
  description: 'Enterprise multi-round assessment, real-time candidate proctoring, and automated qualification engine.',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-white text-gray-900 antialiased selection:bg-gray-100 selection:text-gray-900 font-sans">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'border border-gray-200 bg-white text-gray-900 shadow-sm rounded-lg text-sm font-sans',
          }}
        />
      </body>
    </html>
  );
}
