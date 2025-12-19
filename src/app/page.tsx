"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SmoothScroll from "@/components/SmoothScroll";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import TrustedBy from "@/components/TrustedBy";
import RevenueLeak from "@/components/RevenueLeak";
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

function AuthCodeRedirector() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const code = searchParams.get('code');
        if (code) {
            const qs = searchParams.toString();
            router.replace(qs ? `/auth/callback?${qs}` : '/auth/callback');
        }
    }, [router, searchParams]);

    return null;
}

export default function Home() {
    const [isBookingOpen, setIsBookingOpen] = useState(false);

    const openBooking = () => setIsBookingOpen(true);

    return (
        <SmoothScroll>
            <main className="relative min-h-screen bg-black text-white selection:bg-purple-500/30">
                <Suspense fallback={null}>
                    <AuthCodeRedirector />
                </Suspense>
                <Navbar />

                {/* 1. HOOK: Reptilian Brain & Loss Aversion */}
                <Hero onBookDemo={openBooking} />

                {/* Authority Anchors */}
                <TrustedBy />
                <PressMentions />

                {/* 2. PAIN: Make the problem hurt */}
                <RevenueLeak />

                {/* 3. SOLUTION & SAFETY: The unique mechanism */}
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
