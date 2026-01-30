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

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <NavbarRedesigned />
      <HeroCalendlyReplica />
      <TrustBarSimple />
      <FeaturesBentoGrid />
      <HowItWorksRedesigned />
      <Integrations />
      <TestimonialsCarousel />
      <Pricing />
      <FAQ />
      <FooterRedesigned />
    </main>
  );
}
