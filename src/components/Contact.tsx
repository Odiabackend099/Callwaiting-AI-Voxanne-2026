"use client";

import FadeIn from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/button";
import { Mail, Phone, MapPin, Loader2, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

export default function Contact() {
    const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setStatus("loading");
        
        // Simulate API call
        setTimeout(() => {
            setStatus("success");
            // Reset after 3 seconds
            setTimeout(() => setStatus("idle"), 3000);
        }, 1500);
    };

    return (
        <section id="contact" className="py-24 bg-slate-50">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid lg:grid-cols-2 gap-16">
                    {/* Left Column: Info */}
                    <FadeIn>
                        <h2 className="text-4xl font-bold text-navy-900 tracking-tight mb-6">
                            Ready to transform your <br />
                            <span className="text-surgical-600">clinic&apos;s front desk?</span>
                        </h2>
                        <p className="text-lg text-slate-600 mb-12">
                            Get in touch with our team to see how Voxanne can help you capture more patients and reduce admin work.
                        </p>

                        <div className="space-y-8">
                            <div className="flex items-start gap-4">
                                <div className="h-10 w-10 rounded-full bg-surgical-100 flex items-center justify-center shrink-0">
                                    <Mail className="h-5 w-5 text-surgical-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-navy-900">Email us</h3>
                                    <p className="text-slate-600">hello@voxanne.ai</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="h-10 w-10 rounded-full bg-surgical-100 flex items-center justify-center shrink-0">
                                    <Phone className="h-5 w-5 text-surgical-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-navy-900">Call us</h3>
                                    <p className="text-slate-600">+44 20 1234 5678</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="h-10 w-10 rounded-full bg-surgical-100 flex items-center justify-center shrink-0">
                                    <MapPin className="h-5 w-5 text-surgical-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-navy-900">Visit us</h3>
                                    <p className="text-slate-600">
                                        20 AI Innovation Way<br />
                                        London, UK
                                    </p>
                                </div>
                            </div>
                        </div>
                    </FadeIn>

                    {/* Right Column: Form */}
                    <FadeIn delay={0.2}>
                        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label htmlFor="name" className="text-sm font-medium text-navy-900">Name</label>
                                        <Input id="name" placeholder="Dr. Jane Doe" required disabled={status === "loading" || status === "success"} />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="email" className="text-sm font-medium text-navy-900">Email</label>
                                        <Input id="email" type="email" placeholder="jane@clinic.com" required disabled={status === "loading" || status === "success"} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="phone" className="text-sm font-medium text-navy-900">Phone (Optional)</label>
                                    <Input id="phone" type="tel" placeholder="+1 (555) 000-0000" disabled={status === "loading" || status === "success"} />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="message" className="text-sm font-medium text-navy-900">Message</label>
                                    <Textarea id="message" placeholder="Tell us about your practice..." className="min-h-[120px]" required disabled={status === "loading" || status === "success"} />
                                </div>

                                <Button 
                                    type="submit" 
                                    className={`w-full text-lg h-12 transition-all ${status === "success" ? "bg-green-600 hover:bg-green-700" : "bg-surgical-600 hover:bg-surgical-700"}`}
                                    disabled={status === "loading" || status === "success"}
                                >
                                    {status === "loading" ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Sending...
                                        </>
                                    ) : status === "success" ? (
                                        <>
                                            <CheckCircle2 className="mr-2 h-5 w-5" />
                                            Message Sent!
                                        </>
                                    ) : (
                                        "Send Message"
                                    )}
                                </Button>
                            </form>
                        </div>
                    </FadeIn>
                </div>
            </div>
        </section>
    );
}
