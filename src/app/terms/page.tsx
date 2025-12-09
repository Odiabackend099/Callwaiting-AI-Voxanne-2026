import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
    title: 'Terms of Service | CallWaiting AI',
    description: 'Terms of Service for CallWaiting AI. Usage rules, liability limitations, and subscription terms.',
};

export default function TermsPage() {
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
                <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-8">Terms of Service</h1>
                <p className="text-slate-400 mb-12">Last Updated: December 7, 2025</p>

                <div className="prose prose-invert prose-lg max-w-none">
                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
                        <p>
                            By accessing or using CallWaiting AI (the "Service"), you agree to be bound by these Terms of Service ("Terms").
                            If you do not agree to these Terms, you may not use the Service.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-white mb-4">2. Description of Service</h2>
                        <p>
                            CallWaiting AI provides an automated AI-powered receptionist service that answers phone calls, qualifies leads,
                            and books appointments.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-white mb-4">3. AI Disclaimer and Limitations</h2>
                        <div className="bg-cyan-900/20 border border-cyan-500/30 p-6 rounded-xl">
                            <h3 className="text-xl font-bold text-white mb-3">No Medical Advice</h3>
                            <p className="mb-0">
                                CallWaiting AI is a technological tool for communication. It does <strong>NOT</strong> provide medical advice, diagnosis, or treatment strategies.
                                The AI responses are generated based on configuration and Large Language Models, which may occasionally hallucinate or provide inaccurate information.
                                You agree that you are solely responsible for reviewing all appointments and communications handled by the AI.
                            </p>
                        </div>
                        <p className="mt-6">
                            You acknowledge that the Service uses experimental AI technologies that may have latency, errors, or interruptions.
                            We do not guarantee 100% accuracy in transcription or response generation.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-white mb-4">4. User Account and Responsibilities</h2>
                        <p>You are responsible for:</p>
                        <ul className="list-disc pl-5 space-y-2 text-slate-400">
                            <li>Maintaining the confidentiality of your account credentials.</li>
                            <li>Ensuring your use of the Service complies with all applicable laws, including telemarketing and recording laws (e.g., obtaining consent to record calls where required).</li>
                            <li>Providing accurate business information for the AI to use.</li>
                        </ul>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-white mb-4">5. Subscription and Billing</h2>
                        <p>
                            The Service is billed on a recurring subscription basis. You may cancel your subscription at any time via the dashboard.
                            Refunds are provided at our sole discretion or as required by law.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-white mb-4">6. Limitation of Liability</h2>
                        <p className="uppercase text-slate-300">
                            To the maximum extent permitted by law, CallWaiting AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages,
                            including loss of profits, data, or goodwill, arising out of your use of the Service. Our total liability shall not exceed the amount
                            you paid us in the past 12 months.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-white mb-4">7. Termination</h2>
                        <p>
                            We reserve the right to suspend or terminate your access to the Service at our sole discretion, without notice,
                            for conduct that we believe violates these Terms or is harmful to other users of the Service, us, or third parties, or for any other reason.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-white mb-4">8. Changes to Terms</h2>
                        <p>
                            We may modify these Terms at any time. Your continued use of the Service constitutes agreement to the updated Terms.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-white mb-4">9. Contact</h2>
                        <p>
                            Questions regarding these Terms should be sent to:
                            <br />
                            <a href="mailto:legal@callwaitingai.dev" className="text-cyan-400 hover:text-cyan-300">legal@callwaitingai.dev</a>
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
