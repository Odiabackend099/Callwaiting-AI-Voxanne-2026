import { Metadata } from "next";
import Link from "next/link";
import { Calendar, Clock } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
    title: "Blog - Voxanne AI",
    description: "Insights on AI, healthcare automation, and customer service innovation",
};

const blogPosts = [
    {
        slug: "ai-booking-plastic-surgery",
        title: "How Plastic Surgeons Are Using AI to Book 40% More Consultations",
        excerpt: "Discover how leading plastic surgery practices are leveraging AI receptionists to capture after-hours leads and increase consultation bookings by 40%.",
        date: "December 7, 2025",
        readTime: "5 min read",
        category: "Case Studies",
        author: "Voxanne Team"
    },
    {
        slug: "cost-of-missed-calls",
        title: "The Hidden Cost of Missed Calls in Medical Practices",
        excerpt: "A single missed call could cost your practice £10,000+ in lost revenue. Learn how to calculate your missed call cost and what to do about it.",
        date: "December 6, 2025",
        readTime: "4 min read",
        category: "Business",
        author: "Voxanne Team"
    },
    {
        slug: "hipaa-compliance-ai-receptionists",
        title: "HIPAA Compliance for AI Receptionists: What You Need to Know",
        excerpt: "A comprehensive guide to ensuring your AI receptionist meets HIPAA requirements, including BAA agreements, data encryption, and audit trails.",
        date: "December 5, 2025",
        readTime: "7 min read",
        category: "Compliance",
        author: "Voxanne Team"
    }
];

export default function BlogPage() {
    return (
        <div className="min-h-screen bg-white">
            <Navbar />

            <main className="max-w-7xl mx-auto px-4 py-16">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-navy-900 mb-4">
                        Voxanne AI Blog
                    </h1>
                    <p className="text-lg text-slate-600">
                        Insights on AI, healthcare automation, and customer service innovation
                    </p>
                </div>

                {/* Blog Posts Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
                    {blogPosts.map((post) => (
                        <Card key={post.slug} className="hover:shadow-lg transition-shadow border-slate-100">
                            <CardHeader>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="px-3 py-1 rounded-full bg-surgical-50 border border-surgical-600/20 text-surgical-600 text-xs font-medium">
                                        {post.category}
                                    </span>
                                </div>
                                <CardTitle className="text-navy-900 hover:text-surgical-600 transition-colors">
                                    <Link href={`/blog/${post.slug}`}>
                                        {post.title}
                                    </Link>
                                </CardTitle>
                                <CardDescription className="text-slate-600 flex items-center gap-4 text-sm mt-2">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-4 h-4" />
                                        {post.date}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-4 h-4" />
                                        {post.readTime}
                                    </span>
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-slate-600 mb-4 leading-relaxed">
                                    {post.excerpt}
                                </p>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-500">
                                        By {post.author}
                                    </span>
                                    <Button variant="outline" asChild size="sm">
                                        <Link href={`/blog/${post.slug}`}>
                                            Read More
                                        </Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Newsletter CTA */}
                <div className="bg-slate-50 rounded-2xl p-8 md:p-12 text-center">
                    <h3 className="text-2xl font-bold text-navy-900 mb-4">
                        Want to learn more about AI for your practice?
                    </h3>
                    <p className="text-slate-600 mb-8 max-w-2xl mx-auto">
                        Subscribe to our newsletter for weekly insights, case studies, and industry updates.
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
