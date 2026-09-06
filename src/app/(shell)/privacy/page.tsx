// src/app/(shell)/privacy/page.tsx
import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { DM_Sans } from 'next/font/google'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
})

export const metadata: Metadata = {
  title: 'Privacy Policy - Midas',
  description: 'Privacy Policy for Midas financial intelligence platform',
}

export default function PrivacyPolicy() {
  return (
    <div className={`min-h-screen pt-20 pb-16 px-4 sm:px-6 lg:px-8 ${dmSans.variable} ${dmSans.className}`}>
      <div className="max-w-3xl mx-auto">
        {/* Back to Home */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium theme-text-secondary hover:text-amber-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>

        <div className="text-center mb-12">
          <h1
            className="text-4xl font-bold theme-text-primary mb-4"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            Privacy Policy
          </h1>
          <p className="text-sm theme-text-secondary">Last Updated: December 2025</p>
        </div>

        <div className="prose prose-lg max-w-none theme-text-primary">
          <div className="glass-luxury-card border-l-4 border-blue-400 p-4 mb-8">
            <p className="font-semibold text-blue-600 dark:text-blue-400">
              At Midas, we take your privacy seriously. This Privacy Policy explains how we collect,
              use, disclose, and safeguard your information when you use our financial intelligence
              platform.
            </p>
          </div>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              1. Information We Collect
            </h2>

            <h3
              className="text-xl font-semibold theme-text-primary mb-3"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Personal Information
            </h3>
            <p className="mb-3 theme-text-secondary">
              When you register for an account, we collect:
            </p>
            <ul className="list-disc pl-6 mb-4 theme-text-secondary">
              <li>Full name and email address</li>
              <li>Business name and industry</li>
              <li>Business contact information</li>
              <li>Account credentials (securely hashed)</li>
            </ul>

            <h3
              className="text-xl font-semibold theme-text-primary mb-3"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Financial Data
            </h3>
            <p className="mb-3 theme-text-secondary">
              Through your connected accounting platforms, we access:
            </p>
            <ul className="list-disc pl-6 mb-4 theme-text-secondary">
              <li>Company financial statements and reports</li>
              <li>Invoice and expense data</li>
              <li>Customer and vendor information</li>
              <li>Banking and transaction records</li>
              <li>Budget and forecast data</li>
            </ul>

            <h3
              className="text-xl font-semibold theme-text-primary mb-3"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Usage Information
            </h3>
            <p className="mb-3 theme-text-secondary">We automatically collect:</p>
            <ul className="list-disc pl-6 mb-4 theme-text-secondary">
              <li>IP address and device information</li>
              <li>Browser type and operating system</li>
              <li>Access times and dates</li>
              <li>Features used and interaction patterns</li>
              <li>Error logs and performance data</li>
            </ul>

            <h3
              className="text-xl font-semibold theme-text-primary mb-3"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Analytics and Event Data
            </h3>
            <p className="mb-3 theme-text-secondary">
              We use Google Tag Manager and internal event logging to collect:
            </p>
            <ul className="list-disc pl-6 mb-4 theme-text-secondary">
              <li>Account registration and onboarding events</li>
              <li>Feature usage and navigation patterns</li>
              <li>Integration connection events (e.g., when you connect QuickBooks)</li>
              <li>Page views, button clicks, and form submissions</li>
              <li>Error events for debugging and service improvement</li>
            </ul>
            <p className="theme-text-secondary">
              This data may be shared with Google Analytics and other analytics services configured
              through Google Tag Manager.
            </p>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              2. How We Use Your Information
            </h2>
            <p className="mb-3 theme-text-secondary">We use your information to:</p>
            <ul className="list-disc pl-6 theme-text-secondary">
              <li>Provide and maintain our financial intelligence services</li>
              <li>Generate insights, analytics, and recommendations</li>
              <li>Improve and personalize your experience</li>
              <li>Communicate with you about your account</li>
              <li>Ensure platform security and prevent fraud</li>
              <li>Comply with legal obligations</li>
              <li>Develop new features and improvements</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              3. Data Storage and Security
            </h2>

            <h3
              className="text-xl font-semibold theme-text-primary mb-3"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Infrastructure
            </h3>
            <p className="mb-3 theme-text-secondary">Your data is stored using:</p>
            <ul className="list-disc pl-6 mb-4 theme-text-secondary">
              <li>Amazon Web Services (AWS) in the US-East region</li>
              <li>Amazon S3 for document storage</li>
              <li>Amazon DynamoDB for structured data</li>
              <li>Amazon Cognito for authentication</li>
            </ul>

            <h3
              className="text-xl font-semibold theme-text-primary mb-3"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Security Measures
            </h3>
            <p className="mb-3 theme-text-secondary">We protect your data through:</p>
            <ul className="list-disc pl-6 mb-4 theme-text-secondary">
              <li>
                <strong className="theme-text-primary">Encryption in Transit:</strong> All data
                transmitted between your device and our servers is encrypted using TLS 1.3
              </li>
              <li>
                <strong className="theme-text-primary">Encryption at Rest:</strong> All stored data
                is encrypted using AWS KMS with AES-256 encryption
              </li>
              <li>
                <strong className="theme-text-primary">Access Controls:</strong> Role-based access
                control (RBAC) and multi-factor authentication
              </li>
              <li>
                <strong className="theme-text-primary">Data Isolation:</strong> Logical separation
                of customer data using secure tenant isolation
              </li>
            </ul>

            <div className="glass-luxury-card border-l-4 border-green-400 p-4">
              <p className="font-semibold text-green-600 dark:text-green-400">
                Important: Financial data is primarily cached locally on your device during active
                sessions, minimizing data retention on our servers.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              4. Data Sharing and Disclosure
            </h2>
            <p className="mb-3 theme-text-secondary">
              We do not sell, trade, or rent your personal information. We may share your data:
            </p>
            <ul className="list-disc pl-6 mb-4 theme-text-secondary">
              <li>
                <strong className="theme-text-primary">With Your Consent:</strong> When you
                explicitly authorize us to share information
              </li>
              <li>
                <strong className="theme-text-primary">Service Providers:</strong> With trusted
                third parties who assist in operating our platform (e.g., AWS, authentication
                services)
              </li>
              <li>
                <strong className="theme-text-primary">Legal Requirements:</strong> When required by
                law, court order, or government request
              </li>
              <li>
                <strong className="theme-text-primary">Business Transfers:</strong> In connection
                with a merger, acquisition, or sale of assets
              </li>
              <li>
                <strong className="theme-text-primary">Protection of Rights:</strong> To protect our
                rights, property, or safety
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              5. Third-Party Integrations
            </h2>
            <p className="mb-4 theme-text-secondary">
              Midas integrates with third-party accounting platforms. QuickBooks is fully supported,
              with additional platforms coming soon. When you connect these services:
            </p>
            <ul className="list-disc pl-6 mb-4 theme-text-secondary">
              <li>We access only the data necessary for our services</li>
              <li>We store OAuth tokens securely and refresh them as needed</li>
              <li>You can disconnect integrations at any time</li>
              <li>Third-party services have their own privacy policies</li>
            </ul>

            <h3 className="text-xl font-semibold theme-text-primary mb-3 mt-6">
              OAuth Authentication
            </h3>
            <p className="mb-3 theme-text-secondary">
              When connecting your accounting platform, we use OAuth 2.0 for secure authentication.
              We store access tokens encrypted in our database and automatically refresh them as
              needed. You maintain control and can revoke access at any time through your accounting
              platform settings.
            </p>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              6. Data Retention
            </h2>
            <p className="mb-3 theme-text-secondary">
              We retain your data according to the following schedule:
            </p>
            <ul className="list-disc pl-6 mb-4 theme-text-secondary">
              <li>
                <strong className="theme-text-primary">Account Information:</strong> Retained while
                your account is active
              </li>
              <li>
                <strong className="theme-text-primary">Financial Data:</strong> Cleared after each
                session
              </li>
              <li>
                <strong className="theme-text-primary">Conversation History:</strong> Retained while
                your account is active
              </li>
              <li>
                <strong className="theme-text-primary">Usage Data:</strong> Retained for analytical
                purposes
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              7. Cookies, Tracking, and Local Storage
            </h2>

            <h3
              className="text-xl font-semibold theme-text-primary mb-3"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Authentication Cookies
            </h3>
            <p className="mb-3 theme-text-secondary">
              We use essential cookies to maintain your login session:
            </p>
            <ul className="list-disc pl-6 mb-4 theme-text-secondary">
              <li>
                <strong className="theme-text-primary">accessToken, idToken:</strong> Used to
                authenticate your requests and maintain your session
              </li>
              <li>
                <strong className="theme-text-primary">Security:</strong> Cookies are marked as
                Secure in production and use SameSite policy
              </li>
              <li>
                <strong className="theme-text-primary">Duration:</strong> Session-based, expire
                according to token validity
              </li>
            </ul>

            <h3
              className="text-xl font-semibold theme-text-primary mb-3"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Analytics and Tracking
            </h3>
            <p className="mb-3 theme-text-secondary">
              We use Google Tag Manager (GTM) to collect analytics data. GTM may set its own cookies
              and share data with:
            </p>
            <ul className="list-disc pl-6 mb-4 theme-text-secondary">
              <li>Google Analytics for usage statistics and behavior analysis</li>
              <li>Other analytics services configured in our GTM container</li>
            </ul>
            <p className="mb-4 theme-text-secondary">
              You can opt out of Google Analytics by installing the{' '}
              <a
                href="https://tools.google.com/dlpage/gaoptout"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
              >
                Google Analytics Opt-out Browser Add-on
              </a>
              .
            </p>

            <h3
              className="text-xl font-semibold theme-text-primary mb-3"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Local Storage
            </h3>
            <p className="mb-3 theme-text-secondary">
              We use your browser&apos;s local storage to save your preferences, including:
            </p>
            <ul className="list-disc pl-6 mb-4 theme-text-secondary">
              <li>Theme preferences (light/dark mode)</li>
              <li>Currency display preferences</li>
              <li>AI model preferences</li>
              <li>UI state (sidebar position, panel visibility)</li>
            </ul>
            <p className="theme-text-secondary">
              This data remains on your device and is not transmitted to our servers. You can clear
              this data through your browser settings.
            </p>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              8. Your Rights and Choices
            </h2>
            <p className="mb-3 theme-text-secondary">You have the right to:</p>
            <ul className="list-disc pl-6 mb-4 theme-text-secondary">
              <li>
                <strong className="theme-text-primary">Access Your Data:</strong> View your personal
                information in your account
              </li>
              <li>
                <strong className="theme-text-primary">Correct Your Data:</strong> Update or correct
                inaccurate information
              </li>
              <li>
                <strong className="theme-text-primary">Disconnect Integrations:</strong> Revoke
                access to connected accounting platforms
              </li>
              <li>
                <strong className="theme-text-primary">Opt-Out:</strong> Unsubscribe from marketing
                communications
              </li>
            </ul>
            <p className="theme-text-secondary">
              To exercise these rights, contact us at{' '}
              <a
                href="mailto:team@midascfo.com"
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                team@midascfo.com
              </a>
            </p>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              9. International Data Transfers
            </h2>
            <p className="theme-text-secondary">
              Our servers are located in the United States. If you access our services from outside
              the US, your information will be transferred to, stored, and processed in the US. By
              using our services, you consent to this transfer.
            </p>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              10. Children's Privacy
            </h2>
            <p className="theme-text-secondary">
              Midas is not intended for children under 18 years of age. We do not knowingly collect
              personal information from children. If we discover that a child has provided us with
              personal information, we will delete it immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              11. California Privacy Rights
            </h2>
            <p className="theme-text-secondary">
              California residents have additional rights under the California Consumer Privacy Act
              (CCPA), including the right to know what personal information we collect, the right to
              delete personal information, and the right to opt-out of the sale of personal
              information (which we do not do).
            </p>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              12. Updates to This Policy
            </h2>
            <p className="theme-text-secondary">
              We may update this Privacy Policy from time to time. We will notify you of any
              material changes by posting the new Privacy Policy on this page and updating the "Last
              Updated" date. Your continued use of our services after any changes indicates your
              acceptance of the updated policy.
            </p>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              13. Contact Us
            </h2>
            <p className="mb-3 theme-text-secondary">
              If you have questions or concerns about this Privacy Policy or our data practices,
              please contact us:
            </p>
            <div className="glass-luxury-card p-4 rounded-lg">
              <p className="mb-2 theme-text-secondary">
                <strong className="theme-text-primary">Email:</strong>{' '}
                <a
                  href="mailto:team@midascfo.com"
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  team@midascfo.com
                </a>
              </p>
              <p className="mb-2 theme-text-secondary">
                <strong className="theme-text-primary">Data Protection Officer:</strong>{' '}
                <a
                  href="mailto:team@midascfo.com"
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  team@midascfo.com
                </a>
              </p>
              <p className="theme-text-secondary">
                <strong className="theme-text-primary">Address:</strong> 8 The Green, Ste R, Dover,
                DE 19901
              </p>
            </div>
          </section>

          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <p className="text-center theme-text-secondary">
              This Privacy Policy is part of our{' '}
              <Link
                href="/terms"
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
              >
                Terms of Service
              </Link>
              . By using Midas, you agree to both documents.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
