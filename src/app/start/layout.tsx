import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Get Started with Voxanne AI | Free Trial - No Credit Card",
  description: "Start automating your clinic's phone calls in minutes. HIPAA-compliant AI receptionist with 24/7 support. Free trial available. No credit card required.",
  keywords: ["get started", "voxanne signup", "ai receptionist trial", "free demo"],
  openGraph: {
    title: "Get Started with Voxanne AI | Free Trial",
    description: "Replace missed calls with revenue. Start your free trial today.",
    url: 'https://voxanne.ai/start',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Get Started with Voxanne AI | Free Trial",
    description: "Replace missed calls with revenue. Start your free trial today.",
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: '/start',
  },
}

export default function StartLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
