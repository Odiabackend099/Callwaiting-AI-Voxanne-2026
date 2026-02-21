import type { Metadata } from "next"
import React from 'react';

export const metadata: Metadata = {
  title: "Terms of Service | Voxanne AI",
  description: "Voxanne AI Terms of Service. Review our platform usage terms, service agreements, and user responsibilities for AI voice automation.",
  keywords: ["terms of service", "user agreement", "legal terms"],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Terms of Service | Voxanne AI",
    url: 'https://voxanne.ai/terms',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Terms of Service | Voxanne AI",
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: '/terms',
  },
}

export default function TermsOfService() {
    return (
        <div className="min-h-screen bg-slate-50 py-20 px-6">
            <div className="max-w-4xl mx-auto bg-white p-12 rounded-2xl shadow-sm border border-slate-200">
                <h1 className="text-4xl font-bold text-slate-900 mb-8">Terms of Service</h1>
                <p className="text-slate-500 mb-8">Last Updated: January 30, 2026</p>

                <div className="prose prose-slate max-w-none">
                    {/* Table of Contents */}
                    <div className="bg-clinical-blue/5 border-l-4 border-clinical-blue p-6 rounded-r-lg mb-12">
                        <h3 className="text-lg font-semibold text-deep-obsidian mb-4">Table of Contents</h3>
                        <ol className="space-y-2 text-sm">
                            <li><a href="#acceptance" className="text-clinical-blue hover:text-surgical-blue">1. Acceptance of Terms</a></li>
                            <li><a href="#definitions" className="text-clinical-blue hover:text-surgical-blue">2. Definitions</a></li>
                            <li><a href="#service-description" className="text-clinical-blue hover:text-surgical-blue">3. Service Description</a></li>
                            <li><a href="#account-registration" className="text-clinical-blue hover:text-surgical-blue">4. Account Registration</a></li>
                            <li><a href="#user-obligations" className="text-clinical-blue hover:text-surgical-blue">5. User Obligations</a></li>
                            <li><a href="#payment-terms" className="text-clinical-blue hover:text-surgical-blue">6. Payment Terms</a></li>
                            <li><a href="#cancellation" className="text-clinical-blue hover:text-surgical-blue">7. Cancellation and Refunds</a></li>
                            <li><a href="#intellectual-property" className="text-clinical-blue hover:text-surgical-blue">8. Intellectual Property</a></li>
                            <li><a href="#hipaa" className="text-clinical-blue hover:text-surgical-blue">9. HIPAA and Data Protection</a></li>
                            <li><a href="#sla" className="text-clinical-blue hover:text-surgical-blue">10. Service Level Agreement</a></li>
                            <li><a href="#limitation-liability" className="text-clinical-blue hover:text-surgical-blue">11. Limitation of Liability</a></li>
                            <li><a href="#indemnification" className="text-clinical-blue hover:text-surgical-blue">12. Indemnification</a></li>
                            <li><a href="#dispute-resolution" className="text-clinical-blue hover:text-surgical-blue">13. Dispute Resolution</a></li>
                            <li><a href="#governing-law" className="text-clinical-blue hover:text-surgical-blue">14. Governing Law</a></li>
                            <li><a href="#modifications" className="text-clinical-blue hover:text-surgical-blue">15. Modifications to Terms</a></li>
                            <li><a href="#termination" className="text-clinical-blue hover:text-surgical-blue">16. Termination</a></li>
                            <li><a href="#miscellaneous" className="text-clinical-blue hover:text-surgical-blue">17. Miscellaneous</a></li>
                            <li><a href="#contact" className="text-clinical-blue hover:text-surgical-blue">18. Contact Information</a></li>
                        </ol>
                    </div>

                    {/* 1. Acceptance of Terms */}
                    <section id="acceptance" className="mb-12">
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-6">1. Acceptance of Terms</h2>
                        <p className="mb-4">
                            Welcome to Voxanne AI, a product of Call Waiting AI Ltd. ("Voxanne AI," "we," "us," or "our").
                            These Terms of Service ("Terms") constitute a legally binding agreement between you ("you," "your,"
                            or "User") and Voxanne AI governing your access to and use of our AI-powered voice receptionist
                            platform (the "Service").
                        </p>
                        <p className="mb-4">
                            <strong>By accessing, browsing, or using the Service, you acknowledge that you have read,
                            understood, and agree to be bound by these Terms and our Privacy Policy.</strong> If you do
                            not agree to these Terms, you must not access or use the Service.
                        </p>
                        <p className="mb-4">
                            These Terms apply to all users of the Service, including without limitation: organizations,
                            healthcare providers, medical practices, clinics, administrators, staff members, and any other
                            entity or individual accessing or using the Service.
                        </p>
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-6">
                            <p className="text-sm text-yellow-800">
                                <strong>Important:</strong> If you are using the Service on behalf of an organization
                                (such as a medical practice or clinic), you represent and warrant that you have the
                                authority to bind that organization to these Terms, and your acceptance of these Terms
                                will be treated as acceptance by that organization.
                            </p>
                        </div>
                    </section>

                    {/* 2. Definitions */}
                    <section id="definitions" className="mb-12">
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-6">2. Definitions</h2>
                        <p className="mb-4">For purposes of these Terms, the following terms have the meanings set forth below:</p>
                        <dl className="space-y-4">
                            <div>
                                <dt className="font-semibold text-deep-obsidian">"Service"</dt>
                                <dd className="ml-4 text-slate-600">
                                    Refers to Voxanne AI's AI-powered voice receptionist platform, including all software,
                                    features, integrations, APIs, documentation, and related services provided by Voxanne AI.
                                </dd>
                            </div>
                            <div>
                                <dt className="font-semibold text-deep-obsidian">"Organization"</dt>
                                <dd className="ml-4 text-slate-600">
                                    The entity (medical practice, clinic, healthcare provider, or business) that registers
                                    for and uses the Service.
                                </dd>
                            </div>
                            <div>
                                <dt className="font-semibold text-deep-obsidian">"User" or "You"</dt>
                                <dd className="ml-4 text-slate-600">
                                    Any individual or entity that accesses or uses the Service, including Organization
                                    administrators, staff members, and authorized users.
                                </dd>
                            </div>
                            <div>
                                <dt className="font-semibold text-deep-obsidian">"PHI" (Protected Health Information)</dt>
                                <dd className="ml-4 text-slate-600">
                                    Individually identifiable health information as defined by HIPAA (Health Insurance
                                    Portability and Accountability Act), including patient names, phone numbers, medical
                                    records, appointment details, and treatment information.
                                </dd>
                            </div>
                            <div>
                                <dt className="font-semibold text-deep-obsidian">"Customer Data"</dt>
                                <dd className="ml-4 text-slate-600">
                                    All data, information, content, and materials submitted, uploaded, or transmitted by
                                    you to the Service, including but not limited to call recordings, transcripts, contact
                                    information, calendar data, and knowledge base content.
                                </dd>
                            </div>
                            <div>
                                <dt className="font-semibold text-deep-obsidian">"BAA" (Business Associate Agreement)</dt>
                                <dd className="ml-4 text-slate-600">
                                    A written agreement required under HIPAA between a covered entity (healthcare provider)
                                    and a business associate (service provider handling PHI) that establishes each party's
                                    responsibilities for safeguarding PHI.
                                </dd>
                            </div>
                            <div>
                                <dt className="font-semibold text-deep-obsidian">"SLA" (Service Level Agreement)</dt>
                                <dd className="ml-4 text-slate-600">
                                    The uptime and availability commitments outlined in Section 10 of these Terms.
                                </dd>
                            </div>
                        </dl>
                    </section>

                    {/* 3. Service Description */}
                    <section id="service-description" className="mb-12">
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-6">3. Service Description</h2>
                        <p className="mb-4">
                            Voxanne AI provides an AI-powered voice receptionist platform designed specifically for
                            healthcare providers, medical practices, and aesthetic clinics. The Service includes:
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li>Inbound call handling with natural language understanding</li>
                            <li>Appointment scheduling and calendar synchronization</li>
                            <li>Knowledge base integration for answering frequently asked questions</li>
                            <li>Outbound calling capabilities for callbacks and reminders</li>
                            <li>SMS messaging for appointment confirmations and follow-ups</li>
                            <li>Call recording and transcription services</li>
                            <li>Dashboard analytics and reporting</li>
                            <li>Integration with third-party services (Google Calendar, Twilio, etc.)</li>
                            <li>Multi-tenant architecture with organization-level data isolation</li>
                        </ul>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">3.1 Service Limitations</h3>
                        <p className="mb-4">
                            While we strive for high accuracy and reliability, you acknowledge and agree that:
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li>
                                <strong>AI Limitations:</strong> The Service uses artificial intelligence and natural
                                language processing, which may not always interpret caller intent with 100% accuracy.
                                You are responsible for verifying critical information, especially medical details and
                                appointment bookings.
                            </li>
                            <li>
                                <strong>No Medical Advice:</strong> The Service is not designed to provide medical advice,
                                diagnosis, or treatment. It should not be used as a substitute for professional medical
                                judgment.
                            </li>
                            <li>
                                <strong>Third-Party Integrations:</strong> The Service relies on third-party providers
                                (Vapi, Twilio, Google Calendar) for certain functionalities. We are not responsible for
                                disruptions caused by third-party service outages.
                            </li>
                            <li>
                                <strong>Internet Connectivity:</strong> The Service requires a stable internet connection.
                                We are not liable for service disruptions caused by your internet connectivity issues.
                            </li>
                        </ul>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">3.2 Beta Features</h3>
                        <p className="mb-4">
                            From time to time, we may offer beta features or experimental functionalities. These features
                            are provided "AS IS" without warranties and may be modified or discontinued at any time without
                            notice. Use of beta features is at your own risk.
                        </p>
                    </section>

                    {/* 4. Account Registration */}
                    <section id="account-registration" className="mb-12">
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-6">4. Account Registration</h2>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4">4.1 Eligibility</h3>
                        <p className="mb-4">
                            To use the Service, you must:
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li>Be at least 18 years of age</li>
                            <li>Have the legal authority to enter into binding contracts</li>
                            <li>Not be prohibited from using the Service under applicable laws</li>
                            <li>Provide accurate, current, and complete registration information</li>
                        </ul>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">4.2 Account Security</h3>
                        <p className="mb-4">
                            You are responsible for:
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li>Maintaining the confidentiality of your account credentials (password, API keys)</li>
                            <li>All activities that occur under your account</li>
                            <li>Notifying us immediately of any unauthorized access or security breach</li>
                            <li>Using strong, unique passwords and enabling multi-factor authentication (MFA) where available</li>
                        </ul>
                        <div className="bg-red-50 border-l-4 border-red-400 p-4 my-6">
                            <p className="text-sm text-red-800">
                                <strong>Security Warning:</strong> You must not share your account credentials with
                                unauthorized individuals. Voxanne AI will never ask for your password via email, phone,
                                or instant message.
                            </p>
                        </div>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">4.3 Accurate Information</h3>
                        <p className="mb-4">
                            You agree to provide accurate, current, and complete information during registration and to
                            update such information promptly if it changes. We reserve the right to suspend or terminate
                            accounts with false, inaccurate, or incomplete information.
                        </p>
                    </section>

                    {/* 5. User Obligations */}
                    <section id="user-obligations" className="mb-12">
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-6">5. User Obligations</h2>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4">5.1 Acceptable Use Policy</h3>
                        <p className="mb-4">You agree to use the Service only for lawful purposes and in accordance with these Terms. Specifically, you agree NOT to:</p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li>Violate any applicable federal, state, local, or international law or regulation</li>
                            <li>Infringe upon or violate our intellectual property rights or the intellectual property rights of others</li>
                            <li>Transmit any malware, viruses, or malicious code</li>
                            <li>Attempt to gain unauthorized access to the Service or related systems</li>
                            <li>Interfere with or disrupt the integrity or performance of the Service</li>
                            <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
                            <li>Use the Service for any fraudulent, abusive, or illegal activity</li>
                            <li>Harass, abuse, or harm another person through the Service</li>
                            <li>Impersonate any person or entity or falsely state or misrepresent your affiliation with a person or entity</li>
                            <li>Use the Service to send spam, unsolicited communications, or marketing messages</li>
                        </ul>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">5.2 Compliance with Healthcare Laws</h3>
                        <p className="mb-4">
                            If you are a healthcare provider or handle PHI, you agree to:
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li>Comply with all applicable healthcare privacy and security laws, including HIPAA</li>
                            <li>Obtain all necessary patient consents for call recording and data processing</li>
                            <li>Ensure your use of the Service aligns with your organization's HIPAA compliance program</li>
                            <li>Request and execute a BAA with Voxanne AI if required by HIPAA (see Section 9)</li>
                            <li>Train your staff on proper use of the Service in compliance with HIPAA regulations</li>
                        </ul>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">5.3 Content Responsibility</h3>
                        <p className="mb-4">
                            You are solely responsible for:
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li>All Customer Data you upload, transmit, or store using the Service</li>
                            <li>Ensuring you have the necessary rights and permissions to use such Customer Data</li>
                            <li>The accuracy and appropriateness of knowledge base content, agent instructions, and automated responses</li>
                            <li>Compliance with telemarketing laws (TCPA, DNC registries) if using outbound calling features</li>
                        </ul>
                    </section>

                    {/* 6. Payment Terms */}
                    <section id="payment-terms" className="mb-12">
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-6">6. Payment Terms</h2>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4">6.1 Pricing and Billing</h3>
                        <p className="mb-4">
                            Pricing for the Service is available on our website at{' '}
                            <a href="https://voxanne.ai/pricing" className="text-clinical-blue hover:text-surgical-blue underline">
                                voxanne.ai/pricing
                            </a>. You agree to pay all fees and charges incurred under your account at the rates in effect
                            when the charges were incurred.
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li><strong>Billing Model:</strong> Voxanne AI operates on a prepaid credit (pay-as-you-go) basis. You purchase credits which are deducted based on actual call usage</li>
                            <li><strong>Payment Method:</strong> Payments are processed via Stripe. You may purchase credits via one-time card payments</li>
                            <li><strong>Auto-Recharge:</strong> You may optionally enable automatic top-ups when your balance falls below a configured threshold</li>
                            <li><strong>Minimum Top-Up:</strong> The minimum credit purchase is $25</li>
                        </ul>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">6.2 Price Changes</h3>
                        <p className="mb-4">
                            We reserve the right to modify our pricing at any time. Price changes will be communicated to you
                            at least 30 days in advance via email. Your continued use of the Service after the price change
                            takes effect constitutes your acceptance of the new pricing.
                        </p>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">6.3 Late Payments</h3>
                        <p className="mb-4">
                            Late payments are subject to:
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li>A late fee of 1.5% per month (18% annual) or the maximum allowed by law, whichever is less</li>
                            <li>Service suspension after 15 days of non-payment</li>
                            <li>Account termination after 30 days of non-payment</li>
                            <li>Collection costs and legal fees if we pursue collection action</li>
                        </ul>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">6.4 Taxes</h3>
                        <p className="mb-4">
                            All fees are exclusive of applicable taxes (including VAT, sales tax, GST). You are responsible
                            for paying all taxes associated with your use of the Service, except for taxes based on our net income.
                        </p>
                    </section>

                    {/* 7. Cancellation and Refunds */}
                    <section id="cancellation" className="mb-12">
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-6">7. Cancellation and Refunds</h2>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4">7.1 Account Closure</h3>
                        <p className="mb-4">
                            You may stop using the Service at any time. Since there is no recurring subscription, no cancellation is required. To close your account:
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li>Navigate to Account Settings → Close Account in your dashboard</li>
                            <li>Or contact our support team at support@voxanne.ai</li>
                        </ul>
                        <p className="mb-4">
                            Unused credits remain in your wallet for 12 months from the date of your last top-up.
                        </p>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">7.2 Refund Policy</h3>
                        <p className="mb-4">
                            Credits are non-refundable except:
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li>Service uptime falls below our SLA commitments (see Section 10)</li>
                            <li>Billing errors (we will issue a credit within 30 days)</li>
                            <li>As required by applicable law</li>
                        </ul>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">7.3 Data Export Upon Cancellation</h3>
                        <p className="mb-4">
                            Upon cancellation, you have 30 days to export your Customer Data via the dashboard. After 30 days,
                            your data will be permanently deleted in accordance with our data retention policy. We are not
                            responsible for data loss if you fail to export your data within this period.
                        </p>
                    </section>

                    {/* 8. Intellectual Property */}
                    <section id="intellectual-property" className="mb-12">
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-6">8. Intellectual Property</h2>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4">8.1 Our Intellectual Property</h3>
                        <p className="mb-4">
                            The Service, including all software, algorithms, AI models, trademarks, logos, and content
                            (excluding Customer Data), is owned by Voxanne AI and protected by copyright, trademark, patent,
                            trade secret, and other intellectual property laws.
                        </p>
                        <p className="mb-4">
                            Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable,
                            revocable license to access and use the Service solely for your internal business purposes.
                        </p>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">8.2 Your Intellectual Property</h3>
                        <p className="mb-4">
                            You retain all ownership rights to your Customer Data. By using the Service, you grant us a
                            limited license to:
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li>Store, process, and transmit Customer Data as necessary to provide the Service</li>
                            <li>Use aggregated, anonymized data for analytics and service improvements (no PHI or personal identifiers)</li>
                            <li>Display your company name/logo on our website as a customer reference (with your prior consent)</li>
                        </ul>
                        <div className="bg-green-50 border-l-4 border-green-400 p-4 my-6">
                            <p className="text-sm text-green-800">
                                <strong>Your Data, Your Control:</strong> We will never use your Customer Data to train
                                generalized AI models without your explicit, written consent. Your knowledge base content,
                                call recordings, and patient data remain confidential and are only used to provide the Service
                                to you.
                            </p>
                        </div>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">8.3 Feedback</h3>
                        <p className="mb-4">
                            If you provide feedback, suggestions, or ideas for improving the Service, you grant us an
                            unrestricted, perpetual, irrevocable license to use such feedback for any purpose without
                            compensation to you.
                        </p>
                    </section>

                    {/* 9. HIPAA and Data Protection */}
                    <section id="hipaa" className="mb-12">
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-6">9. HIPAA and Data Protection</h2>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4">9.1 HIPAA Compliance</h3>
                        <p className="mb-4">
                            If you are a HIPAA-covered entity (healthcare provider, health plan, or healthcare clearinghouse)
                            and use the Service to process PHI, you must execute a Business Associate Agreement (BAA) with us.
                        </p>
                        <p className="mb-4">
                            <strong>To request a BAA:</strong>
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li>Email legal@voxanne.ai with subject "BAA Request"</li>
                            <li>Include your organization name, contact information, and practice type</li>
                            <li>We will provide our standard BAA template within 5 business days</li>
                            <li>Enterprise customers may negotiate custom BAA terms</li>
                        </ul>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">9.2 Your HIPAA Responsibilities</h3>
                        <p className="mb-4">
                            Even with a BAA in place, you are responsible for:
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li>Determining whether HIPAA applies to your use of the Service</li>
                            <li>Obtaining all necessary patient authorizations for call recording and data processing</li>
                            <li>Ensuring your use of the Service complies with the HIPAA Privacy Rule and Security Rule</li>
                            <li>Training your workforce on HIPAA requirements related to the Service</li>
                            <li>Reporting any suspected security incidents to us within 24 hours</li>
                        </ul>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">9.3 Data Security</h3>
                        <p className="mb-4">
                            We implement industry-standard security measures to protect your data, including:
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li>AES-256 encryption for data at rest</li>
                            <li>TLS 1.3 encryption for data in transit</li>
                            <li>Role-based access controls (RBAC)</li>
                            <li>Multi-factor authentication (MFA) for administrator accounts</li>
                            <li>Regular security audits and penetration testing</li>
                            <li>SOC 2 Type II compliance (in progress)</li>
                        </ul>
                        <p className="mb-4">
                            For more details, see our{' '}
                            <a href="/security" className="text-clinical-blue hover:text-surgical-blue underline">
                                Security Page
                            </a>{' '}
                            and{' '}
                            <a href="/hipaa-compliance" className="text-clinical-blue hover:text-surgical-blue underline">
                                HIPAA Compliance Page
                            </a>.
                        </p>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">9.4 Data Privacy</h3>
                        <p className="mb-4">
                            Our use of personal data is governed by our{' '}
                            <a href="/privacy" className="text-clinical-blue hover:text-surgical-blue underline">
                                Privacy Policy
                            </a>, which is incorporated into these Terms by reference. By using the Service, you also
                            agree to our Privacy Policy.
                        </p>
                    </section>

                    {/* 10. Service Level Agreement (SLA) */}
                    <section id="sla" className="mb-12">
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-6">10. Service Level Agreement</h2>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4">10.1 Uptime Commitment</h3>
                        <p className="mb-4">
                            We commit to maintaining 99.9% uptime for the Service, measured monthly ("Uptime SLA").
                            Uptime is calculated as:
                        </p>
                        <div className="bg-slate-100 p-4 rounded-lg my-4 font-mono text-sm">
                            Uptime % = ((Total Minutes in Month - Downtime Minutes) / Total Minutes in Month) × 100
                        </div>
                        <p className="mb-4">
                            <strong>Excluded Downtime:</strong> The following are excluded from downtime calculations:
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li>Scheduled maintenance (announced at least 24 hours in advance)</li>
                            <li>Downtime caused by your actions or violations of these Terms</li>
                            <li>Third-party service outages (Vapi, Twilio, Google Calendar, AWS)</li>
                            <li>Force majeure events (natural disasters, war, terrorism, pandemics)</li>
                            <li>Issues with your internet connectivity or local network</li>
                        </ul>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">10.2 Service Credits</h3>
                        <p className="mb-4">
                            If we fail to meet the Uptime SLA, you may be eligible for service credits:
                        </p>
                        <table className="w-full border-collapse border border-slate-300 my-6">
                            <thead className="bg-slate-100">
                                <tr>
                                    <th className="border border-slate-300 p-3 text-left">Monthly Uptime</th>
                                    <th className="border border-slate-300 p-3 text-left">Service Credit</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="border border-slate-300 p-3">99.0% - 99.9%</td>
                                    <td className="border border-slate-300 p-3">10% of monthly fee</td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 p-3">95.0% - 98.9%</td>
                                    <td className="border border-slate-300 p-3">25% of monthly fee</td>
                                </tr>
                                <tr>
                                    <td className="border border-slate-300 p-3">Below 95.0%</td>
                                    <td className="border border-slate-300 p-3">50% of monthly fee</td>
                                </tr>
                            </tbody>
                        </table>
                        <p className="mb-4">
                            <strong>To claim service credits:</strong> Email support@voxanne.ai within 30 days of the
                            downtime incident with details of the outage. Credits will be applied to your next monthly invoice.
                        </p>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">10.3 Support</h3>
                        <p className="mb-4">
                            We provide email and chat support during business hours (Monday-Friday, 9 AM - 6 PM UK time).
                            Enterprise customers receive priority support with 4-hour response time for critical issues.
                        </p>
                    </section>

                    {/* 11. Limitation of Liability */}
                    <section id="limitation-liability" className="mb-12">
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-6">11. Limitation of Liability</h2>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4">11.1 Disclaimer of Warranties</h3>
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-6">
                            <p className="text-sm text-yellow-800 uppercase font-semibold mb-2">
                                Important Legal Notice
                            </p>
                            <p className="text-sm text-yellow-800">
                                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
                                EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
                                MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
                            </p>
                        </div>
                        <p className="mb-4">
                            We do not guarantee that:
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li>The Service will meet your specific requirements or expectations</li>
                            <li>The Service will be uninterrupted, secure, or error-free</li>
                            <li>AI-generated responses will be 100% accurate or appropriate</li>
                            <li>Defects or errors will be corrected within a specific timeframe</li>
                            <li>The Service will be compatible with all third-party software or hardware</li>
                        </ul>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">11.2 Liability Cap</h3>
                        <div className="bg-red-50 border-l-4 border-red-400 p-4 my-6">
                            <p className="text-sm text-red-800 uppercase font-semibold mb-2">
                                Limitation of Liability
                            </p>
                            <p className="text-sm text-red-800">
                                TO THE MAXIMUM EXTENT PERMITTED BY LAW, VOXANNE AI'S TOTAL LIABILITY TO YOU FOR ALL
                                CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE
                                GREATER OF: (A) THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) $5,000 USD.
                            </p>
                        </div>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">11.3 Exclusion of Consequential Damages</h3>
                        <div className="bg-red-50 border-l-4 border-red-400 p-4 my-6">
                            <p className="text-sm text-red-800 uppercase font-semibold mb-2">
                                No Consequential Damages
                            </p>
                            <p className="text-sm text-red-800">
                                IN NO EVENT SHALL VOXANNE AI BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
                                CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION LOST PROFITS,
                                LOST REVENUE, LOST DATA, OR BUSINESS INTERRUPTION, EVEN IF WE HAVE BEEN ADVISED
                                OF THE POSSIBILITY OF SUCH DAMAGES.
                            </p>
                        </div>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">11.4 Exceptions</h3>
                        <p className="mb-4">
                            Some jurisdictions do not allow the exclusion of certain warranties or limitation of liability
                            for incidental or consequential damages. In such jurisdictions, our liability will be limited
                            to the maximum extent permitted by law.
                        </p>
                    </section>

                    {/* 12. Indemnification */}
                    <section id="indemnification" className="mb-12">
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-6">12. Indemnification</h2>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4">12.1 Your Indemnification Obligations</h3>
                        <p className="mb-4">
                            You agree to indemnify, defend, and hold harmless Voxanne AI, its affiliates, officers,
                            directors, employees, and agents from and against any claims, liabilities, damages, losses,
                            and expenses (including reasonable attorneys' fees) arising out of or related to:
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li>Your use or misuse of the Service</li>
                            <li>Your violation of these Terms</li>
                            <li>Your violation of any law or regulation</li>
                            <li>Your Customer Data or any third-party claim that your Customer Data infringes their rights</li>
                            <li>Your violation of HIPAA or other healthcare privacy laws</li>
                            <li>Unauthorized access to your account due to your failure to maintain account security</li>
                        </ul>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">12.2 Our Indemnification Obligations</h3>
                        <p className="mb-4">
                            We agree to indemnify, defend, and hold you harmless from third-party claims that the Service
                            infringes their intellectual property rights, provided that:
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li>You promptly notify us in writing of the claim</li>
                            <li>You give us sole control of the defense and settlement</li>
                            <li>You provide reasonable cooperation in the defense</li>
                        </ul>
                        <p className="mb-4">
                            If the Service is found to infringe, we may (at our option):
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li>Obtain the right for you to continue using the Service</li>
                            <li>Replace or modify the Service to make it non-infringing</li>
                            <li>Terminate your subscription and refund pre-paid fees on a pro-rata basis</li>
                        </ul>
                    </section>

                    {/* 13. Dispute Resolution */}
                    <section id="dispute-resolution" className="mb-12">
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-6">13. Dispute Resolution</h2>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4">13.1 Informal Negotiation</h3>
                        <p className="mb-4">
                            Before filing any formal dispute, you agree to contact us at legal@voxanne.ai and attempt to
                            resolve the dispute informally for at least 30 days.
                        </p>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">13.2 Binding Arbitration</h3>
                        <p className="mb-4">
                            If informal negotiation fails, any dispute arising out of or relating to these Terms or the
                            Service will be resolved by binding arbitration in accordance with the American Arbitration
                            Association (AAA) Commercial Arbitration Rules, except as modified by these Terms.
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li><strong>Location:</strong> Arbitration will be conducted in Delaware, USA (or London, UK for EU customers)</li>
                            <li><strong>Language:</strong> English</li>
                            <li><strong>Arbitrator:</strong> Single arbitrator mutually agreed upon, or appointed by AAA</li>
                            <li><strong>Costs:</strong> Each party bears its own legal fees; arbitrator's fees split equally</li>
                            <li><strong>Award:</strong> Arbitrator's decision is final and binding, enforceable in any court</li>
                        </ul>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">13.3 Class Action Waiver</h3>
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-6">
                            <p className="text-sm text-yellow-800 uppercase font-semibold mb-2">
                                Class Action Waiver
                            </p>
                            <p className="text-sm text-yellow-800">
                                YOU AGREE THAT ANY ARBITRATION OR PROCEEDING SHALL BE LIMITED TO THE DISPUTE BETWEEN
                                US AND YOU INDIVIDUALLY. TO THE FULLEST EXTENT PERMITTED BY LAW, (A) NO ARBITRATION
                                OR PROCEEDING SHALL BE JOINED WITH ANY OTHER; (B) THERE IS NO RIGHT OR AUTHORITY FOR
                                ANY DISPUTE TO BE ARBITRATED ON A CLASS-ACTION BASIS OR TO UTILIZE CLASS ACTION
                                PROCEDURES; AND (C) THERE IS NO RIGHT OR AUTHORITY FOR ANY DISPUTE TO BE BROUGHT IN
                                A PURPORTED REPRESENTATIVE CAPACITY ON BEHALF OF THE GENERAL PUBLIC OR ANY OTHER PERSONS.
                            </p>
                        </div>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">13.4 Exceptions</h3>
                        <p className="mb-4">
                            Notwithstanding the above, either party may seek injunctive or other equitable relief in any
                            court of competent jurisdiction to prevent infringement of intellectual property rights or
                            unauthorized disclosure of confidential information.
                        </p>
                    </section>

                    {/* 14. Governing Law */}
                    <section id="governing-law" className="mb-12">
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-6">14. Governing Law & Jurisdiction</h2>
                        <p className="mb-4">
                            <strong>Voxanne AI is registered in England and Wales (Company Number 16917594).</strong> These Terms and any dispute arising out of or related to these Terms or the Service shall be governed by and construed in accordance with the laws of England and Wales, without regard to its conflict of law provisions.
                        </p>
                        <div className="bg-blue-50 border-l-4 border-blue-600 p-6 rounded-r-lg mb-6">
                            <p className="text-blue-800 font-semibold mb-2">Exclusive Jurisdiction</p>
                            <p className="text-blue-700 text-sm">
                                The courts of England and Wales shall have exclusive jurisdiction to hear and determine all disputes arising from or relating to these Terms, the Service, or your use thereof. Each party irrevocably submits to the jurisdiction of these courts.
                            </p>
                        </div>
                        <p className="mb-4">
                            <strong>For US Customers:</strong> If you are based in the United States, you acknowledge that these Terms are governed by English law, not Delaware or US law. However, for specific payment processing disputes, PCI-DSS and US payment regulations may apply in addition to English law where permitted.
                        </p>
                        <p className="mb-4">
                            <strong>Exception:</strong> Nothing in these Terms prevents either party from seeking injunctive or other equitable relief in any court of competent jurisdiction to prevent infringement of intellectual property rights or unauthorized disclosure of confidential information.
                        </p>
                        <p className="mb-4">
                            The United Nations Convention on Contracts for the International Sale of Goods does not apply to these Terms.
                        </p>
                    </section>

                    {/* 15. Modifications to Terms */}
                    <section id="modifications" className="mb-12">
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-6">15. Modifications to Terms</h2>
                        <p className="mb-4">
                            We reserve the right to modify these Terms at any time. If we make material changes, we will
                            notify you by:
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li>Email to your registered email address (at least 30 days in advance)</li>
                            <li>In-app notification when you log in to the Service</li>
                            <li>Posting the updated Terms on our website with a new "Last Updated" date</li>
                        </ul>
                        <p className="mb-4">
                            Your continued use of the Service after the effective date of the updated Terms constitutes
                            your acceptance of the changes. If you do not agree to the modified Terms, you must stop using
                            the Service and cancel your subscription.
                        </p>
                    </section>

                    {/* 16. Termination */}
                    <section id="termination" className="mb-12">
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-6">16. Termination</h2>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4">16.1 Termination by You</h3>
                        <p className="mb-4">
                            You may terminate these Terms at any time by canceling your subscription as described in
                            Section 7.
                        </p>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">16.2 Termination by Us</h3>
                        <p className="mb-4">
                            We may suspend or terminate your access to the Service immediately, without prior notice, if:
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li>You violate these Terms or our Acceptable Use Policy</li>
                            <li>Your account has been inactive for more than 12 months</li>
                            <li>You fail to pay fees when due (after 30-day grace period)</li>
                            <li>We reasonably believe your use of the Service poses a security or legal risk</li>
                            <li>Required by law or government order</li>
                            <li>We discontinue the Service (with 90 days' notice)</li>
                        </ul>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">16.3 Effect of Termination</h3>
                        <p className="mb-4">
                            Upon termination:
                        </p>
                        <ul className="list-disc ml-6 mb-6 space-y-2">
                            <li>Your right to access and use the Service immediately ceases</li>
                            <li>You must pay all outstanding fees and charges</li>
                            <li>You have 30 days to export your Customer Data (after which it will be permanently deleted)</li>
                            <li>Provisions that by their nature should survive termination will survive (including Sections 8, 11, 12, 13, 14)</li>
                        </ul>
                    </section>

                    {/* 17. Miscellaneous */}
                    <section id="miscellaneous" className="mb-12">
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-6">17. Miscellaneous</h2>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4">17.1 Entire Agreement</h3>
                        <p className="mb-4">
                            These Terms, together with our Privacy Policy and any other agreements referenced herein,
                            constitute the entire agreement between you and Voxanne AI regarding the Service and supersede
                            all prior agreements and understandings.
                        </p>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">17.2 Severability</h3>
                        <p className="mb-4">
                            If any provision of these Terms is found to be unenforceable or invalid, that provision will
                            be limited or eliminated to the minimum extent necessary, and the remaining provisions will
                            remain in full force and effect.
                        </p>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">17.3 Waiver</h3>
                        <p className="mb-4">
                            Our failure to enforce any right or provision of these Terms will not be deemed a waiver of
                            such right or provision.
                        </p>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">17.4 Assignment</h3>
                        <p className="mb-4">
                            You may not assign or transfer these Terms or your rights hereunder without our prior written
                            consent. We may assign these Terms without restriction. Subject to the foregoing, these Terms
                            will bind and inure to the benefit of the parties and their permitted successors and assigns.
                        </p>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">17.5 Force Majeure</h3>
                        <p className="mb-4">
                            We shall not be liable for any failure or delay in performance due to events beyond our reasonable
                            control, including acts of God, war, terrorism, riots, embargoes, acts of civil or military
                            authorities, fire, floods, accidents, pandemics, strikes, or shortages of transportation, fuel,
                            energy, labor, or materials.
                        </p>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">17.6 Export Control</h3>
                        <p className="mb-4">
                            You agree to comply with all applicable export and re-export control laws and regulations,
                            including the Export Administration Regulations maintained by the U.S. Department of Commerce
                            and sanctions programs administered by the Office of Foreign Assets Control.
                        </p>

                        <h3 className="text-xl font-semibold text-deep-obsidian mb-4 mt-8">17.7 U.S. Government Users</h3>
                        <p className="mb-4">
                            If you are a U.S. government entity, the Service is a "commercial item" as defined at 48 C.F.R.
                            §2.101, and is provided under these Terms in accordance with applicable federal regulations.
                        </p>
                    </section>

                    {/* 18. Contact Information */}
                    <section id="contact" className="mb-12">
                        <h2 className="text-3xl font-bold text-deep-obsidian mb-6">18. Contact Information</h2>
                        <p className="mb-4">
                            If you have questions about these Terms or need to contact us regarding the Service, please
                            reach out to:
                        </p>
                        <div className="bg-clinical-blue/5 border border-clinical-blue/20 rounded-lg p-6 mt-6">
                            <h3 className="font-semibold text-deep-obsidian mb-4">Voxanne AI</h3>
                            <p className="text-slate-600 mb-2">
                                A product of Call Waiting AI Ltd.
                            </p>
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
                                    <strong>Legal Matters:</strong>{' '}
                                    <a href="mailto:legal@voxanne.ai" className="text-clinical-blue hover:text-surgical-blue underline">
                                        legal@voxanne.ai
                                    </a>
                                </p>
                                <p className="text-slate-600">
                                    <strong>Privacy Inquiries:</strong>{' '}
                                    <a href="mailto:privacy@voxanne.ai" className="text-clinical-blue hover:text-surgical-blue underline">
                                        privacy@voxanne.ai
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
                            By using the Service, you acknowledge that you have read and understood these Terms of Service
                            and agree to be bound by them. Thank you for choosing Voxanne AI.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
