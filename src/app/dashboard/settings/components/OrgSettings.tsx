'use client';

import React, { useState, useEffect } from 'react';
import { useOrg } from '@/hooks/useOrg';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, CheckCircle, Loader, Building2 } from 'lucide-react';

interface OrgData {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}

export function OrgSettings() {
  const orgId = useOrg();
  const { user } = useAuth();
  const [org, setOrg] = useState<OrgData | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check if user is admin
  const isAdmin = user?.app_metadata?.role === 'admin' || user?.user_metadata?.role === 'admin';

  useEffect(() => {
    if (!orgId) return;

    const fetchOrg = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/orgs/${orgId}`, {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Failed to load organization (${response.status})`);
        }

        const data: OrgData = await response.json();
        setOrg(data);
        setFormData({ name: data.name || '' });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load organization');
      } finally {
        setLoading(false);
      }
    };

    fetchOrg();
  }, [orgId]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Organization name is required');
      return;
    }

    if (formData.name.length > 100) {
      setError('Organization name must be less than 100 characters');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/orgs/${orgId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: formData.name }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to save (${response.status})`);
      }

      const updated: OrgData = await response.json();
      setOrg(updated);
      setSuccess('Organization updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-slate-900/50 backdrop-blur-md border border-slate-800/50">
        <div className="flex items-center justify-center py-8">
          <Loader className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 rounded-2xl bg-amber-900/20 backdrop-blur-md border border-amber-800/50">
        <p className="text-sm text-amber-200 tracking-tight">
          Only administrators can modify organization settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Card */}
      <div className="p-6 rounded-2xl bg-slate-900/50 backdrop-blur-md border border-slate-800/50 transition-all duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-semibold text-slate-50 tracking-tight">Organization</h2>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-900/20 border border-red-800/50 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 tracking-tight">{error}</p>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mb-6 p-4 rounded-lg bg-emerald-900/20 border border-emerald-800/50 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-300 tracking-tight">{success}</p>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          {/* Name Input */}
          <div>
            <label className="block text-xs font-medium text-slate-400 tracking-tight mb-2 uppercase">
              Organization Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ name: e.target.value })}
              placeholder="Enter organization name"
              disabled={saving}
              className="w-full px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-50 placeholder-slate-500 text-sm tracking-tight focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all duration-200 disabled:opacity-50"
            />
            <p className="text-xs text-slate-500 mt-2 tracking-tight">
              {formData.name.length}/100 characters
            </p>
          </div>

          {/* Status (Read-Only) */}
          <div>
            <label className="block text-xs font-medium text-slate-400 tracking-tight mb-2 uppercase">
              Status
            </label>
            <div className="px-4 py-2 rounded-lg bg-slate-800/30 border border-slate-700/30 text-slate-400 text-sm tracking-tight capitalize flex items-center justify-between">
              <span>{org?.status || 'active'}</span>
              <span className="text-xs text-slate-500">(managed by support)</span>
            </div>
          </div>

          {/* Org ID (Read-Only) */}
          <div>
            <label className="block text-xs font-medium text-slate-400 tracking-tight mb-2 uppercase">
              Organization ID
            </label>
            <div className="px-4 py-2 rounded-lg bg-slate-800/30 border border-slate-700/30 text-slate-400 text-xs tracking-tight font-mono">
              {orgId}
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving || !formData.name.trim()}
            className="w-full mt-6 px-4 py-2 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 disabled:bg-slate-700 text-slate-50 font-medium text-sm tracking-tight transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
