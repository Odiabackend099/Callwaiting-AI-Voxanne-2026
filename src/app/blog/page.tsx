import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock } from "lucide-react";

export const metadata: Metadata = {
    title: "Blog - CallWaiting AI",
    description: "Insights on AI receptionists, medical practice management, and healthcare technology",
};

const blogPosts = [
    {
        slug: "ai-booking-plastic-surgery",
        title: "How Plastic Surgeons Are Using AI to Book 40% More Consultations",
        excerpt: "Discover how leading plastic surgery practices are leveraging AI receptionists to capture after-hours leads and increase consultation bookings by 40%.",
        date: "December 7, 2025",
        readTime: "5 min read",
        category: "Case Studies",
        author: "Peter Ntaji"
    },
    {
        slug: "cost-of-missed-calls",
        title: "The Hidden Cost of Missed Calls in Medical Practices",
        excerpt: "A single missed call could cost your practice £10,000+ in lost revenue. Learn how to calculate your missed call cost and what to do about it.",
        date: "December 6, 2025",
        readTime: "4 min read",
        category: "Business",
        author: "Austyn Eguale"
    },
    {
        slug: "hipaa-compliance-ai-receptionists",
        title: "HIPAA Compliance for AI Receptionists: What You Need to Know",
        excerpt: "A comprehensive guide to ensuring your AI receptionist meets HIPAA requirements, including BAA agreements, data encryption, and audit trails.",
        date: "December 5, 2025",
        readTime: "7 min read",
        category: "Compliance",
        author: "Benjamin Nwoye"
    }
];

export default function BlogPage() {
    return (
        <main className="min-h-screen bg-black text-white">
            {/* Header */}
            <section className="py-24 px-6 bg-gradient-to-b from-slate-950 to-black border-b border-white/5">
                <div className="container mx-auto max-w-4xl">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors mb-8"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Home
                    </Link>
                    <h1 className="text-4xl md:text-6xl font-bold mb-6">
                        The CallWaiting AI Blog
                    </h1>
                    <p className="text-xl text-slate-400">
                        Insights on AI receptionists, medical practice management, and healthcare technology.
                    </p>
                </div>
            </section>

            {/* Blog Posts */}
            <section className="py-16 px-6">
                <div className="container mx-auto max-w-4xl">
                    <div className="space-y-12">
                        {blogPosts.map((post) => (
                            <article
                                key={post.slug}
                                className="group p-8 rounded-3xl bg-slate-900/50 border border-white/10 hover:border-cyan-500/30 transition-all duration-300"
                            >
                                <div className="flex items-center gap-4 mb-4">
                                    <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium">
                                        {post.category}
                                    </span>
                                    <div className="flex items-center gap-4 text-slate-500 text-sm">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-4 h-4" />
                                            {post.date}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-4 h-4" />
                                            {post.readTime}
                                        </div>
                                    </div>
                                </div>

                                <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 group-hover:text-cyan-400 transition-colors">
                                    <Link href={`/blog/${post.slug}`}>
                                        {post.title}
                                    </Link>
                                </h2>

                                <p className="text-slate-400 mb-6 leading-relaxed">
                                    {post.excerpt}
                                </p>

                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-500">
                                        By {post.author}
                                    </span>
                                    <Link
                                        href={`/blog/${post.slug}`}
                                        className="text-cyan-400 hover:text-cyan-300 font-medium text-sm flex items-center gap-2 group-hover:gap-3 transition-all"
                                    >
                                        Read More →
                                    </Link>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-16 px-6 border-t border-white/5">
                <div className="container mx-auto max-w-4xl text-center">
                    <h3 className="text-2xl font-bold text-white mb-4">
                        Want to learn more about AI for your practice?
                    </h3>
                    <p className="text-slate-400 mb-8">
                        Subscribe to our newsletter for weekly insights and case studies.
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
