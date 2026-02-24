'use client';

import React from 'react';
import { Bot, MessageSquare, Info } from 'lucide-react';

interface PromptSectionProps {
  systemPrompt: string;
  firstMessage: string;
  onSystemPromptChange: (prompt: string) => void;
  onFirstMessageChange: (message: string) => void;
}

export const PromptSection: React.FC<PromptSectionProps> = ({
  systemPrompt,
  firstMessage,
  onSystemPromptChange,
  onFirstMessageChange,
}) => {
  return (
    <>
      {/* System Prompt */}
      <div className="bg-white rounded-xl shadow-sm border border-surgical-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-obsidian flex items-center gap-2">
            <Bot className="w-5 h-5 text-surgical-600" />
            System Prompt
            <span
              title="The instructions that define your AI agent's personality and behavior. Never spoken aloud — it's the agent's internal operating manual."
              className="text-obsidian/40 hover:text-obsidian/60 cursor-help"
            >
              <Info className="w-4 h-4" />
            </span>
          </h3>
          <span className="text-xs px-2 py-1 rounded-full bg-surgical-50 text-obsidian/60 font-medium">
            Core Personality
          </span>
        </div>
        <p className="text-sm text-obsidian/60 mb-4">
          Define how your agent behaves, speaks, and handles specific scenarios.
        </p>
        <textarea
          value={systemPrompt}
          onChange={(e) => onSystemPromptChange(e.target.value)}
          placeholder="You are a helpful AI assistant..."
          className="w-full h-64 min-h-[8rem] px-4 py-3 rounded-xl bg-surgical-50 border border-surgical-200 text-obsidian focus:ring-2 focus:ring-surgical-500 outline-none resize-y font-mono text-sm leading-relaxed"
        />
      </div>

      {/* First Message */}
      <div className="bg-white rounded-xl shadow-sm border border-surgical-200 p-6">
        <h3 className="text-lg font-semibold text-obsidian mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-surgical-600" />
          First Message
          <span
            title="The first sentence your AI agent speaks when the call connects. Keep it short and welcoming."
            className="text-obsidian/40 hover:text-obsidian/60 cursor-help"
          >
            <Info className="w-4 h-4" />
          </span>
        </h3>
        <p className="text-sm text-obsidian/60 mb-4">
          The very first thing your agent says when the call connects.
        </p>
        <textarea
          value={firstMessage}
          onChange={(e) => onFirstMessageChange(e.target.value)}
          placeholder="Hello! How can I help you today?"
          className="w-full h-24 px-4 py-3 rounded-xl bg-surgical-50 border border-surgical-200 text-obsidian focus:ring-2 focus:ring-surgical-500 outline-none resize-none"
        />
      </div>
    </>
  );
};
