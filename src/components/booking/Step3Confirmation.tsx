'use client';

import { motion } from 'framer-motion';
import { CheckCircle, Calendar, Clock, Mail, Phone } from 'lucide-react';

interface Step3ConfirmationProps {
  firstName: string;
  lastName: string;
  email: string;
  selectedDate: Date | null;
  selectedTime: string | null;
  confirmationNumber?: string;
  onClose: () => void;
}

export default function Step3Confirmation({
  firstName,
  lastName,
  email,
  selectedDate,
  selectedTime,
  confirmationNumber,
  onClose,
}: Step3ConfirmationProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (time: string | null) => {
    if (!time) return '';
    const [hour, min] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${String(min).padStart(2, '0')} ${period}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Success Icon */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="inline-block"
        >
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
        </motion.div>
        <h2 className="text-2xl font-bold text-obsidian mb-2">Appointment Confirmed!</h2>
        <p className="text-sm text-obsidian/60">
          We've sent a confirmation email to <span className="font-medium text-obsidian">{email}</span>
        </p>
      </div>

      {/* Appointment Details Card */}
      <div className="bg-surgical-50 rounded-xl p-6 border border-surgical-200 space-y-4">
        <h3 className="font-semibold text-obsidian mb-4">Appointment Details</h3>

        <div className="space-y-3">
          {/* Name */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center border border-surgical-200">
              <span className="text-lg font-bold text-surgical-600">
                {firstName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-xs text-obsidian/60">Name</p>
              <p className="font-medium text-obsidian">
                {firstName} {lastName}
              </p>
            </div>
          </div>

          {/* Date */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center border border-surgical-200">
              <Calendar className="w-5 h-5 text-surgical-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-obsidian/60">Date</p>
              <p className="font-medium text-obsidian">{formatDate(selectedDate)}</p>
            </div>
          </div>

          {/* Time */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center border border-surgical-200">
              <Clock className="w-5 h-5 text-surgical-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-obsidian/60">Time</p>
              <p className="font-medium text-obsidian">{formatTime(selectedTime)}</p>
              <p className="text-xs text-obsidian/50">30 minutes duration</p>
            </div>
          </div>

          {/* Confirmation Number */}
          {confirmationNumber && (
            <div className="flex items-start gap-3 pt-3 border-t border-surgical-200">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center border border-surgical-200">
                <Mail className="w-5 h-5 text-surgical-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-obsidian/60">Confirmation #</p>
                <p className="font-mono text-sm font-medium text-surgical-600">
                  {confirmationNumber}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* What's Next Section */}
      <div className="bg-white rounded-xl p-6 border border-surgical-200">
        <h3 className="font-semibold text-obsidian mb-3">What happens next?</h3>
        <ul className="space-y-2.5 text-sm text-obsidian/70">
          <li className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-surgical-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-surgical-600">1</span>
            </div>
            <span>Check your email for the appointment confirmation and calendar invite</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-surgical-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-surgical-600">2</span>
            </div>
            <span>Add the appointment to your calendar with one click</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-surgical-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-surgical-600">3</span>
            </div>
            <span>We'll send you a reminder 24 hours before your appointment</span>
          </li>
        </ul>
      </div>

      {/* Need to Reschedule */}
      <div className="text-center bg-surgical-50 rounded-xl p-4 border border-surgical-200">
        <p className="text-sm font-medium text-obsidian mb-2">Need to reschedule?</p>
        <p className="text-xs text-obsidian/60">
          Contact us at{' '}
          <a href="mailto:support@voxanne.ai" className="text-surgical-600 hover:underline">
            support@voxanne.ai
          </a>{' '}
          or call{' '}
          <a href="tel:+442074240382" className="text-surgical-600 hover:underline">
            +44 7424 038250
          </a>
        </p>
      </div>

      {/* Close Button */}
      <button
        onClick={onClose}
        className="w-full bg-surgical-600 hover:bg-surgical-700 text-white font-semibold py-3.5 rounded-xl transition-colors shadow-lg shadow-surgical-600/30 hover:shadow-surgical-700/40"
      >
        Done
      </button>
    </motion.div>
  );
}
