'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, MessageSquare, Calendar, Database, Smartphone, CheckCircle, Play, Pause } from 'lucide-react';

interface WorkflowStep {
  id: number;
  label: string;
  icon: React.ReactNode;
  description: string;
  startTime: number;
  endTime: number;
}

export default function WorkflowDemo() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const TOTAL_DURATION = 18000; // 18 seconds in milliseconds

  const steps: WorkflowStep[] = [
    {
      id: 1,
      label: 'Incoming Call',
      icon: <Phone className="w-8 h-8" />,
      description: 'Patient calls clinic',
      startTime: 0,
      endTime: 2000,
    },
    {
      id: 2,
      label: 'AI Answers',
      icon: <MessageSquare className="w-8 h-8" />,
      description: 'Voxanne AI responds instantly',
      startTime: 2000,
      endTime: 3500,
    },
    {
      id: 3,
      label: 'Patient Question',
      icon: <MessageSquare className="w-8 h-8" />,
      description: 'Do you have Botox appointments tomorrow?',
      startTime: 3500,
      endTime: 5500,
    },
    {
      id: 4,
      label: 'AI Response',
      icon: <MessageSquare className="w-8 h-8" />,
      description: 'Yes! I have 2:00 PM and 4:00 PM available',
      startTime: 5500,
      endTime: 8000,
    },
    {
      id: 5,
      label: 'Books Appointment',
      icon: <Calendar className="w-8 h-8" />,
      description: 'Confirms 2:00 PM slot',
      startTime: 8000,
      endTime: 10000,
    },
    {
      id: 6,
      label: 'Syncs to CRM',
      icon: <Database className="w-8 h-8" />,
      description: 'Updates patient record',
      startTime: 10000,
      endTime: 12000,
    },
    {
      id: 7,
      label: 'Sends SMS',
      icon: <Smartphone className="w-8 h-8" />,
      description: 'Appointment confirmation sent',
      startTime: 12000,
      endTime: 13500,
    },
    {
      id: 8,
      label: 'Complete',
      icon: <CheckCircle className="w-8 h-8" />,
      description: 'Appointment Booked',
      startTime: 13500,
      endTime: 15000,
    },
  ];

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= TOTAL_DURATION) {
          return 0; // Loop back to start
        }
        return prev + 50; // Update every 50ms for smooth animation
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const getActiveStep = () => {
    return steps.find(
      (step) => currentTime >= step.startTime && currentTime < step.endTime
    );
  };

  const activeStep = getActiveStep();

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const resetAnimation = () => {
    setCurrentTime(0);
    setIsPlaying(true);
  };

  return (
    <section className="py-24 bg-gradient-to-br from-surgical-50 via-white to-surgical-100 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-surgical-200/30 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-4"
          >
            See Voxanne AI In Action
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-xl text-gray-600"
          >
            From incoming call to booked appointment in 18 seconds
          </motion.p>
        </div>

        {/* Main Animation Stage */}
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 border border-gray-100 relative overflow-hidden">
            {/* Subtle glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-surgical-100/20 pointer-events-none" />

            {/* Progress Bar */}
            <div className="mb-12 relative z-10">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">
                  {activeStep?.label || 'Ready'}
                </span>
                <span className="text-sm text-gray-500">
                  {Math.floor(currentTime / 1000)}s / 18s
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-surgical-400"
                  style={{ width: `${(currentTime / TOTAL_DURATION) * 100}%` }}
                  transition={{ duration: 0.05 }}
                />
              </div>
            </div>

            {/* Animation Canvas */}
            <div className="relative h-[400px] md:h-[500px] mb-8">
              <AnimatePresence mode="wait">
                {/* Step 1: Phone Ring */}
                {activeStep?.id === 1 && (
                  <motion.div
                    key="phone-ring"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute inset-0 flex flex-col items-center justify-center"
                  >
                    <motion.div
                      animate={{
                        scale: [1, 1.2, 1],
                        rotate: [0, 15, -15, 0],
                      }}
                      transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        repeatDelay: 0.2,
                      }}
                      className="relative"
                    >
                      <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl scale-150 animate-pulse" />
                      <div className="bg-primary text-white p-8 rounded-full shadow-2xl relative z-10">
                        <Phone className="w-16 h-16" />
                      </div>
                    </motion.div>
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-8 text-2xl font-semibold text-gray-800"
                    >
                      Incoming Call
                    </motion.p>
                    <p className="text-gray-600 mt-2">Patient calling clinic</p>
                  </motion.div>
                )}

                {/* Step 2: AI Answers */}
                {activeStep?.id === 2 && (
                  <motion.div
                    key="ai-answers"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute inset-0 flex flex-col items-center justify-center"
                  >
                    <div className="relative">
                      <motion.div
                        animate={{
                          scale: [1, 1.1, 1],
                        }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                        }}
                        className="absolute inset-0 bg-surgical-300/30 rounded-full blur-2xl"
                      />
                      <div className="bg-gradient-to-br from-surgical-400 to-surgical-500 text-white p-8 rounded-full shadow-2xl relative z-10">
                        <MessageSquare className="w-16 h-16" />
                      </div>
                      {/* Voice waves */}
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-4 border-surgical-400/40 rounded-full"
                          animate={{
                            scale: [1, 2, 2],
                            opacity: [0.6, 0, 0],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            delay: i * 0.4,
                          }}
                        />
                      ))}
                    </div>
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-8 text-2xl font-semibold text-gray-800"
                    >
                      Voxanne AI Answers
                    </motion.p>
                    <p className="text-gray-600 mt-2">Instant response, zero wait time</p>
                  </motion.div>
                )}

                {/* Step 3: Patient Question */}
                {activeStep?.id === 3 && (
                  <motion.div
                    key="patient-question"
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="max-w-md">
                      <motion.div
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        className="bg-gray-100 rounded-3xl rounded-bl-none p-6 shadow-lg"
                      >
                        <div className="flex items-start space-x-3">
                          <div className="bg-gray-300 p-2 rounded-full">
                            <MessageSquare className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 mb-1">Patient</p>
                            <p className="text-gray-700 text-lg">
                              "Do you have Botox appointments available tomorrow?"
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                )}

                {/* Step 4: AI Response */}
                {activeStep?.id === 4 && (
                  <motion.div
                    key="ai-response"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 50 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="max-w-md">
                      <motion.div
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        className="bg-gradient-to-br from-primary to-surgical-400 rounded-3xl rounded-br-none p-6 shadow-lg"
                      >
                        <div className="flex items-start space-x-3">
                          <div className="bg-white/20 p-2 rounded-full">
                            <MessageSquare className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-white mb-1">Voxanne AI</p>
                            <p className="text-white text-lg">
                              "Yes! I have 2:00 PM and 4:00 PM available tomorrow. Which time works best for you?"
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                )}

                {/* Step 5: Books Appointment */}
                {activeStep?.id === 5 && (
                  <motion.div
                    key="books-appointment"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute inset-0 flex flex-col items-center justify-center"
                  >
                    <div className="relative">
                      <motion.div
                        animate={{
                          scale: [1, 1.05, 1],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                        }}
                        className="bg-white rounded-2xl shadow-2xl p-8 border-2 border-gray-200"
                      >
                        <Calendar className="w-16 h-16 text-primary mb-4" />
                        <div className="space-y-2">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 0.8 }}
                            className="bg-green-100 rounded-lg p-3 border-2 border-green-400"
                          >
                            <p className="font-semibold text-green-800">2:00 PM</p>
                            <p className="text-sm text-green-700">Botox Treatment</p>
                          </motion.div>
                          <div className="bg-gray-100 rounded-lg p-3 opacity-50">
                            <p className="font-semibold text-gray-600">4:00 PM</p>
                            <p className="text-sm text-gray-500">Available</p>
                          </div>
                        </div>
                      </motion.div>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5 }}
                        className="absolute -top-2 -right-2 bg-green-500 text-white p-2 rounded-full shadow-lg"
                      >
                        <CheckCircle className="w-6 h-6" />
                      </motion.div>
                    </div>
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-8 text-2xl font-semibold text-gray-800"
                    >
                      Appointment Booked
                    </motion.p>
                    <p className="text-gray-600 mt-2">Tomorrow at 2:00 PM</p>
                  </motion.div>
                )}

                {/* Step 6: Syncs to CRM */}
                {activeStep?.id === 6 && (
                  <motion.div
                    key="syncs-crm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center"
                  >
                    <div className="flex items-center justify-center space-x-8">
                      <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="bg-white rounded-xl shadow-lg p-6 border border-gray-200"
                      >
                        <Calendar className="w-12 h-12 text-primary" />
                      </motion.div>

                      {/* Data particles */}
                      <div className="relative w-32">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <motion.div
                            key={i}
                            className="absolute top-1/2 left-0 w-2 h-2 bg-primary rounded-full"
                            animate={{
                              x: [0, 128],
                              opacity: [1, 0],
                            }}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                              delay: i * 0.2,
                            }}
                          />
                        ))}
                      </div>

                      <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.5 }}
                        className="bg-gradient-to-br from-surgical-400 to-surgical-500 rounded-xl shadow-lg p-6"
                      >
                        <Database className="w-12 h-12 text-white" />
                      </motion.div>
                    </div>
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-8 text-2xl font-semibold text-gray-800"
                    >
                      Syncing to CRM
                    </motion.p>
                    <p className="text-gray-600 mt-2">Updating patient record</p>
                  </motion.div>
                )}

                {/* Step 7: Sends SMS */}
                {activeStep?.id === 7 && (
                  <motion.div
                    key="sends-sms"
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -50 }}
                    className="absolute inset-0 flex flex-col items-center justify-center"
                  >
                    <motion.div
                      initial={{ y: 50, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.5 }}
                      className="relative"
                    >
                      <div className="bg-white rounded-3xl shadow-2xl p-8 border-4 border-gray-200 max-w-sm">
                        <div className="flex items-center space-x-3 mb-4">
                          <Smartphone className="w-8 h-8 text-primary" />
                          <p className="font-semibold text-gray-900">SMS Confirmation</p>
                        </div>
                        <div className="bg-gradient-to-br from-primary to-surgical-400 rounded-2xl p-4 text-white">
                          <p className="text-sm mb-2">Hi Sarah!</p>
                          <p className="text-sm">Your Botox appointment is confirmed for tomorrow at 2:00 PM.</p>
                          <p className="text-xs mt-2 opacity-80">Reply CANCEL to reschedule</p>
                        </div>
                      </div>
                      <motion.div
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [1, 0, 1],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                        }}
                        className="absolute -top-2 -right-2 bg-green-500 text-white p-3 rounded-full shadow-lg"
                      >
                        <CheckCircle className="w-6 h-6" />
                      </motion.div>
                    </motion.div>
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-8 text-2xl font-semibold text-gray-800"
                    >
                      SMS Sent
                    </motion.p>
                    <p className="text-gray-600 mt-2">Confirmation delivered</p>
                  </motion.div>
                )}

                {/* Step 8: Complete */}
                {activeStep?.id === 8 && (
                  <motion.div
                    key="complete"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    className="absolute inset-0 flex flex-col items-center justify-center"
                  >
                    <motion.div
                      animate={{
                        scale: [1, 1.1, 1],
                        rotate: [0, 5, -5, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                      }}
                      className="relative"
                    >
                      <div className="absolute inset-0 bg-green-400/30 rounded-full blur-3xl scale-150" />
                      <div className="bg-gradient-to-br from-green-400 to-green-500 text-white p-12 rounded-full shadow-2xl relative z-10">
                        <CheckCircle className="w-20 h-20" />
                      </div>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="mt-8 text-center"
                    >
                      <div className="inline-block bg-green-100 border-2 border-green-400 rounded-full px-6 py-3 mb-4">
                        <p className="text-green-800 font-bold text-lg">Appointment Booked</p>
                      </div>
                      <p className="text-2xl font-semibold text-gray-800 mb-2">
                        Complete Automation
                      </p>
                      <p className="text-gray-600">Zero human intervention required</p>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Controls */}
            <div className="flex justify-center items-center space-x-4 relative z-10">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={togglePlayPause}
                className="flex items-center space-x-2 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-full font-semibold shadow-lg transition-colors"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-5 h-5" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    <span>Play</span>
                  </>
                )}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={resetAnimation}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-full font-semibold shadow-lg transition-colors"
              >
                Restart
              </motion.button>
            </div>
          </div>

          {/* Timeline Steps */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
            {steps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className={`p-4 rounded-xl border-2 transition-all ${
                  activeStep?.id === step.id
                    ? 'bg-primary/10 border-primary shadow-lg scale-105'
                    : 'bg-white border-gray-200 hover:border-primary/50'
                }`}
              >
                <div
                  className={`flex items-center justify-center w-12 h-12 rounded-full mb-3 transition-colors ${
                    activeStep?.id === step.id
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {step.icon}
                </div>
                <p className="font-semibold text-gray-900 text-sm mb-1">{step.label}</p>
                <p className="text-xs text-gray-600">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
