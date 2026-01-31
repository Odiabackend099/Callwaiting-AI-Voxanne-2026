'use client';
export const dynamic = "force-dynamic";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
// LeftSidebar removed (now in layout)
import { BookOpen, Plus, Trash2, Save, Loader2, RefreshCw, CloudUpload, Sparkles, AlertCircle, CheckCircle2, Upload, File } from 'lucide-react';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

type KBItem = {
  id: string;
  filename: string;
  category: string;
  content: string;
  active: boolean;
  version: number;
};

export default function KnowledgeBasePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [items, setItems] = useState<KBItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastSaveTime, setLastSaveTime] = useState(0);

  const [draft, setDraft] = useState<{ id: string | null; filename: string; category: string; content: string; active: boolean }>({
    id: null,
    filename: '',
    category: 'products_services',
    content: '',
    active: true
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const loadItems = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await authedBackendFetch<any>('/api/knowledge-base');
      setItems((data?.items || []) as KBItem[]);
    } catch (e: any) {
      setError(e?.message || 'Failed to load knowledge base');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (user) loadItems();
  }, [user, loadItems]);

  const beginNew = () => {
    setDraft({ id: null, filename: '', category: 'products_services', content: '', active: true });
    setError(null);
    setSuccess(null);
    setUploadProgress(0);
    setTimeout(() => {
      const input = document.querySelector('input[placeholder*="pricing"]') as HTMLInputElement;
      if (input) input.focus();
    }, 0);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError('File too large. Maximum 5MB.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);
      setUploadProgress(0);

      const reader = new FileReader();
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;

          setDraft({
            id: null,
            filename: file.name,
            category: 'products_services',
            content: content || '',
            active: true
          });

          setSuccess(`File loaded: ${file.name}`);
        } catch (err: any) {
          setError(`Failed to read file: ${err?.message}`);
        } finally {
          setIsSaving(false);
          setUploadProgress(0);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };

      reader.onerror = () => {
        setError('Failed to read file');
        setIsSaving(false);
      };

      reader.readAsText(file);
    } catch (err: any) {
      setError(`Upload failed: ${err?.message}`);
      setIsSaving(false);
    }
  };

  const beginEdit = (item: KBItem) => {
    setDraft({ id: item.id, filename: item.filename, category: item.category, content: item.content, active: item.active });
    setError(null);
    setSuccess(null);
  };

  const save = async () => {
    // Prevent duplicate submissions
    const now = Date.now();
    if (now - lastSaveTime < 1000) {
      setError('Please wait before saving again');
      return;
    }

    // Validation
    const filename = draft.filename.trim();
    const content = draft.content.trim();

    if (!filename) {
      setError('Please enter a document name');
      return;
    }
    if (filename.length > 255) {
      setError('Document name must be less than 255 characters');
      return;
    }
    if (!content) {
      setError('Please enter content');
      return;
    }
    if (content.length > 300000) {
      setError('Content exceeds 300KB limit');
      return;
    }

    try {
      setIsSaving(true);
      setLastSaveTime(now);
      setError(null);
      setSuccess(null);
      const isUpdate = Boolean(draft.id);

      const data = await authedBackendFetch<any>(
        isUpdate ? `/api/knowledge-base/${draft.id}` : '/api/knowledge-base',
        {
          method: isUpdate ? 'PATCH' : 'POST',
          body: JSON.stringify({
            filename,
            category: draft.category,
            content,
            active: draft.active
          }),
          timeoutMs: 30000,
          retries: 1,
        }
      );

      setSuccess(isUpdate ? '✅ Document updated.' : '✅ Document created.');
      beginNew();
      await loadItems();
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(e?.message || 'Failed to save document');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      await authedBackendFetch<any>(`/api/knowledge-base/${id}`, {
        method: 'DELETE',
        timeoutMs: 30000,
        retries: 1,
      });

      setSuccess('✅ Document deleted.');
      await loadItems();
      if (draft.id === id) beginNew();
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    } finally {
      setIsSaving(false);
    }
  };

  const seedBeverly = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      const data = await authedBackendFetch<any>('/api/knowledge-base/seed/beverly', {
        method: 'POST',
        timeoutMs: 30000,
        retries: 1,
      });
      setSuccess(data?.message || 'Seed completed');
      await loadItems();
    } catch (e: any) {
      setError(e?.message || 'Seed failed');
    } finally {
      setIsSaving(false);
    }
  };

  const syncToBoth = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      const data = await authedBackendFetch<any>('/api/knowledge-base/sync', {
        method: 'POST',
        body: JSON.stringify({
          toolName: 'knowledge-search',
          assistantRoles: ['inbound', 'outbound']
        }),
        timeoutMs: 30000,
        retries: 1,
      });
      setSuccess(`✅ Synced! Knowledge base attached to ${data?.assistantsUpdated?.length || 2} agent(s).`);
    } catch (e: any) {
      setError(e?.message || 'Sync failed');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-surgical-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-surgical-500 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen pt-16 md:pt-0 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-obsidian flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-surgical-600" />
            Knowledge Base
          </h1>
          <p className="text-obsidian/60 mt-2">Upload documents that your AI assistant will use to answer customer questions.</p>
        </div>

        {/* Messages */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-surgical-50 border border-surgical-200 rounded-lg text-surgical-600 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={seedBeverly}
            disabled={isSaving}
            className="p-4 bg-white border border-surgical-200 rounded-lg hover:bg-surgical-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-left"
          >
            <div className="flex items-center gap-3">
              {isSaving ? <Loader2 className="w-6 h-6 text-surgical-600 flex-shrink-0 animate-spin" /> : <Sparkles className="w-6 h-6 text-surgical-600 flex-shrink-0" />}
              <div>
                <div className="font-semibold text-obsidian">Load Sample KB</div>
                <div className="text-sm text-obsidian/60">Get started with examples</div>
              </div>
            </div>
          </button>

          <button
            onClick={syncToBoth}
            disabled={isSaving || items.length === 0}
            className="p-4 bg-white border border-surgical-200 rounded-lg hover:bg-surgical-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-left"
          >
            <div className="flex items-center gap-3">
              {isSaving ? <Loader2 className="w-6 h-6 text-surgical-600 flex-shrink-0 animate-spin" /> : <CloudUpload className="w-6 h-6 text-surgical-600 flex-shrink-0" />}
              <div>
                <div className="font-semibold text-obsidian">Sync to AI</div>
                <div className="text-sm text-obsidian/60">Send to your assistants</div>
              </div>
            </div>
          </button>

          <button
            onClick={loadItems}
            disabled={isSaving}
            className="p-4 bg-white border border-surgical-200 rounded-lg hover:bg-surgical-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-left"
          >
            <div className="flex items-center gap-3">
              {isSaving ? <Loader2 className="w-6 h-6 text-surgical-600 flex-shrink-0 animate-spin" /> : <RefreshCw className="w-6 h-6 text-surgical-600 flex-shrink-0" />}
              <div>
                <div className="font-semibold text-obsidian">Refresh</div>
                <div className="text-sm text-obsidian/60">Reload documents</div>
              </div>
            </div>
          </button>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Documents List */}
          <div className="lg:col-span-1 bg-white border border-surgical-200 rounded-xl shadow-sm">
            <div className="p-6 border-b border-surgical-200">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-obsidian">Your Documents</h2>
                <button
                  onClick={beginNew}
                  className="px-3 py-1 bg-surgical-600 text-white rounded-lg hover:bg-surgical-700 text-sm font-medium flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
              <p className="text-sm text-obsidian/60 mt-1">{items.length} document{items.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="divide-y divide-surgical-200 max-h-[500px] overflow-y-auto">
              {items.length === 0 ? (
                <div className="p-6 text-center text-obsidian/60">
                  <p>No documents yet.</p>
                  <p className="text-sm mt-1">Click &quot;Add&quot; or &quot;Load Sample KB&quot; to get started.</p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-surgical-50 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => beginEdit(item)}
                          className="font-medium text-obsidian hover:text-surgical-600 truncate text-left"
                        >
                          {item.filename}
                        </button>
                        <div className="text-xs text-obsidian/60 mt-1">
                          {item.category} · v{item.version} {item.active ? '✓' : '○'}
                        </div>
                      </div>
                      <button
                        onClick={() => remove(item.id)}
                        className="p-1 text-obsidian/40 hover:text-red-600 flex-shrink-0"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Editor */}
          <div className="lg:col-span-2 bg-white border border-surgical-200 rounded-xl shadow-sm flex flex-col h-fit">
            <div className="p-6 border-b border-surgical-200 flex-shrink-0">
              <h2 className="font-semibold text-obsidian">
                {draft.id ? `Edit: ${draft.filename || 'Untitled'}` : 'Add New Document'}
              </h2>
            </div>
            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-obsidian mb-2">Upload File or Enter Text</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 border-2 border-dashed border-surgical-300 bg-surgical-50 rounded-lg hover:bg-surgical-100 disabled:opacity-50 text-surgical-600 font-medium flex items-center justify-center gap-2 transition"
                  >
                    <Upload className="w-4 h-4" />
                    {uploadProgress > 0 ? `${uploadProgress}%` : 'Upload File'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    aria-label="Upload knowledge base document"
                    onChange={handleFileUpload}
                    accept=".txt,.md"
                    className="hidden"
                  />
                </div>
                <p className="text-xs text-obsidian/60 mt-1">Supports: TXT, Markdown (max 5MB)</p>
              </div>

              <div>
                <label htmlFor="kb-filename" className="block text-sm font-semibold text-obsidian mb-2">Document Name</label>
                <input
                  id="kb-filename"
                  value={draft.filename}
                  onChange={(e) => setDraft((p) => ({ ...p, filename: e.target.value }))}
                  placeholder="e.g., pricing.md"
                  className="w-full px-4 py-2 rounded-lg border border-surgical-200 bg-white text-obsidian placeholder-obsidian/40 focus:ring-2 focus:ring-surgical-500 focus:border-transparent outline-none"
                />
                <p className="text-xs text-obsidian/60 mt-1">Auto-filled from uploaded file</p>
              </div>

              <div>
                <label htmlFor="kb-category" className="block text-sm font-semibold text-obsidian mb-2">Category</label>
                <select
                  id="kb-category"
                  value={draft.category}
                  onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-surgical-200 bg-white text-obsidian focus:ring-2 focus:ring-surgical-500 focus:border-transparent outline-none"
                >
                  <option value="products_services">Products & Services</option>
                  <option value="operations">Operations</option>
                  <option value="ai_guidelines">AI Guidelines</option>
                  <option value="general">General</option>
                </select>
              </div>

              <div>
                <label htmlFor="kb-content" className="block text-sm font-semibold text-obsidian mb-2">Content</label>
                <textarea
                  id="kb-content"
                  value={draft.content}
                  onChange={(e) => setDraft((p) => ({ ...p, content: e.target.value }))}
                  placeholder="Paste your content here. Markdown is supported."
                  className="w-full h-40 px-4 py-2 rounded-lg border border-surgical-200 bg-white text-obsidian placeholder-obsidian/40 font-mono text-sm focus:ring-2 focus:ring-surgical-500 focus:border-transparent resize-none outline-none"
                />
                <p className="text-xs text-obsidian/60 mt-1">Max 300KB per document</p>
              </div>
            </div>

            <div className="p-6 border-t border-surgical-200 flex items-center justify-between gap-4 flex-shrink-0 bg-white rounded-b-xl">
              <label className="flex items-center gap-2 text-sm text-obsidian/60">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft((p) => ({ ...p, active: e.target.checked }))}
                  className="w-4 h-4 rounded border-surgical-200 bg-white"
                />
                <span>Active (AI can use this)</span>
              </label>

              <button
                onClick={save}
                disabled={isSaving || !draft.filename.trim() || !draft.content.trim()}
                className="px-6 py-2 bg-surgical-600 text-white rounded-lg hover:bg-surgical-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2 transition flex-shrink-0"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {draft.id ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
