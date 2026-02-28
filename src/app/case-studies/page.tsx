import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, TrendingUp, Users, Clock } from "lucide-react";
import NavbarRedesigned from "@/components/NavbarRedesigned";
import FooterRedesigned from "@/components/FooterRedesigned";

export const metadata: Metadata = {
  title: "Case Studies - Voxanne AI",
  description: "Real results from clinics using Voxanne AI. See how AI receptionists increase bookings, reduce no-shows, and save staff time.",
};

const caseStudies = [
  {
    id: 1,
    clinicName: "Martinez Dermatology",
    specialty: "Dermatology",
    location: "Austin, TX",
    doctor: "Dr. Jennifer Martinez",
    challenge: "30% of calls went to voicemail during peak hours, losing an estimated $15K/month in missed bookings.",
    solution: "Deployed Voxanne AI to handle all after-hours calls and overflow during busy periods. Integrated with their existing calendar system.",
    results: [
      { metric: "Call answer rate", value: "24/7", change: "Always on" },
      { metric: "No-show rate", value: "5%", change: "-25%" },
      { metric: "Additional revenue", value: "$173K/year", change: "+12%" },
      { metric: "Time saved", value: "2 hrs/day", change: "100%" },
    ],
    quote: "Voxanne AI answered the calls we were missing. In the first month, we booked 47 additional consultations that would have gone to voicemail. The ROI was immediate.",
    image: "/testimonials/dr-martinez.jpg",
  },
  {
    id: 2,
    clinicName: "Chen Plastic Surgery",
    specialty: "Plastic Surgery",
    location: "San Francisco, CA",
    doctor: "Dr. Michael Chen",
    challenge: "High-value consultation requests coming in after hours were being lost to competitors who answered faster.",
    solution: "Implemented Voxanne AI for 24/7 availability, with custom scripts for cosmetic procedures and pricing discussions.",
    results: [
      { metric: "After-hours bookings", value: "89/month", change: "+89" },
      { metric: "Average consultation value", value: "$2,400", change: "same" },
      { metric: "Conversion rate", value: "42%", change: "+18%" },
      { metric: "Response time", value: "<10 sec", change: "-100%" },
    ],
    quote: "In cosmetic surgery, timing is everything. Patients shop around. Being the first to respond means we win the consultation. Voxanne AI gave us 24/7 responsiveness without hiring night staff.",
    image: "/testimonials/dr-chen.jpg",
  },
  {
    id: 3,
    clinicName: "Williams Dental Care",
    specialty: "General Dentistry",
    location: "London, UK",
    doctor: "Dr. Sarah Williams",
    challenge: "Front desk staff spent 60% of their time answering routine questions about appointments, pricing, and insurance.",
    solution: "Trained Voxanne AI on their knowledge base covering common procedures, insurance plans, and appointment policies.",
    results: [
      { metric: "Routine calls handled", value: "85%", change: "+85%" },
      { metric: "Staff productivity", value: "+3.5 hrs/day", change: "+60%" },
      { metric: "Patient satisfaction", value: "4.8/5", change: "+0.4" },
      { metric: "Same-day bookings", value: "34/week", change: "+22" },
    ],
    quote: "Our front desk team can now focus on patient care instead of answering the same questions 50 times a day. Patients love the instant responses, especially for urgent appointments.",
    image: "/testimonials/dr-williams.jpg",
  },
];

export default function CaseStudiesPage() {
  return (
    <div className="min-h-screen bg-white">
      <NavbarRedesigned />

      <main className="max-w-7xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-navy-900 mb-4">
            Real Results from Real Clinics
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            See how medical practices are using Voxanne AI to increase bookings, reduce no-shows, and save staff time.
          </p>
        </div>

        {/* Case Studies */}
        <div className="space-y-20">
          {caseStudies.map((study, index) => (
            <article key={study.id} className="border border-slate-200 rounded-3xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-br from-surgical-50 to-white p-8 md:p-12 border-b border-slate-200">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-3xl font-bold text-navy-900 mb-2">{study.clinicName}</h2>
                    <p className="text-lg text-slate-600">
                      {study.specialty} • {study.location}
                    </p>
                  </div>
                  <span className="px-4 py-2 rounded-full bg-surgical-600 text-white text-sm font-semibold">
                    Case Study #{index + 1}
                  </span>
                </div>

                {/* Challenge */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Challenge</h3>
                  <p className="text-lg text-slate-700 leading-relaxed">{study.challenge}</p>
                </div>

                {/* Solution */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Solution</h3>
                  <p className="text-lg text-slate-700 leading-relaxed">{study.solution}</p>
                </div>
              </div>

              {/* Results Grid */}
              <div className="p-8 md:p-12">
                <h3 className="text-2xl font-bold text-navy-900 mb-8">Results</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                  {study.results.map((result, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                      <p className="text-sm text-slate-600 mb-2">{result.metric}</p>
                      <p className="text-3xl font-bold text-navy-900 mb-1">{result.value}</p>
                      <p className="text-sm font-semibold text-green-600 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        {result.change}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Quote */}
                <div className="bg-navy-900 rounded-2xl p-8 md:p-10 text-white">
                  <div className="flex items-start gap-4">
                    <div className="text-6xl text-surgical-400 leading-none">"</div>
                    <div>
                      <p className="text-lg leading-relaxed mb-6">{study.quote}</p>
                      <p className="font-semibold">— {study.doctor}</p>
                      <p className="text-slate-300 text-sm">{study.clinicName}</p>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-20 bg-gradient-to-br from-surgical-50 to-white border border-slate-200 rounded-3xl p-8 md:p-12 text-center">
          <h2 className="text-3xl font-bold text-navy-900 mb-4">Ready to see similar results?</h2>
          <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
            Schedule a demo to see how Voxanne AI can transform your practice's patient communication.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/start"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-surgical-600 text-white font-semibold hover:bg-surgical-700 transition-colors"
            >
              Schedule Demo
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/contact-sales"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full border-2 border-navy-900 text-navy-900 font-semibold hover:bg-navy-900 hover:text-white transition-colors"
            >
              Talk to Sales
            </Link>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Users className="w-6 h-6 text-surgical-600" />
              <p className="text-4xl font-bold text-navy-900">Growing</p>
            </div>
            <p className="text-slate-600">Clinics using Voxanne AI</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <TrendingUp className="w-6 h-6 text-surgical-600" />
              <p className="text-4xl font-bold text-navy-900">24/7</p>
            </div>
            <p className="text-slate-600">Always available coverage</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="w-6 h-6 text-surgical-600" />
              <p className="text-4xl font-bold text-navy-900">24/7</p>
            </div>
            <p className="text-slate-600">Patient availability</p>
          </div>
        </div>
      </main>

      <FooterRedesigned />
    </div>
  );
}
