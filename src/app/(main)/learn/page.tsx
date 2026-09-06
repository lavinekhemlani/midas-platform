// src/app/(main)/learn/page.tsx
'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useLearnTerms, useLearnProgress } from '@/hooks/useLearnData'
import { TermCard } from '@/components/learn/core/TermCard'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  BookOpen,
  ArrowRight,
  Search,
  Grid3X3,
  LayoutList,
  GraduationCap,
  FileQuestion,
  Library,
  Sparkles,
  ChevronDown,
  TrendingUp,
  Target,
  Zap,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'
import type { GlossaryEntry } from '@/lib/data'
import { useFinancialData } from '@/contexts/FinancialDataContext'

interface SmartRecommendation {
  id: string
  termId: string
  urgency: 'high' | 'medium' | 'low'
}

// Category icons mapping
const categoryIcons: Record<string, typeof TrendingUp> = {
  fundamentals: BookOpen,
  growth: TrendingUp,
  'cash flow': Zap,
  fundraising: Target,
  operations: GraduationCap,
}

export default function LearnHubPage() {
  const { terms, isLoading: termsLoading, error: termsError } = useLearnTerms()
  const { progress, isLoading: progressLoading, error: progressError } = useLearnProgress()

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isHeaderVisible, setIsHeaderVisible] = useState(true)

  const heroRef = useRef<HTMLDivElement>(null)
  const { financialData } = useFinancialData()

  // Intersection observer for hero section
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsHeaderVisible(entry.isIntersecting)
      },
      { threshold: 0.1 }
    )

    if (heroRef.current) {
      observer.observe(heroRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const loading = termsLoading && progressLoading
  const error = termsError || progressError

  const categories = useMemo(() => {
    return [...new Set(terms.map((term: GlossaryEntry) => term.category))] as string[]
  }, [terms])

  const filteredTerms = useMemo(() => {
    let filtered = terms

    if (selectedCategory) {
      filtered = filtered.filter((term) => term.category === selectedCategory)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (term) =>
          term.title.toLowerCase().includes(query) ||
          term.definitions.basic.toLowerCase().includes(query) ||
          term.category.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [terms, selectedCategory, searchQuery])

  // Group terms by category for magazine layout
  const termsByCategory = useMemo(() => {
    const grouped: Record<string, GlossaryEntry[]> = {}
    filteredTerms.forEach((term) => {
      if (!grouped[term.category]) {
        grouped[term.category] = []
      }
      grouped[term.category].push(term)
    })
    return grouped
  }, [filteredTerms])

  const urgentRecommendations = useMemo((): SmartRecommendation[] => {
    if (!financialData?.kpis) return []

    const recommendations: SmartRecommendation[] = []

    const runway = financialData.kpis.find((k) => k.metric === 'runway_months')
    const ocf = financialData.kpis.find((k) => k.metric === 'ocf')

    if (runway && runway.value < 6 && !progress.completedTerms.includes('runway')) {
      recommendations.push({ id: 'runway-critical', termId: 'runway', urgency: 'high' })
    }

    if (ocf && ocf.value < 0 && !progress.completedTerms.includes('cash-flow')) {
      recommendations.push({ id: 'cashflow-negative', termId: 'cash-flow', urgency: 'high' })
    }

    return recommendations
  }, [financialData, progress])

  // Calculate progress percentage
  const progressPercentage =
    terms.length > 0 ? Math.round((progress.completedTerms.length / terms.length) * 100) : 0

  if (error && !terms.length) {
    return (
      <div className="learn-page min-h-screen flex items-center justify-center p-4">
        <Card className="glass-luxury-card max-w-md w-full border border-red-500/20">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 mx-auto bg-red-500/10 rounded-full flex items-center justify-center">
                <span className="text-red-500 text-xl">⚠</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-2 theme-text-primary">
                  Failed to Load Content
                </h2>
                <p className="theme-text-secondary text-sm">
                  {error?.message || 'Unable to load learning data. Please try again.'}
                </p>
              </div>
              <Button variant="outline" onClick={() => window.location.reload()} className="w-full">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Track if we're in the initial loading state (no data yet)
  const isInitialLoad = termsLoading && terms.length === 0

  return (
    <div className="learn-page min-h-screen">
      {/* Ambient Background */}
      <div className="learn-ambient-bg" />

      {/* Hero Section */}
      <div ref={heroRef} className="learn-hero">
        <div className="learn-hero-content">
          {/* Editorial Header */}
          <div className="learn-hero-text">
            <span className="learn-overline">Financial Intelligence</span>
            <h1 className="learn-title">
              Master the Language
              <br />
              <span className="learn-title-accent">of Finance</span>
            </h1>
            <p className="learn-subtitle">
              Build your financial vocabulary through interactive courses, assessments, and a
              comprehensive glossary of essential concepts.
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="learn-progress-ring">
            <svg viewBox="0 0 120 120" className="learn-progress-svg">
              <circle cx="60" cy="60" r="52" className="learn-progress-track" />
              <circle
                cx="60"
                cy="60"
                r="52"
                className="learn-progress-fill"
                style={{
                  strokeDasharray: `${progressPercentage * 3.27} 327`,
                }}
              />
            </svg>
            <div className="learn-progress-inner">
              <span className="learn-progress-value">{progressPercentage}%</span>
              <span className="learn-progress-label">Complete</span>
            </div>
          </div>
        </div>

        {/* Quick Access Cards */}
        <div className="learn-pathways">
          {/* Tests Card */}
          <Link href="/learn/test" className="learn-pathway-card learn-pathway-tests">
            <div className="learn-pathway-icon">
              <FileQuestion strokeWidth={1.5} />
            </div>
            <div className="learn-pathway-content">
              <span className="learn-pathway-badge">Assessment</span>
              <h3 className="learn-pathway-title">Knowledge Tests</h3>
              <p className="learn-pathway-desc">
                Validate your understanding with quick assessments
              </p>
            </div>
            <ArrowRight className="learn-pathway-arrow" />
          </Link>

          {/* Courses Card */}
          <Link href="/learn/course" className="learn-pathway-card learn-pathway-courses">
            <div className="learn-pathway-icon">
              <GraduationCap strokeWidth={1.5} />
            </div>
            <div className="learn-pathway-content">
              <span className="learn-pathway-badge">
                {progress.completedTerms.length}/{terms.length} lessons
              </span>
              <h3 className="learn-pathway-title">Guided Courses</h3>
              <p className="learn-pathway-desc">
                Structured learning from fundamentals to advanced
              </p>
            </div>
            <ArrowRight className="learn-pathway-arrow" />
          </Link>

          {/* Glossary Card */}
          <button
            onClick={() =>
              document.getElementById('glossary-section')?.scrollIntoView({ behavior: 'smooth' })
            }
            className="learn-pathway-card learn-pathway-glossary"
          >
            <div className="learn-pathway-icon">
              <Library strokeWidth={1.5} />
            </div>
            <div className="learn-pathway-content">
              <span className="learn-pathway-badge">{terms.length} definitions</span>
              <h3 className="learn-pathway-title">Glossary</h3>
              <p className="learn-pathway-desc">Comprehensive reference of financial terms</p>
            </div>
            <ChevronDown className="learn-pathway-arrow" />
          </button>
        </div>
      </div>

      {/* Glossary Section */}
      <div id="glossary-section" className="learn-glossary">
        {/* Section Header with Filters */}
        <div className="learn-glossary-header">
          <div className="learn-glossary-title-row">
            <div className="learn-glossary-title-group">
              <h2 className="learn-glossary-title">Glossary</h2>
              <span className="learn-glossary-count">{filteredTerms.length} concepts</span>
            </div>

            <div className="learn-glossary-filters">
              {/* Search */}
              <div className="learn-search-wrapper">
                <Search className="learn-search-icon" />
                <Input
                  placeholder="Search concepts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="learn-search-input"
                />
              </div>

              {/* View Toggle */}
              <div className="learn-view-toggle">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`learn-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  aria-label="Grid view"
                >
                  <Grid3X3 />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`learn-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                  aria-label="List view"
                >
                  <LayoutList />
                </button>
              </div>
            </div>
          </div>

          {/* Category Pills */}
          <div className="learn-category-pills">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`learn-category-pill ${!selectedCategory ? 'active' : ''}`}
            >
              All
            </button>
            {categories.map((category) => {
              const IconComponent = categoryIcons[category.toLowerCase()] || BookOpen
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`learn-category-pill ${selectedCategory === category ? 'active' : ''}`}
                >
                  <IconComponent className="learn-pill-icon" />
                  {category}
                </button>
              )
            })}
          </div>
        </div>

        {/* Terms Display */}
        {isInitialLoad ? (
          <div className="learn-loading-state">
            <div className="learn-loading-spinner">
              <Loader2 className="animate-spin" />
            </div>
            <p className="learn-loading-text">Loading glossary terms...</p>
          </div>
        ) : filteredTerms.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="learn-terms-grid">
              {filteredTerms.map((term, index) => {
                const isUrgent = urgentRecommendations.some((rec) => rec.termId === term.id)

                return (
                  <div
                    key={term.id}
                    className={`learn-term-wrapper ${isUrgent ? 'urgent' : ''}`}
                    style={{ '--stagger-delay': `${index * 50}ms` } as React.CSSProperties}
                  >
                    {isUrgent && (
                      <div className="learn-urgent-badge">
                        <Sparkles />
                        <span>Priority</span>
                      </div>
                    )}
                    <TermCard term={term} className={isUrgent ? 'urgent' : ''} />
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="learn-terms-list">
              {Object.entries(termsByCategory).map(([category, categoryTerms]) => (
                <div key={category} className="learn-category-group">
                  <h3 className="learn-category-heading">{category}</h3>
                  <div className="learn-category-terms">
                    {categoryTerms.map((term, index) => {
                      const isUrgent = urgentRecommendations.some((rec) => rec.termId === term.id)
                      return (
                        <div
                          key={term.id}
                          className={`learn-term-wrapper ${isUrgent ? 'urgent' : ''}`}
                          style={{ '--stagger-delay': `${index * 30}ms` } as React.CSSProperties}
                        >
                          {isUrgent && (
                            <div className="learn-urgent-badge">
                              <Sparkles />
                              <span>Priority</span>
                            </div>
                          )}
                          <TermCard
                            term={term}
                            variant="list"
                            className={isUrgent ? 'urgent' : ''}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="learn-empty-state">
            <div className="learn-empty-icon">
              <BookOpen strokeWidth={1} />
            </div>
            <h3 className="learn-empty-title">No concepts found</h3>
            <p className="learn-empty-desc">
              {selectedCategory
                ? `No concepts in "${selectedCategory}".`
                : searchQuery
                  ? `No results for "${searchQuery}".`
                  : 'No concepts available.'}
            </p>
            {(selectedCategory || searchQuery) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedCategory(null)
                  setSearchQuery('')
                }}
                className="learn-empty-btn"
              >
                Clear Filters
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
