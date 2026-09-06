'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface UnsavedChangesContextType {
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  navigateWithCheck: (path: string) => void;
  navigateWithoutCheck: (path: string) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType | null>(null);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const [isDirty, setIsDirty] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const message = 'You have unsaved changes. Are you sure you want to leave this page?';

  // Navigate with unsaved changes check
  const navigateWithCheck = useCallback((path: string) => {
    if (isDirty) {
      if (window.confirm(message)) {
        setIsDirty(false);
        router.push(path);
      }
    } else {
      router.push(path);
    }
  }, [isDirty, router]);

  // Navigate without checking (for successful saves)
  const navigateWithoutCheck = useCallback((path: string) => {
    setIsDirty(false);
    router.push(path);
  }, [router]);

  // Handle browser navigation (back/forward, refresh, close)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    if (isDirty) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  // Reset dirty state when navigating to a new page
  useEffect(() => {
    setIsDirty(false);
  }, [pathname]);

  return (
    <UnsavedChangesContext.Provider value={{
      isDirty,
      setIsDirty,
      navigateWithCheck,
      navigateWithoutCheck
    }}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error('useUnsavedChanges must be used within UnsavedChangesProvider');
  }
  return context;
}