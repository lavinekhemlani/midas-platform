// src/app/(shell)/under-construction/page.tsx - 90% scaled version
// Universal under construction page with navigation options - FIXED ESLINT ERRORS
'use client'

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Wrench, Sparkles } from 'lucide-react';

export default function UnderConstructionPage() {
  const router = useRouter();

  const handleGoBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Main Content - Scaled down */}
<main className="flex-1 flex flex-col items-center justify-start md:justify-center px-5 pt-10 md:pt-0 pb-10 relative z-20">
        <div className="w-full max-w-xl mx-auto text-center">
          
          {/* Construction Icon & Badge - Scaled down */}
          <div className="luxury-fade-in mb-7">
            <div className="inline-flex items-center px-3.5 py-1.5 rounded-full glass-luxury mb-5 group">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 theme-light:text-amber-700 mr-1.5 group-hover:rotate-12 transition-transform duration-300" />
              <span className="text-xs font-bold text-amber-300 theme-light:text-amber-800 tracking-wide">
                COMING SOON
              </span>
            </div>

            {/* Large Construction Icon - Scaled down */}
            <div className="w-20 h-20 mx-auto mb-5 rounded-full glass-luxury-card flex items-center justify-center">
              <Wrench className="w-10 h-10 text-amber-500 animate-pulse" />
            </div>
          </div>

          {/* Construction Message - Scaled down */}
          <div className="luxury-fade-in mb-10" style={{ animationDelay: '0.2s' }}>
            <div className="text-5xl mb-3.5">🚧</div>
            
            <h1 className="text-3xl md:text-4xl font-black theme-text-primary mb-3.5 leading-tight tracking-tight">
              Page Under
              <br />
              <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 theme-light:from-amber-600 theme-light:via-amber-700 theme-light:to-amber-800 bg-clip-text text-transparent">
                Construction
              </span>
            </h1>
            
            <div className="inline-flex items-center px-3.5 py-1.5 rounded-full glass-component mb-5">
              <span className="text-xs font-semibold text-amber-500 theme-light:text-amber-700 tracking-wide">
                Building Something Amazing
              </span>
            </div>
            
            <p className="text-lg theme-text-secondary leading-relaxed max-w-lg mx-auto">
              We&apos;re working hard to bring you this feature. Our team is crafting an exceptional experience that aligns with Midas&apos;s commitment to excellence.
            </p>
          </div>

          {/* Info Card - Scaled down */}
          <div className="luxury-fade-in mb-10" style={{ animationDelay: '0.4s' }}>
            <div className="glass-luxury-card p-7 rounded-xl max-w-md mx-auto">
              <h3 className="text-lg font-bold theme-text-primary mb-3.5">What&apos;s Coming</h3>
              
              <div className="space-y-3.5 text-left">
                <div className="flex items-start space-x-2.5">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-white font-bold">✓</span>
                  </div>
                  <div>
                    <p className="text-xs theme-text-secondary">Advanced AI-powered financial analytics</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2.5">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-white font-bold">✓</span>
                  </div>
                  <div>
                    <p className="text-xs theme-text-secondary">Seamless integration with your existing tools</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2.5">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-white font-bold">✓</span>
                  </div>
                  <div>
                    <p className="text-xs theme-text-secondary">Enterprise-grade security and compliance</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Buttons - Scaled down */}
          <div className="luxury-fade-in space-y-5" style={{ animationDelay: '0.6s' }}>
            <div className="flex flex-col sm:flex-row gap-3.5 justify-center">
              {/* Go Back Button */}
              <button
                onClick={handleGoBack}
                className="inline-flex items-center px-7 py-3.5 glass-luxury-card text-base font-bold rounded-lg hover:scale-105 transition-all duration-500 group"
              >
                <ArrowLeft className="mr-2.5 w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-300" />
                <span className="theme-text-primary">Go Back</span>
              </button>

              {/* Homepage Button */}
              <Link 
                href="/"
                className="inline-flex items-center px-7 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-base rounded-lg shadow-lg hover:shadow-amber-500/25 transition-all duration-500 relative overflow-hidden group transform hover:scale-105"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative z-10 flex items-center">
                  Return Home
                  <ArrowRight className="ml-2.5 w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-300" />
                </span>
              </Link>
            </div>

            {/* Alternative Actions */}
            <div className="text-center">
              <p className="text-xs theme-text-secondary mb-3.5">
                While you&apos;re here, explore what&apos;s available:
              </p>
              <div className="flex justify-center space-x-5 text-xs">
                <Link href="/schedule-demo" className="theme-text-secondary hover:text-amber-500 transition-colors duration-300">
                  Schedule Demo
                </Link>
                <span className="theme-text-secondary">•</span>
                <Link href="/sign-up" className="theme-text-secondary hover:text-amber-500 transition-colors duration-300">
                  Get Started
                </Link>
                <span className="theme-text-secondary">•</span>
                <Link href="/sign-in" className="theme-text-secondary hover:text-amber-500 transition-colors duration-300">
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}