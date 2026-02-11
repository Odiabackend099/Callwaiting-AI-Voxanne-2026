"use client";

import { motion } from "framer-motion";
import { FadeInOnScroll, SlideInOnScroll } from "./ParallaxSection";
import { Star } from "lucide-react";

const testimonials = [
    {
        name: "Dr. Sarah Mitchell",
        role: "Dermatology Clinic Owner",
        content: "Voxanne AI increased our appointment bookings by 40% in the first month. The AI sounds natural and patients love the instant responses.",
        rating: 5,
        image: "👩‍⚕️",
    },
    {
        name: "James Chen",
        role: "Plastic Surgery Practice Manager",
        content: "We've eliminated missed calls completely. The system integrates seamlessly with our existing software and the analytics are incredible.",
        rating: 5,
        image: "��‍⚕️",
    },
    {
        name: "Dr. Lisa Rodriguez",
        role: "Med Spa Director",
        content: "Our patients are amazed by how professional and helpful the AI is. It's like having a perfect receptionist working 24/7 without the cost.",
        rating: 5,
        image: "👩‍⚕️",
    },
    {
        name: "Michael Thompson",
        role: "Cosmetic Dentistry Owner",
        content: "The ROI was immediate. We're booking more appointments and our team has more time to focus on patient care. Highly recommend!",
        rating: 5,
        image: "👨‍⚕️",
    },
];

export default function TestimonialsRedesigned() {
    return (
        <section className="relative py-20 md:py-32 bg-surgical-50 overflow-hidden">
            {/* Background Elements */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-surgical-200/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-1/4 left-0 w-[400px] h-[400px] bg-surgical-400/10 rounded-full blur-[100px]" />
            </div>

            <div className="container relative z-10 mx-auto px-4 md:px-6">
                {/* Section Header */}
                <FadeInOnScroll>
                    <div className="text-center mb-16">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            viewport={{ once: true }}
                        >
                            <h2 className="text-h2-desktop md:text-h2-mobile font-display font-bold text-obsidian mb-4">
                                Loved by Clinic Owners
                            </h2>
                            <p className="text-lg text-obsidian/70 max-w-2xl mx-auto">
                                See how Voxanne AI is transforming patient communication for aesthetic clinics.
                            </p>
                        </motion.div>
                    </div>
                </FadeInOnScroll>

                {/* Testimonials Grid */}
                <div className="grid md:grid-cols-2 gap-8">
                    {testimonials.map((testimonial, index) => (
                        <SlideInOnScroll
                            key={index}
                            direction={index % 2 === 0 ? "left" : "right"}
                            delay={index * 0.1}
                        >
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: index * 0.1 }}
                                viewport={{ once: true }}
                                className="bg-white border border-surgical-200 rounded-lg p-8 hover:shadow-lg transition-all duration-300 group"
                            >
                                {/* Stars */}
                                <div className="flex gap-1 mb-4">
                                    {[...Array(testimonial.rating)].map((_, i) => (
                                        <Star
                                            key={i}
                                            className="w-5 h-5 fill-surgical-500 text-surgical-500"
                                        />
                                    ))}
                                </div>

                                {/* Quote */}
                                <p className="text-obsidian/80 text-lg mb-6 leading-relaxed italic">
                                    "{testimonial.content}"
                                </p>

                                {/* Author */}
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-surgical-900 via-surgical-600 to-surgical-400 flex items-center justify-center text-2xl">
                                        {testimonial.image}
                                    </div>
                                    <div>
                                        <p className="font-bold text-obsidian">
                                            {testimonial.name}
                                        </p>
                                        <p className="text-sm text-obsidian/60">
                                            {testimonial.role}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        </SlideInOnScroll>
                    ))}
                </div>

                {/* Social Proof Stats */}
                <FadeInOnScroll>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        viewport={{ once: true }}
                        className="mt-16 bg-gradient-to-br from-surgical-50 to-white rounded-lg p-8 md:p-12 border border-surgical-200"
                    >
                        <div className="grid md:grid-cols-4 gap-8 text-center">
                            <div>
                                <p className="text-3xl font-bold text-surgical-900 mb-2">500+</p>
                                <p className="text-obsidian/70">Clinics Using Voxanne AI</p>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-surgical-600 mb-2">98%</p>
                                <p className="text-obsidian/70">Patient Satisfaction Rate</p>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-surgical-400 mb-2">40%</p>
                                <p className="text-obsidian/70">Avg. Booking Increase</p>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-surgical-900 mb-2">24/7</p>
                                <p className="text-obsidian/70">Always Available</p>
                            </div>
                        </div>
                    </motion.div>
                </FadeInOnScroll>
            </div>
        </section>
    );
}
