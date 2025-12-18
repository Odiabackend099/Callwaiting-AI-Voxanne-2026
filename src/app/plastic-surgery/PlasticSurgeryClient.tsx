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
import { PhoneCall, CalendarCheck, FileText, ClipboardList } from "lucide-react";
import { MedicalAudioDemos } from "@/components/MedicalAudioDemos";
import { MedicalFAQ } from "@/components/MedicalFAQ";

export default function PlasticSurgeryPage() {
    const [isBookingOpen, setIsBookingOpen] = useState(false);
    const openBooking = () => setIsBookingOpen(true);

    const surgeryFeatures = [
        {
            icon: ClipboardList,
            title: "Pre-Op Automation",
            description: "Automatically sends pre-op instructions (e.g. 'Stop aspirin 2 weeks prior') and collects medical history forms."
        },
        {
            icon: PhoneCall,
            title: "Lead Qualification",
            description: "Filters leads by BMI, financing needs, and procedure type (BBL, Rhino, Breast Aug) before they reach you."
        },
        {
            icon: CalendarCheck,
            title: "Post-Op Follow-up",
            description: "Schedules 1-day, 1-week, and 1-month post-op appointments automatically, reducing front-desk workload."
        },
        {
            icon: FileText,
            title: "Photo Collection",
            description: "Instructs patients via SMS on how to safely submit secure before photos for virtual consultations."
        }
    ];

    return (
        <SmoothScroll>
            <main className="min-h-screen bg-black text-white selection:bg-purple-500/30">
                <Navbar />

                <Hero
                    onBookDemo={openBooking}
                    badgeText="Built for Plastic Surgeons"
                    title={
                        <>
                            Never Miss a <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-600">
                                $15,000 BBL Consult.
                            </span>
                        </>
                    }
                    subtitle={
                        <>
                            Capture the 40% of leads that call after-hours. Call Waiting AI qualifies surgical candidates, <br />
                            quotes ranges, and books consultations directly into your surgical calendar.
                        </>
                    }
                    ctaText="Book Your Strategy Call"
                />

                <MedicalAudioDemos />

                <Features customFeatures={surgeryFeatures} />

                <div className="py-24 bg-slate-950">
                    <div className="container mx-auto px-4 text-center">
                        <h2 className="text-3xl md:text-5xl font-bold mb-6">Dr. Chen's Transformation</h2>
                        <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 md:p-12">
                            <div className="grid md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-slate-800">
                                <div>
                                    <div className="text-4xl font-bold text-green-400 mb-2">+$120k</div>
                                    <div className="text-slate-400">Monthly Revenue Recovered</div>
                                </div>
                                <div>
                                    <div className="text-4xl font-bold text-blue-400 mb-2">40%</div>
                                    <div className="text-slate-400">Increase in After-Hours Bookings</div>
                                </div>
                                <div>
                                    <div className="text-4xl font-bold text-purple-400 mb-2">2.5 hrs</div>
                                    <div className="text-slate-400">Saved Per Day for Front Desk</div>
                                </div>
                            </div>
                            <p className="mt-8 text-lg text-slate-300 italic">
                                &quot;Call Waiting AI pays for herself in the first 3 days of the month. She handles all the &apos;Are you open?&apos; calls so my coordinator can focus on closing surgeries.&quot;
                            </p>
                            <p className="mt-4 text-slate-500 font-medium">- Dr. Michael Chen, Board Certified Plastic Surgeon</p>
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
