"use client";

import { motion } from "framer-motion";
import { Phone, Bot, CheckCircle, ArrowRight } from "lucide-react";

export default function HowItWorksSection() {
  const steps = [
    {
      number: 1,
      icon: Phone,
      title: "Potential Clients Call",
      description: "Clients call your dedicated number. No more missed calls, even outside business hours."
    },
    {
      number: 2,
      icon: Bot,
      title: "AI Receptionist Answers",
      description: "Our AI answers professionally, asks qualifying questions, and gathers essential information about their needs."
    },
    {
      number: 3,
      icon: CheckCircle,
      title: "Leads Sent to You",
      description: "Qualified leads are instantly sent to you via email or scheduled directly into your calendar system."
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
            How It Works
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Simple, seamless, and automated. Three steps to never miss a lead again.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="relative"
              >
                {/* Arrow between steps */}
                {index < steps.length - 1 && (
                  <div className="hidden md:flex absolute -right-4 top-1/3 z-20">
                    <ArrowRight className="w-8 h-8 text-purple-500/50" />
                  </div>
                )}

                <div className="relative p-8 rounded-2xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 h-full">
                  {/* Step number */}
                  <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-red-500 flex items-center justify-center text-white font-bold text-lg">
                    {step.number}
                  </div>

                  <div className="pt-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-red-500 flex items-center justify-center mb-6">
                      <Icon className="w-6 h-6 text-white" />
                    </div>

                    <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                    <p className="text-slate-400 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <p className="text-slate-400 mb-6">
            Ready to transform your practice? See it in action.
          </p>
          <a href="/demo-workflow">
            <button className="px-8 py-4 bg-white text-black rounded-full font-bold text-lg hover:bg-slate-200 transition-all duration-300 flex items-center gap-2 mx-auto shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]">
              Watch Demo
              <ArrowRight className="w-5 h-5" />
            </button>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
