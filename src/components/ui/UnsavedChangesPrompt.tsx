// src/components/ui/UnsavedChangesPrompt.tsx
'use client';

import { useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface UnsavedChangesPromptProps {
  isDirty: boolean;
  message?: string;
}

/**
 * Component that adds event listeners to prompt users about unsaved changes
 * when they try to navigate away from a page with unsaved changes
 */
export default function UnsavedChangesPrompt({ 
  isDirty, 
  message = 'You have unsaved changes. Are you sure you want to leave this page?' 
}: UnsavedChangesPromptProps) {
  const router = useRouter();
  const pathname = usePathname();
  
  // Function to check if we should bypass the warning
  // This is used when navigating after a successful form submission
  const shouldBypassWarning = useCallback(() => {
    // @ts-ignore - Custom property added to window
    if (window.bypassUnsavedChangesWarning) {
      // @ts-ignore - Reset the flag after checking
      window.bypassUnsavedChangesWarning = false;
      return true;
    }
    return false;
  }, []);
  
  // Handle browser tab/window close
  const handleWindowBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (isDirty && !shouldBypassWarning()) {
      e.preventDefault();
      e.returnValue = message;
      return message;
    }
  }, [isDirty, message, shouldBypassWarning]);
  
  // Handle browser back/forward navigation
  const handlePopState = useCallback(() => {
    if (isDirty && !shouldBypassWarning() && !window.confirm(message)) {
      // If user cancels, push the current URL back to history to prevent navigation
      window.history.pushState(null, '', window.location.href);
    }
  }, [isDirty, message, shouldBypassWarning]);
  
  // Handle clicks on anchor tags and navigation elements
  const handleClick = useCallback((e: MouseEvent) => {
    if (!isDirty || shouldBypassWarning()) return;
    
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    const button = target.closest('button');
    const select = target.closest('select');
    
    // Skip if it's a form submission button
    if (button && button.type === 'submit') return;
    
    // Skip if it's the onboarding completion button
    if (button && button.getAttribute('data-onboarding-complete') === 'true') return;
    
    // Skip if it's a form control button (not navigation)
    if (button) {
      // Check if button is within a form control area
      const isFormControl = 
        button.closest('.zenith-form-group') ||
        button.closest('.proficiency-selector-container') ||
        button.classList.contains('proficiency-segment') ||
        button.closest('[role="group"]') ||
        button.closest('fieldset') ||
        // Also check for common form control patterns
        button.getAttribute('aria-pressed') !== null ||
        button.getAttribute('role') === 'radio' ||
        button.getAttribute('role') === 'checkbox' ||
        button.getAttribute('role') === 'tab' ||
        // Check for file upload buttons
        button.textContent?.toLowerCase().includes('browse') ||
        button.textContent?.toLowerCase().includes('remove') ||
        button.textContent?.toLowerCase().includes('upload');
      
      if (isFormControl) return;
    }
    
    // Check if it's a navigation element
    const isNavElement = 
      (anchor && anchor.href && !anchor.href.startsWith('javascript:') && anchor.target !== '_blank' && !anchor.hasAttribute('download')) ||
      (button && !button.closest('form')) || // Only catch buttons outside of forms
      (select && select.classList.contains('step-nav'));
    
    if (isNavElement && !window.confirm(message)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
  }, [isDirty, message, shouldBypassWarning]);

  useEffect(() => {
    if (!isDirty) return;
    
    // Handle browser tab/window close
    window.addEventListener('beforeunload', handleWindowBeforeUnload);
    
    // Handle browser back/forward navigation
    window.addEventListener('popstate', handlePopState);
    
    // Handle clicks on navigation elements
    document.addEventListener('click', handleClick, { capture: true });
    
    // Handle select change events (for mobile step selector)
    const handleSelectChange = (e: Event) => {
      const select = e.target as HTMLSelectElement;
      if (select.classList.contains('step-nav') && !shouldBypassWarning() && !window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
        // Reset the select to its previous value
        setTimeout(() => {
          const currentPath = window.location.pathname.split('/').pop() || '';
          if (currentPath && select.value !== currentPath) {
            select.value = currentPath;
          }
        }, 0);
      }
    };
    
    document.addEventListener('change', handleSelectChange, { capture: true });
    
    // Push current state to history stack to enable popstate detection
    window.history.pushState(null, '', window.location.href);
    
    return () => {
      window.removeEventListener('beforeunload', handleWindowBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleClick, { capture: true });
      document.removeEventListener('change', handleSelectChange, { capture: true });
    };
  }, [isDirty, handleWindowBeforeUnload, handlePopState, handleClick, message, shouldBypassWarning]);

  // This component doesn't render anything visible
  return null;
}