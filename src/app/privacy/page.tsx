import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
    title: 'Privacy Policy | CallWaiting AI',
    description: 'Privacy Policy for CallWaiting AI. Learn how we handle your data, voice recordings, and compliance.',
};

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-black text-slate-300 font-sans selection:bg-cyan-500/30">
            {/* Header */}
            <header className="border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="relative w-8 h-8 transition-transform duration-300 group-hover:scale-105">
                            <Image
                                src="/callwaiting-ai-logo.png"
                                alt="CallWaiting AI"
                                fill
                                className="object-contain"
                            />
                        </div>
                        <span className="text-lg font-bold text-white tracking-tight">CallWaiting AI</span>
                    </Link>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-8">Privacy Policy</h1>
                <p className="text-slate-400 mb-12">Last Updated: December 7, 2025</p>

                <div className="prose prose-invert prose-lg max-w-none">
                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-white mb-4">1. Introduction</h2>
                        <p>
                            Welcome to CallWaiting AI ("we," "our," or "us"). We are committed to protecting your privacy and ensuring the security of your data.
                            This Privacy Policy explains how we collect, use, disclosure, and safeguard your information when you use our AI receptionist services,
                            website, and related applications (collectively, the "Service").
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-white mb-4">2. Information We Collect</h2>
                        <h3 className="text-xl font-bold text-white mt-6 mb-3">2.1 Personal Information</h3>
                        <p>We collect information that you provide securely, including:</p>
                        <ul className="list-disc pl-5 space-y-2 text-slate-400">
                            <li>Account information (Name, Email address, Business details).</li>
                            <li>Billing information (processed securely by our payment processors).</li>
                            <li>Configuration data (Opening hours, Service lists, FAQs).</li>
                        </ul>

                        <h3 className="text-xl font-bold text-white mt-6 mb-3">2.2 Voice and Communication Data</h3>
                        <p>To provide our AI receptionist service, we process:</p>
                        <ul className="list-disc pl-5 space-y-2 text-slate-400">
                            <li>Audio recordings of incoming calls handled by the AI.</li>
                            <li>Transcripts of conversations.</li>
                            <li>Caller metadata (Phone numbers, timestamps, call duration).</li>
                            <li>Appointment details booked through the system.</li>
                        </ul>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-white mb-4">3. How We Use Artificial Intelligence</h2>
                        <p>
                            Our Service utilizes advanced Artificial Intelligence (AI) technologies to function. Specifically:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-slate-400">
                            <li><strong>Speech-to-Text:</strong> We use third-party providers (e.g., Deepgram) to transcribe audio in real-time.</li>
                            <li><strong>Language Processing:</strong> We use Large Language Models (LLMs) (e.g., Groq, Llama) to understand intent and generate responses.</li>
                            <li><strong>Text-to-Speech:</strong> We use AI voice synthesis to generate audio responses.</li>
                        </ul>
                        <p className="mt-4">
                            <strong>Note for Clinics:</strong> While use robust security measures, we recommend that you ensure your use of AI tools complies with local regulations regarding patient data (e.g., HIPAA in the US). We act as a Business Associate where applicable, but you remain the Data Controller.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-white mb-4">4. Data Sharing and Disclosure</h2>
                        <p>We do not sell your personal data. We share data only with:</p>
                        <ul className="list-disc pl-5 space-y-2 text-slate-400">
                            <li><strong>Service Providers:</strong> Cloud hosting (Supabase), Telephony (Twilio), and AI processors strictly for the purpose of delivering the service.</li>
                            <li><strong>Legal Compliance:</strong> When required by law or to protect rights and safety.</li>
                        </ul>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-white mb-4">5. Data Security</h2>
                        <p>
                            We implement industry-standard security measures, including encryption in transit and at rest, to protect your data.
                            However, no method of transmission over the Internet is 100% secure.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-white mb-4">6. Your Rights</h2>
                        <p>
                            You have the right to access, correct, or delete your personal information. You can manage your account settings within the dashboard
                            or contact us at support@callwaitingai.dev to request data deletion.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-white mb-4">7. Contact Us</h2>
                        <p>
                            If you have questions about this Privacy Policy, please contact us at:
                            <br />
                            <a href="mailto:support@callwaitingai.dev" className="text-cyan-400 hover:text-cyan-300">support@callwaitingai.dev</a>
                        </p>
                    </section>
                </div>
            </main>

            {/* Simple Footer */}
            <footer className="border-t border-white/10 bg-black py-8">
                <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
                    &copy; {new Date().getFullYear()} CallWaiting AI. All rights reserved.
                </div>
            </footer>
        </div>
    );
}
