import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, TrendingUp, Users, DollarSign } from "lucide-react";

export const metadata: Metadata = {
    title: "Case Studies - CallWaiting AI",
    description: "Real results from medical practices using Voxanne AI receptionist",
};

const caseStudies = [
    {
        slug: "beverly-hills-plastic-surgery",
        clinic: "Beverly Hills Aesthetic Center",
        location: "Los Angeles, CA",
        specialty: "Plastic Surgery",
        results: {
            bookings: "+42%",
            revenue: "$180K",
            callsAnswered: "100%"
        },
        quote: "Voxanne paid for herself in the first month. We're now capturing every single after-hours BBL inquiry.",
        doctor: "Dr. Sarah Chen",
        image: "/case-studies/beverly-hills.jpg"
    },
    {
        slug: "london-dermatology",
        clinic: "Harley Street Dermatology",
        location: "London, UK",
        specialty: "Dermatology",
        results: {
            bookings: "+38%",
            revenue: "£95K",
            callsAnswered: "24/7"
        },
        quote: "The British accent was crucial for our clientele. Voxanne sounds more professional than our previous receptionist.",
        doctor: "Dr. James Morrison",
        image: "/case-studies/harley-street.jpg"
    },
    {
        slug: "miami-med-spa",
        clinic: "Ocean Drive Med Spa",
        location: "Miami, FL",
        specialty: "Med Spa",
        results: {
            bookings: "+55%",
            revenue: "$220K",
            callsAnswered: "100%"
        },
        quote: "We went from missing 30% of calls to missing zero. The ROI is insane.",
        doctor: "Maria Rodriguez, Owner",
        image: "/case-studies/miami-spa.jpg"
    }
];

export default function CaseStudiesPage() {
    return (
        <main className="min-h-screen bg-black text-white">
            {/* Header */}
            <section className="py-24 px-6 bg-gradient-to-b from-slate-950 to-black border-b border-white/5">
                <div className="container mx-auto max-w-6xl">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors mb-8"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Home
                    </Link>
                    <h1 className="text-4xl md:text-6xl font-bold mb-6">
                        Real Results from Real Practices
                    </h1>
                    <p className="text-xl text-slate-400">
                        See how medical practices are using Voxanne to capture more leads and increase revenue.
                    </p>
                </div>
            </section>

            {/* Case Studies */}
            <section className="py-16 px-6">
                <div className="container mx-auto max-w-6xl space-y-16">
                    {caseStudies.map((study, index) => (
                        <article
                            key={study.slug}
                            className="grid md:grid-cols-2 gap-12 items-center p-12 rounded-3xl bg-slate-900/50 border border-white/10"
                        >
                            {/* Content */}
                            <div className={index % 2 === 1 ? 'md:order-2' : ''}>
                                <div className="inline-block px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-4">
                                    {study.specialty}
                                </div>
                                <h2 className="text-3xl font-bold text-white mb-2">
                                    {study.clinic}
                                </h2>
                                <p className="text-slate-400 mb-6">{study.location}</p>

                                {/* Results */}
                                <div className="grid grid-cols-3 gap-4 mb-8">
                                    <div className="text-center p-4 rounded-xl bg-black/50">
                                        <TrendingUp className="w-6 h-6 text-green-400 mx-auto mb-2" />
                                        <div className="text-2xl font-bold text-green-400">{study.results.bookings}</div>
                                        <div className="text-xs text-slate-500">Bookings</div>
                                    </div>
                                    <div className="text-center p-4 rounded-xl bg-black/50">
                                        <DollarSign className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
                                        <div className="text-2xl font-bold text-cyan-400">{study.results.revenue}</div>
                                        <div className="text-xs text-slate-500">Added Revenue</div>
                                    </div>
                                    <div className="text-center p-4 rounded-xl bg-black/50">
                                        <Users className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                                        <div className="text-2xl font-bold text-purple-400">{study.results.callsAnswered}</div>
                                        <div className="text-xs text-slate-500">Calls Answered</div>
                                    </div>
                                </div>

                                {/* Quote */}
                                <blockquote className="border-l-4 border-cyan-500 pl-6 py-2 mb-4">
                                    <p className="text-slate-300 italic mb-2">"{study.quote}"</p>
                                    <cite className="text-sm text-slate-500 not-italic">— {study.doctor}</cite>
                                </blockquote>

                                <Link
                                    href={`/case-studies/${study.slug}`}
                                    className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-medium"
                                >
                                    Read Full Case Study →
                                </Link>
                            </div>

                            {/* Image Placeholder */}
                            <div className={index % 2 === 1 ? 'md:order-1' : ''}>
                                <div className="aspect-square rounded-2xl bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border border-white/10 flex items-center justify-center">
                                    <div className="text-center text-slate-500">
                                        <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                        <p className="text-sm">Case Study Image</p>
                                    </div>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="py-16 px-6 border-t border-white/5">
                <div className="container mx-auto max-w-4xl text-center">
                    <h3 className="text-3xl font-bold text-white mb-4">
                        Ready to See Similar Results?
                    </h3>
                    <p className="text-slate-400 mb-8">
                        Book a demo and see how Voxanne can transform your practice.
                    </p>
                    <button className="px-8 py-4 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-lg hover:shadow-lg hover:shadow-cyan-500/30 transition-all">
                        Book Your Demo Call
                    </button>
                </div>
            </section>
        </main>
    );
}
