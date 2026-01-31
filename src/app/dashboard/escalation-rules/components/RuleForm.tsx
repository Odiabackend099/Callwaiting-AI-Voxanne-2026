'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

interface EscalationRule {
    id: string;
    name: string;
    agent_id?: string;
    trigger_type: 'wait_time' | 'sentiment' | 'ai_request' | 'manual';
    transfer_number: string;
    max_wait_seconds?: number;
    sentiment_threshold?: number;
    enabled: boolean;
    priority: number;
}

interface RuleFormProps {
    rule?: EscalationRule | null;
    onClose: () => void;
    onSuccess: () => void;
}

export const RuleForm: React.FC<RuleFormProps> = ({ rule, onClose, onSuccess }) => {
    const [formData, setFormData] = useState<Partial<EscalationRule>>({
        name: rule?.name || '',
        agent_id: rule?.agent_id || '',
        trigger_type: rule?.trigger_type || 'wait_time',
        transfer_number: rule?.transfer_number || '',
        max_wait_seconds: rule?.max_wait_seconds || 300,
        sentiment_threshold: rule?.sentiment_threshold || 0.5,
        enabled: rule?.enabled !== false,
        priority: rule?.priority || 1,
    });

    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [agents, setAgents] = useState<Array<{ id: string; email: string }>>([]);
    const [agentsLoading, setAgentsLoading] = useState(false);

    // Fetch agents list
    useEffect(() => {
        const fetchAgents = async () => {
            setAgentsLoading(true);
            try {
                const data = await authedBackendFetch<any>('/api/agents');
                setAgents(data || []);
            } catch (err) {
                console.error('Error fetching agents:', err);
            } finally {
                setAgentsLoading(false);
            }
        };

        fetchAgents();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;

        if (type === 'checkbox') {
            setFormData(prev => ({
                ...prev,
                [name]: (e.target as HTMLInputElement).checked,
            }));
        } else if (type === 'number') {
            setFormData(prev => ({
                ...prev,
                [name]: parseFloat(value),
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value,
            }));
        }
    };

    const validateForm = (): boolean => {
        setError(null);

        if (!formData.name || formData.name.trim().length < 3) {
            setError('Rule name must be at least 3 characters');
            return false;
        }

        if (!formData.transfer_number) {
            setError('Transfer number is required');
            return false;
        }

        // Validate E.164 format (simplified)
        if (!/^\+\d{1,15}$/.test(formData.transfer_number)) {
            setError('Phone number must be in E.164 format (e.g., +1-202-555-0123)');
            return false;
        }

        if (!formData.priority || formData.priority < 1 || formData.priority > 100) {
            setError('Priority must be between 1 and 100');
            return false;
        }

        if (formData.trigger_type === 'wait_time') {
            if (!formData.max_wait_seconds || formData.max_wait_seconds < 60 || formData.max_wait_seconds > 600) {
                setError('Wait time must be between 60 and 600 seconds');
                return false;
            }
        }

        if (formData.trigger_type === 'sentiment') {
            if (formData.sentiment_threshold === undefined || formData.sentiment_threshold < 0 || formData.sentiment_threshold > 1) {
                setError('Sentiment threshold must be between 0 and 1');
                return false;
            }
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
                name: formData.name,
                agent_id: formData.agent_id || null,
                trigger_type: formData.trigger_type,
                transfer_number: formData.transfer_number,
                ...(formData.trigger_type === 'wait_time' && { max_wait_seconds: formData.max_wait_seconds }),
                ...(formData.trigger_type === 'sentiment' && { sentiment_threshold: formData.sentiment_threshold }),
                enabled: formData.enabled,
                priority: formData.priority,
            };

            const url = rule ? `/api/escalation-rules/${rule.id}` : '/api/escalation-rules';
            const method = rule ? 'PATCH' : 'POST';

            await authedBackendFetch<any>(url, {
                method,
                body: JSON.stringify(payload),
            });

            setSuccess(`Rule ${rule ? 'updated' : 'created'} successfully`);
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1500);
        } catch (err) {
            const error = err as any;
            setError(error?.message || 'Error saving rule. Please try again.');
            console.error('Submit error:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Alert */}
            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            {/* Success Alert */}
            {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{success}</span>
                </div>
            )}

            {/* Rule Name */}
            <div>
                <label className="block text-sm font-medium text-obsidian/70 mb-1">Rule Name *</label>
                <input
                    type="text"
                    name="name"
                    value={formData.name || ''}
                    onChange={handleInputChange}
                    placeholder="e.g., Wait 5 minutes then transfer"
                    className="w-full px-3 py-2 border border-surgical-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-surgical-500"
                    disabled={isSubmitting}
                />
            </div>

            {/* Agent Selection */}
            <div>
                <label className="block text-sm font-medium text-obsidian/70 mb-1">Agent (Optional)</label>
                <select
                    name="agent_id"
                    value={formData.agent_id || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-surgical-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-surgical-500"
                    disabled={isSubmitting || agentsLoading}
                >
                    <option value="">All Agents</option>
                    {agents.map(agent => (
                        <option key={agent.id} value={agent.id}>
                            {agent.email}
                        </option>
                    ))}
                </select>
                <p className="text-xs text-obsidian/60 mt-1">Leave empty to apply to all agents</p>
            </div>

            {/* Trigger Type */}
            <div>
                <label className="block text-sm font-medium text-obsidian/70 mb-2">Trigger Type *</label>
                <div className="space-y-2">
                    {(['wait_time', 'sentiment', 'ai_request', 'manual'] as const).map(trigger => (
                        <label key={trigger} className="flex items-center">
                            <input
                                type="radio"
                                name="trigger_type"
                                value={trigger}
                                checked={formData.trigger_type === trigger}
                                onChange={handleInputChange}
                                disabled={isSubmitting}
                                className="w-4 h-4 text-surgical-600"
                            />
                            <span className="ml-2 text-sm">
                                {trigger === 'wait_time' && 'Wait Time: Transfer after X seconds'}
                                {trigger === 'sentiment' && 'Sentiment: Transfer if negative sentiment'}
                                {trigger === 'ai_request' && 'AI Request: Transfer when AI requests'}
                                {trigger === 'manual' && 'Manual: Transfer by human agent'}
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Conditional: Wait Time */}
            {formData.trigger_type === 'wait_time' && (
                <div>
                    <label className="block text-sm font-medium text-obsidian/70 mb-1">Max Wait Time (seconds) *</label>
                    <input
                        type="number"
                        name="max_wait_seconds"
                        value={formData.max_wait_seconds || 300}
                        onChange={handleInputChange}
                        min="60"
                        max="600"
                        step="30"
                        className="w-full px-3 py-2 border border-surgical-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-surgical-500"
                        disabled={isSubmitting}
                    />
                    <p className="text-xs text-obsidian/60 mt-1">60-600 seconds (1-10 minutes)</p>
                </div>
            )}

            {/* Conditional: Sentiment Threshold */}
            {formData.trigger_type === 'sentiment' && (
                <div>
                    <label className="block text-sm font-medium text-obsidian/70 mb-1">Sentiment Threshold *</label>
                    <input
                        type="range"
                        name="sentiment_threshold"
                        value={formData.sentiment_threshold || 0.5}
                        onChange={handleInputChange}
                        min="0"
                        max="1"
                        step="0.1"
                        className="w-full"
                        disabled={isSubmitting}
                    />
                    <div className="flex justify-between text-xs text-obsidian/60 mt-1">
                        <span>Positive (0)</span>
                        <span className="font-medium">{(formData.sentiment_threshold || 0.5).toFixed(1)}</span>
                        <span>Negative (1)</span>
                    </div>
                    <p className="text-xs text-obsidian/60 mt-2">
                        Transfer if sentiment score is higher than {(formData.sentiment_threshold || 0.5).toFixed(1)}
                    </p>
                </div>
            )}

            {/* Transfer Number */}
            <div>
                <label className="block text-sm font-medium text-obsidian/70 mb-1">Transfer To (Phone Number) *</label>
                <input
                    type="tel"
                    name="transfer_number"
                    value={formData.transfer_number || ''}
                    onChange={handleInputChange}
                    placeholder="+1-202-555-0123"
                    className="w-full px-3 py-2 border border-surgical-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-surgical-500"
                    disabled={isSubmitting}
                />
                <p className="text-xs text-obsidian/60 mt-1">E.164 format: +1-XXX-XXX-XXXX</p>
            </div>

            {/* Priority */}
            <div>
                <label className="block text-sm font-medium text-obsidian/70 mb-1">Priority (1-100) *</label>
                <input
                    type="number"
                    name="priority"
                    value={formData.priority || 1}
                    onChange={handleInputChange}
                    min="1"
                    max="100"
                    className="w-full px-3 py-2 border border-surgical-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-surgical-500"
                    disabled={isSubmitting}
                />
                <p className="text-xs text-obsidian/60 mt-1">Lower number = higher priority</p>
            </div>

            {/* Enabled Toggle */}
            <div className="flex items-center">
                <input
                    type="checkbox"
                    name="enabled"
                    checked={formData.enabled !== false}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-surgical-600 rounded focus:ring-surgical-500"
                    disabled={isSubmitting}
                />
                <label className="ml-2 text-sm font-medium text-obsidian/70">Enabled</label>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-surgical-600 text-white px-4 py-2 rounded-lg hover:bg-surgical-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isSubmitting && <Loader className="w-4 h-4 animate-spin" />}
                    {isSubmitting ? 'Saving...' : rule ? 'Update Rule' : 'Create Rule'}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="flex-1 bg-surgical-100 text-obsidian px-4 py-2 rounded-lg hover:bg-surgical-50 disabled:opacity-50"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
};
