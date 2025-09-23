import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ViceLoop - AI-Powered Video Platform | TikTok for AI Content',
  description: 'Discover ViceLoop, the revolutionary AI-powered video platform that brings you endless entertainment. Experience AI-generated content in a TikTok-style interface with vertical videos, smart recommendations, and interactive features.',
  keywords: 'ViceLoop, AI videos, artificial intelligence content, TikTok alternative, AI entertainment, vertical videos, AI platform, machine learning videos, AI-generated content, video streaming, AI social media',
  authors: [{ name: 'ViceLoop Team' }],
  openGraph: {
    title: 'ViceLoop - AI-Powered Video Platform',
    description: 'Experience the future of entertainment with AI-generated videos in a TikTok-style interface. Discover, watch, and interact with cutting-edge AI content.',
    type: 'website',
    siteName: 'ViceLoop',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ViceLoop - AI-Powered Video Platform',
    description: 'Discover AI-generated videos in a TikTok-style interface. The future of entertainment is here.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
    ],
    shortcut: '/favicon.ico',
    apple: '/favicon-32x32.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Remove viewportFit to prevent safe area conflicts
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "ViceLoop",
    "description": "AI-powered video platform featuring TikTok-style interface for AI-generated content",
    "url": "https://www.viceloop.com",
    "applicationCategory": "EntertainmentApplication",
    "operatingSystem": "Web Browser",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "creator": {
      "@type": "Organization",
      "name": "ViceLoop Team"
    },
    "keywords": "AI videos, artificial intelligence content, TikTok alternative, AI entertainment, vertical videos"
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}