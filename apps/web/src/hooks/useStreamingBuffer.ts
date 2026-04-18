import { useCallback, useEffect, useRef } from 'react';

export function useStreamingBuffer(
  onFlush: (messageId: string, text: string) => void,
  flushMs = 40,
) {
  const bufferRef = useRef(new Map<string, string>());
  const timerRef = useRef(new Map<string, number>());

  const flush = useCallback((messageId: string) => {
    const text = bufferRef.current.get(messageId) ?? '';
    if (!text) {
      return;
    }

    bufferRef.current.delete(messageId);
    const timerId = timerRef.current.get(messageId);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      timerRef.current.delete(messageId);
    }
    onFlush(messageId, text);
  }, [onFlush]);

  const push = useCallback((messageId: string, text: string) => {
    if (!text) {
      return;
    }

    bufferRef.current.set(messageId, `${bufferRef.current.get(messageId) ?? ''}${text}`);
    if (!timerRef.current.has(messageId)) {
      const timerId = window.setTimeout(() => flush(messageId), flushMs);
      timerRef.current.set(messageId, timerId);
    }
  }, [flush, flushMs]);

  const flushAll = useCallback(() => {
    for (const messageId of Array.from(bufferRef.current.keys())) {
      flush(messageId);
    }
  }, [flush]);

  const clear = useCallback((messageId: string) => {
    bufferRef.current.delete(messageId);
    const timerId = timerRef.current.get(messageId);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      timerRef.current.delete(messageId);
    }
  }, []);

  useEffect(() => () => {
    for (const timerId of timerRef.current.values()) {
      window.clearTimeout(timerId);
    }
    timerRef.current.clear();
    bufferRef.current.clear();
  }, []);

  return {
    push,
    flush,
    flushAll,
    clear,
  };
}
