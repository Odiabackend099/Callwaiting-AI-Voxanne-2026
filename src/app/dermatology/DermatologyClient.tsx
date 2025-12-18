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
import { PhoneCall, CalendarCheck, Activity, ShieldPlus } from "lucide-react";
import { MedicalAudioDemos } from "@/components/MedicalAudioDemos";
import { MedicalFAQ } from "@/components/MedicalFAQ";

export default function DermatologyPage() {
    const [isBookingOpen, setIsBookingOpen] = useState(false);
    const openBooking = () => setIsBookingOpen(true);

    const dermFeatures = [
        {
            icon: Activity,
            title: "Smart Triage",
            description: "Intelligently distinguishes cosmetic leads (Botox, Filler) from medical patients (rashes, mole checks) and routes accordingly."
        },
        {
            icon: ShieldPlus,
            title: "Insurance Routing",
            description: "Answers basic network questions ('Do you take United?') and collects insurance card photos before the visit."
        },
        {
            icon: PhoneCall,
            title: "Rx Refill Handling",
            description: "Automates prescription refill requests by collecting pharmacy info and patient details for nurse review."
        },
        {
            icon: CalendarCheck,
            title: "Cosmetic Conversion",
            description: "Identifies medical patients interested in aesthetics and cross-sells services during booking."
        }
    ];

    return (
        <SmoothScroll>
            <main className="min-h-screen bg-black text-white selection:bg-purple-500/30">
                <Navbar />

                <Hero
                    onBookDemo={openBooking}
                    badgeText="The #1 AI for Dermatologists"
                    title={
                        <>
                            Scale Cosmetic. <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                                Automate Medical.
                            </span>
                        </>
                    }
                    subtitle={
                        <>
                            Call Waiting AI handles the chaos of high-volume dermatology calls. She triages medical vs. cosmetic, <br />
                            handling 100+ calls a day without burnout.
                        </>
                    }
                    ctaText="See Call Waiting AI in Action"
                />

                <MedicalAudioDemos />

                <Features customFeatures={dermFeatures} />

                <div className="py-24 bg-slate-950">
                    <div className="container mx-auto px-4 text-center">
                        <h2 className="text-3xl md:text-5xl font-bold mb-6">Proven Derm Practice Impact</h2>
                        <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 md:p-12">
                            <div className="grid md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-slate-800">
                                <div>
                                    <div className="text-4xl font-bold text-cyan-400 mb-2">3.5hr</div>
                                    <div className="text-slate-400">Phone Time Saved Daily</div>
                                </div>
                                <div>
                                    <div className="text-4xl font-bold text-blue-400 mb-2">100%</div>
                                    <div className="text-slate-400">Triage Accuracy</div>
                                </div>
                                <div>
                                    <div className="text-4xl font-bold text-purple-400 mb-2">+18%</div>
                                    <div className="text-slate-400">Cosmetic Revenue Growth</div>
                                </div>
                            </div>
                            <p className="mt-8 text-lg text-slate-300 italic">
                                &quot;The biggest win wasn&apos;t just the missed calls—it was the triage. She sends medical to the portal and books cosmetic directly. Genius.&quot;
                            </p>
                            <p className="mt-4 text-slate-500 font-medium">- Dr. Emily Weiss, Coastal Dermatology</p>
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
