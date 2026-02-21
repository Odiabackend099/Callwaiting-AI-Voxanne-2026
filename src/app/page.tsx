import type { Metadata } from "next"
import NavbarRedesigned from "@/components/NavbarRedesigned";
import { HeroCalendlyReplica } from "@/components/HeroCalendlyReplica";
import { TrustBarSimple } from "@/components/TrustBarSimple";
import { FeaturesBentoGrid } from "@/components/FeaturesBentoGrid";
import HowItWorksRedesigned from "@/components/HowItWorksRedesigned";
import Integrations from "@/components/Integrations";
import { TestimonialsCarousel } from "@/components/TestimonialsCarousel";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import FooterRedesigned from "@/components/FooterRedesigned";
import Contact from "@/components/Contact";

export const metadata: Metadata = {
  title: "Voxanne AI | The #1 AI Receptionist for Clinics & Spas",
  description: "Voxanne is the AI voice receptionist that answers, qualifies, and books appointments 24/7 for clinics and med spas. HIPAA-compliant. No missed calls.",
  keywords: ["ai receptionist", "medical answering service", "clinic automation", "appointment booking ai", "hipaa compliant", "24/7 call answering"],
  openGraph: {
    title: "Voxanne AI | The #1 AI Receptionist for Clinics",
    description: "Replace your missed calls with revenue. The AI receptionist that books appointments for you.",
    url: 'https://voxanne.ai',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Voxanne AI | The #1 AI Receptionist for Clinics",
    description: "Don't let missed calls cost you money. Switch to Voxanne AI.",
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: '/',
  },
}

export default function Home() {
  return (
    <main className="relative min-h-screen bg-white">
      <NavbarRedesigned />
      <HeroCalendlyReplica />
      <TrustBarSimple />
      <FeaturesBentoGrid />
      <HowItWorksRedesigned />
      <Integrations />
      <TestimonialsCarousel />
      <Pricing />
      <FAQ />
      <Contact />
      <FooterRedesigned />
    </main>
  );
}
