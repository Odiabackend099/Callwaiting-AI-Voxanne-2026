'use client';

import { ParallaxBackground, ParallaxImage, HeroTextReveal, FadeIn, StickyScrollSection } from '@/components/ui/animations';
import { useOptimizedAnimation } from '@/lib/hooks/useOptimizedAnimation';

export default function DemoWorkflowPage() {
  const shouldAnimate = useOptimizedAnimation();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative min-h-screen overflow-hidden flex flex-col justify-center">
        <ParallaxBackground speed={0.3}>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-purple-50" />
        </ParallaxBackground>
        <ParallaxBackground speed={0.5}>
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob" />
          <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
          <div className="absolute bottom-1/4 left-1/2 w-64 h-64 bg-pink-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000" />
        </ParallaxBackground>
        <div className="container relative z-10 text-center">
          <HeroTextReveal 
            text="Voxanne in Action" 
            mode="words" 
            variant="fadeUp" 
            stagger={0.05}
            shouldAnimate={shouldAnimate}
          />
          <FadeIn direction="up" delay={0.6} shouldAnimate={shouldAnimate}>
            <p className="text-lg text-gray-600 mt-6 max-w-2xl mx-auto">
              Experience the seamless workflow of our AI receptionist
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Demo Workflow Sections */}
      <StickyScrollSection height="500vh">
        {/* Step 1: Answering Call */}
        <div className="sticky top-0 h-screen flex items-center justify-center bg-white">
          <div className="container grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="p-8 bg-gray-50 rounded-2xl shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900">1. Answering Calls</h3>
              <p className="text-gray-600 mt-4">
                Voxanne answers calls instantly, 24/7, with a natural and professional voice.
              </p>
            </div>
            <ParallaxImage 
              src="/demo/call-answering.png" 
              alt="Voxanne answering a call"
              offset={30}
              shouldAnimate={shouldAnimate}
            />
          </div>
        </div>

        {/* Step 2: Booking Meeting */}
        <div className="sticky top-0 h-screen flex items-center justify-center bg-gray-50">
          <div className="container grid grid-cols-1 lg:grid-cols-2 gap-12">
            <ParallaxImage 
              src="/demo/booking.png" 
              alt="Voxanne booking a meeting"
              offset={30}
              shouldAnimate={shouldAnimate}
            />
            <div className="p-8 bg-white rounded-2xl shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900">2. Booking Appointments</h3>
              <p className="text-gray-600 mt-4">
                Seamlessly books appointments directly into your calendar.
              </p>
            </div>
          </div>
        </div>

        {/* Step 3: Compliance Assurance */}
        <div className="sticky top-0 h-screen flex items-center justify-center bg-white">
          <div className="container grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="p-8 bg-gray-50 rounded-2xl shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900">3. HIPAA Compliance</h3>
              <p className="text-gray-600 mt-4">
                Voxanne ensures all interactions are HIPAA compliant and secure.
              </p>
            </div>
            <ParallaxImage 
              src="/demo/compliance.png" 
              alt="Voxanne ensuring compliance"
              offset={30}
              shouldAnimate={shouldAnimate}
            />
          </div>
        </div>

        {/* Step 4: SMS Confirmation */}
        <div className="sticky top-0 h-screen flex items-center justify-center bg-gray-50">
          <div className="container grid grid-cols-1 lg:grid-cols-2 gap-12">
            <ParallaxImage 
              src="/demo/sms.png" 
              alt="Voxanne sending SMS confirmation"
              offset={30}
              shouldAnimate={shouldAnimate}
            />
            <div className="p-8 bg-white rounded-2xl shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900">4. SMS Confirmation</h3>
              <p className="text-gray-600 mt-4">
                Automatically sends SMS confirmations to patients.
              </p>
            </div>
          </div>
        </div>

        {/* Step 5: CRM Integration */}
        <div className="sticky top-0 h-screen flex items-center justify-center bg-white">
          <div className="container grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="p-8 bg-gray-50 rounded-2xl shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900">5. CRM Integration</h3>
              <p className="text-gray-600 mt-4">
                Logs all interactions directly into your CRM system.
              </p>
            </div>
            <ParallaxImage 
              src="/demo/crm.png" 
              alt="Voxanne logging into CRM"
              offset={30}
              shouldAnimate={shouldAnimate}
            />
          </div>
        </div>
      </StickyScrollSection>
    </div>
  );
}
