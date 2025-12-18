"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import CTA from "@/components/CTA";
import { BookingModal } from "@/components/BookingModal";
import { ChatWidget } from "@/components/ChatWidget";
import SmoothScroll from "@/components/SmoothScroll";
import { PhoneCall, CalendarCheck, Smile, CircleDollarSign } from "lucide-react";
import { MedicalAudioDemos } from "@/components/MedicalAudioDemos";
import { MedicalFAQ } from "@/components/MedicalFAQ";

export default function CosmeticDentistryPage() {
    const [isBookingOpen, setIsBookingOpen] = useState(false);
    const openBooking = () => setIsBookingOpen(true);

    const dentalFeatures = [
        {
            icon: Smile,
            title: "Smile Makeover Triage",
            description: "Identifies high-value cosmetic leads (Veneers, Invisalign) vs general hygiene calls and prioritizes them."
        },
        {
            icon: CircleDollarSign,
            title: "Financing Pre-Qual",
            description: "Softly qualifies patients for financing (CareCredit, Cherry) before they even step into the chair."
        },
        {
            icon: CalendarCheck,
            title: "Emergency vs Cosmetic",
            description: "Routes chipped teeth emergencies instantly while booking consultations for elective whitening/veneers."
        },
        {
            icon: PhoneCall,
            title: "Recall Automation",
            description: "Automatically calls overdue hygiene patients to fill holes in your schedule."
        }
    ];

    return (
        <SmoothScroll>
            <main className="min-h-screen bg-black text-white selection:bg-purple-500/30">
                <Navbar />

                <Hero
                    onBookDemo={openBooking}
                    badgeText="The #1 AI for Cosmetic Dentists"
                    title={
                        <>
                            More Veneers. <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
                                Less Voicemail.
                            </span>
                        </>
                    }
                    subtitle={
                        <>
                            Convert high-ticket smile makeover leads while you're in surgery. Call Waiting AI qualifies financing, <br />
                            explains composite vs porcelain, and books your chair solid.
                        </>
                    }
                    ctaText="Schedule a Demo"
                />

                <MedicalAudioDemos />

                <Features customFeatures={dentalFeatures} />

                <div className="py-24 bg-slate-950">
                    <div className="container mx-auto px-4 text-center">
                        <h2 className="text-3xl md:text-5xl font-bold mb-6">Impact on Production</h2>
                        <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 md:p-12">
                            <div className="grid md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-slate-800">
                                <div>
                                    <div className="text-4xl font-bold text-blue-400 mb-2">9</div>
                                    <div className="text-slate-400">Extra Aligners Cases / Mo</div>
                                </div>
                                <div>
                                    <div className="text-4xl font-bold text-indigo-400 mb-2">$35k</div>
                                    <div className="text-slate-400">Monthly Production Boost</div>
                                </div>
                                <div>
                                    <div className="text-4xl font-bold text-purple-400 mb-2">0</div>
                                    <div className="text-slate-400">Missed New Patient Calls</div>
                                </div>
                            </div>
                            <p className="mt-8 text-lg text-slate-300 italic">
                                "She handles the 'how much are veneers' question perfectly—giving a range but emphasizing the consultation. My front desk used to hate that question."
                            </p>
                            <p className="mt-4 text-slate-500 font-medium">- Dr. James Lee, Aesthetic Dentistry</p>
                        </div>
                    </div>
                </div>

                <MedicalFAQ />

                <CTA onBookDemo={openBooking} />
                <Footer />
                <ChatWidget />
                <BookingModal isOpen={isBookingOpen} onClose={() => setIsBookingOpen(false)} />
            </main>
        </SmoothScroll>
    );
}
