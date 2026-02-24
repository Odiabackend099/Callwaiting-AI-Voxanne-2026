import { useState, useCallback } from 'react';

interface PromptCheckpointState {
  isOpen: boolean;
  agentName: string;
  systemPrompt: string;
  firstMessage: string;
  isLoading: boolean;
}

interface PromptCheckpointCallbacks {
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Hook to manage prompt checkpoint modal lifecycle
 *
 * Usage:
 * ```typescript
 * const checkpoint = usePromptCheckpoint();
 *
 * const handleSave = async () => {
 *   // Show checkpoint modal with current prompt data
 *   checkpoint.show({
 *     agentName: currentConfig.name,
 *     systemPrompt: currentConfig.systemPrompt,
 *     firstMessage: currentConfig.firstMessage,
 *   }, {
 *     onConfirm: async () => {
 *       await performActualSave();
 *       checkpoint.close();
 *     },
 *     onCancel: () => {
 *       checkpoint.close();
 *     },
 *   });
 * };
 * ```
 */
export function usePromptCheckpoint() {
  const [state, setState] = useState<PromptCheckpointState>({
    isOpen: false,
    agentName: '',
    systemPrompt: '',
    firstMessage: '',
    isLoading: false,
  });

  const [callbacks, setCallbacks] = useState<PromptCheckpointCallbacks>({
    onConfirm: () => {},
    onCancel: () => {},
  });

  const show = useCallback(
    (
      data: {
        agentName: string;
        systemPrompt: string;
        firstMessage: string;
      },
      handlers: PromptCheckpointCallbacks
    ) => {
      setState((prev) => ({
        ...prev,
        isOpen: true,
        agentName: data.agentName,
        systemPrompt: data.systemPrompt,
        firstMessage: data.firstMessage,
        isLoading: false,
      }));
      setCallbacks(handlers);
    },
    []
  );

  const close = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({
      ...prev,
      isLoading: loading,
    }));
  }, []);

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    try {
      await callbacks.onConfirm();
    } finally {
      setLoading(false);
    }
  }, [callbacks, setLoading]);

  const handleCancel = useCallback(() => {
    callbacks.onCancel();
    close();
  }, [callbacks, close]);

  const handleEdit = useCallback(() => {
    close();
  }, [close]);

  return {
    // State
    isOpen: state.isOpen,
    agentName: state.agentName,
    systemPrompt: state.systemPrompt,
    firstMessage: state.firstMessage,
    isLoading: state.isLoading,

    // Methods
    show,
    close,
    setLoading,
    handleConfirm,
    handleCancel,
    handleEdit,
  };
}
