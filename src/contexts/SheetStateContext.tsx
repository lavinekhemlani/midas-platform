'use client';

import { createContext, useState, useContext, ReactNode, Dispatch, SetStateAction } from 'react';

interface SheetStateContextType {
  isSheetOpen: boolean;
  setSheetOpen: Dispatch<SetStateAction<boolean>>;
}

const SheetStateContext = createContext<SheetStateContextType | undefined>(undefined);

export const SheetStateProvider = ({ children }: { children: ReactNode }) => {
  const [isSheetOpen, setSheetOpen] = useState(false);
  return (
    <SheetStateContext.Provider value={{ isSheetOpen, setSheetOpen }}>
      {children}
    </SheetStateContext.Provider>
  );
};

export const useSheetState = () => {
  const context = useContext(SheetStateContext);
  if (context === undefined) {
    throw new Error('useSheetState must be used within a SheetStateProvider');
  }
  return context;
};