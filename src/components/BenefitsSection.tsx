"use client";

import { motion } from "framer-motion";
import { Phone, Zap, Calendar } from "lucide-react";

export default function BenefitsSection() {
  const benefits = [
    {
      icon: Phone,
      title: "Never Miss a Lead",
      description: "Answer every call, even outside of business hours. Capture every potential client automatically."
    },
    {
      icon: Zap,
      title: "Qualify Leads Automatically",
      description: "Identify high-value prospects and prioritize your time. Our AI asks the right questions."
    },
    {
      icon: Calendar,
      title: "Effortless Booking",
      description: "Integrated seamlessly with your existing calendar system. Leads book directly into your schedule."
    }
  ];

  return (
    <section className="relative py-20 md:py-32 bg-black text-white overflow-hidden">
      <div className="container relative z-10 px-4 md:px-6 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Why Aesthetic Clinics Choose Voxanne
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Three key benefits that transform your practice
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="relative p-8 rounded-2xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 hover:border-white/20 transition-all duration-300 group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 via-transparent to-red-500/0 rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
                
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-red-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  
                  <h3 className="text-xl font-bold mb-3">{benefit.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{benefit.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
