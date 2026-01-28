import { Metadata } from "next";
import { FileText, Video, Download, BookOpen } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
    title: "Resources - Voxanne AI",
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
        description: "Proven scripts for consultations, bookings, and customer inquiries",
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
        description: "5-minute video showing how to set up Voxanne AI from scratch",
        downloadUrl: "/resources/setup-video"
    },
    {
        title: "Integration Guide: Google Calendar",
        type: "PDF Guide",
        icon: FileText,
        description: "Step-by-step guide to connect Voxanne AI with your Google Calendar",
        downloadUrl: "/resources/calendar-integration.pdf"
    }
];

export default function ResourcesPage() {
    return (
        <div className="min-h-screen bg-white">
            <Navbar />

            <main className="max-w-7xl mx-auto px-4 py-16">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-navy-900 mb-4">
                        Resources & Downloads
                    </h1>
                    <p className="text-lg text-slate-600">
                        Free guides, templates, and tools to help you maximize your practice's potential
                    </p>
                </div>

                {/* Resources Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
                    {resources.map((resource) => (
                        <Card key={resource.title} className="hover:shadow-lg transition-shadow border-slate-100">
                            <CardHeader>
                                <div className="w-14 h-14 rounded-2xl bg-surgical-50 flex items-center justify-center text-surgical-600 mb-4">
                                    <resource.icon className="w-7 h-7" />
                                </div>
                                <div className="inline-block px-3 py-1 rounded-full bg-slate-50 text-slate-600 text-xs font-medium mb-3">
                                    {resource.type}
                                </div>
                                <CardTitle className="text-navy-900">
                                    {resource.title}
                                </CardTitle>
                                <CardDescription className="text-slate-600">
                                    {resource.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    className="w-full bg-surgical-600 hover:bg-surgical-700 text-white rounded-full"
                                    asChild
                                >
                                    <a href={resource.downloadUrl} download>
                                        <Download className="w-4 h-4 mr-2" />
                                        Download Free
                                    </a>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Newsletter CTA */}
                <div className="bg-slate-50 rounded-2xl p-8 md:p-12 text-center">
                    <h3 className="text-3xl font-bold text-navy-900 mb-4">
                        Get New Resources Delivered Weekly
                    </h3>
                    <p className="text-slate-600 mb-8 max-w-2xl mx-auto">
                        Join 500+ medical practice owners getting actionable insights every Tuesday
                    </p>
                    <form className="flex gap-4 max-w-md mx-auto">
                        <input
                            type="email"
                            placeholder="Enter your email"
                            className="flex-1 px-4 py-3 rounded-lg bg-white border border-slate-200 text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-surgical-600 focus:border-surgical-600"
                        />
                        <Button
                            type="submit"
                            className="px-6 py-3 rounded-full bg-surgical-600 text-white font-semibold hover:bg-surgical-700 transition-colors"
                        >
                            Subscribe
                        </Button>
                    </form>
                </div>
            </main>

            <Footer />
        </div>
    );
}
