// src/app/(main)/learn/course/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { apiClient } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  CheckCircle,
  Lock,
  ArrowRight,
  ArrowLeft,
  Star,
  Trophy,
  GraduationCap,
  Target,
} from 'lucide-react'
import Link from 'next/link'
import type { GlossaryEntry } from '@/lib/data'

interface LearnProgress {
  completedTerms: string[]
  totalTime: number
  lastActive: string
}

export default function CoursePage() {
  const [terms, setTerms] = useState<GlossaryEntry[]>([])
  const [progress, setProgress] = useState<LearnProgress>({
    completedTerms: [],
    totalTime: 0,
    lastActive: new Date().toISOString(),
  })
  const [loading, setLoading] = useState(true)
  const [showWorkInProgress, setShowWorkInProgress] = useState(false)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchData = async () => {
    try {
      const termsResponse = await apiClient('/api/learn/terms')
      const termsData = await termsResponse.json()
      const allTerms = termsData.terms || []

      const sortedTerms = allTerms.sort((a: GlossaryEntry, b: GlossaryEntry) => {
        if (a.difficulty !== b.difficulty) {
          return a.difficulty - b.difficulty
        }
        return a.category.localeCompare(b.category)
      })

      setTerms(sortedTerms)

      const progressResponse = await apiClient('/api/learn/progress')
      const progressData = await progressResponse.json()
      if (progressData.learnState) {
        setProgress({
          completedTerms: progressData.learnState.completed_terms || [],
          totalTime: calculateTotalTime(progressData.learnState.reading_history || []),
          lastActive: progressData.learnState.updated_at || new Date().toISOString(),
        })
      }
    } catch (error) {
      logger.error('Error fetching data', { error, component: 'CoursePage' })
    } finally {
      setLoading(false)
    }
  }

  type ReadingHistoryEntry = { time_spent?: number; timeSpent?: number }
  const calculateTotalTime = (history: ReadingHistoryEntry[]): number => {
    return history.reduce((total, h) => total + (h.time_spent ?? h.timeSpent ?? 0), 0)
  }

  const learningPathGrouped = useMemo(() => {
    const pathWithStatus = terms.map((term, index) => {
      const isCompleted = progress.completedTerms.includes(term.id)
      const isNext =
        !isCompleted && (index === 0 || progress.completedTerms.includes(terms[index - 1]?.id))
      const isLocked = !isCompleted && !isNext

      return {
        ...term,
        isCompleted,
        isNext,
        isLocked,
        stepNumber: index + 1,
      }
    })

    const grouped = pathWithStatus.reduce(
      (acc, lesson) => {
        const difficulty = lesson.difficulty
        if (!acc[difficulty]) {
          acc[difficulty] = []
        }
        acc[difficulty].push(lesson)
        return acc
      },
      {} as Record<number, typeof pathWithStatus>
    )

    return grouped
  }, [terms, progress])

  const difficultyLevels = Object.keys(learningPathGrouped)
    .map(Number)
    .sort((a, b) => a - b)

  const progressPercentage =
    terms.length > 0 ? Math.round((progress.completedTerms.length / terms.length) * 100) : 0
  const completedCount = progress.completedTerms.length
  const totalCount = terms.length

  if (loading) {
    return null
  }

  return (
    <div className="min-h-screen py-6 px-4">
      {/* Work in Progress Toast */}
      {showWorkInProgress && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <Card className="glass-luxury-card border border-amber-500/30 shadow-lg">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-amber-500" />
              </div>
              <span className="text-sm font-medium theme-text-primary">
                Course content is being developed. Check back soon!
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <Link
            href="/learn"
            className="inline-flex items-center text-sm theme-text-secondary hover:text-amber-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Learn
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold theme-text-primary">
                Financial Mastery Course
              </h1>
              <p className="text-sm theme-text-secondary mt-1">
                A structured pathway from basics to advanced financial concepts
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Progress Card */}
        <Card className="glass-luxury-card border border-gray-200/10">
          <CardContent className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium theme-text-primary">Course Progress</span>
                  <span className="text-sm font-semibold text-amber-500">
                    {progressPercentage}%
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>
            </div>
            <div className="flex justify-between text-xs theme-text-secondary pl-14">
              <span>{completedCount} completed</span>
              <span>{totalCount - completedCount} remaining</span>
            </div>
          </CardContent>
        </Card>

        {/* Learning Path */}
        <div className="space-y-6">
          {difficultyLevels.map((difficulty) => {
            const lessons = learningPathGrouped[difficulty] || []
            if (lessons.length === 0) return null

            const difficultyLabels: Record<number, string> = {
              1: 'Beginner',
              2: 'Intermediate',
              3: 'Advanced',
              4: 'Expert',
              5: 'Master',
            }

            return (
              <div key={difficulty} className="space-y-3">
                {/* Section Header */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: difficulty }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    ))}
                  </div>
                  <h2 className="text-base font-semibold theme-text-primary">
                    {difficultyLabels[difficulty] || `Level ${difficulty}`}
                  </h2>
                  <span className="text-xs theme-text-secondary">
                    ({lessons.length} lesson{lessons.length !== 1 ? 's' : ''})
                  </span>
                  <div className="flex-1 h-px bg-gray-200/10" />
                </div>

                {/* Lessons Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {lessons.map((lesson) => {
                    const statusColors = lesson.isCompleted
                      ? 'border-emerald-500/20 hover:border-emerald-500/40'
                      : lesson.isNext
                        ? 'border-cyan-500/20 hover:border-cyan-500/40'
                        : 'border-gray-200/10 opacity-60'

                    const iconBg = lesson.isCompleted
                      ? 'bg-emerald-500/10'
                      : lesson.isNext
                        ? 'bg-cyan-500/10'
                        : 'bg-gray-500/10'

                    const iconColor = lesson.isCompleted
                      ? 'text-emerald-500'
                      : lesson.isNext
                        ? 'text-cyan-500'
                        : 'text-gray-400'

                    return (
                      <Card
                        key={lesson.id}
                        className={`glass-luxury-card border ${statusColors} transition-all duration-200 cursor-pointer group`}
                        onClick={(e) => {
                          e.preventDefault()
                          setShowWorkInProgress(true)
                          setTimeout(() => setShowWorkInProgress(false), 3000)
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}
                            >
                              {lesson.isCompleted ? (
                                <CheckCircle className={`w-4 h-4 ${iconColor}`} />
                              ) : lesson.isLocked ? (
                                <Lock className={`w-4 h-4 ${iconColor}`} />
                              ) : (
                                <span className={`text-sm font-semibold ${iconColor}`}>
                                  {lesson.stepNumber}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] theme-text-secondary mb-0.5">
                                Chapter {lesson.stepNumber}
                              </div>
                              <h3 className="text-sm font-medium theme-text-primary line-clamp-1">
                                {lesson.title}
                              </h3>
                            </div>
                            {!lesson.isLocked && (
                              <ArrowRight className="w-4 h-4 theme-text-secondary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Completion Celebration */}
        {completedCount === totalCount && totalCount > 0 && (
          <Card className="glass-luxury-card border border-amber-500/20">
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 rounded-lg bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-7 h-7 text-amber-500" />
              </div>
              <h3 className="text-xl font-semibold theme-text-primary mb-2">Congratulations!</h3>
              <p className="text-sm theme-text-secondary mb-6 max-w-md mx-auto">
                You&apos;ve completed the Financial Mastery Course. You now have a solid foundation
                in financial concepts.
              </p>
              <div className="flex justify-center gap-3">
                <Link href="/learn">
                  <Button variant="outline" size="sm">
                    Explore More Terms
                  </Button>
                </Link>
                <Link href="/reports">
                  <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">
                    Apply Your Knowledge
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
