'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface LoadingContextType {
  isLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
  setLoading: (loading: boolean) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);

  const startLoading = useCallback(() => {
    setIsLoading(true);
  }, []);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  // Listen for custom loading events from apiClient
  React.useEffect(() => {
    const handleLoadingStart = () => startLoading();
    const handleLoadingStop = () => stopLoading();

    window.addEventListener('loading-start', handleLoadingStart);
    window.addEventListener('loading-stop', handleLoadingStop);

    return () => {
      window.removeEventListener('loading-start', handleLoadingStart);
      window.removeEventListener('loading-stop', handleLoadingStop);
    };
  }, [startLoading, stopLoading]);

  const value = {
    isLoading,
    startLoading,
    stopLoading,
    setLoading,
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading(): LoadingContextType {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}
