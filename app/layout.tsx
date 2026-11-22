import type { Metadata, Viewport } from 'next';
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
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ExamS',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9fe' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0c1d' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full`} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="manifest" href="/manifest.json" />
        <script src="/button.js"></script>
      </head>
      <body className="min-h-full flex flex-col bg-[#faf9fe] dark:bg-[#0d0c1d] text-[#1d1a4a] dark:text-[#f4f3ff] antialiased selection:bg-[#edeaff] dark:selection:bg-[#24204d] font-sans transition-colors duration-150">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'border border-[#e6e3f8] dark:border-[#2c2854] bg-white dark:bg-[#15132d] text-[#1d1a4a] dark:text-[#f4f3ff] shadow-sm rounded-lg text-sm font-sans',
          }}
        />
      </body>
    </html>
  );
}
