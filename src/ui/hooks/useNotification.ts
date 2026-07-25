'use client';
import { useState, useCallback } from 'react';

export interface Notification {
  id: string;
  message: string;
  severity: 'success' | 'info' | 'warning' | 'error';
}

export function useNotification() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = useCallback(
    (message: string, severity: Notification['severity'] = 'info') => {
      const id = crypto.randomUUID();
      setNotifications((prev) => [...prev, { id, message, severity }]);
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { notifications, notify, dismiss };
}
