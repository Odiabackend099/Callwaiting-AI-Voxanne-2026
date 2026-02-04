'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useBooking } from '@/hooks/useBooking';
import Step1Contact from './Step1Contact';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BookingModal({ isOpen, onClose }: BookingModalProps) {
  const {
    data,
    error,
    updateData,
    redirectToCalendly,
    reset,
  } = useBooking();

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleContactSubmit = async () => {
    try {
      // Submit contact details to backend, then redirect to Calendly
      await redirectToCalendly();
      // Close modal after successful submission and redirect
      handleClose();
    } catch (error) {
      // Error is already set in useBooking hook, just log it here
      console.error('Failed to submit contact details:', error);
      // Don't close modal - let user see the error and try again
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-obsidian/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden pointer-events-auto"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-surgical-600 to-surgical-500 text-white px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Book an Appointment</h2>
                  <p className="text-sm text-white/80 mt-0.5">
                    Enter your details to continue to scheduling
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="w-10 h-10 rounded-lg hover:bg-white/20 flex items-center justify-center transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm"
                  >
                    {error}
                  </motion.div>
                )}

                {/* Contact Form */}
                <Step1Contact
                  firstName={data.firstName}
                  lastName={data.lastName}
                  email={data.email}
                  phone={data.phone || ''}
                  onUpdate={updateData}
                  onNext={handleContactSubmit}
                />
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
