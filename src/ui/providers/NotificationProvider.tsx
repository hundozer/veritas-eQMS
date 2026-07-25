'use client';
import { createContext, useContext, ReactNode } from 'react';
import { Alert, Snackbar, Stack } from '@mui/material';
import { useNotification, Notification } from '../hooks/useNotification';

interface NotificationContextValue {
  notify: (message: string, severity?: Notification['severity']) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotify() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotify must be used within NotificationProvider');
  return ctx.notify;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { notifications, notify, dismiss } = useNotification();

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      <Stack spacing={1} sx={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999 }}>
        {notifications.map((n) => (
          <Snackbar key={n.id} open autoHideDuration={4000} onClose={() => dismiss(n.id)}>
            <Alert severity={n.severity} onClose={() => dismiss(n.id)} variant="filled" sx={{ minWidth: 300 }}>
              {n.message}
            </Alert>
          </Snackbar>
        ))}
      </Stack>
    </NotificationContext.Provider>
  );
}
