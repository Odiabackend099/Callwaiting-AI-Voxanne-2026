import Image from 'next/image';

export default function AboutPage() {
  const team = [
    {
      name: "Peter Ntaji",
      role: "CEO & Founder",
      image: "/images/team/peter-ntaji.png",
      bio: "Visionary leader driving innovation in AI-powered healthcare communication."
    },
    {
      name: "Austyn Eguale",
      role: "Co-Founder & CTO",
      image: "/images/team/austyn-eguale.png",
      bio: "Technical architect behind Voxanne's intelligent voice platform."
    },
    {
      name: "Ndi",
      role: "Head of Human & International Relations",
      image: "/images/team/ndi.png",
      bio: "Leading global operations and building world-class teams across continents."
    }
  ];

  return (
    <main className="min-h-screen bg-white">
      <section className="py-20 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 space-y-6">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-[0.2em]">About</p>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Built for modern clinics</h1>
          <p className="text-lg text-slate-600 leading-relaxed max-w-3xl">
            Voxanne AI is a voice-first receptionist designed for healthcare. We answer calls instantly,
            qualify patients with natural language, book appointments into your calendar or EHR, and keep
            your front desk available 24/7 without adding headcount.
          </p>
        </div>
      </section>

      <section className="py-16 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-3 gap-8">
          {[{
            title: "Clinical-grade security",
            desc: "HIPAA-compliant by default, SOC 2 Type II processes, encrypted at rest and in transit."
          }, {
            title: "Built for teams",
            desc: "Shared inbox for calls, voice summaries, live transcripts, and escalation to humans when needed."
          }, {
            title: "Measurable ROI",
            desc: "Reduced abandonment, faster booking, and captured after-hours leads with clear analytics."
          }].map((card) => (
            <div key={card.title} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3">
              <h3 className="text-lg font-semibold text-slate-900">{card.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-2 gap-8 items-start">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">Why clinics choose Voxanne</h2>
            <ul className="space-y-3 text-slate-700 text-sm leading-relaxed list-disc list-inside">
              <li>AI that sounds human, understands intent, and follows clinical scripts.</li>
              <li>Native integrations with Google/Outlook calendars, major EHRs, and CRMs.</li>
              <li>Live agent failover and call summaries stored securely for your team.</li>
              <li>Deployed in minutes with a guided onboarding and dedicated support.</li>
            </ul>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Fast facts</h3>
            <dl className="grid grid-cols-2 gap-4 text-sm text-slate-700">
              <div>
                <dt className="font-semibold text-slate-900">Response time</dt>
                <dd>&lt; 1 second pickup</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">Setup</dt>
                <dd>&lt; 15 minutes</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">Compliance</dt>
                <dd>HIPAA, SOC 2 Type II</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">Coverage</dt>
                <dd>24/7, after-hours ready</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Meet Our Leadership</h2>
            <p className="text-slate-600 text-lg">The team building the future of healthcare communication</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {team.map((member) => (
              <div key={member.name} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-square relative bg-gradient-to-br from-blue-50 to-slate-50">
                  <Image
                    src={member.image}
                    alt={`${member.name} - ${member.role}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
                <div className="p-6 space-y-2">
                  <h3 className="text-xl font-bold text-slate-900">{member.name}</h3>
                  <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">{member.role}</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{member.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
