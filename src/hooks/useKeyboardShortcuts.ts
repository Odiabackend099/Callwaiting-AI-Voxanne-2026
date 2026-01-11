import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface KeyboardShortcut {
  keys: string[];
  description: string;
  action: () => void;
}

export function useKeyboardShortcuts() {
  const router = useRouter();

  const shortcuts: KeyboardShortcut[] = [
    {
      keys: ['Meta', 'Digit1'],
      description: 'Go to Dashboard',
      action: () => router.push('/dashboard'),
    },
    {
      keys: ['Meta', 'Digit2'],
      description: 'Go to Call Logs',
      action: () => router.push('/dashboard/calls'),
    },
    {
      keys: ['Meta', 'Digit3'],
      description: 'Go to Leads',
      action: () => router.push('/dashboard/leads'),
    },
    {
      keys: ['Meta', 'Digit4'],
      description: 'Go to Agent Configuration',
      action: () => router.push('/dashboard/agent-config'),
    },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Build current key combination
      const keysPressed: string[] = [];
      if (e.metaKey || e.ctrlKey) keysPressed.push('Meta');
      if (e.shiftKey) keysPressed.push('Shift');
      if (e.altKey) keysPressed.push('Alt');

      // Add the key itself
      const keyMap: { [key: string]: string } = {
        '1': 'Digit1',
        '2': 'Digit2',
        '3': 'Digit3',
        '4': 'Digit4',
        '/': 'Slash',
      };

      const mappedKey = keyMap[e.key] || e.code;
      if (mappedKey) {
        keysPressed.push(mappedKey);
      }

      // Check for matching shortcut
      const matchingShortcut = shortcuts.find((shortcut) => {
        return (
          shortcut.keys.length === keysPressed.length &&
          shortcut.keys.every((key) => keysPressed.includes(key))
        );
      });

      if (matchingShortcut) {
        e.preventDefault();
        matchingShortcut.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  return { shortcuts };
}
