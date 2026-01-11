'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit2, Trash2, AlertCircle, CheckCircle, XCircle, Loader } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import useSWR from 'swr';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import { RuleForm } from './components/RuleForm';

const fetcher = (url: string) => authedBackendFetch<any>(url);

interface EscalationRule {
    id: string;
    org_id: string;
    name: string;
    agent_id?: string;
    agent_email?: string;
    trigger_type: 'wait_time' | 'sentiment' | 'ai_request' | 'manual';
    transfer_number: string;
    max_wait_seconds?: number;
    sentiment_threshold?: number;
    enabled: boolean;
    priority: number;
    created_at: string;
    updated_at: string;
}

const EscalationRulesPage = () => {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [showRuleModal, setShowRuleModal] = useState(false);
    const [editingRule, setEditingRule] = useState<EscalationRule | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

    // Fetch escalation rules
    const { data: rulesData, error: rulesError, mutate: mutateRules, isLoading: isRulesLoading } = useSWR(
        user ? '/api/escalation-rules' : null,
        fetcher,
        {
            revalidateOnFocus: false,
            refreshInterval: 0,
        }
    );

    const rules = (rulesData as EscalationRule[]) || [];

    // Auth check
    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    // Error handling
    useEffect(() => {
        if (rulesError) {
            setError('Failed to load escalation rules. Please try again.');
        }
    }, [rulesError]);

    // Clear success message after 3 seconds
    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    const handleDeleteRule = async (ruleId: string) => {
        setDeletingRuleId(ruleId);
        try {
            await authedBackendFetch<any>(`/api/escalation-rules/${ruleId}`, {
                method: 'DELETE',
            });

            setSuccess('Rule deleted successfully');
            mutateRules();
        } catch (err) {
            const error = err as any;
            setError(error?.message || 'Error deleting rule. Please try again.');
            console.error('Delete error:', err);
        } finally {
            setDeletingRuleId(null);
        }
    };

    const handleToggleEnabled = async (rule: EscalationRule) => {
        try {
            await authedBackendFetch<any>(`/api/escalation-rules/${rule.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    enabled: !rule.enabled,
                }),
            });

            setSuccess(`Rule ${!rule.enabled ? 'enabled' : 'disabled'} successfully`);
            mutateRules();
        } catch (err) {
            const error = err as any;
            setError(error?.message || 'Error updating rule. Please try again.');
            console.error('Update error:', err);
        }
    };

    const getTriggerLabel = (triggerType: string) => {
        const labels: Record<string, string> = {
            wait_time: 'Wait Time',
            sentiment: 'Sentiment',
            ai_request: 'AI Request',
            manual: 'Manual',
        };
        return labels[triggerType] || triggerType;
    };

    if (!user) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Escalation Rules</h1>
                        <p className="text-gray-600 mt-2">Manage call transfer rules and escalation triggers</p>
                    </div>
                    <button
                        onClick={() => {
                            setEditingRule(null);
                            setShowRuleModal(true);
                        }}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Create Rule
                    </button>
                </div>

                {/* Alert Messages */}
                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
                        <AlertCircle className="w-5 h-5" />
                        {error}
                        <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
                            ✕
                        </button>
                    </div>
                )}

                {success && (
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
                        <CheckCircle className="w-5 h-5" />
                        {success}
                    </div>
                )}

                {/* Rules Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    {isRulesLoading ? (
                        <div className="p-8 flex justify-center">
                            <Loader className="w-6 h-6 animate-spin text-emerald-600" />
                        </div>
                    ) : rules.length === 0 ? (
                        <div className="p-8 text-center">
                            <p className="text-gray-600 mb-4">No escalation rules created yet</p>
                            <button
                                onClick={() => {
                                    setEditingRule(null);
                                    setShowRuleModal(true);
                                }}
                                className="text-emerald-600 hover:text-emerald-700 font-medium"
                            >
                                Create your first rule
                            </button>
                        </div>
                    ) : (
                        <table className="w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Trigger
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Transfer Number
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Priority
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {rules.map(rule => (
                                    <tr key={rule.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="font-medium text-gray-900">{rule.name}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                                                {getTriggerLabel(rule.trigger_type)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                                            {rule.transfer_number}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="font-medium text-gray-900">{rule.priority}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button
                                                onClick={() => handleToggleEnabled(rule)}
                                                className={`px-3 py-1 rounded-full text-sm font-medium ${
                                                    rule.enabled
                                                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                                }`}
                                            >
                                                {rule.enabled ? 'Enabled' : 'Disabled'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap space-x-2">
                                            <button
                                                onClick={() => {
                                                    setEditingRule(rule);
                                                    setShowRuleModal(true);
                                                }}
                                                className="text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Delete rule "${rule.name}"?`)) {
                                                        handleDeleteRule(rule.id);
                                                    }
                                                }}
                                                disabled={deletingRuleId === rule.id}
                                                className="text-red-600 hover:text-red-700 inline-flex items-center gap-1 disabled:opacity-50"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                {deletingRuleId === rule.id ? 'Deleting...' : 'Delete'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Stats Footer */}
                {rules.length > 0 && (
                    <div className="mt-6 grid grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-lg shadow">
                            <p className="text-gray-600 text-sm">Total Rules</p>
                            <p className="text-2xl font-bold text-gray-900">{rules.length}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow">
                            <p className="text-gray-600 text-sm">Enabled</p>
                            <p className="text-2xl font-bold text-green-600">{rules.filter(r => r.enabled).length}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow">
                            <p className="text-gray-600 text-sm">Disabled</p>
                            <p className="text-2xl font-bold text-gray-600">{rules.filter(r => !r.enabled).length}</p>
                        </div>
                    </div>
                )}

                {/* Rule Modal */}
                {showRuleModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                            <h2 className="text-2xl font-bold mb-4">
                                {editingRule ? 'Edit Rule' : 'Create New Rule'}
                            </h2>
                            <RuleForm
                                rule={editingRule}
                                onClose={() => setShowRuleModal(false)}
                                onSuccess={() => mutateRules()}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EscalationRulesPage;
