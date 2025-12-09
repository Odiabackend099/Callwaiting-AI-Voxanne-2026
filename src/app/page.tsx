"use client";

import { useState } from "react";
import SmoothScroll from "@/components/SmoothScroll";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import TrustedBy from "@/components/TrustedBy";
import RevenueLeak from "@/components/RevenueLeak";
import DemoSection from "@/components/DemoSection";
import Features from "@/components/Features";
import CampaignShowcase from "@/components/CampaignShowcase";
import Comparison from "@/components/Comparison";
import TestimonialCarousel from "@/components/TestimonialCarousel";
import Pricing from "@/components/Pricing";
import Team from "@/components/Team";
import OfficeLocation from "@/components/OfficeLocation";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import { BookingModal } from "@/components/BookingModal";
import { ChatWidget } from "@/components/ChatWidget";
import { MedicalFAQ } from "@/components/MedicalFAQ";
import { MedicalAudioDemos } from "@/components/MedicalAudioDemos";
import MobileShowcase from "@/components/MobileShowcase";
import CompetitorComparison from "@/components/CompetitorComparison";
import SecurityBadges from "@/components/SecurityBadges";
import HowItWorks from "@/components/HowItWorks";
import PressMentions from "@/components/PressMentions";
import LiveChatWidget from "@/components/LiveChatWidget";

export default function Home() {
    const [isBookingOpen, setIsBookingOpen] = useState(false);

    const openBooking = () => setIsBookingOpen(true);

    return (
        <SmoothScroll>
            <main className="min-h-screen bg-black text-white selection:bg-purple-500/30">
                <Navbar />
                <Hero onBookDemo={openBooking} />
                <TrustedBy />
                <PressMentions />
                <MedicalAudioDemos />
                <RevenueLeak />
                <DemoSection />
                <Features />
                <MobileShowcase />
                <CampaignShowcase />
                <Comparison />
                <CompetitorComparison />
                <TestimonialCarousel />
                <MedicalFAQ />
                <HowItWorks />
                <Pricing onBookDemo={openBooking} />
                <SecurityBadges />
                <Team />
                <OfficeLocation />
                <CTA onBookDemo={openBooking} />
                <Footer />
                <ChatWidget />
                <LiveChatWidget />
                <BookingModal isOpen={isBookingOpen} onClose={() => setIsBookingOpen(false)} />
            </main>
        </SmoothScroll>
    );
}
