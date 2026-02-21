import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Data Processing Agreement (DPA) | Voxanne AI",
  description: "Voxanne AI Data Processing Agreement. GDPR-compliant data processing terms for healthcare organizations. Download our BAA addendum.",
  keywords: ["dpa", "data processing agreement", "gdpr compliance", "baa"],
  openGraph: {
    title: "Data Processing Agreement | Voxanne AI",
    url: 'https://voxanne.ai/dpa',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Data Processing Agreement | Voxanne AI",
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: '/dpa',
  },
}

export default function DPALayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
