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
import { PhoneCall, CalendarCheck, Sparkles, Gem } from "lucide-react";
import { MedicalAudioDemos } from "@/components/MedicalAudioDemos";
import { MedicalFAQ } from "@/components/MedicalFAQ";

export default function MedSpaPage() {
    const [isBookingOpen, setIsBookingOpen] = useState(false);
    const openBooking = () => setIsBookingOpen(true);

    const medSpaFeatures = [
        {
            icon: Sparkles,
            title: "Treatment Upsells",
            description: "Smartly suggests add-ons during booking (e.g. &apos;Would you like to add a lip flip to your Botox appointment?&apos;)."
        },
        {
            icon: CalendarCheck,
            title: "Membership Enrollment",
            description: "Explains your VIP/Beauty Bank membership benefits and signs patients up over the phone."
        },
        {
            icon: PhoneCall,
            title: "Weekend Catch-Up",
            description: "While you're closed Sunday, Roxanne books your Monday solid. Captures the high volume of weekend inquiries."
        },
        {
            icon: Gem,
            title: "Deposit Collection",
            description: "Secures appointments with credit card deposits to virtually eliminate no-shows for high-value slots."
        }
    ];

    return (
        <SmoothScroll>
            <main className="min-h-screen bg-black text-white selection:bg-purple-500/30">
                <Navbar />

                <Hero
                    onBookDemo={openBooking}
                    badgeText="The #1 AI for Med Spas"
                    title={
                        <>
                            Book More Botox. <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-500">
                                Zero Missed Calls.
                            </span>
                        </>
                    }
                    subtitle={
                        <>
                            Stop losing weekend revenue to voicemail. Roxanne answers instantly, explains your memberships, <br />
                            and fills your injectors' schedules while you sleep.
                        </>
                    }
                    ctaText="Get Your Free Demo"
                />

                <MedicalAudioDemos />

                <Features customFeatures={medSpaFeatures} />

                <div className="py-24 bg-slate-950">
                    <div className="container mx-auto px-4 text-center">
                        <h2 className="text-3xl md:text-5xl font-bold mb-6">Real Med Spa Results</h2>
                        <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 md:p-12">
                            <div className="grid md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-slate-800">
                                <div>
                                    <div className="text-4xl font-bold text-teal-400 mb-2">35</div>
                                    <div className="text-slate-400">New Memberships Sold / Mo</div>
                                </div>
                                <div>
                                    <div className="text-4xl font-bold text-emerald-400 mb-2">98%</div>
                                    <div className="text-slate-400">Call Answer Rate</div>
                                </div>
                                <div>
                                    <div className="text-4xl font-bold text-purple-400 mb-2">$45k</div>
                                    <div className="text-slate-400">Added Grade A Revenue</div>
                                </div>
                            </div>
                            <p className="mt-8 text-lg text-slate-300 italic">
                                &quot;Our injectors used to spend hours calling people back. Now they just come in and inject. Roxanne fills the books automatically.&quot;
                            </p>
                            <p className="mt-4 text-slate-500 font-medium">- Sarah Vance, Owner of Glow Aesthetics</p>
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
