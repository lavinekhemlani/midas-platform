// src/app/(main)/learn/course/[lesson]/page.tsx
'use client'

import { useState, useEffect, use } from 'react'
import { apiClient } from '@/lib/apiClient'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { logger } from '@/lib/logger'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Star,
  Lightbulb,
  Target,
  Users,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import type { GlossaryEntry } from '@/lib/data'
import LoadingState from '@/components/ui/LoadingState'

interface MCQQuestion {
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
}

// interface LearnProgress { completedTerms: string[]; totalTime: number; lastActive: string }

export default function LessonPage({ params }: { params: Promise<{ lesson: string }> }) {
  const resolvedParams = use(params)
  const { lesson: lessonId } = resolvedParams

  const [lesson, setLesson] = useState<GlossaryEntry | null>(null)
  const [allTerms, setAllTerms] = useState<GlossaryEntry[]>([])
  // Progress state removed in simplified layout
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // MCQ state
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  // Show result inline; no extra state needed
  const [hasCompleted, setHasCompleted] = useState(false)

  // Simplified: removed category icon usage for a cleaner layout

  // Placeholder MCQ - in the future this could be dynamic based on the term
  const mcqQuestion: MCQQuestion = {
    question: 'What is the primary purpose of understanding this financial concept?',
    options: [
      'To impress investors with financial jargon',
      'To make informed business decisions and track performance',
      'To complete paperwork requirements',
      'To calculate taxes more accurately',
    ],
    correctAnswer: 1,
    explanation:
      'Understanding financial concepts helps entrepreneurs make data-driven decisions, track business performance, and communicate effectively with stakeholders.',
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch the specific lesson
      const lessonResponse = await apiClient(`/api/learn/terms/${lessonId}`)
      if (!lessonResponse.ok) {
        if (lessonResponse.status === 404) {
          throw new Error('Lesson not found.')
        }
        throw new Error('Failed to load lesson content.')
      }
      const { term: lessonData } = await lessonResponse.json()
      setLesson(lessonData)

      // Fetch all terms to determine navigation
      const termsResponse = await apiClient('/api/learn/terms')
      const termsData = await termsResponse.json()
      const sortedTerms = (termsData.terms || []).sort((a: GlossaryEntry, b: GlossaryEntry) => {
        if (a.difficulty !== b.difficulty) {
          return a.difficulty - b.difficulty
        }
        return a.category.localeCompare(b.category)
      })
      setAllTerms(sortedTerms)

      // Fetch progress
      const progressResponse = await apiClient('/api/learn/progress')
      const progressData = await progressResponse.json()
      if (progressData.learnState) {
        const completed = (progressData.learnState.completed_terms || []).includes(lessonId)
        setHasCompleted(completed)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.')
    } finally {
      setLoading(false)
    }
  }

  // Removed reading history helper

  const handleAnswerSelect = (answerIndex: number) => {
    setSelectedAnswer(answerIndex)
  }

  // When a user selects an answer, we immediately show the result. If correct, mark complete.
  useEffect(() => {
    if (selectedAnswer === null) return
    const correct = selectedAnswer === mcqQuestion.correctAnswer
    if (correct && !hasCompleted) {
      markLessonComplete()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAnswer])

  const markLessonComplete = async (): Promise<void> => {
    try {
      await apiClient('/api/learn/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          termId: lessonId,
          action: 'complete_term',
          timeSpent: 300, // 5 minutes placeholder
        }),
      })

      setHasCompleted(true)
    } catch (error) {
      logger.error('Failed to mark lesson as complete', { error, component: 'LessonPage' })
    }
  }

  const getCurrentLessonIndex = () => {
    return allTerms.findIndex((term) => term.id === lessonId)
  }

  const getNextLesson = () => {
    const currentIndex = getCurrentLessonIndex()
    return currentIndex < allTerms.length - 1 ? allTerms[currentIndex + 1] : null
  }

  // Previous lesson helper not needed in simplified layout

  const getRelatedTerms = () => {
    if (!lesson?.relatedTerms) return []
    return allTerms.filter((term) => lesson.relatedTerms.includes(term.id)).slice(0, 3)
  }

  if (loading) {
    return null
  }

  if (error || !lesson) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-md w-full text-center p-8 rounded-xl border border-slate-300/40 dark:border-slate-700/40">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold theme-text-primary mb-4">Lesson Not Found</h2>
          <p className="theme-text-secondary mb-6">{error || 'This lesson could not be found.'}</p>
          <Link href="/learn/course">
            <Button className="bg-amber-500 hover:bg-amber-600 text-white">Back to Course</Button>
          </Link>
        </div>
      </div>
    )
  }

  const nextLesson = getNextLesson()
  const relatedTerms = getRelatedTerms()
  const currentIndex = getCurrentLessonIndex()
  const totalLessons = allTerms.length
  const progressPercentage =
    totalLessons > 0 ? Math.round(((currentIndex + 1) / totalLessons) * 100) : 0

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-4 space-y-14 md:space-y-20">
        {/* Header with centered title and navigation hint */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link href="/learn/course">
                <Button
                  variant="ghost"
                  size="sm"
                  className="theme-text-primary hover:theme-text-primary hover:bg-amber-500/10"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Course
                </Button>
              </Link>
              <div className="h-6 w-px bg-slate-300 dark:bg-slate-600" />
              <div className="text-sm theme-text-secondary">
                Lesson {currentIndex + 1} of {totalLessons}
              </div>
            </div>
            {hasCompleted && (
              <div className="flex items-center space-x-2 text-green-500">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Completed</span>
              </div>
            )}
          </div>
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-semibold font-serif theme-text-primary">
              {lesson.title}
            </h1>
            <div className="mt-2 flex items-center justify-center gap-3 text-sm">
              <Badge variant="secondary">{lesson.category}</Badge>
              <div className="flex items-center">
                {Array.from({ length: lesson.difficulty }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-amber-500 fill-current" />
                ))}
              </div>
            </div>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-amber-400 to-amber-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Lesson content - single column, no cards */}
        <div className="space-y-12 md:space-y-16">
          {/* Simple explanation */}
          <section className="space-y-3 md:space-y-4">
            <h2 className="text-xl md:text-2xl font-semibold font-serif theme-text-primary flex items-center justify-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              Simple Explanation
            </h2>
            <p className="text-lg leading-relaxed theme-text-secondary text-center">
              {lesson.definitions.metaphor}
            </p>
          </section>

          {/* Detailed explanation */}
          <section className="space-y-4 md:space-y-5">
            <h2 className="text-xl md:text-2xl font-semibold font-serif theme-text-primary">
              Detailed Explanation
            </h2>
            <p className="leading-relaxed theme-text-secondary">{lesson.definitions.basic}</p>
            {lesson.definitions.contextual && (
              <div className="mt-2 p-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
                <h3 className="font-medium theme-text-primary mb-1">In Context</h3>
                <p className="text-sm theme-text-secondary">{lesson.definitions.contextual}</p>
              </div>
            )}
          </section>

          {/* Examples */}
          <section className="space-y-4 md:space-y-5">
            <h2 className="text-xl md:text-2xl font-semibold font-serif theme-text-primary flex items-center gap-2">
              <Users className="w-5 h-5 text-green-500" />
              Real-World Examples
            </h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-medium theme-text-primary mb-1">For Startups</h3>
                <p className="text-sm theme-text-secondary">{lesson.examples.startup}</p>
              </div>
              {lesson.examples.generic && (
                <div>
                  <h3 className="font-medium theme-text-primary mb-1">General Example</h3>
                  <p className="text-sm theme-text-secondary">{lesson.examples.generic}</p>
                </div>
              )}
            </div>
          </section>

          {/* MCQ Section - simplified */}
          <section className="space-y-5 md:space-y-6">
            <h2 className="text-xl md:text-2xl font-semibold font-serif theme-text-primary flex items-center justify-center gap-2 text-center">
              <Target className="w-5 h-5 text-purple-500" />
              Quick Check
            </h2>
            <div className="max-w-xl mx-auto w-full space-y-4 md:space-y-5">
              <p className="font-medium theme-text-primary text-center">{mcqQuestion.question}</p>
              <div className="grid gap-3 md:gap-4">
                {mcqQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(index)}
                    className={`w-full px-5 py-3 md:px-6 md:py-3.5 rounded-full border transition-all duration-150 text-left theme-text-primary flex items-center gap-3
                      ${
                        selectedAnswer === index
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-slate-300/50 dark:border-slate-600/50 hover:border-slate-400 dark:hover:border-slate-500'
                      }
                      focus:outline-none focus:ring-2 focus:ring-amber-500/40`}
                  >
                    <div className="w-6 h-6 md:w-7 md:h-7 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center text-xs md:text-sm">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="flex-1">{option}</span>
                  </button>
                ))}
              </div>
              {selectedAnswer !== null && (
                <div
                  className={`p-3 rounded-md text-sm ${selectedAnswer === mcqQuestion.correctAnswer ? 'bg-green-500/10 text-green-700 dark:text-green-300' : 'bg-red-500/10 text-red-700 dark:text-red-300'}`}
                >
                  {selectedAnswer === mcqQuestion.correctAnswer ? 'Correct!' : 'Not quite right. '}
                  {mcqQuestion.explanation}
                </div>
              )}
              <div>
                {nextLesson ? (
                  <Link href={`/learn/course/${nextLesson.id}`}>
                    <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white">
                      Next Lesson: {nextLesson.title}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                ) : (
                  <Link href="/learn/course">
                    <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white">
                      Back to Course
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </section>

          {/* Related Terms */}
          {relatedTerms.length > 0 && (
            <section className="space-y-4 md:space-y-5">
              <h2 className="text-xl md:text-2xl font-semibold font-serif theme-text-primary">
                Related Terms
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                {relatedTerms.map((relatedTerm) => (
                  <Link
                    key={relatedTerm.id}
                    href={`/learn/course/${relatedTerm.id}`}
                    className="block group"
                  >
                    <div className="relative p-2.5 md:p-3 rounded-md border border-slate-200/60 dark:border-slate-700/60 hover:border-amber-500/40 hover:bg-amber-500/5 transition-colors duration-150">
                      <h3 className="theme-text-secondary font-light text-xs md:text-sm pr-6">
                        {relatedTerm.title}
                      </h3>
                      <svg
                        className="absolute top-2 right-2 w-4 h-4 theme-text-secondary opacity-50 group-hover:opacity-80 group-hover:text-amber-500/80 dark:group-hover:text-amber-400/80 transition-colors"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M7 17L17 7" />
                        <path d="M7 7h10v10" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
