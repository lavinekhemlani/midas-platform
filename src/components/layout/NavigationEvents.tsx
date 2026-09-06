'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLoading } from '@/contexts/LoadingContext';

export function NavigationEvents() {
  const { startLoading, stopLoading } = useLoading();
  const router = useRouter();

  useEffect(() => {
    // For Next.js 13+ App Router, we need to listen to navigation events differently
    // We'll use a combination of browser events and router state changes
    
    let navigationTimeout: NodeJS.Timeout;

    const handleStart = () => {
      // Clear any existing timeout
      if (navigationTimeout) {
        clearTimeout(navigationTimeout);
      }
      startLoading();
    };

    const handleComplete = () => {
      // Add a small delay to ensure the page has fully loaded
      navigationTimeout = setTimeout(() => {
        stopLoading();
      }, 100);
    };

    // Listen for browser navigation events
    const handleBeforeUnload = () => {
      startLoading();
    };

    const handlePopState = () => {
      handleStart();
      // For back/forward navigation, we need to detect when it's complete
      setTimeout(handleComplete, 300);
    };

    // Listen for programmatic navigation by intercepting clicks on links
    const handleLinkClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const link = target.closest('a');
      
      if (link && link.href && !link.href.startsWith('mailto:') && !link.href.startsWith('tel:')) {
        const url = new URL(link.href);
        const currentUrl = new URL(window.location.href);
        
        // Only show loading for same-origin navigation
        if (url.origin === currentUrl.origin && url.pathname !== currentUrl.pathname) {
          handleStart();
          // Set a timeout to stop loading in case the navigation doesn't complete
          setTimeout(handleComplete, 2000);
        }
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('click', handleLinkClick);

    // Cleanup
    return () => {
      if (navigationTimeout) {
        clearTimeout(navigationTimeout);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleLinkClick);
    };
  }, [startLoading, stopLoading]);

  return null; // This component doesn't render anything
}
