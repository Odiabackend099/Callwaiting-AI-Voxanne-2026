"use client";

import { useState } from "react";
import SmoothScroll from "@/components/SmoothScroll";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import TrustedBy from "@/components/TrustedBy";
import RevenueLeak from "@/components/RevenueLeak";
import { MedicalAudioDemos } from "@/components/MedicalAudioDemos";
import SafetySection from "@/components/SafetySection";
import PerformanceMetrics from "@/components/PerformanceMetrics";
import HowItWorks from "@/components/HowItWorks";
import TestimonialCarousel from "@/components/TestimonialCarousel";
import Pricing from "@/components/Pricing";
import RiskReversal from "@/components/RiskReversal";
import LimitedAvailability from "@/components/LimitedAvailability";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import { BookingModal } from "@/components/BookingModal";
import { ChatWidget } from "@/components/ChatWidget";
import LiveChatWidget from "@/components/LiveChatWidget";
import PressMentions from "@/components/PressMentions";
import SecurityBadges from "@/components/SecurityBadges";
import Comparison from "@/components/Comparison";
import CompetitorComparison from "@/components/CompetitorComparison";
import { MedicalFAQ } from "@/components/MedicalFAQ";
import MobileShowcase from "@/components/MobileShowcase";
import CampaignShowcase from "@/components/CampaignShowcase";
import Team from "@/components/Team";
import OfficeLocation from "@/components/OfficeLocation";

export default function Home() {
    const [isBookingOpen, setIsBookingOpen] = useState(false);

    const openBooking = () => setIsBookingOpen(true);

    return (
        <SmoothScroll>
            <main className="relative min-h-screen bg-black text-white selection:bg-purple-500/30">
                <Navbar />

                {/* 1. HOOK: Reptilian Brain & Loss Aversion */}
                <Hero onBookDemo={openBooking} />

                {/* Authority Anchors */}
                <TrustedBy />
                <PressMentions />

                {/* 2. PAIN: Make the problem hurt */}
                <RevenueLeak />

                {/* 3. PROOF: Show, don't just tell */}
                <MedicalAudioDemos />

                {/* 4. SOLUTION & SAFETY: The unique mechanism */}
                <SafetySection />
                <PerformanceMetrics />

                {/* 5. PROCESS: Simplicity */}
                <HowItWorks />

                {/* 6. SOCIAL PROOF: Reinforce the decision */}
                <TestimonialCarousel />
                <Comparison />
                <CompetitorComparison />

                {/* 7. OFFER: The Pricing & Guarantee */}
                <Pricing onBookDemo={openBooking} />
                <RiskReversal />

                {/* 8. URGENCY & CLOSING */}
                <LimitedAvailability />
                <CTA onBookDemo={openBooking} />

                {/* Supporting Pillars (kept for SEO/Depth but lower priority) */}
                <SecurityBadges />
                <MedicalFAQ />
                <MobileShowcase />
                <CampaignShowcase />
                {/* <DemoSection />  Removed as we have demos in Hero & Proof section now */}
                <Team />
                <OfficeLocation />

                <Footer />
                <ChatWidget />
                <LiveChatWidget />
                <BookingModal isOpen={isBookingOpen} onClose={() => setIsBookingOpen(false)} />
            </main>
        </SmoothScroll>
    );
}
