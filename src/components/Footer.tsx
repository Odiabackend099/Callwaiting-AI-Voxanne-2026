import Link from 'next/link';
import Image from 'next/image';
import { Mail, MapPin, Phone } from 'lucide-react';
import Logo from "./Logo";

export default function Footer() {
    return (
        <footer className="py-16 bg-black border-t border-white/10 text-zinc-400 text-sm">
            <div className="container px-6 mx-auto max-w-7xl">
                <div className="grid md:grid-cols-4 gap-12 mb-12">
                    {/* Company Info */}
                    <div className="md:col-span-2">
                        <div className="mb-6 flex items-center gap-3">
                            <Logo size="lg" showText={true} href="/" />
                            <span className="text-white font-serif text-3xl font-bold">CallWaiting AI</span>
                        </div>
                        <p className="text-zinc-500 mb-6 leading-relaxed">
                            Transform your practice with AI-powered reception. Never miss a call, never lose a lead.
                        </p>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-zinc-400">
                                <MapPin className="w-4 h-4 text-cyan-400" />
                                <span className="text-xs">Collage House, 2nd Floor, 17 King Edward Road, Ruislip, London HA4 7AE</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-cyan-400" />
                                <a href="tel:+447424038250" className="hover:text-white transition-colors">+44 7424 038250</a>
                            </div>
                            <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-cyan-400" />
                                <a href="mailto:support@callwaitingai.dev" className="hover:text-white transition-colors">support@callwaitingai.dev</a>
                            </div>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="text-white font-semibold mb-4">Product</h3>
                        <ul className="space-y-2">
                            <li><Link href="/#features" className="hover:text-white transition-colors">Features</Link></li>
                            <li><Link href="/#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                            <li><Link href="/dashboard/voice-test" className="hover:text-white transition-colors">Try Demo</Link></li>
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h3 className="text-white font-semibold mb-4">Legal</h3>
                        <ul className="space-y-2">
                            <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                            <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                            <li><Link href="/privacy#cookies" className="hover:text-white transition-colors">Cookie Policy</Link></li>
                        </ul>
                    </div>

                    {/* Specialties */}
                    <div>
                        <h3 className="text-white font-semibold mb-4">Specialties</h3>
                        <ul className="space-y-2">
                            <li><Link href="/plastic-surgery" className="hover:text-white transition-colors">Plastic Surgery</Link></li>
                            <li><Link href="/med-spa" className="hover:text-white transition-colors">Med Spas</Link></li>
                            <li><Link href="/dermatology" className="hover:text-white transition-colors">Dermatology</Link></li>
                            <li><Link href="/cosmetic-dentistry" className="hover:text-white transition-colors">Cosmetic Dentistry</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-zinc-500">© 2025 CallWaiting AI. All rights reserved.</p>
                    <p className="text-slate-400 text-sm">Built exclusively for Aesthetic Clinics, Plastic Surgeons, and Med Spas</p>
                </div>
            </div>
        </footer>
    )
}
