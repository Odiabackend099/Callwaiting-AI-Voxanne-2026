"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2, Globe, Lock, Database } from "lucide-react";
import { motion } from "framer-motion";

export default function SubProcessorsPage() {
    const subProcessors = [
        {
            name: "Supabase",
            service: "Database, Authentication, Real-time APIs",
            dataProcessed: "All customer data (contacts, appointments, call logs, knowledge base)",
            location: "US (Virginia) or EU (Ireland) - customer selectable",
            compliance: ["SOC 2 Type II", "HIPAA BAA", "GDPR DPA", "CCPA"],
            purpose: "Data storage, user authentication, real-time synchronization",
            retention: "Until customer deletion or service termination",
            dataTransfers: "Standard Contractual Clauses (SCCs) for EU/UK customers",
        },
        {
            name: "Vapi AI",
            service: "Voice AI Infrastructure & Call Processing",
            dataProcessed: "Real-time voice audio, call transcripts, call metadata",
            location: "United States",
            compliance: ["HIPAA-eligible", "SOC 2", "GDPR-compliant"],
            purpose: "Inbound/outbound call handling, speech-to-text, voice AI processing",
            retention: "Call recordings (encrypted, 30-day retention), metadata (90 days)",
            dataTransfers: "Standard Contractual Clauses (SCCs)",
        },
        {
            name: "Twilio",
            service: "Telephony & SMS Gateway",
            dataProcessed: "Phone numbers, SMS messages, call metadata, call logs",
            location: "United States with EU redundancy",
            compliance: ["SOC 2 Type II", "HIPAA BAA", "ISO 27001", "GDPR DPA", "CCPA"],
            purpose: "Incoming/outgoing calls, SMS sending (confirmations, reminders, follow-ups)",
            retention: "Call logs (90 days), SMS (90 days), no content retention",
            dataTransfers: "Standard Contractual Clauses (SCCs)",
        },
        {
            name: "Deepgram",
            service: "Speech-to-Text (Transcription)",
            dataProcessed: "Audio streams (real-time only, not persisted)",
            location: "United States",
            compliance: ["SOC 2", "GDPR-compliant", "HIPAA-compatible"],
            purpose: "Convert voice audio to text transcripts in real-time",
            retention: "No persistent storage (processed in real-time, deleted immediately)",
            dataTransfers: "Standard Contractual Clauses (SCCs)",
        },
        {
            name: "ElevenLabs",
            service: "Text-to-Speech Synthesis",
            dataProcessed: "Text responses (no personal data stored)",
            location: "United States & European Union",
            compliance: ["SOC 2", "GDPR DPA", "HIPAA-compatible"],
            purpose: "Generate voice responses for outbound calls",
            retention: "No persistent storage (synthesized on-demand)",
            dataTransfers: "Standard Contractual Clauses (SCCs)",
        },
        {
            name: "OpenAI",
            service: "Large Language Model (GPT)",
            dataProcessed: "Call transcripts (with PII redacted), knowledge base queries",
            location: "United States",
            compliance: ["Enterprise DPA", "GDPR-compliant", "SOC 2"],
            purpose: "Natural language processing, knowledge base retrieval, response generation",
            retention: "Zero data retention (API default), no logs saved",
            dataTransfers: "Standard Contractual Clauses (SCCs)",
        },
        {
            name: "Stripe",
            service: "Payment Processing & Billing",
            dataProcessed: "Email addresses, billing information (no credit card data stored by us)",
            location: "United States with global redundancy",
            compliance: ["PCI DSS Level 1", "SOC 2 Type II", "GDPR DPA", "HIPAA-compatible"],
            purpose: "Subscription processing, invoice generation, payment collection",
            retention: "As per PCI DSS requirements (typically 90 days)",
            dataTransfers: "Standard Contractual Clauses (SCCs)",
        },
        {
            name: "Sentry",
            service: "Error Tracking & Monitoring",
            dataProcessed: "Error logs (with PII redacted), application events, performance metrics",
            location: "United States & Europe (customer selectable)",
            compliance: ["SOC 2", "GDPR DPA", "HIPAA-compatible"],
            purpose: "Error monitoring, performance tracking, security alerts",
            retention: "30 days (customer-configurable)",
            dataTransfers: "Standard Contractual Clauses (SCCs)",
        },
        {
            name: "Google Cloud AI",
            service: "AI/ML Infrastructure, Knowledge Base Processing",
            dataProcessed: "Knowledge base documents, embeddings, search indexes",
            location: "United States & Multi-region (customer selectable)",
            compliance: ["HIPAA BAA", "ISO 27001", "SOC 2 Type II", "GDPR DPA"],
            purpose: "Knowledge base indexing, RAG pipeline processing, semantic search",
            retention: "Duration of service",
            dataTransfers: "Standard Contractual Clauses (SCCs)",
        },
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.6 },
        },
    };

    return (
        <main className="min-h-screen bg-white">
            {/* Hero Section */}
            <section className="bg-gradient-to-br from-clinical-blue/5 via-white to-surgical-blue/5 py-20 px-4 md:px-6">
                <div className="max-w-4xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h1 className="text-5xl md:text-6xl font-bold text-deep-obsidian mb-6 tracking-tight">
                            Sub-Processor Disclosure
                        </h1>
                        <p className="text-xl text-slate-600 mb-4">
                            GDPR Article 28 Transparency - All Third-Party Service Providers
                        </p>
                        <p className="text-sm text-slate-500">
                            Last Updated: January 30, 2026 | Version 1.0
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Main Content */}
            <section className="py-16 px-4 md:px-6">
                <div className="max-w-5xl mx-auto space-y-12">
                    {/* Introduction */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        className="prose prose-lg max-w-none"
                    >
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-6">
                            What is a Sub-Processor?
                        </h2>
                        <p className="text-slate-700 leading-relaxed mb-4">
                            Under GDPR Article 28, Data Processors (like Voxanne AI) must obtain written authorization before engaging sub-processors to handle personal data. We believe in transparency - below is our complete list of all vendors who access or process your data.
                        </p>
                        <p className="text-slate-700 leading-relaxed">
                            <strong>Why we use sub-processors:</strong> We use specialized vendors to deliver the best AI receptionist experience - voice infrastructure, transcription, database storage, and analytics. We carefully vet each vendor for GDPR compliance, security certifications, and data protection practices.
                        </p>
                    </motion.div>

                    {/* Change Notification Policy */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        className="bg-amber-50 border border-amber-200 rounded-xl p-8"
                    >
                        <div className="flex gap-4">
                            <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-lg font-semibold text-amber-900 mb-3">
                                    30-Day Notice for Changes
                                </h3>
                                <p className="text-amber-800 mb-4">
                                    <strong>GDPR Article 28(2) & 28(4) Requirement:</strong> We provide you with at least 30 days' advance notice before:
                                </p>
                                <ul className="space-y-2 text-amber-800 ml-4">
                                    <li>✓ Adding a new sub-processor</li>
                                    <li>✓ Replacing an existing sub-processor</li>
                                    <li>✓ Changing sub-processor location or function</li>
                                </ul>
                                <p className="text-amber-800 mt-4 font-semibold">
                                    You have the right to object or terminate your agreement if you disagree with sub-processor changes.
                                </p>
                                <p className="text-sm text-amber-700 mt-3">
                                    Notifications are sent via email to the primary account contact. To update your contact preferences, email support@voxanne.ai.
                                </p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Sub-Processor Detailed List */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-8">
                            Complete Sub-Processor List
                        </h2>

                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            className="space-y-6"
                        >
                            {subProcessors.map((processor, index) => (
                                <motion.div
                                    key={processor.name}
                                    variants={itemVariants}
                                    className="border border-slate-200 rounded-xl p-8 hover:shadow-lg transition-shadow"
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-6">
                                        <div>
                                            <h3 className="text-2xl font-bold text-deep-obsidian mb-2">
                                                {index + 1}. {processor.name}
                                            </h3>
                                            <p className="text-surgical-600 font-semibold">
                                                {processor.service}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Grid Layout */}
                                    <div className="grid md:grid-cols-2 gap-8">
                                        {/* Left Column */}
                                        <div className="space-y-6">
                                            {/* Data Processed */}
                                            <div>
                                                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                                    Data Processed
                                                </p>
                                                <p className="text-slate-700">
                                                    {processor.dataProcessed}
                                                </p>
                                            </div>

                                            {/* Location */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Globe className="w-4 h-4 text-surgical-600" />
                                                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                                                        Location
                                                    </p>
                                                </div>
                                                <p className="text-slate-700">
                                                    {processor.location}
                                                </p>
                                            </div>

                                            {/* Purpose */}
                                            <div>
                                                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                                    Purpose
                                                </p>
                                                <p className="text-slate-700">
                                                    {processor.purpose}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Right Column */}
                                        <div className="space-y-6">
                                            {/* Compliance */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                                                        Certifications
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {processor.compliance.map((cert) => (
                                                        <span
                                                            key={cert}
                                                            className="bg-green-50 border border-green-200 text-green-700 px-3 py-1 rounded-full text-xs font-semibold"
                                                        >
                                                            {cert}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Retention */}
                                            <div>
                                                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                                    Data Retention
                                                </p>
                                                <p className="text-slate-700">
                                                    {processor.retention}
                                                </p>
                                            </div>

                                            {/* Data Transfers */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Lock className="w-4 h-4 text-surgical-600" />
                                                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                                                        Data Transfer Safeguards
                                                    </p>
                                                </div>
                                                <p className="text-slate-700">
                                                    {processor.dataTransfers}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    </motion.div>

                    {/* Data Residency Options */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        className="bg-clinical-blue/5 border-2 border-clinical-blue rounded-xl p-8"
                    >
                        <div className="flex gap-4 mb-6">
                            <Database className="w-6 h-6 text-clinical-blue flex-shrink-0 mt-1" />
                            <div className="flex-1">
                                <h3 className="text-xl font-bold text-deep-obsidian mb-4">
                                    Data Residency Options
                                </h3>
                                <p className="text-slate-700 mb-4">
                                    If your organization requires data to remain in specific geographic regions (e.g., EU-only), we offer the following options:
                                </p>
                                <div className="space-y-3 ml-4">
                                    <p className="text-slate-700">
                                        <strong>✓ EU-Region Database:</strong> Supabase EU (Ireland) instead of US
                                    </p>
                                    <p className="text-slate-700">
                                        <strong>✓ EU-Region AI Infrastructure:</strong> Google Cloud EU (Frankfurt) for knowledge base processing
                                    </p>
                                    <p className="text-slate-700">
                                        <strong>✓ EU-Region Backups:</strong> Database backups retained in EU region
                                    </p>
                                    <p className="text-slate-700 mt-4 font-semibold">
                                        <strong>Note:</strong> Some sub-processors (Vapi, Twilio, OpenAI) operate globally and cannot be restricted to EU region. Contact sales@voxanne.ai to discuss EU-only data residency requirements.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* International Data Transfers */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-6">
                            International Data Transfers
                        </h2>
                        <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-4">
                            <p className="text-slate-700 leading-relaxed">
                                Many of our sub-processors are located in the United States, which is not an "adequate" jurisdiction under GDPR (as of 2024). Data transfers are protected by:
                            </p>
                            <div className="space-y-3 ml-4">
                                <p className="text-slate-700">
                                    <strong>1. Standard Contractual Clauses (SCCs):</strong> EU/UK GDPR-approved transfer mechanism between Voxanne AI and all US-based sub-processors
                                </p>
                                <p className="text-slate-700">
                                    <strong>2. UK International Data Transfer Agreement (IDTA):</strong> For UK-specific GDPR compliance
                                </p>
                                <p className="text-slate-700">
                                    <strong>3. Encryption in Transit:</strong> All data encrypted with TLS 1.3 during transmission
                                </p>
                                <p className="text-slate-700">
                                    <strong>4. Encryption at Rest:</strong> AES-256 encryption for stored data at sub-processors
                                </p>
                                <p className="text-slate-700">
                                    <strong>5. Access Controls:</strong> Sub-processors implement role-based access control (RBAC) limiting who can access your data
                                </p>
                            </div>
                            <p className="text-slate-700 mt-6 italic">
                                All sub-processor agreements include Data Processing Agreements (DPAs) with GDPR-compliant terms. Copies available upon request.
                            </p>
                        </div>
                    </motion.div>

                    {/* Security Measures */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-6">
                            Security & Compliance Standards
                        </h2>
                        <div className="grid md:grid-cols-3 gap-6">
                            {[
                                {
                                    title: "SOC 2 Type II",
                                    description: "Most sub-processors hold SOC 2 Type II certification for security, availability, and confidentiality",
                                },
                                {
                                    title: "HIPAA BAA",
                                    description: "Sub-processors handling health data have signed HIPAA Business Associate Agreements",
                                },
                                {
                                    title: "GDPR DPA",
                                    description: "All sub-processors have signed Data Processing Agreements compliant with GDPR Article 28",
                                },
                            ].map((standard, index) => (
                                <div
                                    key={index}
                                    className="border border-slate-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
                                >
                                    <h3 className="text-lg font-semibold text-deep-obsidian mb-3">
                                        {standard.title}
                                    </h3>
                                    <p className="text-slate-600 text-sm">
                                        {standard.description}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Version History */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        className="bg-slate-50 rounded-xl p-8 border border-slate-200"
                    >
                        <h2 className="text-2xl font-bold text-deep-obsidian mb-6">
                            Version History
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <p className="font-semibold text-deep-obsidian">
                                    Version 1.0 - January 30, 2026
                                </p>
                                <p className="text-slate-600 text-sm">
                                    Initial sub-processor disclosure. 9 sub-processors listed with GDPR Article 28 compliance details.
                                </p>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-6">
                            This page is updated whenever sub-processors change. Subscribe to security updates by contacting support@voxanne.ai.
                        </p>
                    </motion.div>

                    {/* Questions Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        className="bg-deep-obsidian text-white rounded-xl p-8 text-center"
                    >
                        <h2 className="text-2xl font-bold mb-4">
                            Questions About Our Sub-Processors?
                        </h2>
                        <p className="text-white/80 mb-6 max-w-xl mx-auto">
                            Our compliance team is available to discuss data protection, security certifications, and sub-processor agreements.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <a
                                href="mailto:support@voxanne.ai"
                                className="bg-surgical-600 hover:bg-surgical-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
                            >
                                Contact Support
                            </a>
                            <Link
                                href="/dpa"
                                className="border border-white text-white hover:bg-white/10 px-8 py-3 rounded-lg font-semibold transition-colors"
                            >
                                View DPA Template
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>
        </main>
    );
}
