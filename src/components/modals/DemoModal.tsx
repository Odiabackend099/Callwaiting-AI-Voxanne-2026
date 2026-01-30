'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface DemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId?: string | null;
}

export function DemoModal({ isOpen, onClose, agentId }: DemoModalProps) {
  // Close on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6"
          >
            {/* Modal Content */}
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl">
              {/* Close Button */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
                aria-label="Close demo modal"
              >
                <X className="w-6 h-6 text-slate-900" />
              </motion.button>

              {/* Header */}
              <div className="bg-gradient-to-r from-surgical-blue to-clinical-blue px-6 md:px-8 py-4">
                <h2 className="text-xl md:text-2xl font-bold text-pure-white">
                  Watch Voxanne AI in Action
                </h2>
                <p className="text-sm text-slate-200 mt-1">
                  See how our AI receptionist handles a real patient interaction
                </p>
              </div>

              {/* Video Container */}
              <div className="relative w-full bg-slate-900 aspect-video">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="w-full h-full flex items-center justify-center"
                >
                  {/* YouTube Embed or Placeholder */}
                  <div className="w-full h-full bg-slate-900 relative">
                    <iframe
                      width="100%"
                      height="100%"
                      src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1"
                      title="Voxanne AI Demo"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="rounded-none"
                    />

                    {/* Fallback Loading State */}
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 pointer-events-none rounded-lg">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        className="w-8 h-8 border-2 border-surgical-blue border-t-transparent rounded-full"
                      />
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Footer */}
              <div className="bg-slate-50 border-t border-slate-200 px-6 md:px-8 py-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-slate-600">
                      {agentId ? (
                        <>
                          Demo Agent ID: <code className="font-mono text-xs bg-slate-200 px-2 py-1 rounded">{agentId.slice(0, 12)}...</code>
                        </>
                      ) : (
                        'Loading demo information...'
                      )}
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onClose}
                    className="px-6 py-2 bg-slate-900 text-pure-white font-semibold rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    Close
                  </motion.button>
                </div>
              </div>

              {/* Keyboard Hint */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="absolute bottom-2 right-2 text-xs text-slate-400"
              >
                Press <kbd className="px-2 py-1 bg-slate-100 rounded text-slate-700 font-mono">ESC</kbd> to close
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
