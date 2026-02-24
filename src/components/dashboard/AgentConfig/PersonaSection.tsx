'use client';

import React from 'react';
import { LayoutTemplate, Check } from 'lucide-react';
import { PromptTemplate } from '@/lib/prompt-templates';

interface PersonaSectionProps {
  templates: PromptTemplate[];
  selectedTemplateId: string | null;
  onSelectTemplate: (templateId: string) => void;
}

export const PersonaSection: React.FC<PersonaSectionProps> = ({
  templates,
  selectedTemplateId,
  onSelectTemplate,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-surgical-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-semibold text-obsidian flex items-center gap-2">
          <LayoutTemplate className="w-5 h-5 text-surgical-600" />
          AI Persona
        </h3>
        <span className="text-xs text-obsidian/40 font-medium">Choose your agent&apos;s personality</span>
      </div>
      <p className="text-xs text-obsidian/50 mb-4">
        Selecting a persona pre-fills your system prompt and first message with a proven template.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {templates.map((template) => {
          const isSelected = selectedTemplateId === template.id;
          return (
            <button
              key={template.id}
              onClick={() => onSelectTemplate(template.id)}
              className={`text-left p-4 rounded-xl border-2 transition-all group relative ${
                isSelected
                  ? 'border-surgical-600 bg-surgical-50 shadow-sm'
                  : 'border-surgical-200 hover:border-surgical-400 hover:bg-surgical-50/50'
              }`}
            >
              {isSelected && (
                <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-surgical-600 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </span>
              )}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-2xl leading-none">{template.icon}</span>
                <div>
                  <div className="font-semibold text-obsidian text-sm leading-tight">{template.name}</div>
                  <div className="text-xs text-surgical-600 font-medium">{template.persona}</div>
                </div>
              </div>
              <p className="text-xs text-obsidian/60 leading-relaxed">
                {template.tagline}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
