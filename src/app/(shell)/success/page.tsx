'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, CheckCircle, Sparkles, Calendar, Mail, FileText, Shield } from 'lucide-react'

function SuccessContent() {
  const searchParams = useSearchParams()
  const type = searchParams.get('type') || 'default'

  // Define success messages based on type
  const getSuccessConfig = (type: string) => {
    switch (type) {
      case 'sign-up':
        return {
          icon: CheckCircle,
          badge: 'ACCOUNT CREATED',
          title: 'Welcome to Midas!',
          subtitle: 'Your account has been successfully created',
          message:
            "You're now part of the Midas community. We've sent a verification email to confirm your account.",
          primaryAction: { text: 'Get Started', href: '/dashboard' },
          secondaryAction: { text: 'Go to Reports', href: '/dashboard' },
        }
      case 'sign-in':
        return {
          icon: CheckCircle,
          badge: 'SIGNED IN',
          title: 'Welcome Back!',
          subtitle: 'Successfully signed into your account',
          message:
            "You're now signed in to Midas. Access your financial intelligence dashboard and continue your journey.",
          primaryAction: { text: 'Go to Reports', href: '/dashboard' },
          secondaryAction: { text: 'View Profile', href: '/settings' },
        }
      case 'demo':
        return {
          icon: Calendar,
          badge: 'DEMO SCHEDULED',
          title: 'Demo Request Submitted!',
          subtitle: "We'll be in touch within 24 hours",
          message:
            'Our team will contact you to schedule your personalized Midas demonstration. Check your email for confirmation details.',
          primaryAction: { text: 'View Calendar', href: '/dashboard' },
          secondaryAction: { text: 'Learn More', href: '/dashboard' },
        }
      case 'forgot-password':
        return {
          icon: Mail,
          badge: 'EMAIL SENT',
          title: 'Password Reset Link Sent',
          subtitle: 'Check your email to reset your password',
          message:
            "We've sent password reset instructions to your email address. The link will expire in 24 hours.",
          primaryAction: { text: 'Check Email', href: '/dashboard' },
          secondaryAction: { text: 'Try Again', href: '/sign-in' },
        }
      case 'terms':
        return {
          icon: FileText,
          badge: 'LEGAL DOCUMENTS',
          title: 'Terms of Service',
          subtitle: 'Coming soon - comprehensive legal framework',
          message:
            'Our legal team is finalizing our Terms of Service to ensure complete transparency and protection for all users.',
          primaryAction: { text: 'Back to Sign Up', href: '/sign-up' },
          secondaryAction: { text: 'Contact Legal', href: '/dashboard' },
        }
      case 'privacy':
        return {
          icon: Shield,
          badge: 'PRIVACY POLICY',
          title: 'Privacy Policy',
          subtitle: 'Coming soon - data protection standards',
          message:
            "We're crafting industry-leading privacy policies that exceed GDPR and CCPA requirements for maximum data protection.",
          primaryAction: { text: 'Back to Sign Up', href: '/sign-up' },
          secondaryAction: { text: 'Security Info', href: '/dashboard' },
        }
      case 'onboarding':
        return {
          icon: CheckCircle,
          badge: 'ONBOARDING COMPLETE',
          title: 'Welcome to Midas!',
          subtitle: 'Your account has been successfully set up',
          message:
            "You've completed the onboarding process. Your Midas account is now ready to use.",
          primaryAction: { text: 'Go to Reports', href: '/dashboard' },
          secondaryAction: { text: 'View Settings', href: '/settings' },
        }
      default:
        return {
          icon: CheckCircle,
          badge: 'SUCCESS',
          title: 'Action Completed!',
          subtitle: 'Your request has been processed successfully',
          message:
            'Thank you for using Midas. Your action has been completed and processed successfully.',
          primaryAction: { text: 'Continue', href: '/dashboard' },
          secondaryAction: { text: 'Reports', href: '/dashboard' },
        }
    }
  }

  const config = getSuccessConfig(type)
  const IconComponent = config.icon

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Main Content - Scaled down */}
      <main className="flex-1 flex items-center justify-center px-5 py-7 relative z-20">
        <div className="w-full max-w-xl mx-auto text-center">
          {/* Success Icon & Badge - Scaled down */}
          <div className="luxury-fade-in mb-7">
            <div className="inline-flex items-center px-3.5 py-1.5 rounded-full glass-luxury mb-5 group">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 theme-light:text-amber-700 mr-1.5 group-hover:rotate-12 transition-transform duration-300" />
              <span className="text-xs font-bold text-amber-300 theme-light:text-amber-800 tracking-wide">
                {config.badge}
              </span>
            </div>

            {/* Large Success Icon - Scaled down */}
            <div className="w-20 h-20 mx-auto mb-5 rounded-full glass-luxury-card flex items-center justify-center">
              <IconComponent className="w-10 h-10 text-emerald-500" />
            </div>
          </div>

          {/* Success Message - Scaled down */}
          <div className="luxury-fade-in mb-10" style={{ animationDelay: '0.2s' }}>
            <h1 className="text-3xl md:text-4xl font-black theme-text-primary mb-3.5 leading-tight tracking-tight">
              {config.title}
            </h1>

            <div className="inline-flex items-center px-3.5 py-1.5 rounded-full glass-component mb-5">
              <span className="text-xs font-semibold text-emerald-500 theme-light:text-emerald-700 tracking-wide">
                {config.subtitle}
              </span>
            </div>

            <p className="text-lg theme-text-secondary leading-relaxed max-w-lg mx-auto">
              {config.message}
            </p>
          </div>

          {/* Next Steps Card - Scaled down */}
          <div className="luxury-fade-in mb-10" style={{ animationDelay: '0.4s' }}>
            <div className="glass-luxury-card p-7 rounded-xl max-w-md mx-auto">
              <h3 className="text-lg font-bold theme-text-primary mb-3.5">What&apos;s Next?</h3>

              <div className="space-y-3.5">
                {type === 'sign-up' && (
                  <>
                    <div className="flex items-start space-x-2.5">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs text-white font-bold">1</span>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-semibold theme-text-primary">
                          Verify Your Email
                        </p>
                        <p className="text-xs theme-text-secondary">
                          Check your inbox and click the verification link
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2.5">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs text-white font-bold">2</span>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-semibold theme-text-primary">
                          Complete Onboarding
                        </p>
                        <p className="text-xs theme-text-secondary">
                          Set up your corporate profile and preferences
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2.5">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs text-white font-bold">3</span>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-semibold theme-text-primary">
                          Start Using Midas
                        </p>
                        <p className="text-xs theme-text-secondary">
                          Access your AI-powered financial dashboard
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {type === 'demo' && (
                  <>
                    <div className="flex items-start space-x-2.5">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Calendar className="w-2.5 h-2.5 text-white" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-semibold theme-text-primary">
                          Confirmation Email
                        </p>
                        <p className="text-xs theme-text-secondary">
                          We&apos;ll send demo details to your email within 1 hour
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2.5">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Mail className="w-2.5 h-2.5 text-white" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-semibold theme-text-primary">Calendar Invite</p>
                        <p className="text-xs theme-text-secondary">
                          Direct calendar link for easy scheduling
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {(type === 'terms' || type === 'privacy') && (
                  <div className="flex items-start space-x-2.5">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FileText className="w-2.5 h-2.5 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold theme-text-primary">Coming Soon</p>
                      <p className="text-xs theme-text-secondary">
                        Our legal team is finalizing these documents
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons - Scaled down */}
          <div className="luxury-fade-in space-y-5" style={{ animationDelay: '0.6s' }}>
            <div className="flex flex-col sm:flex-row gap-3.5 justify-center">
              {/* Primary Action */}
              <Link
                href={config.primaryAction.href}
                className="inline-flex items-center px-7 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-base rounded-lg shadow-lg hover:shadow-emerald-500/25 transition-all duration-500 relative overflow-hidden group transform hover:scale-105"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative z-10 flex items-center">
                  {config.primaryAction.text}
                  <ArrowRight className="ml-2.5 w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-300" />
                </span>
              </Link>

              {/* Secondary Action */}
              <Link
                href={config.secondaryAction.href}
                className="inline-flex items-center px-7 py-3.5 glass-luxury-card text-base font-bold rounded-lg hover:scale-105 transition-all duration-500 group"
              >
                <span className="theme-text-primary group-hover:text-amber-400 transition-colors duration-300">
                  {config.secondaryAction.text}
                </span>
              </Link>
            </div>

            {/* Additional Navigation */}
            <div className="text-center">
              <p className="text-xs theme-text-secondary mb-3.5">Need help or have questions?</p>
              <div className="flex justify-center space-x-5 text-xs">
                <Link
                  href="/support"
                  className="theme-text-secondary hover:text-amber-500 transition-colors duration-300"
                >
                  Support Center
                </Link>
                <span className="theme-text-secondary">•</span>
                <Link
                  href="/schedule-demo"
                  className="theme-text-secondary hover:text-amber-500 transition-colors duration-300"
                >
                  Schedule Demo
                </Link>
                <span className="theme-text-secondary">•</span>
                <Link
                  href="/"
                  className="theme-text-secondary hover:text-amber-500 transition-colors duration-300"
                >
                  Return Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function SuccessPage() {
  return <SuccessContent />
}
