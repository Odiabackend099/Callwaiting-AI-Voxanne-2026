'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

interface InviteFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const InviteForm: React.FC<InviteFormProps> = ({ onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'manager' | 'agent' | 'viewer'>('agent');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    setError(null);

    if (!email || email.trim().length === 0) {
      setError('Email is required');
      return false;
    }

    // Simple email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address');
      return false;
    }

    if (!role) {
      setError('Role is required');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        email: email.trim(),
        role: role,
      };

      await authedBackendFetch<any>('/api/team/members', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSuccess('Invitation sent successfully');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      const error = err as any;
      setError(error?.message || 'Error sending invitation. Please try again.');
      console.error('Submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleDescriptions: Record<string, string> = {
    admin: 'Full access to all settings and team management',
    manager: 'Can view reports and configure agents',
    agent: 'Can access calls and contacts',
    viewer: 'Read-only access to dashboard',
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      {/* Email Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
        <input
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="team@example.com"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          disabled={isSubmitting}
        />
        <p className="text-xs text-gray-500 mt-1">
          An invitation will be sent to this email address
        </p>
      </div>

      {/* Role Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
        <div className="space-y-2">
          {(['admin', 'manager', 'agent', 'viewer'] as const).map((r) => (
            <label key={r} className="flex items-start">
              <input
                type="radio"
                name="role"
                value={r}
                checked={role === r}
                onChange={(e) => setRole(e.target.value as typeof role)}
                disabled={isSubmitting}
                className="w-4 h-4 text-emerald-600 mt-0.5"
              />
              <div className="ml-3">
                <span className="text-sm font-medium text-gray-900 capitalize">{r}</span>
                <p className="text-xs text-gray-500">{roleDescriptions[r]}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader className="w-4 h-4 animate-spin" />}
          {isSubmitting ? 'Sending...' : 'Send Invitation'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};
