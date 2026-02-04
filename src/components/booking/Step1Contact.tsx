'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Phone } from 'lucide-react';

interface Step1ContactProps {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  onUpdate: (data: { firstName: string; lastName: string; email: string; phone?: string }) => void;
  onNext: () => void;
}

export default function Step1Contact({
  firstName,
  lastName,
  email,
  phone,
  onUpdate,
  onNext,
}: Step1ContactProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onNext();
    }
  };

  const handleInputChange = (field: string, value: string) => {
    onUpdate({ firstName, lastName, email, phone, [field]: value });
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-obsidian mb-2">Let's get started</h2>
        <p className="text-sm text-obsidian/60">
          Enter your details to continue to our scheduling page
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* First Name */}
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-obsidian mb-1.5">
            First Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-obsidian/40" />
            <input
              type="text"
              id="firstName"
              value={firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              className={`w-full pl-11 pr-4 py-3 rounded-xl border ${
                errors.firstName
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-surgical-200 focus:ring-surgical-500'
              } focus:outline-none focus:ring-2 transition-all`}
              placeholder="John"
            />
          </div>
          {errors.firstName && (
            <p className="text-sm text-red-500 mt-1">{errors.firstName}</p>
          )}
        </div>

        {/* Last Name */}
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-obsidian mb-1.5">
            Last Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-obsidian/40" />
            <input
              type="text"
              id="lastName"
              value={lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              className={`w-full pl-11 pr-4 py-3 rounded-xl border ${
                errors.lastName
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-surgical-200 focus:ring-surgical-500'
              } focus:outline-none focus:ring-2 transition-all`}
              placeholder="Doe"
            />
          </div>
          {errors.lastName && (
            <p className="text-sm text-red-500 mt-1">{errors.lastName}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-obsidian mb-1.5">
            Email Address <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-obsidian/40" />
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={`w-full pl-11 pr-4 py-3 rounded-xl border ${
                errors.email
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-surgical-200 focus:ring-surgical-500'
              } focus:outline-none focus:ring-2 transition-all`}
              placeholder="john.doe@example.com"
            />
          </div>
          {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
        </div>

        {/* Phone (Optional) */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-obsidian mb-1.5">
            Phone Number <span className="text-obsidian/40 text-xs">(Optional)</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-obsidian/40" />
            <input
              type="tel"
              id="phone"
              value={phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-surgical-200 focus:outline-none focus:ring-2 focus:ring-surgical-500 transition-all"
              placeholder="+1 (555) 000-0000"
            />
          </div>
        </div>

        {/* Continue Button */}
        <button
          type="submit"
          className="w-full bg-surgical-600 hover:bg-surgical-700 text-white font-semibold py-3.5 rounded-xl transition-colors mt-6 shadow-lg shadow-surgical-600/30 hover:shadow-surgical-700/40"
        >
          Continue to Scheduling
        </button>
      </form>
    </motion.div>
  );
}
