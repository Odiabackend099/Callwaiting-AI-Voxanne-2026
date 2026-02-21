import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sub-Processors | Voxanne AI",
  description: "List of Voxanne AI sub-processors and third-party service providers. Transparency in data handling for GDPR and HIPAA compliance.",
  keywords: ["sub-processors", "third-party vendors", "data processors"],
  openGraph: {
    title: "Sub-Processors | Voxanne AI",
    url: 'https://voxanne.ai/sub-processors',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Sub-Processors | Voxanne AI",
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: '/sub-processors',
  },
}

export default function SubProcessorsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
