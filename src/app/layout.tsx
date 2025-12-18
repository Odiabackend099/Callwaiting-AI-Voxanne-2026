import type { Metadata } from "next";
import { Lato, Playfair_Display } from "next/font/google";
import "./globals.css";
import JsonLd from "@/components/JsonLd";
import { AuthProvider } from "@/contexts/AuthContext";
import DevSwCleanup from "@/components/DevSwCleanup";

const lato = Lato({
  weight: ["100", "300", "400", "700", "900"],
  subsets: ["latin"],
  variable: "--font-lato",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
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
  authors: [{ name: "CallWaiting AI" }],
  creator: "CallWaiting AI",
  metadataBase: new URL('https://callwaitingai.dev'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "CallWaiting AI | The #1 AI Receptionist",
    description: "Replace your missed calls with revenue. The AI receptionist that books appointments for you.",
    url: 'https://callwaitingai.dev',
    siteName: 'CallWaiting AI',
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
    title: "CallWaiting AI | The #1 AI Receptionist",
    description: "Don't let missed calls cost you money. Switch to CallWaiting AI.",
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
    <html lang="en" className={`dark ${lato.variable} ${playfair.variable}`} suppressHydrationWarning>
      <body
        className="antialiased font-sans bg-black text-white"
        suppressHydrationWarning
      >
        <JsonLd />
        <DevSwCleanup />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
