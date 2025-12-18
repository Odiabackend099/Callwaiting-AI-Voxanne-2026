import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText, Video, Download, BookOpen } from "lucide-react";

export const metadata: Metadata = {
    title: "Resources - CallWaiting AI",
    description: "Guides, templates, and resources for medical practice management",
};

const resources = [
    {
        title: "HIPAA Compliance Checklist for AI Tools",
        type: "PDF Guide",
        icon: FileText,
        description: "Complete checklist to ensure your AI receptionist meets all HIPAA requirements",
        downloadUrl: "/resources/hipaa-checklist.pdf"
    },
    {
        title: "ROI Calculator Spreadsheet",
        type: "Excel Template",
        icon: Download,
        description: "Calculate exactly how much revenue you're losing to missed calls",
        downloadUrl: "/resources/roi-calculator.xlsx"
    },
    {
        title: "Phone Script Templates",
        type: "PDF Guide",
        icon: BookOpen,
        description: "Proven scripts for BBL, Rhinoplasty, and Botox consultations",
        downloadUrl: "/resources/phone-scripts.pdf"
    },
    {
        title: "AI Receptionist Buyer's Guide",
        type: "eBook",
        icon: BookOpen,
        description: "What to look for when choosing an AI receptionist for your practice",
        downloadUrl: "/resources/buyers-guide.pdf"
    },
    {
        title: "Setup Walkthrough Video",
        type: "Video",
        icon: Video,
        description: "5-minute video showing how to set up Call Waiting AI from scratch",
        downloadUrl: "/resources/setup-video"
    },
    {
        title: "Integration Guide: Mindbody",
        type: "PDF Guide",
        icon: FileText,
        description: "Step-by-step guide to connect Call Waiting AI with your Mindbody account",
        downloadUrl: "/resources/mindbody-integration.pdf"
    }
];

export default function ResourcesPage() {
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
                        Resources & Downloads
                    </h1>
                    <p className="text-xl text-slate-400">
                        Free guides, templates, and tools to help you maximize your practice's potential.
                    </p>
                </div>
            </section>

            {/* Resources Grid */}
            <section className="py-16 px-6">
                <div className="container mx-auto max-w-6xl">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {resources.map((resource, index) => (
                            <div
                                key={index}
                                className="group p-8 rounded-3xl bg-slate-900/50 border border-white/10 hover:border-cyan-500/30 transition-all duration-300"
                            >
                                <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6 group-hover:scale-110 transition-transform">
                                    <resource.icon className="w-7 h-7" />
                                </div>

                                <div className="inline-block px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-xs font-medium mb-4">
                                    {resource.type}
                                </div>

                                <h3 className="text-xl font-bold text-white mb-3">
                                    {resource.title}
                                </h3>

                                <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                                    {resource.description}
                                </p>

                                <a
                                    href={resource.downloadUrl}
                                    className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-medium text-sm group-hover:gap-3 transition-all"
                                >
                                    <Download className="w-4 h-4" />
                                    Download Free
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Newsletter CTA */}
            <section className="py-16 px-6 border-t border-white/5">
                <div className="container mx-auto max-w-4xl text-center">
                    <h3 className="text-3xl font-bold text-white mb-4">
                        Get New Resources Delivered Weekly
                    </h3>
                    <p className="text-slate-400 mb-8">
                        Join 500+ medical practice owners getting actionable insights every Tuesday.
                    </p>
                    <form className="flex gap-4 max-w-md mx-auto">
                        <input
                            type="email"
                            placeholder="Enter your email"
                            className="flex-1 px-4 py-3 rounded-lg bg-slate-900 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
                        />
                        <button className="px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold hover:shadow-lg hover:shadow-cyan-500/30 transition-all">
                            Subscribe
                        </button>
                    </form>
                </div>
            </section>
        </main>
    );
}
