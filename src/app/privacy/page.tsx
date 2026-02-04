import React from 'react';
import NavbarRedesigned from '@/components/NavbarRedesigned';
import FooterRedesigned from '@/components/FooterRedesigned';

export const metadata = {
    title: 'Privacy Policy | Voxanne AI',
    description: 'Privacy Policy for Voxanne AI. Learn how we handle your data, voice recordings, and compliance with HIPAA, GDPR, and CCPA.',
};

export default function PrivacyPage() {
    return (
        <>
            <NavbarRedesigned />
            <div className="min-h-screen bg-slate-50 py-20 px-6">
                <div className="max-w-4xl mx-auto bg-white p-12 rounded-2xl shadow-sm border border-slate-200">
                    <h1 className="text-4xl font-bold text-deep-obsidian mb-8">Privacy Policy</h1>
                    <p className="text-slate-500 mb-8">Last Updated: January 30, 2026</p>

                    <div className="prose prose-slate max-w-none">
                        {/* Table of Contents */}
                        <div className="bg-clinical-blue/5 border-l-4 border-clinical-blue p-6 rounded-r-lg mb-12">
                            <h3 className="text-lg font-semibold text-deep-obsidian mb-4">Table of Contents</h3>
                            <ol className="space-y-2 text-sm">
                                <li><a href="#introduction" className="text-clinical-blue hover:text-surgical-blue">1. Introduction</a></li>
                                <li><a href="#uk-gdpr" className="text-clinical-blue hover:text-surgical-blue">2. UK GDPR Compliance (Primary Framework)</a></li>
                                <li><a href="#information-collected" className="text-clinical-blue hover:text-surgical-blue">3. Information We Collect</a></li>
                                <li><a href="#how-we-use" className="text-clinical-blue hover:text-surgical-blue">4. How We Use Your Information</a></li>
                                <li><a href="#ai-technology" className="text-clinical-blue hover:text-surgical-blue">5. Artificial Intelligence & Voice Data</a></li>
                                <li><a href="#data-sharing" className="text-clinical-blue hover:text-surgical-blue">6. Data Sharing & Disclosure</a></li>
                                <li><a href="#data-security" className="text-clinical-blue hover:text-surgical-blue">7. Data Security</a></li>
                                <li><a href="#healthcare" className="text-clinical-blue hover:text-surgical-blue">8. Healthcare Compliance (HIPAA)</a></li>
                                <li><a href="#data-retention" className="text-clinical-blue hover:text-surgical-blue">9. Data Retention</a></li>
                                <li><a href="#your-rights" className="text-clinical-blue hover:text-surgical-blue">10. Your Rights</a></li>
                                <li><a href="#eu-gdpr" className="text-clinical-blue hover:text-surgical-blue">11. EU GDPR for EEA/EU Users</a></li>
                                <li><a href="#ccpa" className="text-clinical-blue hover:text-surgical-blue">12. CCPA (California Users)</a></li>
                                <li><a href="#cookies" className="text-clinical-blue hover:text-surgical-blue">13. Cookies & Tracking</a></li>
                                <li><a href="#children" className="text-clinical-blue hover:text-surgical-blue">14. Children&apos;s Privacy</a></li>
                                <li><a href="#international" className="text-clinical-blue hover:text-surgical-blue">15. International Data Transfers</a></li>
                                <li><a href="#changes" className="text-clinical-blue hover:text-surgical-blue">16. Changes to This Policy</a></li>
                                <li><a href="#contact" className="text-clinical-blue hover:text-surgical-blue">17. Contact Information</a></li>
                            </ol>
                        </div>

                        {/* 1. Introduction */}
                        <section id="introduction" className="mb-12">
                            <h2 className="text-3xl font-bold text-deep-obsidian mb-6">1. Introduction</h2>
                            <p className="mb-4">
                                Welcome to Voxanne AI, a product of Call Waiting AI Ltd. (&quot;Voxanne AI,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).
                                We are committed to protecting your privacy and ensuring the security of your personal data.
                            </p>
                            <p className="mb-4">
                                This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you
                                use our AI-powered voice receptionist platform, website, dashboard, and related applications
                                (collectively, the &quot;Service&quot;).
                            </p>
                            <p className="mb-4">
                                <strong>By accessing or using the Service, you acknowledge that you have read, understood, and agree
                                to the practices described in this Privacy Policy.</strong> If you do not agree with this Privacy Policy,
                                you must not access or use the Service.
                            </p>
                            <div className="bg-blue-50 border-l-4 border-clinical-blue p-4 my-6">
                                <p className="text-sm text-blue-800">
                                    <strong>Healthcare Organizations:</strong> If you are a healthcare provider using Voxanne AI
                                    to handle patient communications, please also review Section 8 (Healthcare Compliance) and our{' '}
                                    <a href="/hipaa-compliance" className="text-clinical-blue hover:text-surgical-blue underline">
                                        Healthcare Compliance Page
                                    </a>.
                                </p>
                            </div>
                        </section>

                        {/* 2. UK GDPR Compliance */}
                        <section id="uk-gdpr" className="mb-12">
                            <h2 className="text-3xl font-bold text-deep-obsidian mb-6">2. UK GDPR Compliance (Primary Framework)</h2>
                            <p className="mb-4">
                                <strong>Voxanne AI is a UK-based company operating under UK GDPR as our primary compliance framework.</strong> We are committed to protecting the rights of individuals in the UK and EU in accordance with the UK General Data Protection Regulation (UK GDPR).
                            </p>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">2.1 Data Controller Information</h3>
                            <div className="bg-clinical-blue/5 border-l-4 border-clinical-blue p-6 rounded-r-lg mb-6">
                                <p className="font-semibold text-deep-obsidian mb-3">Call Waiting AI Ltd</p>
                                <p className="text-slate-700 mb-3">Collage House, 2nd Floor</p>
                                <p className="text-slate-700 mb-3">17 King Edward Road</p>
                                <p className="text-slate-700 mb-3">Ruislip, London HA4 7AE</p>
                                <p className="text-slate-700 mb-3">United Kingdom</p>
                                <p className="text-slate-700 mb-1"><strong>Company Number:</strong> 16917594</p>
                                <p className="text-slate-700"><strong>ICO Registration:</strong> [ICO Number]</p>
                            </div>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">2.2 Legal Bases for Processing (UK GDPR Article 6)</h3>
                            <p className="mb-4">We process personal data under the following legal bases:</p>
                            <ul className="list-disc ml-6 mb-6 space-y-3">
                                <li><strong>Contract Performance (Article 6(1)(b)):</strong> Processing necessary to provide AI receptionist services (call handling, appointment booking, SMS sending)</li>
                                <li><strong>Legitimate Interests (Article 6(1)(f)):</strong> Security, fraud prevention, service improvements, analytics, and business operations</li>
                                <li><strong>Consent (Article 6(1)(a)):</strong> Marketing communications, non-essential cookies, and optional features (with easy opt-out)</li>
                                <li><strong>Legal Obligation (Article 6(1)(c)):</strong> Tax compliance, financial record-keeping, and regulatory obligations</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">2.3 Special Category Data (Health Data - Article 9)</h3>
                            <p className="mb-4">
                                If you process health-related information through our service (e.g., appointment bookings at medical clinics, diagnoses in call transcripts), this constitutes <strong>Special Category Data</strong> under UK GDPR Article 9, which requires additional protection.
                            </p>
                            <p className="mb-4"><strong>Legal bases for health data:</strong></p>
                            <ul className="list-disc ml-6 mb-6 space-y-2">
                                <li><strong>Explicit Consent (Article 9(2)(a)):</strong> Patients explicitly consent when calling or using services</li>
                                <li><strong>Healthcare Provider Operations (Article 9(2)(h)):</strong> Processing necessary for healthcare provision</li>
                                <li><strong>Public Health Interest (Article 9(2)(i)):</strong> Appointment scheduling for public health purposes</li>
                            </ul>
                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-6">
                                <p className="text-sm text-yellow-800">
                                    <strong>Important:</strong> If you are a healthcare organization, please ensure you have appropriate consents from patients before processing their health data through Voxanne AI. Review our <a href="/hipaa-compliance" className="text-clinical-blue hover:text-surgical-blue underline">Healthcare Compliance Page</a> for healthcare-specific requirements.
                                </p>
                            </div>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">2.4 UK GDPR vs EU GDPR (Post-Brexit)</h3>
                            <p className="mb-4">Following Brexit, the UK maintains its own GDPR framework (UK GDPR) that is substantially similar to EU GDPR with minor differences:</p>
                            <ul className="list-disc ml-6 mb-6 space-y-2">
                                <li><strong>Supervisory Authority:</strong> Information Commissioner&apos;s Office (ICO) for UK customers</li>
                                <li><strong>Data Transfer Mechanism:</strong> UK IDTA instead of SCCs for UK-to-third-country transfers</li>
                                <li><strong>Adequacy Status:</strong> UK is recognized as adequate by the EU; EU is recognized as adequate by the UK</li>
                                <li><strong>Regulatory Cooperation:</strong> ICO cooperates with EU supervisory authorities on cross-border matters</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">2.5 Your Rights Under UK GDPR</h3>
                            <p className="mb-4">You have the following rights, which we support through our APIs and dashboard:</p>
                            <div className="overflow-x-auto mb-6">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100">
                                            <th className="border border-slate-300 px-4 py-2 text-left font-semibold">Right</th>
                                            <th className="border border-slate-300 px-4 py-2 text-left font-semibold">Description</th>
                                            <th className="border border-slate-300 px-4 py-2 text-left font-semibold">How to Exercise</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="border border-slate-300 px-4 py-2 font-semibold">Right to Access (Article 15)</td>
                                            <td className="border border-slate-300 px-4 py-2">Request copy of your personal data</td>
                                            <td className="border border-slate-300 px-4 py-2">Email privacy@voxanne.ai or use data export API</td>
                                        </tr>
                                        <tr className="bg-slate-50">
                                            <td className="border border-slate-300 px-4 py-2 font-semibold">Right to Rectification (Article 16)</td>
                                            <td className="border border-slate-300 px-4 py-2">Correct inaccurate personal data</td>
                                            <td className="border border-slate-300 px-4 py-2">Update via dashboard or email privacy@voxanne.ai</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-slate-300 px-4 py-2 font-semibold">Right to Erasure (Article 17)</td>
                                            <td className="border border-slate-300 px-4 py-2">Request deletion of personal data</td>
                                            <td className="border border-slate-300 px-4 py-2">Use data deletion API or email privacy@voxanne.ai (30-day process)</td>
                                        </tr>
                                        <tr className="bg-slate-50">
                                            <td className="border border-slate-300 px-4 py-2 font-semibold">Right to Portability (Article 20)</td>
                                            <td className="border border-slate-300 px-4 py-2">Receive data in machine-readable format</td>
                                            <td className="border border-slate-300 px-4 py-2">Use data export API (JSON format)</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-slate-300 px-4 py-2 font-semibold">Right to Object (Article 21)</td>
                                            <td className="border border-slate-300 px-4 py-2">Object to processing based on legitimate interests</td>
                                            <td className="border border-slate-300 px-4 py-2">Email privacy@voxanne.ai with objection details</td>
                                        </tr>
                                        <tr className="bg-slate-50">
                                            <td className="border border-slate-300 px-4 py-2 font-semibold">Right to Restrict (Article 18)</td>
                                            <td className="border border-slate-300 px-4 py-2">Limit how we process your data</td>
                                            <td className="border border-slate-300 px-4 py-2">Email privacy@voxanne.ai with restriction request</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <p className="mb-4"><strong>Response time:</strong> We will respond to all rights requests within 30 days (extendable to 60 days for complex requests). <strong>Fee:</strong> Free of charge (unless requests are manifestly unfounded or excessive).</p>
                            <p className="mb-4"><strong>Complaints:</strong> If you believe we have violated your UK GDPR rights, you have the right to lodge a complaint with the Information Commissioner&apos;s Office (ICO) at <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-clinical-blue hover:text-surgical-blue underline">ico.org.uk</a>.</p>
                        </section>

                        {/* 3. Information We Collect */}
                        <section id="information-collected" className="mb-12">
                            <h2 className="text-3xl font-bold text-deep-obsidian mb-6">3. Information We Collect</h2>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4">2.1 Account Information</h3>
                            <p className="mb-4">When you register for the Service, we collect:</p>
                            <ul className="list-disc ml-6 mb-6 space-y-2">
                                <li>Name, email address, and business details</li>
                                <li>Organization name, type, and size</li>
                                <li>Billing information (processed securely by Stripe; we do not store full card numbers)</li>
                                <li>Account credentials (passwords are hashed and never stored in plaintext)</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">2.2 Voice & Communication Data</h3>
                            <p className="mb-4">To provide our AI receptionist service, we process:</p>
                            <ul className="list-disc ml-6 mb-6 space-y-2">
                                <li><strong>Call Recordings:</strong> Audio recordings of incoming and outgoing calls handled by the AI agent</li>
                                <li><strong>Transcripts:</strong> Text transcriptions of voice conversations</li>
                                <li><strong>Call Metadata:</strong> Phone numbers, timestamps, call duration, call direction (inbound/outbound)</li>
                                <li><strong>Appointment Data:</strong> Scheduling details, calendar events, and booking confirmations</li>
                                <li><strong>SMS Messages:</strong> Follow-up messages, appointment reminders, and notifications</li>
                            </ul>
                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-6">
                                <p className="text-sm text-yellow-800">
                                    <strong>Important:</strong> Call recordings may contain Protected Health Information (PHI)
                                    if you are a healthcare provider. We process PHI in accordance with HIPAA regulations
                                    and apply PHI redaction to stored transcripts where applicable.
                                </p>
                            </div>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">2.3 Configuration Data</h3>
                            <p className="mb-4">To customize your AI agent, we store:</p>
                            <ul className="list-disc ml-6 mb-6 space-y-2">
                                <li>Agent configuration (system prompts, voice selection, language preferences)</li>
                                <li>Knowledge base documents (uploaded PDFs, FAQs, service lists, pricing)</li>
                                <li>Business hours, holiday schedules, and availability settings</li>
                                <li>Integration credentials (Google Calendar, Twilio; encrypted at rest)</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">2.4 Automatically Collected Data</h3>
                            <p className="mb-4">When you use our website or dashboard, we automatically collect:</p>
                            <ul className="list-disc ml-6 mb-6 space-y-2">
                                <li>IP address and approximate geographic location</li>
                                <li>Browser type, operating system, and device information</li>
                                <li>Pages visited, time spent, and interaction patterns</li>
                                <li>Referral source and search terms</li>
                            </ul>
                        </section>

                        {/* 3. How We Use Your Information */}
                        <section id="how-we-use" className="mb-12">
                            <h2 className="text-3xl font-bold text-deep-obsidian mb-6">3. How We Use Your Information</h2>
                            <p className="mb-4">We use the information we collect for the following purposes:</p>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4">3.1 Service Delivery</h3>
                            <ul className="list-disc ml-6 mb-6 space-y-2">
                                <li>Operating and maintaining the AI voice receptionist</li>
                                <li>Processing and transcribing phone calls</li>
                                <li>Scheduling appointments and managing calendars</li>
                                <li>Sending SMS notifications and appointment reminders</li>
                                <li>Generating call analytics and dashboard reports</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">3.2 Service Improvement</h3>
                            <ul className="list-disc ml-6 mb-6 space-y-2">
                                <li>Analyzing usage patterns to improve AI accuracy and response quality</li>
                                <li>Identifying and fixing bugs, errors, and performance issues</li>
                                <li>Developing new features based on aggregated usage data</li>
                            </ul>
                            <div className="bg-green-50 border-l-4 border-green-400 p-4 my-6">
                                <p className="text-sm text-green-800">
                                    <strong>Your Data, Your Control:</strong> We will never use your Customer Data (including
                                    call recordings, transcripts, or patient data) to train generalized AI models without your
                                    explicit, written consent. Your data is only used to provide the Service to you.
                                </p>
                            </div>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">3.3 Communication</h3>
                            <ul className="list-disc ml-6 mb-6 space-y-2">
                                <li>Sending account-related notifications (billing, security alerts)</li>
                                <li>Providing customer support and responding to inquiries</li>
                                <li>Sharing product updates and service announcements (with opt-out)</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">3.4 Legal & Compliance</h3>
                            <ul className="list-disc ml-6 mb-6 space-y-2">
                                <li>Complying with applicable laws, regulations, and legal processes</li>
                                <li>Enforcing our Terms of Service</li>
                                <li>Protecting against fraud, abuse, and security threats</li>
                                <li>Maintaining audit trails for HIPAA compliance</li>
                            </ul>
                        </section>

                        {/* 4. AI Technology */}
                        <section id="ai-technology" className="mb-12">
                            <h2 className="text-3xl font-bold text-deep-obsidian mb-6">4. Artificial Intelligence & Voice Data</h2>
                            <p className="mb-4">
                                Our Service uses advanced AI technologies to operate. We believe in transparency about how
                                these technologies process your data.
                            </p>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4">4.1 Technologies Used</h3>
                            <ul className="list-disc ml-6 mb-6 space-y-2">
                                <li><strong>Speech-to-Text (Transcription):</strong> We use providers such as Deepgram to
                                    convert audio into text in real-time. Audio is processed in transit and not stored by
                                    transcription providers beyond the processing window.</li>
                                <li><strong>Large Language Models (LLMs):</strong> We use AI language models to understand
                                    caller intent, generate natural responses, and make decisions about appointment booking
                                    and information retrieval.</li>
                                <li><strong>Text-to-Speech (Voice Synthesis):</strong> We use providers such as ElevenLabs,
                                    OpenAI, and Azure to generate natural-sounding voice responses from over 100 available voices.</li>
                                <li><strong>Knowledge Retrieval (RAG):</strong> Your uploaded documents are converted into
                                    vector embeddings and stored securely to enable contextual answers.</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">4.2 AI Data Processing Safeguards</h3>
                            <ul className="list-disc ml-6 mb-6 space-y-2">
                                <li>Audio data is processed in real-time and not retained by AI providers beyond the call session</li>
                                <li>Transcripts are stored in our secure database with encryption at rest</li>
                                <li>PHI redaction is applied to stored transcripts (SSN, credit card numbers, medical diagnoses)</li>
                                <li>Your data is isolated per organization via Row Level Security (RLS)</li>
                                <li>We do not use your data to train third-party AI models</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">4.3 Provider Fallbacks</h3>
                            <p className="mb-4">
                                To ensure 99.9%+ availability, our system uses 3-tier fallback cascades for transcription
                                and voice services. This means your calls may be processed by backup providers if the primary
                                provider experiences an outage. All backup providers meet our security and data protection standards.
                            </p>
                        </section>

                        {/* 5. Data Sharing */}
                        <section id="data-sharing" className="mb-12">
                            <h2 className="text-3xl font-bold text-deep-obsidian mb-6">5. Data Sharing & Disclosure</h2>
                            <p className="mb-4">
                                <strong>We do not sell your personal data.</strong> We share data only in the following
                                circumstances:
                            </p>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4">5.1 Service Providers</h3>
                            <p className="mb-4">We share data with trusted third-party providers strictly to deliver the Service:</p>
                            <ul className="list-disc ml-6 mb-6 space-y-2">
                                <li><strong>Supabase:</strong> Cloud database hosting and authentication</li>
                                <li><strong>Vapi:</strong> Voice AI orchestration platform</li>
                                <li><strong>Twilio:</strong> Telephony and SMS services</li>
                                <li><strong>Deepgram:</strong> Speech-to-text transcription</li>
                                <li><strong>ElevenLabs / OpenAI / Azure:</strong> Voice synthesis</li>
                                <li><strong>Google Calendar:</strong> Appointment scheduling (when connected by you)</li>
                                <li><strong>Stripe:</strong> Payment processing</li>
                                <li><strong>Sentry:</strong> Error monitoring (PII redacted)</li>
                            </ul>
                            <p className="mb-4">
                                Each provider is contractually obligated to protect your data and use it only for the purposes
                                of providing their service to us.
                            </p>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">5.2 Legal Requirements</h3>
                            <p className="mb-4">We may disclose your data when required to:</p>
                            <ul className="list-disc ml-6 mb-6 space-y-2">
                                <li>Comply with applicable law, regulation, or legal process</li>
                                <li>Respond to lawful requests from public authorities</li>
                                <li>Protect the rights, property, or safety of Voxanne AI, our users, or the public</li>
                                <li>Enforce our Terms of Service</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">5.3 Business Transfers</h3>
                            <p className="mb-4">
                                In the event of a merger, acquisition, or sale of all or part of our assets, your data may
                                be transferred as part of that transaction. We will notify you via email and/or prominent
                                notice on our website before your data is transferred and becomes subject to a different
                                privacy policy.
                            </p>
                        </section>

                        {/* 6. Data Security */}
                        <section id="data-security" className="mb-12">
                            <h2 className="text-3xl font-bold text-deep-obsidian mb-6">6. Data Security</h2>
                            <p className="mb-4">
                                We implement industry-standard security measures to protect your data:
                            </p>
                            <ul className="list-disc ml-6 mb-6 space-y-2">
                                <li><strong>Encryption at Rest:</strong> AES-256 encryption for all stored data</li>
                                <li><strong>Encryption in Transit:</strong> TLS 1.3 for all data transmission</li>
                                <li><strong>Access Controls:</strong> Role-based access controls (RBAC) with multi-factor authentication</li>
                                <li><strong>Data Isolation:</strong> Multi-tenant architecture with Row Level Security (RLS) ensuring
                                    complete isolation between organizations</li>
                                <li><strong>Credential Management:</strong> Third-party credentials encrypted with AES-256-GCM
                                    with IV and AuthTag</li>
                                <li><strong>Monitoring:</strong> Real-time error tracking via Sentry with PII redaction</li>
                                <li><strong>Audit Logging:</strong> Comprehensive audit trails for all data access and modifications</li>
                                <li><strong>Rate Limiting:</strong> 1,000 requests/hour per organization, 100 requests/15 minutes per IP</li>
                            </ul>
                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-6">
                                <p className="text-sm text-yellow-800">
                                    <strong>No method of transmission over the Internet is 100% secure.</strong> While we
                                    strive to protect your data, we cannot guarantee absolute security. You are responsible
                                    for maintaining the security of your account credentials.
                                </p>
                            </div>
                        </section>

                        {/* 7. HIPAA */}
                        <section id="hipaa" className="mb-12">
                            <h2 className="text-3xl font-bold text-deep-obsidian mb-6">7. HIPAA Compliance</h2>
                            <p className="mb-4">
                                If you are a HIPAA-covered entity (healthcare provider, health plan, or healthcare clearinghouse)
                                and use the Service to process Protected Health Information (PHI):
                            </p>
                            <ul className="list-disc ml-6 mb-6 space-y-2">
                                <li>You must execute a Business Associate Agreement (BAA) with Voxanne AI</li>
                                <li>We act as a Business Associate under HIPAA</li>
                                <li>We implement administrative, physical, and technical safeguards as required by the HIPAA Security Rule</li>
                                <li>We apply PHI redaction to stored transcripts (8 pattern types including SSN, credit cards, diagnoses)</li>
                                <li>We maintain audit logs as required for HIPAA compliance</li>
                            </ul>
                            <p className="mb-4">
                                To request a BAA, email{' '}
                                <a href="mailto:legal@voxanne.ai" className="text-clinical-blue hover:text-surgical-blue underline">
                                    legal@voxanne.ai
                                </a>{' '}
                                with subject &quot;BAA Request.&quot; For full details, see our{' '}
                                <a href="/hipaa-compliance" className="text-clinical-blue hover:text-surgical-blue underline">
                                    HIPAA Compliance Page
                                </a>.
                            </p>
                        </section>

                        {/* 8. Data Retention */}
                        <section id="data-retention" className="mb-12">
                            <h2 className="text-3xl font-bold text-deep-obsidian mb-6">8. Data Retention</h2>
                            <p className="mb-4">We retain your data according to the following schedule:</p>

                            <table className="w-full border-collapse border border-slate-300 my-6">
                                <thead className="bg-slate-100">
                                    <tr>
                                        <th className="border border-slate-300 p-3 text-left">Data Type</th>
                                        <th className="border border-slate-300 p-3 text-left">Retention Period</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="border border-slate-300 p-3">Account information</td>
                                        <td className="border border-slate-300 p-3">Duration of account + 30 days after deletion</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-slate-300 p-3">Call recordings</td>
                                        <td className="border border-slate-300 p-3">90 days (configurable per organization)</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-slate-300 p-3">Call transcripts</td>
                                        <td className="border border-slate-300 p-3">Duration of account + 30 days</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-slate-300 p-3">Audit logs</td>
                                        <td className="border border-slate-300 p-3">90 days</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-slate-300 p-3">Webhook delivery logs</td>
                                        <td className="border border-slate-300 p-3">7 days</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-slate-300 p-3">Billing records</td>
                                        <td className="border border-slate-300 p-3">7 years (legal requirement)</td>
                                    </tr>
                                </tbody>
                            </table>

                            <p className="mb-4">
                                Upon account closure, all Customer Data is permanently deleted within 30 days in accordance
                                with our GDPR data retention policy. You may export your data via the dashboard before deletion.
                            </p>
                        </section>

                        {/* 9. Your Rights */}
                        <section id="your-rights" className="mb-12">
                            <h2 className="text-3xl font-bold text-deep-obsidian mb-6">9. Your Rights</h2>
                            <p className="mb-4">Depending on your location, you may have the following rights regarding your personal data:</p>
                            <ul className="list-disc ml-6 mb-6 space-y-2">
                                <li><strong>Right to Access:</strong> Request a copy of the personal data we hold about you</li>
                                <li><strong>Right to Rectification:</strong> Request correction of inaccurate or incomplete data</li>
                                <li><strong>Right to Erasure:</strong> Request deletion of your personal data (&quot;right to be forgotten&quot;)</li>
                                <li><strong>Right to Restrict Processing:</strong> Request that we limit how we use your data</li>
                                <li><strong>Right to Data Portability:</strong> Request your data in a structured, machine-readable format</li>
                                <li><strong>Right to Object:</strong> Object to processing of your data for certain purposes</li>
                                <li><strong>Right to Withdraw Consent:</strong> Withdraw previously given consent at any time</li>
                            </ul>
                            <p className="mb-4">
                                To exercise any of these rights, contact us at{' '}
                                <a href="mailto:privacy@voxanne.ai" className="text-clinical-blue hover:text-surgical-blue underline">
                                    privacy@voxanne.ai
                                </a>. We will respond within 30 days (or sooner as required by law).
                            </p>
                        </section>

                        {/* 10. GDPR */}
                        <section id="gdpr" className="mb-12">
                            <h2 className="text-3xl font-bold text-deep-obsidian mb-6">10. GDPR (European Users)</h2>
                            <p className="mb-4">
                                If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland:
                            </p>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4">10.1 Legal Basis for Processing</h3>
                            <ul className="list-disc ml-6 mb-6 space-y-2">
                                <li><strong>Contract Performance:</strong> Processing necessary to provide the Service you requested</li>
                                <li><strong>Legitimate Interests:</strong> Service improvement, security, fraud prevention</li>
                                <li><strong>Consent:</strong> Marketing communications (with opt-out)</li>
                                <li><strong>Legal Obligation:</strong> Compliance with applicable laws</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">10.2 Data Controller</h3>
                            <p className="mb-4">
                                Voxanne AI (Call Waiting AI Ltd.) is the data controller for personal data collected through
                                the Service. Our registered address is:
                            </p>
                            <div className="bg-slate-100 p-4 rounded-lg my-4 text-sm">
                                <p>Call Waiting AI Ltd.</p>
                                <p>Collage House, 2nd Floor</p>
                                <p>17 King Edward Road</p>
                                <p>Ruislip, London HA4 7AE</p>
                                <p>United Kingdom</p>
                            </div>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">10.3 Data Protection Officer</h3>
                            <p className="mb-4">
                                For GDPR-related inquiries, contact our Data Protection Officer at{' '}
                                <a href="mailto:privacy@voxanne.ai" className="text-clinical-blue hover:text-surgical-blue underline">
                                    privacy@voxanne.ai
                                </a>.
                            </p>

                            <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">10.4 Right to Lodge a Complaint</h3>
                            <p className="mb-4">
                                You have the right to lodge a complaint with a supervisory authority. In the UK, this is the
                                Information Commissioner&apos;s Office (ICO) at{' '}
                                <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-clinical-blue hover:text-surgical-blue underline">
                                    ico.org.uk
                                </a>.
                            </p>
                        </section>

                        {/* 11. CCPA */}
                        <section id="ccpa" className="mb-12">
                            <h2 className="text-3xl font-bold text-deep-obsidian mb-6">11. CCPA (California Users)</h2>
                            <p className="mb-4">
                                If you are a California resident, you have additional rights under the California Consumer
                                Privacy Act (CCPA):
                            </p>
                            <ul className="list-disc ml-6 mb-6 space-y-2">
                                <li><strong>Right to Know:</strong> Request information about the categories and specific pieces of personal information we collect</li>
                                <li><strong>Right to Delete:</strong> Request deletion of personal information we collected from you</li>
                                <li><strong>Right to Opt-Out:</strong> Opt out of the &quot;sale&quot; of personal information (we do not sell personal data)</li>
                                <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your CCPA rights</li>
                            </ul>
                            <p className="mb-4">
                                To exercise CCPA rights, contact us at{' '}
                                <a href="mailto:privacy@voxanne.ai" className="text-clinical-blue hover:text-surgical-blue underline">
                                    privacy@voxanne.ai
                                </a>{' '}
                                or call +44 7424 038250.
                            </p>
                        </section>

                        {/* 12. Cookies */}
                        <section id="cookies" className="mb-12">
                            <h2 className="text-3xl font-bold text-deep-obsidian mb-6">12. Cookies & Tracking</h2>
                            <p className="mb-4">
                                We use cookies and similar tracking technologies to enhance your experience. For full details,
                                see our{' '}
                                <a href="/cookie-policy" className="text-clinical-blue hover:text-surgical-blue underline">
                                    Cookie Policy
                                </a>.
                            </p>
                            <p className="mb-4">Types of cookies we use:</p>
                            <ul className="list-disc ml-6 mb-6 space-y-2">
                                <li><strong>Essential Cookies:</strong> Required for the Service to function (authentication, security)</li>
                                <li><strong>Analytics Cookies:</strong> Help us understand how you use the Service (can be disabled)</li>
                                <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
                            </ul>
                            <p className="mb-4">
                                You can manage your cookie preferences through your browser settings.
                            </p>
                        </section>

                        {/* 13. Children */}
                        <section id="children" className="mb-12">
                            <h2 className="text-3xl font-bold text-deep-obsidian mb-6">13. Children&apos;s Privacy</h2>
                            <p className="mb-4">
                                The Service is not intended for use by individuals under the age of 18. We do not knowingly
                                collect personal information from children. If we become aware that we have collected data
                                from a child under 18, we will take steps to delete that information promptly.
                            </p>
                            <p className="mb-4">
                                If you believe a child has provided us with personal information, please contact us at{' '}
                                <a href="mailto:privacy@voxanne.ai" className="text-clinical-blue hover:text-surgical-blue underline">
                                    privacy@voxanne.ai
                                </a>.
                            </p>
                        </section>

                        {/* 14. International */}
                        <section id="international" className="mb-12">
                            <h2 className="text-3xl font-bold text-deep-obsidian mb-6">14. International Data Transfers</h2>
                            <p className="mb-4">
                                Your data may be transferred to and processed in countries other than your country of
                                residence, including the United States and the United Kingdom. We ensure adequate protection
                                through:
                            </p>
                            <ul className="list-disc ml-6 mb-6 space-y-2">
                                <li>Standard Contractual Clauses (SCCs) approved by the European Commission</li>
                                <li>UK International Data Transfer Agreement (IDTA) where applicable</li>
                                <li>Data processing agreements with all third-party providers</li>
                                <li>Encryption of data in transit and at rest</li>
                            </ul>
                        </section>

                        {/* 15. Changes */}
                        <section id="changes" className="mb-12">
                            <h2 className="text-3xl font-bold text-deep-obsidian mb-6">15. Changes to This Policy</h2>
                            <p className="mb-4">
                                We may update this Privacy Policy from time to time. If we make material changes, we will:
                            </p>
                            <ul className="list-disc ml-6 mb-6 space-y-2">
                                <li>Email you at your registered email address (at least 30 days in advance for material changes)</li>
                                <li>Display a prominent notice on our website and dashboard</li>
                                <li>Update the &quot;Last Updated&quot; date at the top of this page</li>
                            </ul>
                            <p className="mb-4">
                                Your continued use of the Service after the effective date of the updated policy constitutes
                                your acceptance of the changes.
                            </p>
                        </section>

                        {/* 16. Contact */}
                        <section id="contact" className="mb-12">
                            <h2 className="text-3xl font-bold text-deep-obsidian mb-6">16. Contact Information</h2>
                            <p className="mb-4">
                                If you have questions about this Privacy Policy or wish to exercise your data rights,
                                please contact us:
                            </p>
                            <div className="bg-clinical-blue/5 border border-clinical-blue/20 rounded-lg p-6 mt-6">
                                <h3 className="font-semibold text-deep-obsidian mb-4">Voxanne AI</h3>
                                <p className="text-slate-600 mb-2">A product of Call Waiting AI Ltd.</p>
                                <p className="text-slate-600 mb-4">
                                    Collage House, 2nd Floor<br />
                                    17 King Edward Road<br />
                                    Ruislip, London HA4 7AE<br />
                                    United Kingdom
                                </p>
                                <div className="space-y-2">
                                    <p className="text-slate-600">
                                        <strong>General Support:</strong>{' '}
                                        <a href="mailto:support@voxanne.ai" className="text-clinical-blue hover:text-surgical-blue underline">
                                            support@voxanne.ai
                                        </a>
                                    </p>
                                    <p className="text-slate-600">
                                        <strong>Privacy Inquiries:</strong>{' '}
                                        <a href="mailto:privacy@voxanne.ai" className="text-clinical-blue hover:text-surgical-blue underline">
                                            privacy@voxanne.ai
                                        </a>
                                    </p>
                                    <p className="text-slate-600">
                                        <strong>Legal Matters:</strong>{' '}
                                        <a href="mailto:legal@voxanne.ai" className="text-clinical-blue hover:text-surgical-blue underline">
                                            legal@voxanne.ai
                                        </a>
                                    </p>
                                    <p className="text-slate-600">
                                        <strong>Security Issues:</strong>{' '}
                                        <a href="mailto:security@voxanne.ai" className="text-clinical-blue hover:text-surgical-blue underline">
                                            security@voxanne.ai
                                        </a>
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Final Notice */}
                        <div className="bg-slate-100 border-l-4 border-slate-500 p-6 rounded-r-lg mt-12">
                            <p className="text-sm text-slate-700">
                                <strong>Last Updated:</strong> January 30, 2026<br />
                                <strong>Effective Date:</strong> January 30, 2026<br />
                                <strong>Version:</strong> 2.0
                            </p>
                            <p className="text-sm text-slate-600 mt-4">
                                By using the Service, you acknowledge that you have read and understood this Privacy Policy.
                                Thank you for trusting Voxanne AI with your data.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <FooterRedesigned />
        </>
    );
}
