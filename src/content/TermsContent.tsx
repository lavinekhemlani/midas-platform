'use client'

export default function TermsContent() {
  return (
    <div className="space-y-4 text-xs theme-text-secondary leading-relaxed">
      <p>
        By accessing or using the Midas Beta service, you agree to these Terms of Service. If you
        disagree with any part of these terms, you may not use our service.
      </p>

      <h3 className="font-semibold theme-text-primary">1. Beta Service</h3>
      <p>
        This is a beta version of our Midas service. The service may contain bugs, errors, or
        limitations. We reserve the right to modify, suspend, or discontinue the service at any time
        without notice during the beta period.
      </p>

      <h3 className="font-semibold theme-text-primary">2. User Eligibility and Location</h3>
      <p>
        You must be at least 18 years old and legally able to enter into contracts in your
        jurisdiction to use this service. The service is currently available to users located in the
        United States, United Kingdom, European Union, and United Arab Emirates.
      </p>

      <h3 className="font-semibold theme-text-primary">3. Account and Data Collection</h3>
      <p className="font-medium">Personal Information</p>
      <ul className="list-disc list-inside ml-4">
        <li>Your name, email, and business contact information</li>
        <li>Company and business details</li>
        <li>Usage data and service analytics</li>
      </ul>
      <p className="font-medium">Financial Data Access</p>
      <p>By using our service, you consent to us:</p>
      <ul className="list-disc list-inside ml-4">
        <li>
          Pulling data from your connected bookkeeping APIs (QuickBooks is fully supported,
          additional platforms coming soon)
        </li>
        <li>Writing data to your systems when necessary for service functionality</li>
        <li>Accessing your historical and real-time financial information</li>
      </ul>
      <p className="font-medium">Third-Party APIs</p>
      <p>
        Your connected bookkeeping services have their own terms of service that govern your use of
        those platforms. You are responsible for complying with their terms.
      </p>

      <h3 className="font-semibold theme-text-primary">4. Data Security</h3>
      <p>We protect your data with:</p>
      <ul className="list-disc list-inside ml-4">
        <li>TLS encryption for all data transmission</li>
        <li>Server-side KMS encryption for data stored at rest</li>
        <li>Amazon S3 and DynamoDB secure cloud storage</li>
        <li>Comprehensive logging and cloud audit trails</li>
        <li>Proper access controls and user authentication</li>
      </ul>
      <p className="italic">
        Important: Your financial data is primarily cached on your local systems rather than
        permanently stored in our databases.
      </p>

      <h3 className="font-semibold theme-text-primary">5. Service Limitations</h3>
      <p className="font-medium">Accuracy Disclaimer</p>
      <p>
        The Midas service is provided "as is" without warranty. We do not guarantee the accuracy of
        any information, analysis, or recommendations. The AI may experience hallucinations or
        provide incorrect information.
      </p>
      <p className="font-medium">Not Professional Advice</p>
      <p>
        We do not provide tax, legal, or investment advice. All information is for general purposes
        only. Consult qualified professionals for specific advice.
      </p>
      <p className="font-medium">Usage Limits</p>
      <p>
        We track your usage of our AI services and may impose limits to ensure fair access for all
        users. Heavy usage may be subject to restrictions.
      </p>

      <h3 className="font-semibold theme-text-primary">6. Prohibited Uses</h3>
      <ul className="list-disc list-inside ml-4">
        <li>Use the service for illegal activities</li>
        <li>Attempt to reverse engineer or hack the service</li>
        <li>Share your account credentials</li>
        <li>Use the service to provide advice to third parties</li>
      </ul>

      <h3 className="font-semibold theme-text-primary">7. Limitation of Liability</h3>
      <p>
        To the maximum extent permitted by law, we are not liable for any indirect, incidental,
        special, or consequential damages, including loss of profits, data, or business
        interruption.
      </p>
      <p>Our total liability to you will not exceed $50.</p>

      <h3 className="font-semibold theme-text-primary">8. Force Majeure</h3>
      <p>We are not responsible for service interruptions caused by:</p>
      <ul className="list-disc list-inside ml-4">
        <li>AWS outages or cloud service failures</li>
        <li>Cyber-attacks or security incidents</li>
        <li>Natural disasters or acts of God</li>
        <li>Government actions or regulations</li>
        <li>Internet or telecommunications failures</li>
      </ul>

      <h3 className="font-semibold theme-text-primary">9. Privacy</h3>
      <p>
        Your privacy is important to us. Our Privacy Policy explains how we collect, use, and
        protect your information.
      </p>

      <h3 className="font-semibold theme-text-primary">10. Intellectual Property</h3>
      <p>
        We own all rights to the Midas service, including software, algorithms, and content. You
        retain ownership of your business data.
      </p>

      <h3 className="font-semibold theme-text-primary">11. Termination</h3>
      <p>Either party may terminate this agreement at any time. Upon termination:</p>
      <ul className="list-disc list-inside ml-4">
        <li>Your access to the service will end immediately</li>
        <li>We will delete your data according to our retention policy</li>
        <li>These terms will continue to apply where relevant</li>
      </ul>

      <h3 className="font-semibold theme-text-primary">12. Changes to Terms</h3>
      <p>
        We may update these terms at any time. We will notify you of material changes by email or
        through the service. Continued use means you accept the updated terms.
      </p>

      <h3 className="font-semibold theme-text-primary">13. Governing Law</h3>
      <p>
        These terms are governed by the laws of the State of Delaware and the United States. Any
        disputes will be resolved in the federal or state courts located in Delaware. You consent to
        the jurisdiction and venue of such courts.
      </p>

      <h3 className="font-semibold theme-text-primary">14. Contact Information</h3>
      <p>Email: team@midascfo.com</p>
      <p>Address: 8 The Green, Ste R, Dover, DE 19901</p>

      <p className="italic">
        By using the Midas Beta service, you acknowledge that you have read and agree to these Terms
        of Service.
      </p>
    </div>
  )
}
