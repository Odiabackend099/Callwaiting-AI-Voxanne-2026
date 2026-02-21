import type { Metadata } from "next"
import NavbarRedesigned from '@/components/NavbarRedesigned';
import FooterRedesigned from '@/components/FooterRedesigned';

export const metadata: Metadata = {
  title: "Contact Sales | Book a Demo with Voxanne AI Specialists",
  description: "Talk with Voxanne AI specialists. Get a tailored demo, pricing that fits your minutes, and integration mapping for your clinic workflow. 15-minute discovery call.",
  keywords: ["contact sales", "voxanne demo", "ai receptionist pricing", "clinic automation"],
  openGraph: {
    title: "Contact Sales | Voxanne AI Enterprise Solutions",
    description: "Custom demos, clear pricing, and integration support. Talk to our team about AI automation for your clinic.",
    url: 'https://voxanne.ai/contact-sales',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Contact Sales | Voxanne AI Enterprise Solutions",
    description: "Custom demos, clear pricing, and integration support. Talk to our team about AI automation for your clinic.",
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: '/contact-sales',
  },
}

export default function ContactSalesPage() {
  return (
    <>
    <NavbarRedesigned />
    <main className="min-h-screen bg-white">
      <section className="py-20 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 space-y-4">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-[0.2em]">Contact Sales</p>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Talk with Voxanne AI specialists</h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            Share your call volume, calendar setup, and goals. We'll configure a tailored demo,
            outline pricing that fits your minutes, and map integrations to your workflow.
          </p>
        </div>
      </section>

      <section className="py-16 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 grid md:grid-cols-2 gap-10">
          <div className="space-y-5">
            <h2 className="text-2xl font-semibold text-slate-900">What to expect</h2>
            <ul className="space-y-3 text-slate-700 text-sm leading-relaxed list-disc list-inside">
              <li>15-minute discovery to capture your clinic’s routing rules and scripts.</li>
              <li>Live demo of inbound and outbound flows with real-time transcripts.</li>
              <li>Integration walkthrough for Google Calendar and voice infrastructure.</li>
              <li>Security review: HIPAA, SOC 2 Type II, encryption, audit trails.</li>
              <li>Clear pricing with included minutes and overage assumptions.</li>
            </ul>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Share your details</h3>
            <form className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Work email</span>
                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" placeholder="you@clinic.com" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Practice name</span>
                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" placeholder="Riverside Aesthetics" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Monthly call volume</span>
                <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white">
                  <option>&lt; 400 minutes</option>
                  <option>400 - 1200 minutes</option>
                  <option>1200 - 2000 minutes</option>
                  <option>2000+ minutes</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Goals</span>
                <textarea className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" rows={3} placeholder="After-hours coverage, reduce holds, better qualification..." />
              </label>
              <button type="button" className="w-full rounded-lg bg-slate-900 text-white py-3 font-semibold hover:bg-slate-800">Request a call</button>
            </form>
            <p className="text-xs text-slate-500">We reply within one business day.</p>
          </div>
        </div>
      </section>
    </main>
    <FooterRedesigned />
    </>
  );
}
