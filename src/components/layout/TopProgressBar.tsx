'use client';

import { useEffect } from 'react';
import { useLoading } from '@/contexts/LoadingContext';
import NProgress from 'nprogress';

// Import nprogress styles
import 'nprogress/nprogress.css';

// Configure NProgress
NProgress.configure({
  showSpinner: false,
  speed: 200,
  minimum: 0.08,
  easing: 'ease',
  positionUsing: '',
  trickleSpeed: 200,
});

export function TopProgressBar() {
  const { isLoading } = useLoading();

  useEffect(() => {
    if (isLoading) {
      NProgress.start();
    } else {
      NProgress.done();
    }

    // Cleanup on unmount
    return () => {
      NProgress.done();
    };
  }, [isLoading]);

  return null; // This component doesn't render anything visible itself
}
