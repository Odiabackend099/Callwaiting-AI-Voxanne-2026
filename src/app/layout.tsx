import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import JsonLd from "@/components/JsonLd";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastContainer } from "@/components/ToastContainer";
import DevSwCleanup from "@/components/DevSwCleanup";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Voxanne by CallWaiting AI | The #1 AI Receptionist for Clinics & Spas",
  description: "Voxanne is the AI voice receptionist from CallWaiting AI. Stop missing calls—Voxanne answers, qualifies, and books appointments 24/7 for clinics and med spas.",
  keywords: [
    "AI receptionist",
    "CallWaiting AI",
    "Voxanne",
    "Voxanne AI",
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
  metadataBase: new URL('https://voxanne.ai'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "Voxanne AI | The #1 AI Receptionist for Clinics",
    description: "Replace your missed calls with revenue. The AI receptionist that books appointments for you.",
    url: 'https://voxanne.ai',
    siteName: 'Voxanne AI',
    images: [
      {
        url: 'https://callwaitingai.dev/callwaiting-ai-logo.png',
        width: 512,
        height: 512,
        alt: 'CallWaiting AI Logo',
        type: 'image/png',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Voxanne AI | The #1 AI Receptionist for Clinics",
    description: "Don't let missed calls cost you money. Switch to Voxanne AI.",
    images: ['/callwaiting-ai-logo.png'],
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
    icon: "/callwaiting-ai-logo.png",
    shortcut: "/callwaiting-ai-logo.png",
    apple: "/callwaiting-ai-logo.png",
  },
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakarta.variable}`} suppressHydrationWarning>
      <body
        className="antialiased font-sans min-h-screen bg-background text-foreground"
        suppressHydrationWarning
      >
        <JsonLd />
        <DevSwCleanup />
        <AuthProvider>
          {children}
          <ToastContainer />
        </AuthProvider>
      </body>
    </html>
  );
}
