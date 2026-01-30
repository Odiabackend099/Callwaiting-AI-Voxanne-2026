import { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  Rocket,
  Settings,
  Plug,
  Code,
  HelpCircle,
  Shield,
  Phone,
  Calendar,
  MessageSquare,
  Database,
  ArrowRight
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Documentation - Voxanne AI",
  description: "Complete guide to setting up and using Voxanne AI. Learn about agent configuration, integrations, and best practices.",
};

const docSections = [
  {
    title: "Getting Started",
    icon: Rocket,
    description: "Set up your first AI receptionist in under 15 minutes",
    articles: [
      { title: "Quick Start Guide", href: "#quick-start", time: "5 min" },
      { title: "Create Your First Agent", href: "#first-agent", time: "10 min" },
      { title: "Connect Your Phone Number", href: "#phone-setup", time: "5 min" },
      { title: "Test Your Agent", href: "#testing", time: "3 min" },
    ],
  },
  {
    title: "Agent Configuration",
    icon: Settings,
    description: "Customize your AI agent's behavior, voice, and personality",
    articles: [
      { title: "Voice & Personality Settings", href: "#voice", time: "8 min" },
      { title: "Call Routing & Escalation", href: "#routing", time: "10 min" },
      { title: "Business Hours & Availability", href: "#hours", time: "5 min" },
      { title: "Custom Greetings & Scripts", href: "#scripts", time: "12 min" },
    ],
  },
  {
    title: "Integrations",
    icon: Plug,
    description: "Connect Voxanne AI with your existing tools and workflows",
    articles: [
      { title: "Google Calendar Integration", href: "#google-calendar", time: "10 min" },
      { title: "Outlook Calendar Integration", href: "#outlook-calendar", time: "10 min" },
      { title: "Twilio Phone Integration", href: "#twilio", time: "15 min" },
      { title: "Webhook Events & API", href: "#webhooks", time: "20 min" },
    ],
  },
  {
    title: "Knowledge Base",
    icon: Database,
    description: "Train your agent to answer practice-specific questions",
    articles: [
      { title: "Upload Knowledge Base Documents", href: "#kb-upload", time: "8 min" },
      { title: "Supported File Formats", href: "#kb-formats", time: "3 min" },
      { title: "Update & Version Control", href: "#kb-versions", time: "5 min" },
      { title: "Best Practices for KB Content", href: "#kb-best-practices", time: "10 min" },
    ],
  },
  {
    title: "Appointment Booking",
    icon: Calendar,
    description: "Configure automated appointment scheduling and reminders",
    articles: [
      { title: "Set Up Appointment Types", href: "#appointment-types", time: "10 min" },
      { title: "Calendar Availability Rules", href: "#availability", time: "12 min" },
      { title: "SMS Confirmation & Reminders", href: "#sms", time: "8 min" },
      { title: "Handle Cancellations & Reschedules", href: "#cancellations", time: "10 min" },
    ],
  },
  {
    title: "Call Management",
    icon: Phone,
    description: "Monitor calls, review transcripts, and analyze performance",
    articles: [
      { title: "Dashboard Overview", href: "#dashboard", time: "5 min" },
      { title: "Call Logs & Transcripts", href: "#call-logs", time: "8 min" },
      { title: "Lead Scoring & Pipeline", href: "#leads", time: "10 min" },
      { title: "Performance Analytics", href: "#analytics", time: "12 min" },
    ],
  },
  {
    title: "Security & Compliance",
    icon: Shield,
    description: "HIPAA compliance, data protection, and access controls",
    articles: [
      { title: "HIPAA Compliance Overview", href: "#hipaa", time: "10 min" },
      { title: "Data Encryption & Storage", href: "#encryption", time: "8 min" },
      { title: "Access Controls & Permissions", href: "#access", time: "10 min" },
      { title: "Business Associate Agreement", href: "#baa", time: "5 min" },
    ],
  },
  {
    title: "API Reference",
    icon: Code,
    description: "Developer documentation for custom integrations",
    articles: [
      { title: "Authentication & API Keys", href: "/api-reference#auth", time: "10 min" },
      { title: "Agents API", href: "/api-reference#agents", time: "15 min" },
      { title: "Calls API", href: "/api-reference#calls", time: "12 min" },
      { title: "Contacts API", href: "/api-reference#contacts", time: "12 min" },
    ],
  },
];

