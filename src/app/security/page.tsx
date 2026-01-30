import React from 'react';
import NavbarRedesigned from '@/components/NavbarRedesigned';
import FooterRedesigned from '@/components/FooterRedesigned';
import { ShieldCheck, Lock, Server, FileCheck, Eye } from 'lucide-react';

export const metadata = {
    title: 'Security | Voxanne AI',
    description: 'Security practices and compliance at Voxanne AI. SOC 2, HIPAA, and data encryption standards.',
};

export default function SecurityPage() {
    return (
        <main className="min-h-screen bg-white">
            <NavbarRedesigned />
            <div className="max-w-4xl mx-auto px-6 py-32">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-bold text-navy-900 mb-6">Security & Compliance</h1>
                    <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                        Your patient data is our highest priority. We employ enterprise-grade security measures to ensure your practice remains compliant.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 mb-16">
                    <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                        <div className="h-12 w-12 bg-surgical-100 rounded-xl flex items-center justify-center mb-6">
                            <ShieldCheck className="h-6 w-6 text-surgical-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-navy-900 mb-4">HIPAA Compliance</h2>
                        <p className="text-slate-600">
                            We act as a Business Associate and execute BAAs with all healthcare clients. Our platform is designed with PHI protection at its core, including strict access controls and audit logging.
                        </p>
                    </div>

                    <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                        <div className="h-12 w-12 bg-surgical-100 rounded-xl flex items-center justify-center mb-6">
                            <Lock className="h-6 w-6 text-surgical-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-navy-900 mb-4">Data Encryption</h2>
                        <p className="text-slate-600">
                            All data is encrypted in transit using TLS 1.2+ and at rest using AES-256 encryption. This includes voice recordings, transcripts, and patient metadata.
                        </p>
                    </div>

                    <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                        <div className="h-12 w-12 bg-surgical-100 rounded-xl flex items-center justify-center mb-6">
                            <Server className="h-6 w-6 text-surgical-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-navy-900 mb-4">Infrastructure Security</h2>
                        <p className="text-slate-600">
                            Hosted on SOC 2 Type II certified infrastructure (Supabase/AWS). We utilize isolated environments and regular vulnerability scanning to prevent unauthorized access.
                        </p>
                    </div>

                    <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                        <div className="h-12 w-12 bg-surgical-100 rounded-xl flex items-center justify-center mb-6">
                            <FileCheck className="h-6 w-6 text-surgical-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-navy-900 mb-4">Access Controls</h2>
                        <p className="text-slate-600">
                            Strict Role-Based Access Control (RBAC) ensures only authorized personnel can access sensitive data. We enforce Multi-Factor Authentication (MFA) for all internal administrative access.
                        </p>
                    </div>
                </div>

                <div className="bg-navy-900 rounded-3xl p-8 md:p-12 text-center text-white">
                    <h2 className="text-3xl font-bold mb-6">Report a Vulnerability</h2>
                    <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
                        We value the contributions of the security research community. If you believe you have found a security vulnerability in Voxanne AI, please let us know.
                    </p>
                    <a 
                        href="mailto:security@voxanne.ai" 
                        className="inline-flex items-center gap-2 bg-white text-navy-900 px-8 py-3 rounded-full font-semibold hover:bg-slate-100 transition-colors"
                    >
                        <Eye className="h-5 w-5" />
                        Contact Security Team
                    </a>
                </div>
            </div>
            <FooterRedesigned />
        </main>
    );
}
