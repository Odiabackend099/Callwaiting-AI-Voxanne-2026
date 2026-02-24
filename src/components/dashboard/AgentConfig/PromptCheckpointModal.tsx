'use client';

import React, { useState } from 'react';
import { AlertCircle, Edit2, Check } from 'lucide-react';

interface PromptCheckpointModalProps {
  isOpen: boolean;
  agentName: string;
  systemPrompt: string;
  firstMessage: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onEdit?: () => void;
  onCancel: () => void;
}

export const PromptCheckpointModal: React.FC<PromptCheckpointModalProps> = ({
  isOpen,
  agentName,
  systemPrompt,
  firstMessage,
  isLoading = false,
  onConfirm,
  onEdit,
  onCancel,
}) => {
  const [expandedPrompt, setExpandedPrompt] = useState(false);
  const [expandedFirstMessage, setExpandedFirstMessage] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-surgical-200">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-surgical-200 p-6 flex items-start gap-3">
          <div className="p-2 bg-surgical-50 rounded-lg shrink-0">
            <AlertCircle className="w-5 h-5 text-surgical-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-obsidian">
              Review Prompt Before Saving
            </h3>
            <p className="text-sm text-obsidian/60 mt-1">
              Review your agent's personality and behavior settings. Make sure
              they align with your business goals.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Agent Name */}
          <div className="bg-surgical-50 rounded-lg p-4 border border-surgical-200">
            <p className="text-xs font-semibold text-obsidian/60 uppercase tracking-wide mb-1">
              Agent Name
            </p>
            <p className="text-base font-medium text-obsidian">{agentName}</p>
          </div>

          {/* System Prompt Preview */}
          <div>
            <button
              type="button"
              onClick={() => setExpandedPrompt(!expandedPrompt)}
              className="flex items-center justify-between w-full text-left mb-2"
            >
              <div>
                <p className="text-xs font-semibold text-obsidian/60 uppercase tracking-wide">
                  System Prompt (Core Personality)
                </p>
                <p className="text-xs text-obsidian/40 mt-1">
                  The instructions that define your AI agent's behavior
                </p>
              </div>
              <span
                className={`text-obsidian/40 transition-transform ${
                  expandedPrompt ? 'rotate-180' : ''
                }`}
              >
                ▼
              </span>
            </button>
            <div
              className={`overflow-hidden transition-all duration-200 ${
                expandedPrompt ? 'max-h-96' : 'max-h-24'
              }`}
            >
              <div className="bg-obsidian/5 rounded-lg p-4 border border-surgical-200 font-mono text-sm text-obsidian/80 leading-relaxed break-words whitespace-pre-wrap">
                {systemPrompt || '(No system prompt set)'}
              </div>
            </div>
          </div>

          {/* First Message Preview */}
          <div>
            <button
              type="button"
              onClick={() => setExpandedFirstMessage(!expandedFirstMessage)}
              className="flex items-center justify-between w-full text-left mb-2"
            >
              <div>
                <p className="text-xs font-semibold text-obsidian/60 uppercase tracking-wide">
                  First Message
                </p>
                <p className="text-xs text-obsidian/40 mt-1">
                  What your agent says when the call connects
                </p>
              </div>
              <span
                className={`text-obsidian/40 transition-transform ${
                  expandedFirstMessage ? 'rotate-180' : ''
                }`}
              >
                ▼
              </span>
            </button>
            <div
              className={`overflow-hidden transition-all duration-200 ${
                expandedFirstMessage ? 'max-h-32' : 'max-h-16'
              }`}
            >
              <div className="bg-obsidian/5 rounded-lg p-4 border border-surgical-200 font-mono text-sm text-obsidian/80 leading-relaxed break-words whitespace-pre-wrap">
                {firstMessage || '(No first message set)'}
              </div>
            </div>
          </div>

          {/* Warning for empty prompts */}
          {(!systemPrompt || !firstMessage) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>⚠️ Tip:</strong> Your agent will use default prompts if
                you don't customize these. Make sure you've filled in at least
                the System Prompt for best results.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-surgical-200 p-6 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg font-medium text-obsidian/60 hover:bg-surgical-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onEdit || onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg font-medium text-surgical-600 bg-surgical-50 hover:bg-surgical-100 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-6 py-2 rounded-lg font-medium text-white bg-surgical-600 hover:bg-surgical-700 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm shadow-surgical-500/20"
          >
            <Check className="w-4 h-4" />
            {isLoading ? 'Saving...' : 'Confirm & Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
