import type { Metadata } from "next"
import NavbarRedesigned from '@/components/NavbarRedesigned';
import FooterRedesigned from '@/components/FooterRedesigned';

export const metadata: Metadata = {
  title: "Press Kit | Voxanne AI Brand Assets & Media",
  description: "Download Voxanne AI logos, brand guidelines, screenshots, and press materials. Media inquiries welcome.",
  keywords: ["press kit", "brand assets", "media kit", "logos"],
  robots: {
    index: false, // Press kits typically not indexed
    follow: true,
  },
  openGraph: {
    title: "Press Kit | Voxanne AI",
    url: 'https://voxanne.ai/press-kit',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Press Kit | Voxanne AI",
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: '/press-kit',
  },
}

export default function PressKitPage() {
  return (
    <>
    <NavbarRedesigned />
    <main className="min-h-screen bg-white">
      <section className="py-20 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 space-y-4">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-[0.2em]">Press Kit</p>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Press & brand assets</h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            Download Voxanne AI logos, product screenshots, and fast facts. For interviews or media inquiries,
            contact press@voxanne.ai.
          </p>
        </div>
      </section>

      <section className="py-16 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">Downloads</h2>
            <ul className="space-y-3 text-sm text-slate-700 leading-relaxed list-disc list-inside">
              <li><a className="text-slate-900 font-semibold hover:underline" href="/Brand/1.png" download>Primary logo (PNG)</a></li>
              <li><a className="text-slate-900 font-semibold hover:underline" href="/public/branding/resource_8Yu5GfUCC29dqKx3x0skXr.png" download>Product hero (PNG)</a></li>
              <li><a className="text-slate-900 font-semibold hover:underline" href="/public/branding/resource_9Fnvkd0qdNf9kUnicIO_4i.png" download>Dashboard screenshot (PNG)</a></li>
            </ul>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-slate-900">Fast facts</h2>
            <ul className="space-y-2 text-slate-700 text-sm leading-relaxed list-disc list-inside">
              <li>HIPAA compliant; SOC 2 Type II processes.</li>
              <li>Sub-second pickup; live transcripts and summaries.</li>
              <li>Integrations: Google Calendar, Twilio, Vapi voice infrastructure.</li>
              <li>24/7 coverage with human failover for edge cases.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6 space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">Media contact</h2>
          <p className="text-sm text-slate-700 leading-relaxed">press@voxanne.ai</p>
        </div>
      </section>
    </main>
    <FooterRedesigned />
    </>
  );
}
