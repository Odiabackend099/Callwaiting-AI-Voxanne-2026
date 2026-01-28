import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { TrustBar } from "@/components/TrustBar";
import { Features } from "@/components/Features";
import { AudioDemos } from "@/components/AudioDemos";
import { Pricing } from "@/components/Pricing";
import { FAQ } from "@/components/FAQ";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-white font-sans selection:bg-surgical-100 selection:text-surgical-900">
      <Navbar />
      <Hero />
      <TrustBar />
      <Features />
      <AudioDemos />
      <Pricing />
      <FAQ />
      <Footer />
    </main>
  );
}
