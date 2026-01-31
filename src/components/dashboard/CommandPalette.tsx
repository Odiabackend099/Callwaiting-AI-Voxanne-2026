'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Activity, Phone, Bot, Zap, BookOpen, Target, Key, Settings, Bell } from 'lucide-react';

interface Command {
  id: string;
  title: string;
  category: string;
  icon: React.ReactNode;
  action: () => void;
  shortcut?: string;
}

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands: Command[] = [
    // Operations
    {
      id: 'dashboard',
      title: 'Dashboard',
      category: 'OPERATIONS',
      icon: <Activity className="w-4 h-4" />,
      action: () => {
        router.push('/dashboard');
        setOpen(false);
      },
      shortcut: '⌘1',
    },
    {
      id: 'calls',
      title: 'Call Logs',
      category: 'OPERATIONS',
      icon: <Phone className="w-4 h-4" />,
      action: () => {
        router.push('/dashboard/calls');
        setOpen(false);
      },
      shortcut: '⌘2',
    },
    {
      id: 'leads',
      title: 'Leads',
      category: 'OPERATIONS',
      icon: <Target className="w-4 h-4" />,
      action: () => {
        router.push('/dashboard/leads');
        setOpen(false);
      },
      shortcut: '⌘3',
    },

    // Voice Agent
    {
      id: 'agent-config',
      title: 'Agent Configuration',
      category: 'VOICE AGENT',
      icon: <Bot className="w-4 h-4" />,
      action: () => {
        router.push('/dashboard/agent-config');
        setOpen(false);
      },
      shortcut: '⌘4',
    },
    {
      id: 'escalation-rules',
      title: 'Escalation Rules',
      category: 'VOICE AGENT',
      icon: <Zap className="w-4 h-4" />,
      action: () => {
        router.push('/dashboard/escalation-rules');
        setOpen(false);
      },
    },
    {
      id: 'knowledge-base',
      title: 'Knowledge Base',
      category: 'VOICE AGENT',
      icon: <BookOpen className="w-4 h-4" />,
      action: () => {
        router.push('/dashboard/knowledge-base');
        setOpen(false);
      },
    },
    {
      id: 'test-agents',
      title: 'Test Agents',
      category: 'VOICE AGENT',
      icon: <Phone className="w-4 h-4" />,
      action: () => {
        router.push('/dashboard/test');
        setOpen(false);
      },
    },

    // Integrations
    {
      id: 'api-keys',
      title: 'API Keys',
      category: 'INTEGRATIONS',
      icon: <Key className="w-4 h-4" />,
      action: () => {
        router.push('/dashboard/api-keys');
        setOpen(false);
      },
    },
    {
      id: 'inbound-config',
      title: 'Telephony',
      category: 'INTEGRATIONS',
      icon: <Phone className="w-4 h-4" />,
      action: () => {
        router.push('/dashboard/inbound-config');
        setOpen(false);
      },
    },
    {
      id: 'settings',
      title: 'Settings',
      category: 'INTEGRATIONS',
      icon: <Settings className="w-4 h-4" />,
      action: () => {
        router.push('/dashboard/settings');
        setOpen(false);
      },
    },

    // Quick Access
    {
      id: 'notifications',
      title: 'Notifications',
      category: 'QUICK ACCESS',
      icon: <Bell className="w-4 h-4" />,
      action: () => {
        router.push('/dashboard/notifications');
        setOpen(false);
      },
    },
  ];

  // Filter commands based on search
  const filteredCommands = search.length === 0
    ? commands
    : commands.filter((cmd) =>
        cmd.title.toLowerCase().includes(search.toLowerCase()) ||
        cmd.category.toLowerCase().includes(search.toLowerCase())
      );

  // Group by category
  const groupedCommands = filteredCommands.reduce(
    (acc, cmd) => {
      const existingGroup = acc.find((g) => g.category === cmd.category);
      if (existingGroup) {
        existingGroup.commands.push(cmd);
      } else {
        acc.push({ category: cmd.category, commands: [cmd] });
      }
      return acc;
    },
    [] as Array<{ category: string; commands: Command[] }>
  );

  // Flatten for selection
  const flatCommands = groupedCommands.flatMap((g) => g.commands);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CMD+K or CTRL+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
        setSearch('');
        setSelectedIndex(0);
      }

      // Only handle navigation when open
      if (!open) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % flatCommands.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + flatCommands.length) % flatCommands.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (flatCommands[selectedIndex]) {
            flatCommands[selectedIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedIndex, flatCommands]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const items = listRef.current.querySelectorAll('[data-command-item]');
      if (items[selectedIndex]) {
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  return (
    <>
      {/* Command Palette Trigger - Keyboard Shortcut Hint */}
      {!open && (
        <div
          className="hidden md:fixed md:bottom-6 md:right-6 md:flex items-center gap-2 px-3 py-2 rounded-lg bg-surgical-50 text-obsidian/60 text-sm cursor-pointer hover:bg-surgical-100 transition-colors z-40"
          onClick={() => {
            setOpen(true);
            setSearch('');
            setSelectedIndex(0);
          }}
        >
          <Search className="w-4 h-4" />
          <span className="hidden lg:inline">Command Palette</span>
          <span className="text-xs bg-surgical-100 px-2 py-0.5 rounded ml-2">⌘K</span>
        </div>
      )}

      {/* Overlay and Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-obsidian/50 flex items-start justify-center pt-20"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col max-h-96"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-surgical-200">
              <Search className="w-5 h-5 text-obsidian/40" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search pages and commands..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedIndex(0);
                }}
                className="flex-1 bg-transparent text-base outline-none placeholder-obsidian/40"
              />
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-surgical-50 transition-colors"
              >
                <X className="w-5 h-5 text-obsidian/40" />
              </button>
            </div>

            {/* Commands List */}
            <div ref={listRef} className="overflow-y-auto flex-1">
              {groupedCommands.length === 0 ? (
                <div className="px-4 py-8 text-center text-obsidian/60">
                  No commands found
                </div>
              ) : (
                groupedCommands.map((group) => (
                  <div key={group.category}>
                    <div className="px-4 py-2 text-xs font-semibold text-obsidian/60 uppercase tracking-wider bg-surgical-50 sticky top-0">
                      {group.category}
                    </div>
                    {group.commands.map((cmd, idx) => {
                      const isSelected = flatCommands.indexOf(cmd) === selectedIndex;
                      return (
                        <div
                          key={cmd.id}
                          data-command-item
                          onClick={() => cmd.action()}
                          className={`px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-surgical-50'
                              : 'hover:bg-surgical-50'
                          }`}
                        >
                          <div className="text-obsidian/60">
                            {cmd.icon}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-obsidian">
                              {cmd.title}
                            </div>
                          </div>
                          {cmd.shortcut && (
                            <span className="text-xs text-obsidian/40 bg-surgical-50 px-2 py-1 rounded">
                              {cmd.shortcut}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer Help */}
            <div className="px-4 py-3 border-t border-surgical-200 flex justify-between text-xs text-obsidian/60">
              <div className="flex gap-4">
                <span>↑↓ Navigate</span>
                <span>⏎ Select</span>
                <span>Esc Close</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
