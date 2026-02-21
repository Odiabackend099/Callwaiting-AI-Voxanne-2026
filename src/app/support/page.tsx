import type { Metadata } from "next"
import NavbarRedesigned from '@/components/NavbarRedesigned';
import FooterRedesigned from '@/components/FooterRedesigned';

export const metadata: Metadata = {
  title: "Support Center | Voxanne AI Help & Documentation",
  description: "Get help with Voxanne AI. Browse documentation, FAQs, integration guides, and contact our 24/7 support team for assistance.",
  keywords: ["support", "help center", "documentation", "customer service"],
  openGraph: {
    title: "Support Center | Voxanne AI",
    description: "Get help with Voxanne AI. Browse documentation and contact our support team.",
    url: 'https://voxanne.ai/support',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Support Center | Voxanne AI",
    description: "Get help with Voxanne AI. Browse documentation and contact our support team.",
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: '/support',
  },
}

export default function SupportPage() {
  return (
    <>
    <NavbarRedesigned />
    <main className="min-h-screen bg-white">
      <section className="py-20 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 space-y-4">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-[0.2em]">Support</p>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">We’re here to help</h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            Get answers on setup, call routing, integrations, and security. Our team responds within one
            business day.
          </p>
        </div>
      </section>

      <section className="py-16 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 space-y-10">
          <div className="grid md:grid-cols-3 gap-6">
            {[{
              title: "Knowledge base",
              desc: "Step-by-step guides for onboarding, routing rules, and integrations.",
              link: "/docs"
            }, {
              title: "API reference",
              desc: "Authentication, webhook events, and endpoints for custom flows.",
              link: "/api"
            }, {
              title: "System status",
              desc: "Check uptime, incidents, and maintenance windows.",
              link: "/status"
            }].map((card) => (
              <a key={card.title} href={card.link} className="p-5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition">
                <h3 className="text-lg font-semibold text-slate-900">{card.title}</h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{card.desc}</p>
              </a>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold text-slate-900">Contact support</h2>
              <p className="text-slate-700 text-sm leading-relaxed">
                For anything urgent, reach our team by email or phone. Include your tracking ID for faster triage.
              </p>
              <ul className="text-sm text-slate-700 space-y-2">
                <li><span className="font-semibold text-slate-900">Email:</span> support@voxanne.ai</li>
                <li><span className="font-semibold text-slate-900">Phone:</span> +44 7424 038250</li>
                <li><span className="font-semibold text-slate-900">Hours:</span> 24/7 for critical incidents; standard tickets in 1 business day.</li>
              </ul>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">Submit a ticket</h3>
              <form className="space-y-4">
                <label className="block text-sm text-slate-700">
                  Subject
                  <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Call routing issue, integration question..." />
                </label>
                <label className="block text-sm text-slate-700">
                  Details
                  <textarea className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" rows={4} placeholder="Describe the issue, include tracking ID if applicable." />
                </label>
                <label className="block text-sm text-slate-700">
                  Email
                  <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="you@clinic.com" />
                </label>
                <button type="button" className="w-full rounded-lg bg-slate-900 text-white py-3 font-semibold hover:bg-slate-800">Send ticket</button>
              </form>
              <p className="text-xs text-slate-500">We reply within one business day.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
    <FooterRedesigned />
    </>
  );
}
