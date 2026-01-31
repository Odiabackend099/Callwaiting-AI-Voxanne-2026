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
      <div className="p-6 rounded-2xl bg-white backdrop-blur-md border border-surgical-200">
        <div className="flex items-center justify-center py-8">
          <Loader className="w-5 h-5 animate-spin text-obsidian/40" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 rounded-2xl bg-surgical-50 backdrop-blur-md border border-surgical-200">
        <p className="text-sm text-obsidian/60 tracking-tight">
          Only administrators can modify organization settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Card */}
      <div className="p-6 rounded-2xl bg-white backdrop-blur-md border border-surgical-200 transition-all duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="w-5 h-5 text-surgical-500" />
          <h2 className="text-lg font-semibold text-obsidian tracking-tight">Organization</h2>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 tracking-tight">{error}</p>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-700 tracking-tight">{success}</p>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          {/* Name Input */}
          <div>
            <label className="block text-xs font-medium text-obsidian/40 tracking-tight mb-2 uppercase">
              Organization Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ name: e.target.value })}
              placeholder="Enter organization name"
              disabled={saving}
              className="w-full px-4 py-2 rounded-lg bg-surgical-50 border border-surgical-200 text-obsidian placeholder-obsidian/40 text-sm tracking-tight focus:outline-none focus:border-surgical-500 focus:ring-1 focus:ring-surgical-500 transition-all duration-200 disabled:opacity-50"
            />
            <p className="text-xs text-obsidian/60 mt-2 tracking-tight">
              {formData.name.length}/100 characters
            </p>
          </div>

          {/* Status (Read-Only) */}
          <div>
            <label className="block text-xs font-medium text-obsidian/40 tracking-tight mb-2 uppercase">
              Status
            </label>
            <div className="px-4 py-2 rounded-lg bg-surgical-50 border border-surgical-200 text-obsidian/60 text-sm tracking-tight capitalize flex items-center justify-between">
              <span>{org?.status || 'active'}</span>
              <span className="text-xs text-obsidian/40">(managed by support)</span>
            </div>
          </div>

          {/* Org ID (Read-Only) */}
          <div>
            <label className="block text-xs font-medium text-obsidian/40 tracking-tight mb-2 uppercase">
              Organization ID
            </label>
            <div className="px-4 py-2 rounded-lg bg-surgical-50 border border-surgical-200 text-obsidian/60 text-xs tracking-tight font-mono">
              {orgId}
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving || !formData.name.trim()}
            className="w-full mt-6 px-4 py-2 rounded-lg bg-surgical-600 hover:bg-surgical-700 disabled:bg-surgical-100 text-white font-medium text-sm tracking-tight transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
