import React from 'react';
import { ShieldCheck, Lock, Server, FileText, Eye, AlertTriangle, CheckCircle, Phone, Mail } from 'lucide-react';
import Link from 'next/link';
import NavbarRedesigned from '@/components/NavbarRedesigned';
import FooterRedesigned from '@/components/FooterRedesigned';

export default function HIPAACompliancePage() {
    return (
        <>
        <NavbarRedesigned />
        <div className="min-h-screen bg-slate-50 py-20 px-6">
            <div className="max-w-5xl mx-auto">
                {/* Hero Section */}
                <div className="bg-gradient-to-br from-surgical-600 to-surgical-800 text-white p-12 rounded-2xl shadow-xl mb-12">
                    <div className="flex items-center gap-4 mb-6">
                        <ShieldCheck className="h-16 w-16" />
                        <div>
                            <h1 className="text-5xl font-bold mb-2">HIPAA Compliance</h1>
                            <p className="text-surgical-100 text-xl">
                                Enterprise-Grade Security for Healthcare Providers
                            </p>
                        </div>
                    </div>
                    <p className="text-surgical-50 text-lg leading-relaxed">
                        Voxanne AI is designed from the ground up to meet HIPAA (Health Insurance Portability and Accountability Act)
                        requirements, ensuring your patient data is protected with industry-leading security measures.
                    </p>
                </div>

                {/* Main Content */}
                <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 mb-8">
                    <div className="prose prose-slate prose-lg max-w-none">
                        <p className="text-slate-500 text-sm mb-8">Last Updated: January 30, 2026</p>

                        {/* Table of Contents */}
                        <div className="bg-slate-50 p-6 rounded-lg mb-12 border border-slate-200">
                            <h2 className="text-2xl font-bold text-slate-900 mb-4 mt-0">Table of Contents</h2>
                            <nav className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {[
                                    { href: '#overview', title: '1. HIPAA Overview' },
                                    { href: '#phi-definition', title: '2. What is PHI?' },
                                    { href: '#security-safeguards', title: '3. Security Safeguards' },
                                    { href: '#encryption', title: '4. Encryption Standards' },
                                    { href: '#access-controls', title: '5. Access Controls' },
                                    { href: '#baa', title: '6. Business Associate Agreement' },
                                    { href: '#breach-notification', title: '7. Breach Notification' },
                                    { href: '#patient-rights', title: '8. Patient Rights' },
                                    { href: '#certifications', title: '9. Compliance Certifications' },
                                    { href: '#contact', title: '10. Contact Information' },
                                ].map((item) => (
                                    <a
                                        key={item.href}
                                        href={item.href}
                                        className="text-surgical-600 hover:text-surgical-700 hover:underline transition-colors"
                                    >
                                        {item.title}
                                    </a>
                                ))}
                            </nav>
                        </div>

                        {/* Section 1: HIPAA Overview */}
                        <section id="overview" className="mb-12 scroll-mt-8">
                            <div className="flex items-center gap-3 mb-4">
                                <FileText className="h-8 w-8 text-surgical-600" />
                                <h2 className="text-3xl font-bold text-slate-900 m-0">1. HIPAA Overview</h2>
                            </div>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">What is HIPAA?</h3>
                            <p className="text-slate-700 leading-relaxed">
                                The Health Insurance Portability and Accountability Act (HIPAA) is a federal law enacted in 1996
                                to protect sensitive patient health information from being disclosed without patient consent or knowledge.
                                HIPAA establishes national standards for the protection of Protected Health Information (PHI).
                            </p>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Why HIPAA Matters for Healthcare Providers</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                As a healthcare provider, you are legally required to:
                            </p>
                            <ul className="space-y-2 text-slate-700">
                                <li><strong>Protect patient privacy:</strong> Safeguard all PHI from unauthorized access or disclosure</li>
                                <li><strong>Ensure data security:</strong> Implement technical, administrative, and physical safeguards</li>
                                <li><strong>Work with compliant vendors:</strong> Ensure all third-party service providers sign Business Associate Agreements (BAAs)</li>
                                <li><strong>Report breaches:</strong> Notify patients and HHS within 60 days of discovering a data breach</li>
                                <li><strong>Train your workforce:</strong> Ensure all staff understand HIPAA requirements and your privacy policies</li>
                            </ul>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Our Commitment to HIPAA Compliance</h3>
                            <p className="text-slate-700 leading-relaxed">
                                Voxanne AI is committed to full HIPAA compliance. We understand the critical importance of protecting
                                patient health information and have implemented comprehensive security measures across our entire platform.
                                We work exclusively with HIPAA-compliant infrastructure providers and are prepared to sign Business Associate
                                Agreements with all covered entities and healthcare providers.
                            </p>

                            <div className="bg-surgical-50 border-l-4 border-surgical-600 p-6 rounded-r-lg mt-6">
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="h-6 w-6 text-surgical-600 flex-shrink-0 mt-1" />
                                    <div>
                                        <p className="font-semibold text-slate-900 mb-2">Enterprise BAA Available</p>
                                        <p className="text-slate-700 text-sm">
                                            Business Associate Agreements are available for all enterprise customers. Contact our sales team
                                            at <a href="mailto:sales@voxanne.ai" className="text-surgical-600 hover:underline">sales@voxanne.ai</a> to
                                            request a BAA.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 2: PHI Definition */}
                        <section id="phi-definition" className="mb-12 scroll-mt-8">
                            <div className="flex items-center gap-3 mb-4">
                                <Eye className="h-8 w-8 text-surgical-600" />
                                <h2 className="text-3xl font-bold text-slate-900 m-0">2. What is Protected Health Information (PHI)?</h2>
                            </div>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Definition of PHI</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                Protected Health Information (PHI) is any individually identifiable health information that is transmitted
                                or maintained in any form or medium by a covered entity or its business associates. PHI includes:
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <h4 className="font-semibold text-slate-900 mb-2">Demographic Information</h4>
                                    <ul className="text-sm text-slate-700 space-y-1">
                                        <li>• Patient names</li>
                                        <li>• Addresses (street, city, ZIP)</li>
                                        <li>• Phone numbers</li>
                                        <li>• Email addresses</li>
                                        <li>• Dates of birth</li>
                                        <li>• Social Security numbers</li>
                                    </ul>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <h4 className="font-semibold text-slate-900 mb-2">Medical Information</h4>
                                    <ul className="text-sm text-slate-700 space-y-1">
                                        <li>• Medical record numbers</li>
                                        <li>• Diagnoses and conditions</li>
                                        <li>• Treatment information</li>
                                        <li>• Prescription details</li>
                                        <li>• Lab results</li>
                                        <li>• Insurance information</li>
                                    </ul>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <h4 className="font-semibold text-slate-900 mb-2">Communication Records</h4>
                                    <ul className="text-sm text-slate-700 space-y-1">
                                        <li>• Call recordings</li>
                                        <li>• Voicemail transcripts</li>
                                        <li>• SMS messages</li>
                                        <li>• Email correspondence</li>
                                        <li>• Appointment notes</li>
                                        <li>• Patient inquiries</li>
                                    </ul>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <h4 className="font-semibold text-slate-900 mb-2">Unique Identifiers</h4>
                                    <ul className="text-sm text-slate-700 space-y-1">
                                        <li>• Medical record numbers</li>
                                        <li>• Health plan numbers</li>
                                        <li>• Account numbers</li>
                                        <li>• Device identifiers</li>
                                        <li>• IP addresses (in some contexts)</li>
                                        <li>• Biometric identifiers</li>
                                    </ul>
                                </div>
                            </div>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">How Voxanne AI Handles PHI</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                Voxanne AI processes and stores the following types of PHI on behalf of healthcare providers:
                            </p>
                            <ul className="space-y-3 text-slate-700">
                                <li>
                                    <strong>Call Recordings & Transcripts:</strong> When patients call your practice, their conversations
                                    with our AI voice agent may contain PHI such as symptoms, medication questions, or appointment preferences.
                                    All recordings and transcripts are encrypted and stored securely.
                                </li>
                                <li>
                                    <strong>Patient Contact Information:</strong> We store patient names, phone numbers, email addresses,
                                    and appointment details to facilitate scheduling and follow-up communications.
                                </li>
                                <li>
                                    <strong>Appointment Data:</strong> We access your Google Calendar to check availability and book appointments.
                                    This may include patient names and appointment types (e.g., "Annual Checkup," "Botox Consultation").
                                </li>
                                <li>
                                    <strong>Medical Queries:</strong> Patients may ask questions about medical procedures, treatments, or
                                    conditions. Our AI responds using your knowledge base but does not provide medical advice.
                                </li>
                            </ul>

                            <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-r-lg mt-6">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-1" />
                                    <div>
                                        <p className="font-semibold text-slate-900 mb-2">Important: PHI Redaction</p>
                                        <p className="text-slate-700 text-sm">
                                            Voxanne AI automatically redacts certain types of PHI (such as Social Security numbers, credit card
                                            numbers, and explicit diagnoses) from stored transcripts to minimize risk. However, you should
                                            configure your AI agent to avoid asking for highly sensitive information unless necessary.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 3: Security Safeguards */}
                        <section id="security-safeguards" className="mb-12 scroll-mt-8">
                            <div className="flex items-center gap-3 mb-4">
                                <Lock className="h-8 w-8 text-surgical-600" />
                                <h2 className="text-3xl font-bold text-slate-900 m-0">3. Security Safeguards</h2>
                            </div>

                            <p className="text-slate-700 leading-relaxed mb-6">
                                HIPAA requires covered entities and business associates to implement administrative, physical, and technical
                                safeguards to protect PHI. Voxanne AI adheres to all three categories of safeguards:
                            </p>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Administrative Safeguards</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                Administrative safeguards are policies and procedures designed to manage the selection, development,
                                implementation, and maintenance of security measures to protect PHI.
                            </p>
                            <ul className="space-y-2 text-slate-700">
                                <li><strong>Security Management Process:</strong> We conduct annual risk assessments to identify vulnerabilities and implement corrective actions</li>
                                <li><strong>Workforce Training:</strong> All employees complete HIPAA training upon hire and annually thereafter</li>
                                <li><strong>Access Authorization:</strong> Role-based access control (RBAC) ensures employees only access PHI necessary for their job functions</li>
                                <li><strong>Workforce Clearance:</strong> Background checks are conducted for all employees with access to PHI</li>
                                <li><strong>Incident Response:</strong> We maintain a documented incident response plan for security breaches</li>
                                <li><strong>Contingency Planning:</strong> Disaster recovery and backup procedures ensure data availability</li>
                            </ul>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Physical Safeguards</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                Physical safeguards protect the physical systems, buildings, and equipment where PHI is stored.
                            </p>
                            <ul className="space-y-2 text-slate-700">
                                <li><strong>Data Center Security:</strong> Our infrastructure providers (Supabase, Google Cloud) operate SOC 2 Type II certified data centers with 24/7 physical security</li>
                                <li><strong>Access Controls:</strong> Biometric authentication and keycard access restrict entry to server rooms</li>
                                <li><strong>Device Security:</strong> All employee laptops are encrypted with BitLocker (Windows) or FileVault (Mac)</li>
                                <li><strong>Workstation Security:</strong> Automatic screen locks after 5 minutes of inactivity</li>
                                <li><strong>Media Disposal:</strong> Hard drives are securely wiped or physically destroyed before disposal</li>
                            </ul>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Technical Safeguards</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                Technical safeguards are the technology and policies that protect PHI and control access to it.
                            </p>
                            <ul className="space-y-2 text-slate-700">
                                <li><strong>Access Control:</strong> Unique user IDs, automatic logoff after 15 minutes, and multi-factor authentication (MFA) for administrative access</li>
                                <li><strong>Audit Controls:</strong> All access to PHI is logged with immutable audit trails retained for 7 years</li>
                                <li><strong>Integrity Controls:</strong> Digital signatures and checksums verify data has not been altered</li>
                                <li><strong>Transmission Security:</strong> TLS 1.3 encryption for all data transmitted over networks</li>
                                <li><strong>Encryption:</strong> AES-256 encryption for all PHI stored at rest (see Section 4)</li>
                            </ul>
                        </section>

                        {/* Section 4: Encryption Standards */}
                        <section id="encryption" className="mb-12 scroll-mt-8">
                            <div className="flex items-center gap-3 mb-4">
                                <Server className="h-8 w-8 text-surgical-600" />
                                <h2 className="text-3xl font-bold text-slate-900 m-0">4. Encryption Standards</h2>
                            </div>

                            <p className="text-slate-700 leading-relaxed mb-6">
                                Encryption is one of the most critical technical safeguards for protecting PHI. Voxanne AI uses
                                industry-leading encryption standards to protect data both at rest and in transit.
                            </p>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Encryption at Rest (Stored Data)</h3>
                            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mb-6">
                                <p className="text-slate-700 leading-relaxed mb-4">
                                    All PHI stored in our database is encrypted using <strong>AES-256 encryption</strong>,
                                    the same encryption standard used by banks and government agencies.
                                </p>
                                <ul className="space-y-2 text-slate-700">
                                    <li><strong>Algorithm:</strong> AES-256 (Advanced Encryption Standard with 256-bit keys)</li>
                                    <li><strong>Key Management:</strong> Encryption keys are stored separately from data and rotated every 90 days</li>
                                    <li><strong>Database Provider:</strong> Supabase (SOC 2 Type II certified, HIPAA-compliant infrastructure)</li>
                                    <li><strong>Backup Encryption:</strong> All database backups are encrypted with the same AES-256 standard</li>
                                    <li><strong>Media Encryption:</strong> Call recordings stored in cloud storage are encrypted at rest</li>
                                </ul>
                            </div>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Encryption in Transit (Data Transmission)</h3>
                            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mb-6">
                                <p className="text-slate-700 leading-relaxed mb-4">
                                    All PHI transmitted over networks (including the internet) is encrypted using <strong>TLS 1.3</strong>,
                                    the latest and most secure version of Transport Layer Security.
                                </p>
                                <ul className="space-y-2 text-slate-700">
                                    <li><strong>Protocol:</strong> TLS 1.3 (Transport Layer Security 1.3)</li>
                                    <li><strong>Certificate Authority:</strong> Let's Encrypt (industry-standard SSL certificates)</li>
                                    <li><strong>API Communications:</strong> All API calls between frontend, backend, and third-party services use HTTPS/TLS 1.3</li>
                                    <li><strong>Voice Calls:</strong> Voice data transmitted via Vapi and Twilio is encrypted end-to-end using SRTP (Secure Real-time Transport Protocol)</li>
                                    <li><strong>Webhook Delivery:</strong> All webhook payloads containing PHI are transmitted over TLS 1.3</li>
                                </ul>
                            </div>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">End-to-End Encryption for Voice Calls</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                Phone calls between patients and our AI voice agent are encrypted from end to end:
                            </p>
                            <ul className="space-y-2 text-slate-700">
                                <li><strong>Patient to Twilio:</strong> PSTN call encrypted by carrier (varies by carrier)</li>
                                <li><strong>Twilio to Vapi:</strong> SRTP (Secure Real-time Transport Protocol) encryption</li>
                                <li><strong>Vapi to AI Model:</strong> TLS 1.3 encrypted API calls</li>
                                <li><strong>Storage:</strong> Call recordings encrypted with AES-256 and stored in compliance with retention policies</li>
                            </ul>

                            <div className="bg-surgical-50 border-l-4 border-surgical-600 p-6 rounded-r-lg mt-6">
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="h-6 w-6 text-surgical-600 flex-shrink-0 mt-1" />
                                    <div>
                                        <p className="font-semibold text-slate-900 mb-2">Encryption Key Management</p>
                                        <p className="text-slate-700 text-sm">
                                            Encryption keys are managed using industry best practices: keys are stored in secure hardware
                                            security modules (HSMs), rotated every 90 days, and never transmitted in plaintext. Access to
                                            encryption keys is restricted to authorized security personnel only.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 5: Access Controls */}
                        <section id="access-controls" className="mb-12 scroll-mt-8">
                            <div className="flex items-center gap-3 mb-4">
                                <Lock className="h-8 w-8 text-surgical-600" />
                                <h2 className="text-3xl font-bold text-slate-900 m-0">5. Access Controls</h2>
                            </div>

                            <p className="text-slate-700 leading-relaxed mb-6">
                                Access controls ensure that only authorized individuals can access PHI, and only to the extent necessary
                                for their job functions. Voxanne AI implements multiple layers of access control:
                            </p>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Role-Based Access Control (RBAC)</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                Users are assigned roles based on their responsibilities, and each role has specific permissions:
                            </p>
                            <div className="overflow-x-auto mb-6">
                                <table className="min-w-full bg-white border border-slate-200 rounded-lg">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900 border-b">Role</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900 border-b">Permissions</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900 border-b">PHI Access</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm text-slate-700">
                                        <tr className="border-b">
                                            <td className="px-4 py-3 font-medium">Practice Administrator</td>
                                            <td className="px-4 py-3">Full access to all features, settings, and patient data</td>
                                            <td className="px-4 py-3">Full access to all PHI</td>
                                        </tr>
                                        <tr className="border-b">
                                            <td className="px-4 py-3 font-medium">Office Manager</td>
                                            <td className="px-4 py-3">View patient data, manage appointments, configure AI agent</td>
                                            <td className="px-4 py-3">Limited to patient contact info and appointments</td>
                                        </tr>
                                        <tr className="border-b">
                                            <td className="px-4 py-3 font-medium">Receptionist</td>
                                            <td className="px-4 py-3">View call logs, listen to recordings, send follow-up messages</td>
                                            <td className="px-4 py-3">Limited to call data and contact info</td>
                                        </tr>
                                        <tr className="border-b">
                                            <td className="px-4 py-3 font-medium">Billing Staff</td>
                                            <td className="px-4 py-3">View patient contact info, export billing reports</td>
                                            <td className="px-4 py-3">No access to call recordings or medical queries</td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-3 font-medium">Read-Only User</td>
                                            <td className="px-4 py-3">View-only access to analytics and reports</td>
                                            <td className="px-4 py-3">De-identified data only (no PHI)</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Multi-Factor Authentication (MFA)</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                All user accounts with access to PHI are required to use multi-factor authentication:
                            </p>
                            <ul className="space-y-2 text-slate-700">
                                <li><strong>Primary Authentication:</strong> Username and password (minimum 12 characters, complexity requirements)</li>
                                <li><strong>Secondary Authentication:</strong> Time-based one-time password (TOTP) via authenticator app (Google Authenticator, Authy, etc.)</li>
                                <li><strong>Enforcement:</strong> MFA is mandatory for all users; cannot be disabled without administrator approval</li>
                                <li><strong>Recovery Codes:</strong> Users receive 10 recovery codes for account recovery if they lose their authenticator device</li>
                            </ul>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Audit Logging</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                All access to PHI is logged in immutable audit trails:
                            </p>
                            <ul className="space-y-2 text-slate-700">
                                <li><strong>Events Logged:</strong> Login/logout, PHI viewing, data modifications, report generation, settings changes</li>
                                <li><strong>Information Captured:</strong> User ID, timestamp, IP address, action performed, data accessed</li>
                                <li><strong>Retention Period:</strong> 7 years (HIPAA requirement)</li>
                                <li><strong>Access to Logs:</strong> Restricted to security administrators and compliance officers</li>
                                <li><strong>Monitoring:</strong> Automated alerts for suspicious activity (e.g., multiple failed login attempts, unusual data access patterns)</li>
                            </ul>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Session Management</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                To prevent unauthorized access, we enforce strict session management policies:
                            </p>
                            <ul className="space-y-2 text-slate-700">
                                <li><strong>Automatic Timeout:</strong> Sessions expire after 15 minutes of inactivity</li>
                                <li><strong>Session Revocation:</strong> Users can view and revoke active sessions from the security settings page</li>
                                <li><strong>Force Logout:</strong> Administrators can force logout all users in case of security incident</li>
                                <li><strong>Concurrent Session Limits:</strong> Users can have a maximum of 3 concurrent sessions</li>
                            </ul>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Principle of Least Privilege</h3>
                            <p className="text-slate-700 leading-relaxed">
                                We adhere to the principle of least privilege: users are granted the minimum level of access necessary
                                to perform their job functions. Access rights are reviewed quarterly and adjusted as roles change.
                            </p>
                        </section>

                        {/* Section 6: Business Associate Agreement */}
                        <section id="baa" className="mb-12 scroll-mt-8">
                            <div className="flex items-center gap-3 mb-4">
                                <FileText className="h-8 w-8 text-surgical-600" />
                                <h2 className="text-3xl font-bold text-slate-900 m-0">6. Business Associate Agreement (BAA)</h2>
                            </div>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">What is a Business Associate Agreement?</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                A Business Associate Agreement (BAA) is a written contract required by HIPAA between a covered entity
                                (healthcare provider) and a business associate (service provider like Voxanne AI) that creates, receives,
                                maintains, or transmits PHI on behalf of the covered entity.
                            </p>

                            <p className="text-slate-700 leading-relaxed mb-4">
                                The BAA ensures that the business associate:
                            </p>
                            <ul className="space-y-2 text-slate-700">
                                <li>Implements appropriate safeguards to protect PHI</li>
                                <li>Reports any security incidents or breaches to the covered entity</li>
                                <li>Ensures its subcontractors (if any) also comply with HIPAA</li>
                                <li>Returns or destroys PHI when the relationship ends</li>
                                <li>Allows the covered entity to audit compliance</li>
                            </ul>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">When is a BAA Required?</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                A BAA is required whenever a business associate will create, receive, maintain, or transmit PHI on behalf
                                of a covered entity. If you are a healthcare provider (doctor, dentist, chiropractor, therapist, etc.)
                                using Voxanne AI to handle patient calls and appointments, <strong>you must have a signed BAA with us</strong>.
                            </p>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">How to Request a BAA</h3>
                            <div className="bg-surgical-50 border border-surgical-200 p-6 rounded-lg mb-6">
                                <p className="text-slate-700 leading-relaxed mb-4">
                                    Business Associate Agreements are available for all enterprise customers at no additional charge.
                                    To request a BAA:
                                </p>
                                <ol className="space-y-2 text-slate-700 list-decimal list-inside">
                                    <li>Contact our sales team at <a href="mailto:sales@voxanne.ai" className="text-surgical-600 hover:underline font-semibold">sales@voxanne.ai</a></li>
                                    <li>Provide your practice name, contact information, and intended use case</li>
                                    <li>Review our standard BAA template (we can accommodate reasonable modifications)</li>
                                    <li>Sign electronically via DocuSign or wet signature</li>
                                    <li>We will countersign and provide you with a fully executed copy within 3 business days</li>
                                </ol>
                            </div>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Our BAA with Infrastructure Providers</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                As a business associate, we are also required to have BAAs with our subcontractors that handle PHI.
                                Voxanne AI has signed BAAs with the following infrastructure providers:
                            </p>
                            <ul className="space-y-2 text-slate-700">
                                <li><strong>Supabase:</strong> Database and authentication provider (SOC 2 Type II certified, HIPAA-compliant infrastructure)</li>
                                <li><strong>Twilio:</strong> Telephony and SMS provider (HIPAA-eligible, BAA available)</li>
                                <li><strong>Google Cloud:</strong> Infrastructure provider for AI models and storage (HIPAA-compliant, BAA signed)</li>
                                <li><strong>Vapi:</strong> Voice AI platform (HIPAA-eligible, BAA available)</li>
                            </ul>

                            <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-r-lg mt-6">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-1" />
                                    <div>
                                        <p className="font-semibold text-slate-900 mb-2">Important: Wallet Funding Requirement</p>
                                        <p className="text-slate-700 text-sm">
                                            BAAs require an active, funded account. If you are a healthcare provider subject to HIPAA,
                                            ensure your wallet is funded before processing PHI. Contact sales@voxanne.ai to discuss
                                            BAA execution and compliance requirements.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 7: Breach Notification */}
                        <section id="breach-notification" className="mb-12 scroll-mt-8">
                            <div className="flex items-center gap-3 mb-4">
                                <AlertTriangle className="h-8 w-8 text-surgical-600" />
                                <h2 className="text-3xl font-bold text-slate-900 m-0">7. Breach Notification Procedures</h2>
                            </div>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">What is a Data Breach?</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                Under HIPAA, a breach is defined as the unauthorized acquisition, access, use, or disclosure of PHI that
                                compromises the security or privacy of the information. Examples include:
                            </p>
                            <ul className="space-y-2 text-slate-700">
                                <li>Hacking or ransomware attack resulting in PHI exposure</li>
                                <li>Lost or stolen laptop/device containing unencrypted PHI</li>
                                <li>Accidental email of PHI to wrong recipient</li>
                                <li>Unauthorized employee accessing patient records</li>
                                <li>Vendor security incident affecting PHI</li>
                            </ul>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Our Breach Response Plan</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                If we discover a breach of PHI, we follow a comprehensive incident response plan:
                            </p>

                            <div className="space-y-4 mb-6">
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <h4 className="font-semibold text-slate-900 mb-2">Step 1: Detection & Containment (Within 24 Hours)</h4>
                                    <ul className="text-sm text-slate-700 space-y-1">
                                        <li>• Identify the source and scope of the breach</li>
                                        <li>• Immediately contain the breach to prevent further exposure</li>
                                        <li>• Preserve evidence for forensic investigation</li>
                                        <li>• Activate incident response team</li>
                                    </ul>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <h4 className="font-semibold text-slate-900 mb-2">Step 2: Assessment (Within 48 Hours)</h4>
                                    <ul className="text-sm text-slate-700 space-y-1">
                                        <li>• Conduct forensic investigation to determine what PHI was exposed</li>
                                        <li>• Identify all affected individuals and covered entities</li>
                                        <li>• Assess risk of harm to individuals (identity theft, financial loss, etc.)</li>
                                        <li>• Document findings in incident report</li>
                                    </ul>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <h4 className="font-semibold text-slate-900 mb-2">Step 3: Notification (Within 60 Days)</h4>
                                    <ul className="text-sm text-slate-700 space-y-1">
                                        <li>• Notify all affected covered entities (healthcare providers) without unreasonable delay</li>
                                        <li>• Provide details: what happened, what PHI was exposed, steps we're taking</li>
                                        <li>• Assist covered entities in notifying affected individuals (if required)</li>
                                        <li>• Report breach to HHS if affecting 500+ individuals</li>
                                    </ul>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <h4 className="font-semibold text-slate-900 mb-2">Step 4: Remediation & Prevention (Ongoing)</h4>
                                    <ul className="text-sm text-slate-700 space-y-1">
                                        <li>• Implement corrective actions to prevent recurrence</li>
                                        <li>• Conduct post-incident review to identify lessons learned</li>
                                        <li>• Update security policies and procedures as needed</li>
                                        <li>• Provide additional workforce training if human error was involved</li>
                                    </ul>
                                </div>
                            </div>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Your Responsibilities as a Covered Entity</h3>
                            <p className="text-slate-700 leading-relaxed mb-4">
                                If we notify you of a breach affecting your patients, you are responsible for:
                            </p>
                            <ul className="space-y-2 text-slate-700">
                                <li>Notifying affected individuals without unreasonable delay (and no later than 60 days from discovery)</li>
                                <li>Providing notice in writing (first-class mail or email if the individual agreed to electronic notice)</li>
                                <li>Reporting the breach to HHS (if affecting 500+ individuals, within 60 days; if fewer than 500, annual report)</li>
                                <li>Reporting to media (if breach affects 500+ individuals in your state/jurisdiction)</li>
                                <li>Documenting the breach and your response for compliance audits</li>
                            </ul>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Contact Us for Security Incidents</h3>
                            <div className="bg-red-50 border border-red-200 p-6 rounded-lg mb-6">
                                <p className="text-slate-700 leading-relaxed mb-4">
                                    If you suspect a security incident or breach involving Voxanne AI, please contact us immediately:
                                </p>
                                <div className="flex flex-col gap-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-red-600" />
                                        <span className="font-semibold">Email:</span>
                                        <a href="mailto:security@voxanne.ai" className="text-surgical-600 hover:underline">security@voxanne.ai</a>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-red-600" />
                                        <span className="font-semibold">Emergency Hotline:</span>
                                        <span>Available 24/7 for security incidents</span>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-600 mt-4">
                                    We take all security incidents seriously and will investigate promptly. Do not attempt to investigate
                                    the incident yourself as this may compromise evidence.
                                </p>
                            </div>
                        </section>

                        {/* Section 8: Patient Rights */}
                        <section id="patient-rights" className="mb-12 scroll-mt-8">
                            <div className="flex items-center gap-3 mb-4">
                                <Eye className="h-8 w-8 text-surgical-600" />
                                <h2 className="text-3xl font-bold text-slate-900 m-0">8. Patient Rights Under HIPAA</h2>
                            </div>

                            <p className="text-slate-700 leading-relaxed mb-6">
                                HIPAA grants patients specific rights regarding their PHI. As a business associate processing PHI on behalf
                                of healthcare providers, we support these rights:
                            </p>

                            <div className="space-y-6">
                                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                                    <h3 className="text-xl font-semibold text-slate-900 mb-3">Right to Access</h3>
                                    <p className="text-slate-700 mb-3">
                                        Patients have the right to access their PHI, including call recordings and transcripts. Upon request
                                        from a covered entity, we will provide copies of PHI within 30 days.
                                    </p>
                                    <p className="text-sm text-slate-600">
                                        <strong>Note:</strong> Patients should make access requests directly to their healthcare provider,
                                        not to Voxanne AI. The covered entity is responsible for fulfilling access requests.
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                                    <h3 className="text-xl font-semibold text-slate-900 mb-3">Right to Amendment</h3>
                                    <p className="text-slate-700 mb-3">
                                        Patients have the right to request amendments to their PHI if they believe it is inaccurate or incomplete.
                                        We will make amendments upon instruction from the covered entity.
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                                    <h3 className="text-xl font-semibold text-slate-900 mb-3">Right to Accounting of Disclosures</h3>
                                    <p className="text-slate-700 mb-3">
                                        Patients have the right to receive a list of disclosures of their PHI. Our audit logs capture all
                                        disclosures, and we will provide accounting reports upon request from the covered entity.
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                                    <h3 className="text-xl font-semibold text-slate-900 mb-3">Right to Request Restrictions</h3>
                                    <p className="text-slate-700 mb-3">
                                        Patients have the right to request restrictions on how their PHI is used or disclosed. While we are
                                        not required to agree to all restrictions, we will accommodate reasonable requests when instructed
                                        by the covered entity.
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                                    <h3 className="text-xl font-semibold text-slate-900 mb-3">Right to Confidential Communications</h3>
                                    <p className="text-slate-700 mb-3">
                                        Patients have the right to request that communications containing PHI be sent to alternative locations
                                        or by alternative means. This is managed by the covered entity.
                                    </p>
                                </div>

                                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                                    <h3 className="text-xl font-semibold text-slate-900 mb-3">Right to Be Notified of Breaches</h3>
                                    <p className="text-slate-700 mb-3">
                                        Patients have the right to be notified if their unsecured PHI is breached. We will notify covered
                                        entities of any breaches, and the covered entity is responsible for notifying affected patients.
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Section 9: Compliance Certifications */}
                        <section id="certifications" className="mb-12 scroll-mt-8">
                            <div className="flex items-center gap-3 mb-4">
                                <CheckCircle className="h-8 w-8 text-surgical-600" />
                                <h2 className="text-3xl font-bold text-slate-900 m-0">9. Compliance Certifications</h2>
                            </div>

                            <p className="text-slate-700 leading-relaxed mb-6">
                                Voxanne AI and our infrastructure providers maintain industry-leading security certifications:
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div className="bg-surgical-50 p-6 rounded-lg border border-surgical-200">
                                    <h3 className="text-lg font-semibold text-slate-900 mb-3">SOC 2 Type II</h3>
                                    <p className="text-sm text-slate-700 mb-3">
                                        Our infrastructure providers (Supabase, Google Cloud) are SOC 2 Type II certified, demonstrating
                                        effective controls for security, availability, processing integrity, confidentiality, and privacy.
                                    </p>
                                    <p className="text-xs text-slate-600">
                                        Voxanne AI is currently undergoing SOC 2 Type II audit (expected completion: Q2 2026).
                                    </p>
                                </div>

                                <div className="bg-surgical-50 p-6 rounded-lg border border-surgical-200">
                                    <h3 className="text-lg font-semibold text-slate-900 mb-3">HIPAA Compliance</h3>
                                    <p className="text-sm text-slate-700 mb-3">
                                        All infrastructure providers have signed BAAs and maintain HIPAA-compliant infrastructure.
                                        Voxanne AI adheres to all HIPAA Security Rule and Privacy Rule requirements.
                                    </p>
                                    <p className="text-xs text-slate-600">
                                        Annual security assessments conducted to verify ongoing compliance.
                                    </p>
                                </div>

                                <div className="bg-surgical-50 p-6 rounded-lg border border-surgical-200">
                                    <h3 className="text-lg font-semibold text-slate-900 mb-3">GDPR Compliance</h3>
                                    <p className="text-sm text-slate-700 mb-3">
                                        For European and UK customers, we comply with GDPR requirements including data subject rights,
                                        data retention policies, and international data transfer mechanisms (SCCs).
                                    </p>
                                </div>

                                <div className="bg-surgical-50 p-6 rounded-lg border border-surgical-200">
                                    <h3 className="text-lg font-semibold text-slate-900 mb-3">Penetration Testing</h3>
                                    <p className="text-sm text-slate-700 mb-3">
                                        We conduct annual third-party penetration testing to identify and remediate security vulnerabilities
                                        before they can be exploited.
                                    </p>
                                    <p className="text-xs text-slate-600">
                                        Last penetration test: December 2025. Next scheduled: December 2026.
                                    </p>
                                </div>
                            </div>

                            <h3 className="text-2xl font-semibold text-slate-800 mt-8 mb-4">Ongoing Security Assessments</h3>
                            <ul className="space-y-2 text-slate-700">
                                <li><strong>Annual Risk Assessments:</strong> Comprehensive review of security posture and risk mitigation strategies</li>
                                <li><strong>Quarterly Vulnerability Scans:</strong> Automated scanning for known vulnerabilities in infrastructure</li>
                                <li><strong>Monthly Security Reviews:</strong> Review of access logs, incident reports, and security metrics</li>
                                <li><strong>Continuous Monitoring:</strong> 24/7 security monitoring with automated alerts for anomalous activity</li>
                            </ul>
                        </section>

                        {/* Section 10: Contact Information */}
                        <section id="contact" className="mb-12 scroll-mt-8">
                            <div className="flex items-center gap-3 mb-4">
                                <Phone className="h-8 w-8 text-surgical-600" />
                                <h2 className="text-3xl font-bold text-slate-900 m-0">10. Contact Information</h2>
                            </div>

                            <p className="text-slate-700 leading-relaxed mb-6">
                                For questions about HIPAA compliance, security measures, or to request a Business Associate Agreement:
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Security Officer</h3>
                                    <div className="space-y-2 text-sm text-slate-700">
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-4 w-4 text-surgical-600" />
                                            <a href="mailto:security@voxanne.ai" className="text-surgical-600 hover:underline">
                                                security@voxanne.ai
                                            </a>
                                        </div>
                                        <p className="text-xs text-slate-600">
                                            For security incidents, vulnerability reports, and security-related inquiries.
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Privacy Officer</h3>
                                    <div className="space-y-2 text-sm text-slate-700">
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-4 w-4 text-surgical-600" />
                                            <a href="mailto:privacy@voxanne.ai" className="text-surgical-600 hover:underline">
                                                privacy@voxanne.ai
                                            </a>
                                        </div>
                                        <p className="text-xs text-slate-600">
                                            For privacy policy questions, patient rights requests, and data access inquiries.
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Business Associate Agreements</h3>
                                    <div className="space-y-2 text-sm text-slate-700">
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-4 w-4 text-surgical-600" />
                                            <a href="mailto:sales@voxanne.ai" className="text-surgical-600 hover:underline">
                                                sales@voxanne.ai
                                            </a>
                                        </div>
                                        <p className="text-xs text-slate-600">
                                            For BAA requests, enterprise contracts, and compliance documentation.
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                                    <h3 className="text-lg font-semibold text-slate-900 mb-4">General Support</h3>
                                    <div className="space-y-2 text-sm text-slate-700">
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-4 w-4 text-surgical-600" />
                                            <a href="mailto:support@voxanne.ai" className="text-surgical-600 hover:underline">
                                                support@voxanne.ai
                                            </a>
                                        </div>
                                        <p className="text-xs text-slate-600">
                                            For general customer support, technical issues, and feature questions.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 p-6 bg-slate-50 border border-slate-200 rounded-lg">
                                <h3 className="text-lg font-semibold text-slate-900 mb-3">Mailing Address</h3>
                                <p className="text-slate-700 text-sm">
                                    <strong>Voxanne AI</strong><br />
                                    A product of Call Waiting AI Ltd.<br />
                                    Collage House, 2nd Floor<br />
                                    17 King Edward Road<br />
                                    Ruislip, London HA4 7AE<br />
                                    United Kingdom
                                </p>
                            </div>
                        </section>

                        {/* Footer CTA */}
                        <div className="bg-gradient-to-br from-surgical-600 to-surgical-800 text-white p-8 rounded-xl shadow-lg mt-12">
                            <h3 className="text-2xl font-bold mb-4">Ready to Get Started?</h3>
                            <p className="text-surgical-50 mb-6">
                                Join hundreds of healthcare providers using Voxanne AI to automate patient communications while
                                maintaining HIPAA compliance.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Link
                                    href="/contact-sales"
                                    className="px-6 py-3 bg-white text-surgical-600 font-semibold rounded-lg hover:bg-surgical-50 transition-colors text-center"
                                >
                                    Request a BAA
                                </Link>
                                <Link
                                    href="/#pricing"
                                    className="px-6 py-3 bg-surgical-700 text-white font-semibold rounded-lg hover:bg-surgical-600 transition-colors text-center border border-surgical-500"
                                >
                                    View Pricing
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Back to Top */}
                <div className="text-center mt-8">
                    <a
                        href="#top"
                        className="text-surgical-600 hover:text-surgical-700 font-semibold hover:underline"
                    >
                        Back to Top ↑
                    </a>
                </div>
            </div>
        </div>
        <FooterRedesigned />
        </>
    );
}
