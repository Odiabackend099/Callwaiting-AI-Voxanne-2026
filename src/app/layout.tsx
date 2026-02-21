import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import JsonLd from "@/components/JsonLd";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastContainer } from "@/components/ToastContainer";
import DevSwCleanup from "@/components/DevSwCleanup";
import { CookieConsentBanner } from "@/components/cookie-consent/CookieConsentBanner";
import { GoogleAnalyticsLoader } from "@/components/GoogleAnalyticsLoader";
import VoxanneChatWidget from "@/components/VoxanneChatWidget";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: "Voxanne AI | The #1 AI Receptionist for Clinics & Spas",
  description: "Voxanne is the AI voice receptionist that answers, qualifies, and books appointments 24/7 for clinics and med spas.",
  keywords: [
    "AI receptionist",
    "Voxanne AI",
    "Voxanne",
    "medical answering service",
    "virtual receptionist",
    "clinic automation",
    "med spa AI",
    "plastic surgery AI assistant",
    "appointment booking AI",
    "24/7 call answering"
  ],
  authors: [{ name: "Voxanne AI" }],
  creator: "Voxanne AI",
  category: 'Medical Technology',
  metadataBase: new URL('https://voxanne.ai'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "Voxanne AI | The #1 AI Receptionist for Clinics",
    description: "Replace your missed calls with revenue. The AI receptionist that books appointments for you.",
    url: 'https://voxanne.ai',
    siteName: 'Voxanne AI',
    locale: 'en_US',
    type: 'website',
    // OG image auto-generated from /src/app/opengraph-image.tsx
  },
  twitter: {
    card: 'summary_large_image',
    title: "Voxanne AI | The #1 AI Receptionist for Clinics",
    description: "Don't let missed calls cost you money. Switch to Voxanne AI.",
    // Twitter image auto-generated from /src/app/opengraph-image.tsx
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
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'Voxanne',
  },
};

export const viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={outfit.variable} suppressHydrationWarning>
      <body
        className="antialiased font-sans min-h-screen bg-background text-foreground"
        suppressHydrationWarning
      >
        <JsonLd />
        <DevSwCleanup />
        <GoogleAnalyticsLoader />
        <AuthProvider>
          {children}
          <ToastContainer />
          <CookieConsentBanner />
          <VoxanneChatWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
