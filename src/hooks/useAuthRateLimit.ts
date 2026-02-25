'use client';

import { useState, useEffect, useRef } from 'react';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export function useAuthRateLimit(action: 'signup' | 'login') {
  const key = `rl_${action}`;
  const [lockedOut, setLockedOut] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    checkLockout();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function checkLockout() {
    try {
      const stored = JSON.parse(sessionStorage.getItem(key) || '{}');
      if (stored.lockedUntil && Date.now() < stored.lockedUntil) {
        startCountdown(stored.lockedUntil);
      }
    } catch {
      // sessionStorage unavailable (SSR) — ignore
    }
  }

  function startCountdown(until: number) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setLockedOut(true);

    intervalRef.current = setInterval(() => {
      const secs = Math.ceil((until - Date.now()) / 1000);
      if (secs <= 0) {
        setLockedOut(false);
        setSecondsLeft(0);
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        setSecondsLeft(secs);
      }
    }, 1000);

    // Set initial value immediately
    const initial = Math.ceil((until - Date.now()) / 1000);
    setSecondsLeft(initial > 0 ? initial : 0);
  }

  function recordFailure() {
    try {
      const raw = sessionStorage.getItem(key);
      const stored = raw ? JSON.parse(raw) : { count: 0 };
      stored.count = (stored.count || 0) + 1;
      if (stored.count >= MAX_ATTEMPTS) {
        stored.lockedUntil = Date.now() + LOCKOUT_MS;
        startCountdown(stored.lockedUntil);
      }
      sessionStorage.setItem(key, JSON.stringify(stored));
    } catch {
      // ignore
    }
  }

  function reset() {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
    setLockedOut(false);
    setSecondsLeft(0);
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timerLabel = `${mins}:${String(secs).padStart(2, '0')}`;

  return { lockedOut, secondsLeft, timerLabel, recordFailure, reset };
}
