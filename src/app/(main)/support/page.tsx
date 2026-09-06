// src/app/(main)/support/page.tsx
'use client'

import { useState, useCallback } from 'react'
import {
  HelpCircle,
  MessageSquare,
  Send,
  AlertCircle,
  CheckCircle,
  Mail,
  Clock,
  FileText,
  Loader2,
  BookOpen,
  ShieldCheck,
  Sparkles,
  LifeBuoy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useSession } from '@/hooks/useSession'
import { apiClient } from '@/lib/apiClient'
import { cn } from '@/lib/utils'

interface TicketFormData {
  subject: string
  category: string
  message: string
  attachments?: File[]
}

interface FAQ {
  question: string
  answer: string
  category: string
}

const faqs: FAQ[] = [
  {
    category: 'Getting Started',
    question: 'How do I connect my QuickBooks account?',
    answer:
      'Navigate to Account \u2192 Integrations, click on QuickBooks, and follow the OAuth flow to securely connect your account.',
  },
  {
    category: 'Getting Started',
    question: 'Can I connect multiple accounting platforms?',
    answer:
      'Currently, you can connect one accounting platform at a time. You can switch between platforms from the Integrations page.',
  },
  {
    category: 'Getting Started',
    question: 'How do I set up my financial health metrics?',
    answer:
      'Go to the Reports page and click the settings icon on the Financial Health card. You can select up to 4 key metrics and set custom targets for each.',
  },
  {
    category: 'Features',
    question: 'How does the AI CFO work?',
    answer:
      'Midas, our AI CFO, analyzes your financial data to provide insights, forecasts, and recommendations. Access it via the Chat feature.',
  },
  {
    category: 'Features',
    question: 'What reports are available?',
    answer:
      'Zenith provides Profit & Loss, Balance Sheet, and Cash Flow reports with AI-powered analysis. Access them from the Reports page.',
  },
  {
    category: 'Features',
    question: 'Can I export my reports?',
    answer:
      'Report export functionality is on our roadmap and will be available in an upcoming release. You can currently view all reports in-app.',
  },
  {
    category: 'Billing',
    question: 'How do I upgrade my plan?',
    answer: 'This feature is currently being implemented and will be available soon.',
  },
  {
    category: 'Billing',
    question: 'Is there a free trial?',
    answer:
      'Yes, new accounts start with a free trial period. You can explore all features before committing to a paid plan.',
  },
  {
    category: 'Security',
    question: 'Is my financial data secure?',
    answer:
      'Yes, we use bank-level encryption, secure OAuth connections, and never store your accounting platform credentials.',
  },
  {
    category: 'Security',
    question: 'Who can access my organization data?',
    answer:
      'Only members you invite to your organization can view your financial data. All access is controlled through role-based permissions.',
  },
]

const ticketCategories = [
  { value: 'technical', label: 'Technical Issue' },
  { value: 'billing', label: 'Billing & Subscription' },
  { value: 'integration', label: 'Integration Help' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'data', label: 'Data & Reports' },
  { value: 'other', label: 'Other' },
]

const faqCategoryIcons: Record<string, React.ReactNode> = {
  'Getting Started': <Sparkles className="h-3.5 w-3.5 text-amber-500" />,
  Features: <FileText className="h-3.5 w-3.5 text-blue-400" />,
  Billing: <Mail className="h-3.5 w-3.5 text-emerald-400" />,
  Security: <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />,
}

