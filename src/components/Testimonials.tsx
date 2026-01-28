"use client";

import FadeIn from "@/components/ui/FadeIn";
import { Star } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const testimonials = [
  {
    quote: "Voxanne cut our no-show rate by 40% and freed up 10 hours/week for our front desk staff.",
    author: "Dr. Sarah Johnson",
    role: "Clear Skin Dermatology, Los Angeles",
    rating: 5,
  },
  {
    quote: "The most seamless implementation we've ever had. Our patients love that they can book appointments 24/7.",
    author: "Mark Davis",
    role: "Practice Manager, Elite Dental",
    rating: 5,
  },
  {
    quote: "It sounds incredibly human. We've seen a 25% increase in new patient bookings since switching.",
    author: "Dr. Emily Chen",
    role: "Chen Plastic Surgery, New York",
    rating: 5,
  },
];

export default function Testimonials() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section id="testimonials" className="py-24 bg-white border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-navy-900 tracking-tight mb-4">
              Loved by leading medical practices
            </h2>
          </div>
        </FadeIn>

        <div className="max-w-4xl mx-auto relative h-[300px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="absolute w-full text-center"
            >
              <div className="flex justify-center gap-1 mb-6">
                {[...Array(testimonials[current].rating)].map((_, i) => (
                  <Star key={i} className="h-6 w-6 text-yellow-400 fill-yellow-400" />
                ))}
              </div>

              <blockquote className="text-2xl md:text-3xl font-medium text-navy-900 leading-relaxed mb-8">
                &quot;{testimonials[current].quote}&quot;
              </blockquote>

              <div className="flex flex-col items-center gap-2">
                <div className="h-16 w-16 rounded-full bg-slate-200 mb-2" /> {/* Placeholder for headshot */}
                <cite className="not-italic font-semibold text-lg text-navy-900">
                  {testimonials[current].author}
                </cite>
                <span className="text-slate-500">
                  {testimonials[current].role}
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex justify-center gap-2 mt-8">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all duration-300 ${current === i ? "w-8 bg-surgical-600" : "w-2 bg-slate-200"
                }`}
              aria-label={`Go to testimonial ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
