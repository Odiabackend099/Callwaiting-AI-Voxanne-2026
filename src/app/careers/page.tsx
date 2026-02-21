import type { Metadata } from "next"
import NavbarRedesigned from '@/components/NavbarRedesigned';
import FooterRedesigned from '@/components/FooterRedesigned';

export const metadata: Metadata = {
  title: "Careers at Voxanne AI | Join Our Team",
  description: "Join Voxanne AI and help build the future of healthcare voice automation. Remote-first company with competitive compensation and benefits.",
  keywords: ["careers", "jobs", "voxanne hiring", "remote jobs"],
  openGraph: {
    title: "Careers at Voxanne AI",
    description: "Build the future of AI-powered healthcare communication.",
    url: 'https://voxanne.ai/careers',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Careers at Voxanne AI",
    description: "Build the future of AI-powered healthcare communication.",
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: '/careers',
  },
}

export default function CareersPage() {
  return (
    <>
    <NavbarRedesigned />
    <main className="min-h-screen bg-white">
      <section className="py-20 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 space-y-4">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-[0.2em]">Careers</p>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Join the Voxanne AI team</h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            We build conversational AI that keeps clinics responsive 24/7. If you love shipping secure,
            reliable products in healthcare, lets talk.
          </p>
        </div>
      </section>

      <section className="py-16 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 space-y-6">
          <h2 className="text-2xl font-semibold text-slate-900">Open roles</h2>
          <div className="space-y-4">
            {[{
              title: "Senior Frontend Engineer (React/Next)",
              location: "Remote, UK/EU", 
              desc: "Own the web experience, design systems, and performance for clinician-facing dashboards."
            }, {
              title: "Machine Learning Engineer (NLP/Voice)",
              location: "Remote, UK/EU",
              desc: "Improve intent recognition, call summarization, and safety/guardrail models."
            }, {
              title: "Implementation Specialist (Healthcare)",
              location: "Remote, UK/EU",
              desc: "Onboard clinics, tune call flows, and ensure clinical compliance."
            }].map((role) => (
              <div key={role.title} className="p-5 rounded-2xl border border-slate-200 bg-slate-50">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{role.title}</h3>
                    <p className="text-sm text-slate-600">{role.location}</p>
                  </div>
                  <a className="text-sm font-semibold text-slate-900 hover:underline" href="mailto:careers@voxanne.ai?subject=Application:%20{role.title}">
                    Apply
                  </a>
                </div>
                <p className="text-sm text-slate-700 mt-3 leading-relaxed">{role.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6 space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">What we offer</h2>
          <ul className="space-y-2 text-slate-700 text-sm leading-relaxed list-disc list-inside">
            <li>Remote-first with flexible hours.</li>
            <li>Competitive compensation and equity.</li>
            <li>Healthcare-focused product with real patient impact.</li>
            <li>Budget for learning, conferences, and better tooling.</li>
          </ul>
        </div>
      </section>
    </main>
    <FooterRedesigned />
    </>
  );
}
