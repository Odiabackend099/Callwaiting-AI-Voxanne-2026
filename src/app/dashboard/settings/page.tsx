"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft, Trash2 } from 'lucide-react';
import {
    getCurrentUser,
    getUserSettings,
    saveUserSettings,
    getKnowledgeBase,
    saveKnowledgeBase,
    deleteKnowledgeBase,
} from '@/lib/supabaseHelpers';

export default function SettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    const [businessName, setBusinessName] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [voicePersonality, setVoicePersonality] = useState<'professional' | 'friendly' | 'casual'>('professional');
    const [knowledgeBaseContent, setKnowledgeBaseContent] = useState('');
    const [knowledgeBaseDocs, setKnowledgeBaseDocs] = useState<any[]>([]);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const user = await getCurrentUser();
            if (!user) {
                router.push('/auth/login');
                return;
            }

            setUserId(user.id);

            const [settings, kbDocs] = await Promise.all([
                getUserSettings(user.id),
                getKnowledgeBase(user.id),
            ]);

            if (settings) {
                setBusinessName(settings.business_name || '');
                setSystemPrompt(settings.system_prompt || '');
                setVoicePersonality(settings.voice_personality || 'professional');
            }

            setKnowledgeBaseDocs(kbDocs);
        } catch (error) {
            console.error('Failed to load settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!userId) return;

        setSaving(true);
        try {
            await saveUserSettings(userId, {
                business_name: businessName,
                system_prompt: systemPrompt,
                voice_personality: voicePersonality,
            });

            // Save knowledge base if content provided
            if (knowledgeBaseContent.trim()) {
                await saveKnowledgeBase(userId, knowledgeBaseContent, 'knowledge.txt');
                setKnowledgeBaseContent('');
                // Reload knowledge base docs
                const kbDocs = await getKnowledgeBase(userId);
                setKnowledgeBaseDocs(kbDocs);
            }

            alert('Settings saved successfully!');
        } catch (error: any) {
            console.error('Failed to save settings:', error);
            alert(`Failed to save settings: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteKB = async (id: string) => {
        if (!confirm('Are you sure you want to delete this knowledge base document?')) return;

        try {
            await deleteKnowledgeBase(id);
            setKnowledgeBaseDocs(prev => prev.filter(doc => doc.id !== id));
        } catch (error: any) {
            console.error('Failed to delete knowledge base:', error);
            alert(`Failed to delete: ${error.message}`);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-400">Loading settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </button>
                    <h1 className="text-4xl font-bold text-white mb-2">
                        Voice Agent Settings
                    </h1>
                    <p className="text-slate-400">
                        Configure your Roxanne AI voice agent
                    </p>
                </div>

                {/* Settings Form */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 space-y-6"
                >
                    {/* Business Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Business Name
                        </label>
                        <input
                            type="text"
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            placeholder="e.g., Elite Aesthetics Clinic"
                            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                    </div>

                    {/* Voice Personality */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Voice Personality
                        </label>
                        <select
                            value={voicePersonality}
                            onChange={(e) => setVoicePersonality(e.target.value as any)}
                            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="professional">Professional</option>
                            <option value="friendly">Friendly</option>
                            <option value="casual">Casual</option>
                        </select>
                    </div>

                    {/* System Prompt */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            System Prompt
                        </label>
                        <textarea
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            placeholder="You are Roxanne, a helpful AI receptionist for [Business Name]. You assist with..."
                            rows={6}
                            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Define how Roxanne should behave and respond to customers
                        </p>
                    </div>

                    {/* Knowledge Base */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Add Knowledge Base Content
                        </label>
                        <textarea
                            value={knowledgeBaseContent}
                            onChange={(e) => setKnowledgeBaseContent(e.target.value)}
                            placeholder="Enter information about your services, pricing, FAQs, etc."
                            rows={6}
                            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            This information will be used to answer customer questions
                        </p>
                    </div>

                    {/* Existing Knowledge Base Documents */}
                    {knowledgeBaseDocs.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Existing Knowledge Base Documents
                            </label>
                            <div className="space-y-2">
                                {knowledgeBaseDocs.map((doc) => (
                                    <div
                                        key={doc.id}
                                        className="flex items-center justify-between p-3 bg-slate-900 border border-slate-700 rounded-lg"
                                    >
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-white">{doc.filename}</p>
                                            <p className="text-xs text-slate-500">
                                                {new Date(doc.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteKB(doc.id)}
                                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Save Button */}
                    <div className="flex justify-end pt-4">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:from-cyan-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <Save className="w-5 h-5" />
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
