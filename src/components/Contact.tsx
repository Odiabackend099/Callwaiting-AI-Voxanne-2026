"use client";

import FadeIn from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/button";
import { Mail, Phone, MapPin, Loader2, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useToast } from "@/hooks/useToast";

export default function Contact() {
    const { warning, error: showErrorToast } = useToast();
    const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
    const [formRef, setFormRef] = useState<HTMLFormElement | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus("loading");

        const formElement = e.target as HTMLFormElement;

        try {
            // Collect form data
            const formData = new FormData(formElement);

            const payload = {
                name: formData.get('name') as string,
                email: formData.get('email') as string,
                phone: (formData.get('phone') as string) || '',
                subject: 'Website Contact Form',
                message: formData.get('message') as string,
            };

            // Validate required fields
            if (!payload.name || !payload.email || !payload.message) {
                setStatus("idle");
                warning('Please fill in all required fields');
                return;
            }

            // Call Next.js API route
            const response = await fetch('/api/contact-form', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            // Success - show confirmation
            setStatus("success");
            formElement.reset();

            // Reset form after 3 seconds
            setTimeout(() => setStatus("idle"), 3000);

        } catch (error) {
            console.error('Contact form submission error:', error);
            setStatus("idle");
            showErrorToast('Failed to send message. Please try again or email support@voxanne.ai directly.');
        }
    };

    return (
        <section id="contact" className="py-32 bg-surgical-50">
            <div className="section-container">
                <div className="grid lg:grid-cols-2 gap-20">
                    {/* Left Column: Info */}
                    <FadeIn>
                        <h2 className="font-sans font-bold text-4xl md:text-5xl text-obsidian tracking-tight mb-6">
                            Ready to transform your <br />
                            <span className="font-sans font-semibold text-surgical-600">clinic&apos;s front desk?</span>
                        </h2>
                        <p className="text-lg text-obsidian/50 mb-12">
                            Get in touch with our team to see how Voxanne can help you capture more patients and reduce admin work.
                        </p>

                        <div className="space-y-8">
                            <div className="flex items-start gap-4">
                                <div className="h-10 w-10 rounded-full bg-surgical-100 flex items-center justify-center shrink-0">
                                    <Mail className="h-5 w-5 text-surgical-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-obsidian">Email us</h3>
                                    <p className="text-obsidian/70">support@voxanne.ai</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="h-10 w-10 rounded-full bg-surgical-100 flex items-center justify-center shrink-0">
                                    <Phone className="h-5 w-5 text-surgical-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-obsidian">Call us</h3>
                                    <p className="text-obsidian/70">+44 7424 038250</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="h-10 w-10 rounded-full bg-surgical-100 flex items-center justify-center shrink-0">
                                    <MapPin className="h-5 w-5 text-surgical-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-obsidian">Visit us</h3>
                                    <p className="text-obsidian/70">
                                        Collage House, 2nd Floor<br />
                                        17 King Edward Road<br />
                                        Ruislip, London HA4 7AE<br />
                                        United Kingdom
                                    </p>
                                </div>
                            </div>
                        </div>
                    </FadeIn>

                    {/* Right Column: Form */}
                    <FadeIn delay={0.2}>
                        <div className="bg-white rounded-2xl p-8 border border-surgical-200">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label htmlFor="name" className="text-sm font-medium text-obsidian">Name</label>
                                        <Input id="name" name="name" placeholder="Dr. Jane Doe" required disabled={status === "loading" || status === "success"} />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="email" className="text-sm font-medium text-obsidian">Email</label>
                                        <Input id="email" name="email" type="email" placeholder="jane@clinic.com" required disabled={status === "loading" || status === "success"} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="phone" className="text-sm font-medium text-obsidian">Phone (Optional)</label>
                                    <Input id="phone" name="phone" type="tel" placeholder="+1 (555) 000-0000" disabled={status === "loading" || status === "success"} />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="message" className="text-sm font-medium text-obsidian">Message</label>
                                    <Textarea id="message" name="message" placeholder="Tell us about your practice..." className="min-h-[120px]" required disabled={status === "loading" || status === "success"} />
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