export default function SupportPage() {
  const { user } = useSession()
  const [selectedFaqCategory, setSelectedFaqCategory] = useState('all')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const [formData, setFormData] = useState<TicketFormData>({
    subject: '',
    category: '',
    message: '',
  })

  const handleInputChange = useCallback((field: keyof TicketFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.subject || !formData.category || !formData.message) {
      setErrorMessage('Please fill in all required fields')
      setSubmitStatus('error')
      return
    }

    setIsSubmitting(true)
    setSubmitStatus('idle')
    setErrorMessage('')

    try {
      const response = await apiClient('/api/support/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          userEmail: user?.email || 'Not provided',
          userId: user?.user_id,
          timestamp: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to submit ticket')
      }

      setSubmitStatus('success')
      setFormData({
        subject: '',
        category: '',
        message: '',
      })

      setTimeout(() => setSubmitStatus('idle'), 5000)
    } catch (error) {
      console.error('Error submitting ticket:', error)
      setErrorMessage('Failed to submit ticket. Please try again or contact us directly.')
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const faqCategories = ['all', ...new Set(faqs.map((faq) => faq.category))]
  const filteredFaqs =
    selectedFaqCategory === 'all'
      ? faqs
      : faqs.filter((faq) => faq.category === selectedFaqCategory)

  return (
    <div className="@container space-y-4">
      {/* Page subheading + contact info — mirrors reports page header row */}
      <div className="flex items-center justify-between gap-4">
        <span className="text-xl theme-text-secondary">
          Get help with your account and platform
        </span>
        <div className="flex items-center gap-3">
          <span className="text-sm theme-text-secondary flex items-center gap-2 whitespace-nowrap">
            <span className="font-serif italic text-[0.9rem] theme-text-primary">email</span>
            <span>team@midascfo.com</span>
            <span className="font-serif italic text-[0.9rem] theme-text-primary ml-1">
              response
            </span>
            <span>within 24h</span>
          </span>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg glass-luxury-card border-amber-500/20">
            <LifeBuoy className="w-3.5 h-3.5 text-amber-500" />
          </div>
        </div>
      </div>

      {/* Main content grid — matches reports layout patterns */}
      <div className="@container flex flex-col gap-3">
        {/* Row 1: Ticket Form + FAQ side by side */}
        <div className="flex flex-col @3xl:flex-row gap-3">
          {/* Submit Ticket Card — flex-1 like reports row items */}
          <div className="flex-1 @3xl:flex-[3]">
            <div className="glass-luxury-card rounded-xl border border-amber-500/10 p-5 h-full">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-medium theme-text-primary font-[family-name:var(--font-dm-sans)]">
                  Submit a Ticket
                </h2>
              </div>
              <p className="text-xs theme-text-secondary mb-4">
                Describe your issue and we&apos;ll get back to you within 24 hours
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 @xl:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="subject"
                      className="text-xs font-medium theme-text-secondary uppercase tracking-wider"
                    >
                      Subject
                    </Label>
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={(e) => handleInputChange('subject', e.target.value)}
                      placeholder="Brief description of your issue"
                      className="glass-luxury-card border-amber-500/10 focus:border-amber-500/30 transition-colors text-sm h-9"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="category"
                      className="text-xs font-medium theme-text-secondary uppercase tracking-wider"
                    >
                      Category
                    </Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => handleInputChange('category', value)}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger className="glass-luxury-card border-amber-500/10 focus:border-amber-500/30 transition-colors text-sm h-9">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent className="glass-luxury-card">
                        {ticketCategories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="message"
                    className="text-xs font-medium theme-text-secondary uppercase tracking-wider"
                  >
                    Message
                  </Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => handleInputChange('message', e.target.value)}
                    placeholder="Please provide as much detail as possible about your issue..."
                    className="min-h-[400px] glass-luxury-card border-amber-500/10 focus:border-amber-500/30 transition-colors resize-none text-sm"
                    disabled={isSubmitting}
                  />
                </div>

                {submitStatus === 'success' && (
                  <Alert variant="success">
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Ticket Submitted</AlertTitle>
                    <AlertDescription>
                      Your ticket has been received. We&apos;ll respond within 24 hours.
                    </AlertDescription>
                  </Alert>
                )}

                {submitStatus === 'error' && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs theme-text-secondary">All fields are required</p>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="min-w-[130px] bg-amber-600 hover:bg-amber-500 text-white transition-colors text-sm h-9"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-3.5 w-3.5" />
                        Submit Ticket
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* FAQ Card — flex-1 like reports row items */}
          <div className="flex-1 @3xl:flex-[2]">
            <div className="glass-luxury-card rounded-xl border border-amber-500/10 p-5 h-full">
              <div className="flex items-center gap-2 mb-3">
                <HelpCircle className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-medium theme-text-primary font-[family-name:var(--font-dm-sans)]">
                  Frequently Asked
                </h2>
              </div>

              {/* Category filter pills */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {faqCategories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedFaqCategory(category)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 capitalize',
                      selectedFaqCategory === category
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                        : 'theme-text-secondary hover:theme-text-primary border border-transparent hover:bg-white/[0.04]'
                    )}
                  >
                    {category === 'all' ? 'All' : category}
                  </button>
                ))}
              </div>

              <Accordion type="single" collapsible className="w-full">
                {filteredFaqs.map((faq, index) => (
                  <AccordionItem
                    key={index}
                    value={`faq-${index}`}
                    className="border-b border-white/[0.04] last:border-b-0"
                  >
                    <AccordionTrigger className="py-3 hover:no-underline group/faq text-left">
                      <div className="flex items-start gap-2 pr-2">
                        <span className="mt-0.5 shrink-0 opacity-60 group-hover/faq:opacity-100 transition-opacity">
                          {faqCategoryIcons[faq.category] || (
                            <HelpCircle className="h-3.5 w-3.5 text-amber-500" />
                          )}
                        </span>
                        <span className="text-sm font-medium theme-text-primary leading-snug">
                          {faq.question}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pl-6 theme-text-secondary text-sm leading-relaxed pb-3">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              {filteredFaqs.length === 0 && (
                <div className="py-6 text-center">
                  <HelpCircle className="h-6 w-6 text-amber-500/30 mx-auto mb-2" />
                  <p className="text-xs theme-text-secondary">No FAQs in this category yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Quick info cards — same dense grid as reports */}
        <div className="grid grid-cols-1 @2xl:grid-cols-3 gap-3">
          <div className="glass-luxury-card rounded-xl border border-amber-500/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/15">
                <Mail className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium theme-text-primary">Email Support</p>
                <p className="text-xs theme-text-secondary">team@midascfo.com</p>
              </div>
            </div>
          </div>

          <div className="glass-luxury-card rounded-xl border border-amber-500/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/15">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium theme-text-primary">Response Time</p>
                <p className="text-xs theme-text-secondary">Within 24 hours</p>
              </div>
            </div>
          </div>

          <div className="glass-luxury-card rounded-xl border border-amber-500/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/15">
                <BookOpen className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium theme-text-primary">Documentation</p>
                <p className="text-xs theme-text-secondary">Browse our guides</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
