"use client";

import Link from "next/link";
import { FileDown, CheckCircle2, Shield, Users, Clock } from "lucide-react";
import { motion } from "framer-motion";

export default function DPAPage() {
    const currentYear = new Date().getFullYear();

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
                            Data Processing Agreement
                        </h1>
                        <p className="text-xl text-slate-600 mb-4">
                            GDPR Article 28 Compliance for EU and UK Customers
                        </p>
                        <p className="text-sm text-slate-500">
                            Last Updated: January 30, 2026
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Main Content */}
            <section className="py-16 px-4 md:px-6">
                <div className="max-w-4xl mx-auto space-y-12">
                    {/* What is a DPA Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        className="prose prose-lg max-w-none"
                    >
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-6">
                            What is a Data Processing Agreement?
                        </h2>
                        <p className="text-slate-700 leading-relaxed mb-4">
                            Under the UK GDPR and EU GDPR (Article 28), organizations that process personal data on behalf of customers (Data Controllers) must have a written Data Processing Agreement (DPA) with their service providers (Data Processors).
                        </p>
                        <p className="text-slate-700 leading-relaxed mb-4">
                            <strong>Voxanne AI acts as a Data Processor</strong> when your organization uses our AI receptionist services. We process personal data (customer names, phone numbers, appointment details, health information, etc.) according to your instructions.
                        </p>
                        <p className="text-slate-700 leading-relaxed">
                            <strong>When do you need a DPA with us?</strong> If you are a Data Controller (clinic, med spa, healthcare provider, or any organization) and use Voxanne AI to process personal data of your patients, customers, or staff, you require a signed DPA.
                        </p>
                    </motion.div>

                    {/* DPA Template Box */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        className="bg-clinical-blue/5 border-2 border-clinical-blue rounded-xl p-8 md:p-12"
                    >
                        <h2 className="text-2xl font-bold text-deep-obsidian mb-8">
                            Standard Data Processing Agreement
                        </h2>

                        <div className="space-y-8 text-slate-700">
                            {/* Parties Section */}
                            <div>
                                <h3 className="text-lg font-semibold text-deep-obsidian mb-4">
                                    1. Parties to This Agreement
                                </h3>
                                <div className="bg-white p-6 rounded-lg space-y-3 text-sm">
                                    <div>
                                        <p className="font-semibold text-deep-obsidian">Data Controller:</p>
                                        <p className="text-slate-600 ml-4">[Customer Organization Name]</p>
                                    </div>
                                    <div className="border-t pt-3">
                                        <p className="font-semibold text-deep-obsidian">Data Processor:</p>
                                        <p className="text-slate-600 ml-4">
                                            Voxanne AI, a product of Call Waiting AI Ltd
                                        </p>
                                    </div>
                                    <div className="border-t pt-3">
                                        <p className="font-semibold text-deep-obsidian">Registered Address:</p>
                                        <div className="text-slate-600 ml-4">
                                            <p>Collage House, 2nd Floor</p>
                                            <p>17 King Edward Road</p>
                                            <p>Ruislip, London HA4 7AE</p>
                                            <p>United Kingdom</p>
                                        </div>
                                    </div>
                                    <div className="border-t pt-3">
                                        <p className="font-semibold text-deep-obsidian">ICO Registration:</p>
                                        <p className="text-slate-600 ml-4">[ICO Number]</p>
                                    </div>
                                    <div className="border-t pt-3">
                                        <p className="font-semibold text-deep-obsidian">Company Number:</p>
                                        <p className="text-slate-600 ml-4">16917594</p>
                                    </div>
                                </div>
                            </div>

                            {/* Scope Section */}
                            <div>
                                <h3 className="text-lg font-semibold text-deep-obsidian mb-4">
                                    2. Scope of Processing
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <p className="font-semibold mb-2">Data Categories:</p>
                                        <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 ml-2">
                                            <li>Contact information (names, phone numbers, email addresses)</li>
                                            <li>Voice recordings (call audio from inbound/outbound calls)</li>
                                            <li>Call transcripts (AI-generated transcriptions of calls)</li>
                                            <li>Appointment data (dates, times, service types)</li>
                                            <li>Health data (medical history, diagnoses, treatment notes - if applicable)</li>
                                            <li>Communication records (SMS messages, call notes)</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="font-semibold mb-2">Purpose:</p>
                                        <p className="text-sm text-slate-600">
                                            Provide AI receptionist services including call handling, appointment scheduling, SMS notifications, and outbound calling on your behalf.
                                        </p>
                                    </div>
                                    <div>
                                        <p className="font-semibold mb-2">Duration:</p>
                                        <p className="text-sm text-slate-600">
                                            For the duration of your service agreement with Voxanne AI, plus 30 days post-termination for data return/deletion.
                                        </p>
                                    </div>
                                    <div>
                                        <p className="font-semibold mb-2">Data Subjects:</p>
                                        <p className="text-sm text-slate-600">
                                            Your patients, customers, clinic staff, appointment callers, and other individuals whose data you direct us to process.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Processing Instructions */}
                            <div>
                                <h3 className="text-lg font-semibold text-deep-obsidian mb-4">
                                    3. Processing Instructions
                                </h3>
                                <p className="text-sm text-slate-600 mb-4">
                                    Voxanne AI processes personal data only according to your documented instructions:
                                </p>
                                <ul className="space-y-2 text-sm text-slate-600 ml-4">
                                    <li>✓ Inbound call handling and transcription</li>
                                    <li>✓ AI-generated responses based on your knowledge base</li>
                                    <li>✓ Appointment booking and calendar integration</li>
                                    <li>✓ SMS sending (confirmations, reminders, follow-ups)</li>
                                    <li>✓ Knowledge base retrieval and RAG pipeline</li>
                                    <li>✓ Call log storage and analytics</li>
                                    <li>✓ Lead scoring and contact management</li>
                                </ul>
                                <p className="text-sm text-slate-600 mt-4 italic">
                                    We do not use personal data for our own purposes except where necessary for service provision, security, and legal compliance.
                                </p>
                            </div>

                            {/* Sub-Processors */}
                            <div>
                                <h3 className="text-lg font-semibold text-deep-obsidian mb-4">
                                    4. Sub-Processors
                                </h3>
                                <p className="text-sm text-slate-600 mb-4">
                                    We use the following sub-processors to deliver our services. A full list with data protection details is available at{" "}
                                    <Link href="/sub-processors" className="text-surgical-600 hover:text-surgical-700 font-semibold">
                                        /sub-processors
                                    </Link>
                                    .
                                </p>
                                <div className="text-sm text-slate-600 space-y-2 ml-4">
                                    <p>• <strong>Supabase</strong> - Database and authentication (SOC 2, HIPAA BAA)</p>
                                    <p>• <strong>Vapi</strong> - Voice AI infrastructure (HIPAA-eligible)</p>
                                    <p>• <strong>Twilio</strong> - Telephony and SMS (HIPAA BAA, SOC 2)</p>
                                    <p>• <strong>Google Cloud</strong> - AI/ML infrastructure (HIPAA BAA)</p>
                                    <p>• <strong>OpenAI</strong> - LLM processing (Enterprise DPA)</p>
                                    <p>• Additional providers listed at <Link href="/sub-processors" className="text-surgical-600 hover:text-surgical-700">/sub-processors</Link></p>
                                </div>
                                <p className="text-sm text-slate-600 mt-4 font-semibold">
                                    30-Day Notice: We provide 30 days' notice before adding or replacing sub-processors. You may object and terminate your agreement if you disagree.
                                </p>
                            </div>

                            {/* Security Measures */}
                            <div>
                                <h3 className="text-lg font-semibold text-deep-obsidian mb-4">
                                    5. Security Measures
                                </h3>
                                <div className="space-y-3 text-sm text-slate-600">
                                    <p><strong>Encryption:</strong> AES-256 at rest, TLS 1.3 in transit, SRTP for voice calls</p>
                                    <p><strong>Access Control:</strong> Role-Based Access Control (RBAC), MFA for all staff, comprehensive audit logging</p>
                                    <p><strong>Infrastructure:</strong> SOC 2 Type II certified (in progress), HIPAA-compliant hosting, daily automated backups with 30-day retention and Point-in-Time Recovery (PITR)</p>
                                    <p><strong>Data Isolation:</strong> Strong multi-tenant isolation via RLS (Row-Level Security) at the database level</p>
                                    <p><strong>Monitoring:</strong> Sentry error tracking, real-time security alerts, automated vulnerability scanning</p>
                                </div>
                            </div>

                            {/* Data Subject Rights */}
                            <div>
                                <h3 className="text-lg font-semibold text-deep-obsidian mb-4">
                                    6. Data Subject Rights Support
                                </h3>
                                <div className="space-y-3 text-sm text-slate-600">
                                    <p><strong>Article 15 (Right to Access):</strong> Data export API available. Response within 30 days.</p>
                                    <p><strong>Article 16 (Right to Rectification):</strong> Update via customer dashboard or API.</p>
                                    <p><strong>Article 17 (Right to Erasure):</strong> Initiate 30-day deletion process via dashboard. Permanent deletion after grace period.</p>
                                    <p><strong>Article 20 (Right to Portability):</strong> JSON export format for machine-readable data portability.</p>
                                    <p><strong>Article 21 (Right to Object):</strong> Contact privacy@voxanne.ai with objection details.</p>
                                </div>
                            </div>

                            {/* Breach Notification */}
                            <div>
                                <h3 className="text-lg font-semibold text-deep-obsidian mb-4">
                                    7. Breach Notification
                                </h3>
                                <p className="text-sm text-slate-600 mb-3">
                                    In the event of a personal data breach affecting your data:
                                </p>
                                <ul className="space-y-2 text-sm text-slate-600 ml-4">
                                    <li>✓ <strong>Within 24 hours:</strong> We notify you of the breach</li>
                                    <li>✓ <strong>Details provided:</strong> Nature of breach, affected data, mitigation steps</li>
                                    <li>✓ <strong>Your responsibility:</strong> You notify data subjects and authorities as required by GDPR</li>
                                    <li>✓ <strong>Root cause analysis:</strong> Full investigation and remediation plan provided</li>
                                </ul>
                            </div>

                            {/* International Transfers */}
                            <div>
                                <h3 className="text-lg font-semibold text-deep-obsidian mb-4">
                                    8. International Data Transfers
                                </h3>
                                <p className="text-sm text-slate-600 mb-3">
                                    Some sub-processors are located in the United States (Vapi, Twilio, OpenAI, Supabase US region). Transfers are protected by:
                                </p>
                                <ul className="space-y-2 text-sm text-slate-600 ml-4">
                                    <li>✓ <strong>Standard Contractual Clauses (SCCs)</strong> for EU/UK customers</li>
                                    <li>✓ <strong>UK IDTA</strong> (International Data Transfer Agreement) for UK-specific transfers</li>
                                    <li>✓ <strong>Encryption in transit</strong> provides additional protection (TLS 1.3)</li>
                                    <li>✓ <strong>EU-only option:</strong> Contact sales@voxanne.ai to discuss EU-region-only data residency</li>
                                </ul>
                            </div>

                            {/* Audit Rights */}
                            <div>
                                <h3 className="text-lg font-semibold text-deep-obsidian mb-4">
                                    9. Audit Rights
                                </h3>
                                <div className="space-y-3 text-sm text-slate-600">
                                    <p><strong>SOC 2 Type II Reports:</strong> Available upon request (annual independent audit)</p>
                                    <p><strong>Customer Audit Rights:</strong> You may request security audits with 14 days' notice at reasonable frequency (typically no more than annually)</p>
                                    <p><strong>Regulatory Audits:</strong> We cooperate fully with ICO and other regulatory authority audits</p>
                                </div>
                            </div>

                            {/* Termination & Data Return */}
                            <div>
                                <h3 className="text-lg font-semibold text-deep-obsidian mb-4">
                                    10. Termination & Data Return
                                </h3>
                                <div className="space-y-3 text-sm text-slate-600">
                                    <p><strong>30-Day Grace Period:</strong> Upon termination, you have 30 days to export or request deletion of your data</p>
                                    <p><strong>Export Format:</strong> JSON format via secure API endpoint</p>
                                    <p><strong>Secure Deletion:</strong> After 30 days, all data is securely deleted with cryptographic certification</p>
                                    <p><strong>Backup Deletion:</strong> Backup copies deleted within 7 days of primary deletion</p>
                                </div>
                            </div>

                            {/* How to Execute */}
                            <div className="bg-surgical-blue/5 border border-surgical-blue rounded-lg p-6">
                                <h3 className="text-lg font-semibold text-deep-obsidian mb-4">
                                    How to Execute This DPA
                                </h3>
                                <div className="space-y-3 text-sm text-slate-700">
                                    <p>
                                        <strong>Option 1: Electronic Signature (Fastest)</strong>
                                    </p>
                                    <ol className="list-decimal list-inside space-y-1 ml-2">
                                        <li>Copy this DPA template</li>
                                        <li>Sign electronically via DocuSign or Acrobat Sign</li>
                                        <li>Email signed copy to support@voxanne.ai</li>
                                        <li>Receive counter-signed copy within 5 business days</li>
                                    </ol>
                                    <p className="mt-4">
                                        <strong>Option 2: Manual Signature</strong>
                                    </p>
                                    <ol className="list-decimal list-inside space-y-1 ml-2">
                                        <li>Download and print this DPA</li>
                                        <li>Sign and date both copies</li>
                                        <li>Mail to: Collage House, 2nd Floor, 17 King Edward Road, Ruislip, London HA4 7AE</li>
                                        <li>We will counter-sign and return</li>
                                    </ol>
                                    <p className="mt-4 font-semibold">
                                        Questions? Contact: support@voxanne.ai
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Key Features Cards */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        className="grid md:grid-cols-2 gap-6"
                    >
                        {[
                            {
                                icon: CheckCircle2,
                                title: "GDPR Article 28 Compliant",
                                description: "Full compliance with GDPR data processor requirements for EU and UK customers",
                            },
                            {
                                icon: Shield,
                                title: "Enterprise Security",
                                description: "SOC 2 Type II certified, HIPAA-compliant hosting, AES-256 encryption, daily backups",
                            },
                            {
                                icon: Users,
                                title: "Data Subject Rights",
                                description: "Full support for GDPR rights: access, rectification, erasure, portability, and objection",
                            },
                            {
                                icon: Clock,
                                title: "24-Hour Breach Response",
                                description: "Immediate notification of any security incidents affecting your data",
                            },
                        ].map((feature, index) => (
                            <div
                                key={index}
                                className="border border-slate-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
                            >
                                <feature.icon className="w-8 h-8 text-surgical-600 mb-4" />
                                <h3 className="text-lg font-semibold text-deep-obsidian mb-2">
                                    {feature.title}
                                </h3>
                                <p className="text-slate-600 text-sm">
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </motion.div>

                    {/* Download Button */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        className="text-center py-8"
                    >
                        <button className="inline-flex items-center gap-2 bg-surgical-600 hover:bg-surgical-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
                            <FileDown className="w-5 h-5" />
                            Download DPA as PDF
                        </button>
                    </motion.div>
                </div>
            </section>

            {/* Footer CTA */}
            <section className="bg-deep-obsidian text-white py-16 px-4 md:px-6">
                <div className="max-w-2xl mx-auto text-center">
                    <h2 className="text-3xl font-bold mb-4">
                        Ready to Get Started?
                    </h2>
                    <p className="text-lg text-white/80 mb-8">
                        Our DPA is ready to execute. If you have questions or need customization, our legal team is here to help.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <a
                            href="mailto:support@voxanne.ai"
                            className="bg-surgical-600 hover:bg-surgical-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
                        >
                            Contact Support Team
                        </a>
                        <Link
                            href="/sub-processors"
                            className="border border-white text-white hover:bg-white/10 px-8 py-3 rounded-lg font-semibold transition-colors"
                        >
                            View Sub-Processors
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    );
}
