'use client';
import { useState, useEffect, useCallback } from 'react';

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
      if (e.key === 'Escape' && open) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const openCmd = () => setOpen(true);
    const closeCmd = () => setOpen(false);
    window.addEventListener('cmd:open', openCmd as EventListener);
    window.addEventListener('cmd:close', closeCmd as EventListener);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('cmd:open', openCmd as EventListener);
      window.removeEventListener('cmd:close', closeCmd as EventListener);
    };
  }, [open, toggle, handleClose]);

  return { open, handleOpen, handleClose, toggle };
}
