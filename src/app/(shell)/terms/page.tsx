// src/app/(shell)/terms/page.tsx
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
  title: 'Terms of Service - Midas',
  description: 'Terms of Service for Midas financial intelligence platform',
}

export default function TermsOfService() {
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
            Terms of Service
          </h1>
          <p className="text-sm theme-text-secondary">Effective Date: December 2025</p>
        </div>

        <div className="prose prose-lg max-w-none theme-text-primary">
          <div className="glass-luxury-card border-l-4 border-blue-400 p-4 mb-8">
            <p className="font-semibold text-blue-600 dark:text-blue-400">
              BY ACCESSING OR USING THE MIDAS BETA SERVICE, YOU AGREE TO THESE TERMS OF SERVICE. IF
              YOU DISAGREE WITH ANY PART OF THESE TERMS, YOU MAY NOT USE OUR SERVICE.
            </p>
          </div>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              1. Beta Service
            </h2>
            <p className="theme-text-secondary">
              This is a beta version of our Midas service. The service may contain bugs, errors, or
              limitations. We reserve the right to modify, suspend, or discontinue the service at
              any time without notice during the beta period.
            </p>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              2. User Eligibility and Location
            </h2>
            <p className="theme-text-secondary">
              You must be at least 18 years old and legally able to enter into contracts in your
              jurisdiction to use this service. The service is currently available to users located
              in the United States, United Kingdom, European Union, and United Arab Emirates.
            </p>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              3. Account and Data Collection
            </h2>

            <h3
              className="text-xl font-semibold theme-text-primary mb-3"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Personal Information
            </h3>
            <p className="mb-3 theme-text-secondary">We collect:</p>
            <ul className="list-disc pl-6 mb-4 theme-text-secondary">
              <li>Your name, email, and business contact information</li>
              <li>Company and business details</li>
              <li>Usage data and service analytics</li>
              <li>
                Event and interaction data via Google Tag Manager (including signup events, feature
                usage, and navigation patterns)
              </li>
            </ul>

            <h3
              className="text-xl font-semibold theme-text-primary mb-3"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Financial Data Access
            </h3>
            <p className="mb-3 theme-text-secondary">By using our service, you consent to us:</p>
            <ul className="list-disc pl-6 mb-4 theme-text-secondary">
              <li>
                Pulling data from your connected bookkeeping APIs (QuickBooks is fully supported,
                additional platforms coming soon)
              </li>
              <li>Writing data to your systems when necessary for service functionality</li>
              <li>Accessing your historical and real-time financial information</li>
            </ul>

            <h3
              className="text-xl font-semibold theme-text-primary mb-3"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Third-Party APIs
            </h3>
            <p className="theme-text-secondary">
              Your connected bookkeeping services have their own terms of service that govern your
              use of those platforms. You are responsible for complying with their terms.
            </p>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              4. Data Security
            </h2>
            <p className="mb-3 theme-text-secondary">We protect your data with:</p>
            <ul className="list-disc pl-6 mb-4 theme-text-secondary">
              <li>TLS encryption for all data transmission</li>
              <li>Server-side KMS encryption for data stored at rest</li>
              <li>Amazon S3 and DynamoDB secure cloud storage</li>
              <li>Comprehensive logging and cloud audit trails</li>
              <li>Proper access controls and user authentication</li>
            </ul>
            <div className="glass-luxury-card border-l-4 border-yellow-400 p-4">
              <p className="font-semibold text-yellow-600 dark:text-yellow-400">
                Important: Your financial data is primarily cached on your local systems rather than
                permanently stored in our databases.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              5. Service Limitations
            </h2>

            <h3
              className="text-xl font-semibold theme-text-primary mb-3"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Accuracy Disclaimer
            </h3>
            <p className="mb-4 theme-text-secondary">
              The Midas service is provided &quot;as is&quot; without warranty. We do not guarantee
              the accuracy of any information, analysis, or recommendations. The AI may experience
              hallucinations or provide incorrect information.
            </p>

            <h3
              className="text-xl font-semibold theme-text-primary mb-3"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Not Professional Advice
            </h3>
            <p className="theme-text-secondary">
              We do not provide tax, legal, or investment advice. All information is for general
              purposes only. Consult qualified professionals for specific advice.
            </p>

            <h3
              className="text-xl font-semibold theme-text-primary mb-3"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Usage Limits
            </h3>
            <p className="theme-text-secondary">
              We track your usage of our AI services and may impose limits to ensure fair access for
              all users. Heavy usage may be subject to restrictions.
            </p>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              6. Prohibited Uses
            </h2>
            <p className="mb-3 theme-text-secondary">You may not:</p>
            <ul className="list-disc pl-6 theme-text-secondary">
              <li>Use the service for illegal activities</li>
              <li>Attempt to reverse engineer or hack the service</li>
              <li>Share your account credentials</li>
              <li>Use the service to provide advice to third parties</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              7. Limitation of Liability
            </h2>
            <p className="theme-text-secondary">
              To the maximum extent permitted by law, we are not liable for any indirect,
              incidental, special, or consequential damages, including loss of profits, data, or
              business interruption. Our total liability to you will not exceed $50.
            </p>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              8. Force Majeure
            </h2>
            <p className="mb-3 theme-text-secondary">
              We are not responsible for service interruptions caused by:
            </p>
            <ul className="list-disc pl-6 theme-text-secondary">
              <li>AWS outages or cloud service failures</li>
              <li>Cyber-attacks or security incidents</li>
              <li>Natural disasters or acts of God</li>
              <li>Government actions or regulations</li>
              <li>Internet or telecommunications failures</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              9. Privacy
            </h2>
            <p className="theme-text-secondary">
              Your privacy is important to us. Our{' '}
              <Link
                href="/privacy"
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
              >
                Privacy Policy
              </Link>{' '}
              explains how we collect, use, and protect your information.
            </p>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              10. Intellectual Property
            </h2>
            <p className="theme-text-secondary">
              We own all rights to the Midas service, including software, algorithms, and content.
              You retain ownership of your business data.
            </p>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              11. Termination
            </h2>
            <p className="mb-3 theme-text-secondary">
              Either party may terminate this agreement at any time. Upon termination:
            </p>
            <ul className="list-disc pl-6 theme-text-secondary">
              <li>Your access to the service will end immediately</li>
              <li>We will delete your data according to our retention policy</li>
              <li>These terms will continue to apply where relevant</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              12. Changes to Terms
            </h2>
            <p className="theme-text-secondary">
              We may update these terms at any time. We will notify you of material changes by email
              or through the service. Continued use means you accept the updated terms.
            </p>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              13. Governing Law
            </h2>
            <p className="theme-text-secondary">
              These terms are governed by the laws of the State of Delaware and the United States.
              Any disputes will be resolved in the federal or state courts located in Delaware. You
              consent to the jurisdiction and venue of such courts.
            </p>
          </section>

          <section className="mb-8">
            <h2
              className="text-2xl font-bold theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              14. Contact Information
            </h2>
            <p className="mb-3 theme-text-secondary">
              For questions regarding these Terms of Service:
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
              <p className="theme-text-secondary">
                <strong className="theme-text-primary">Address:</strong> 8 The Green, Ste R, Dover,
                DE 19901
              </p>
            </div>
          </section>

          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <p className="text-center theme-text-secondary font-semibold">
              By using the Midas Beta service, you acknowledge that you have read and agree to these
              Terms of Service.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
