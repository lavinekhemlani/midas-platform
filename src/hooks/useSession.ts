'use client';

import { useContext } from 'react';
import { SessionContext, SessionContextType } from '@/contexts/SessionContext';

export const useSession = (): SessionContextType => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};