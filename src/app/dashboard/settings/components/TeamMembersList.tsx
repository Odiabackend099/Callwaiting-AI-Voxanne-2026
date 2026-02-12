'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import useSWR from 'swr';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import { Plus, Trash2, AlertCircle, CheckCircle, Loader, Shield, User } from 'lucide-react';
import { InviteForm } from './InviteForm';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  role: 'admin' | 'manager' | 'agent' | 'viewer';
  created_at: string;
}

const fetcher = (url: string) => authedBackendFetch<any>(url);

export const TeamMembersList: React.FC = () => {
  const { user } = useAuth();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);

  // Fetch team members
  const { data: members = [], error: membersError, mutate: mutateMembers, isLoading } = useSWR(
    user ? '/api/team/members' : null,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 0,
    }
  );

  // Error handling
  useEffect(() => {
    if (membersError) {
      setError('Failed to load team members. Please try again.');
    }
  }, [membersError]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleRemoveMember = async (memberId: string) => {
    setRemovingMemberId(memberId);
    try {
      await authedBackendFetch<any>(`/api/team/members/${memberId}`, {
        method: 'DELETE',
      });

      setSuccess('Team member removed successfully');
      mutateMembers();
    } catch (err) {
      const error = err as any;
      setError(error?.message || 'Error removing team member. Please try again.');
      console.error('Remove error:', err);
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleRemoveClick = (member: TeamMember) => {
    setMemberToRemove(member);
    setShowRemoveConfirm(true);
  };

  const handleRemoveConfirm = async () => {
    if (!memberToRemove) return;

    setShowRemoveConfirm(false);
    await handleRemoveMember(memberToRemove.id);
    setMemberToRemove(null);
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    setChangingRoleId(memberId);
    try {
      await authedBackendFetch<any>(`/api/team/members/${memberId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });

      setSuccess('Team member role updated successfully');
      mutateMembers();
    } catch (err) {
      const error = err as any;
      setError(error?.message || 'Error updating team member role. Please try again.');
      console.error('Role change error:', err);
    } finally {
      setChangingRoleId(null);
    }
  };

  const getRoleIcon = (role: string) => {
    if (role === 'admin') return <Shield className="w-4 h-4" />;
    return <User className="w-4 h-4" />;
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-surgical-100 text-surgical-600',
      manager: 'bg-surgical-100 text-surgical-600',
      agent: 'bg-green-100 text-green-800',
      viewer: 'bg-surgical-50 text-obsidian/60',
    };
    return colors[role] || 'bg-surgical-50 text-obsidian/60';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-obsidian">Team Members</h2>
          <p className="text-obsidian/60 mt-1">Manage your team and assign roles</p>
        </div>
        <button
          type="button"
          onClick={() => setShowInviteForm(true)}
          className="bg-surgical-600 text-white px-4 py-2 rounded-lg hover:bg-surgical-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Invite Member
        </button>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto text-red-600 hover:text-red-800"
          >
            ✕
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3 text-green-700">
          <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="font-medium">{success}</p>
        </div>
      )}

      {/* Team Members Table */}
      <div className="glass-panel rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader className="w-6 h-6 animate-spin text-surgical-600" />
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-obsidian/60 mb-4">No team members yet</p>
            <button
              type="button"
              onClick={() => setShowInviteForm(true)}
              className="text-surgical-600 hover:text-surgical-500 font-medium"
            >
              Invite your first team member
            </button>
          </div>
        ) : (
          <table className="w-full divide-y divide-surgical-200">
            <thead className="bg-surgical-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-obsidian/70 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-obsidian/70 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-obsidian/70 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-obsidian/70 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surgical-200">
              {members.map((member: TeamMember) => (
                <tr key={member.id} className="hover:bg-surgical-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-surgical-400 to-surgical-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                        {member.email?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-obsidian">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="relative group inline-block">
                      <select
                        value={member.role}
                        onChange={(e) => handleChangeRole(member.id, e.target.value)}
                        disabled={changingRoleId === member.id}
                        className={`px-3 py-1 rounded-full text-sm font-medium border-0 cursor-pointer ${getRoleColor(
                          member.role
                        )} disabled:opacity-50`}
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="agent">Agent</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-obsidian/60">
                    {new Date(member.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      type="button"
                      onClick={() => handleRemoveClick(member)}
                      disabled={removingMemberId === member.id}
                      className="text-red-600 hover:text-red-700 inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      {removingMemberId === member.id ? 'Removing...' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite Form Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 border border-surgical-200">
            <h2 className="text-2xl font-bold mb-4 text-obsidian">Invite Team Member</h2>
            <InviteForm
              onClose={() => setShowInviteForm(false)}
              onSuccess={() => {
                setShowInviteForm(false);
                mutateMembers();
              }}
            />
          </div>
        </div>
      )}

      {/* Remove Member Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showRemoveConfirm}
        title="Remove Team Member"
        message={`Are you sure you want to remove ${memberToRemove?.email} from the team? This action cannot be undone.`}
        confirmText="Remove"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleRemoveConfirm}
        onCancel={() => {
          setShowRemoveConfirm(false);
          setMemberToRemove(null);
        }}
      />
    </div>
  );
};