const popularGuides = [
  {
    title: "How to Set Up Your First AI Agent",
    category: "Getting Started",
    readTime: "10 min",
    href: "#first-agent",
  },
  {
    title: "Integrating Google Calendar for Appointment Booking",
    category: "Integrations",
    readTime: "12 min",
    href: "#google-calendar",
  },
  {
    title: "HIPAA Compliance Checklist",
    category: "Security",
    readTime: "8 min",
    href: "#hipaa",
  },
  {
    title: "Best Practices for Knowledge Base Content",
    category: "Knowledge Base",
    readTime: "10 min",
    href: "#kb-best-practices",
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-navy-900 mb-4">
            Documentation
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-8">
            Everything you need to set up, configure, and optimize your AI receptionist
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <input
                type="text"
                placeholder="Search documentation..."
                className="w-full px-6 py-4 rounded-full border-2 border-slate-200 focus:border-surgical-600 focus:outline-none text-lg"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 rounded-full bg-surgical-600 text-white font-semibold hover:bg-surgical-700 transition-colors">
                Search
              </button>
            </div>
          </div>
        </div>

        {/* Popular Guides */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-navy-900 mb-6">Popular Guides</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {popularGuides.map((guide) => (
              <Link
                key={guide.title}
                href={guide.href}
                className="p-6 rounded-2xl border border-slate-200 bg-slate-50 hover:border-surgical-600 hover:shadow-md transition-all"
              >
                <span className="inline-block px-3 py-1 rounded-full bg-surgical-50 border border-surgical-600/20 text-surgical-600 text-xs font-medium mb-3">
                  {guide.category}
                </span>
                <h3 className="font-semibold text-navy-900 mb-2 leading-tight">
                  {guide.title}
                </h3>
                <p className="text-sm text-slate-600">{guide.readTime} read</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Documentation Sections */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-navy-900 mb-6">All Documentation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {docSections.map((section) => {
              const Icon = section.icon;
              return (
                <div
                  key={section.title}
                  className="border border-slate-200 rounded-3xl p-8 bg-white hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start gap-4 mb-6">
                    <div className="p-3 rounded-xl bg-surgical-50 border border-surgical-600/20">
                      <Icon className="w-6 h-6 text-surgical-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-navy-900 mb-2">
                        {section.title}
                      </h3>
                      <p className="text-slate-600">{section.description}</p>
                    </div>
                  </div>

                  <ul className="space-y-3">
                    {section.articles.map((article) => (
                      <li key={article.title}>
                        <Link
                          href={article.href}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors group"
                        >
                          <span className="text-navy-900 font-medium group-hover:text-surgical-600 transition-colors">
                            {article.title}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-500">{article.time}</span>
                            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-surgical-600 transition-colors" />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* Help Section */}
        <div className="bg-gradient-to-br from-surgical-50 to-white border border-slate-200 rounded-3xl p-8 md:p-12 text-center">
          <div className="max-w-3xl mx-auto">
            <HelpCircle className="w-12 h-12 text-surgical-600 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-navy-900 mb-4">
              Can't find what you're looking for?
            </h2>
            <p className="text-lg text-slate-600 mb-8">
              Our support team is here to help. Get answers within 24 hours.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/support"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-surgical-600 text-white font-semibold hover:bg-surgical-700 transition-colors"
              >
                <MessageSquare className="w-5 h-5" />
                Contact Support
              </Link>
              <Link
                href="/api-reference"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full border-2 border-navy-900 text-navy-900 font-semibold hover:bg-navy-900 hover:text-white transition-colors"
              >
                <Code className="w-5 h-5" />
                API Reference
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <Link
            href="/demo-workflow"
            className="p-6 rounded-2xl border border-slate-200 hover:border-surgical-600 transition-colors"
          >
            <Rocket className="w-8 h-8 text-surgical-600 mx-auto mb-3" />
            <h3 className="font-semibold text-navy-900 mb-2">Live Demo</h3>
            <p className="text-sm text-slate-600">See Voxanne AI in action</p>
          </Link>
          <Link
            href="/case-studies"
            className="p-6 rounded-2xl border border-slate-200 hover:border-surgical-600 transition-colors"
          >
            <BookOpen className="w-8 h-8 text-surgical-600 mx-auto mb-3" />
            <h3 className="font-semibold text-navy-900 mb-2">Case Studies</h3>
            <p className="text-sm text-slate-600">Real results from clinics</p>
          </Link>
          <Link
            href="/security"
            className="p-6 rounded-2xl border border-slate-200 hover:border-surgical-600 transition-colors"
          >
            <Shield className="w-8 h-8 text-surgical-600 mx-auto mb-3" />
            <h3 className="font-semibold text-navy-900 mb-2">Security</h3>
            <p className="text-sm text-slate-600">HIPAA & compliance</p>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
