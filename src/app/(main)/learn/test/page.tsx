'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, Circle, ArrowLeft, Trophy, AlertCircle, FileQuestion } from 'lucide-react'

interface Question {
  id: number
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export default function LearnTestPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [answers, setAnswers] = useState<number[]>([])
  const [showResult, setShowResult] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        setIsLoading(true)
        const res = await fetch('/learn/questions.json', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load questions')
        const data: Question[] = await res.json()
        setQuestions(data)
        setAnswers(new Array(data.length).fill(-1))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to load questions')
      } finally {
        setIsLoading(false)
      }
    }
    void loadQuestions()
  }, [])

  const total = questions.length
  const progress = useMemo(() => {
    if (total === 0) return 0
    const answeredCount = answers.filter((a) => a !== -1).length
    return Math.round((answeredCount / total) * 100)
  }, [answers, total])

  const current = questions[currentIndex]
  const canProceed = selectedIndex !== null

  const handleSelect = (idx: number) => {
    setSelectedIndex(idx)
  }

  const handleNext = () => {
    if (selectedIndex === null) return
    const nextAnswers = [...answers]
    nextAnswers[currentIndex] = selectedIndex
    setAnswers(nextAnswers)
    setSelectedIndex(null)

    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1)
    } else {
      setShowResult(true)
    }
  }

  const handlePrev = () => {
    if (currentIndex === 0) return
    setSelectedIndex(answers[currentIndex - 1] !== -1 ? answers[currentIndex - 1] : null)
    setCurrentIndex((i) => i - 1)
  }

  const correctCount = useMemo(() => {
    return questions.reduce((acc, q, i) => acc + (answers[i] === q.correctIndex ? 1 : 0), 0)
  }, [answers, questions])

  if (isLoading) {
    return null
  }

  if (error) {
    return (
      <div className="min-h-screen py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <Card className="glass-luxury-card border border-red-500/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold theme-text-primary mb-1">
                    Unable to load test
                  </h2>
                  <p className="text-sm theme-text-secondary mb-4">{error}</p>
                  <Link href="/learn">
                    <Button variant="outline" size="sm">
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back to Learn
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (showResult) {
    const scorePercent = Math.round((correctCount / Math.max(total, 1)) * 100)
    const isGood = scorePercent >= 70

    return (
      <div className="min-h-screen py-6 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div className="space-y-1">
            <Link
              href="/learn"
              className="inline-flex items-center text-sm theme-text-secondary hover:text-cyan-500 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Learn
            </Link>
            <h1 className="text-2xl font-semibold theme-text-primary">Test Results</h1>
          </div>

          {/* Score Card */}
          <Card
            className={`glass-luxury-card border ${isGood ? 'border-emerald-500/20' : 'border-amber-500/20'}`}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div
                  className={`w-12 h-12 rounded-lg ${isGood ? 'bg-emerald-500/10' : 'bg-amber-500/10'} flex items-center justify-center`}
                >
                  <Trophy className={`w-6 h-6 ${isGood ? 'text-emerald-500' : 'text-amber-500'}`} />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold theme-text-primary">
                    {isGood ? 'Great job!' : 'Keep learning!'}
                  </h2>
                  <p className="text-sm theme-text-secondary">
                    You scored {correctCount} out of {total} questions correctly
                  </p>
                </div>
                <div className="text-right">
                  <div
                    className={`text-3xl font-bold ${isGood ? 'text-emerald-500' : 'text-amber-500'}`}
                  >
                    {scorePercent}%
                  </div>
                </div>
              </div>
              <Progress value={scorePercent} className="h-2" />
            </CardContent>
          </Card>

          {/* Questions Review */}
          <div className="space-y-3">
            {questions.map((q, i) => {
              const isCorrect = answers[i] === q.correctIndex
              return (
                <Card
                  key={q.id}
                  className={`glass-luxury-card border ${isCorrect ? 'border-emerald-500/20' : 'border-red-500/20'}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isCorrect ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}
                      >
                        <span
                          className={`text-xs font-semibold ${isCorrect ? 'text-emerald-500' : 'text-red-500'}`}
                        >
                          {i + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium theme-text-primary mb-2">{q.question}</p>
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="theme-text-secondary">Correct:</span>
                            <span className="text-emerald-500 font-medium">
                              {q.options[q.correctIndex]}
                            </span>
                          </div>
                          {!isCorrect && (
                            <div className="flex items-center gap-2">
                              <span className="theme-text-secondary">Your answer:</span>
                              <span className="text-red-500">{q.options[answers[i]] ?? '—'}</span>
                            </div>
                          )}
                          <p className="theme-text-secondary italic mt-2">{q.explanation}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => router.push('/learn')}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Learn
            </Button>
            <Button
              onClick={() => router.refresh()}
              className="bg-cyan-500 hover:bg-cyan-600 text-white"
            >
              Retake Test
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-6 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Link
              href="/learn"
              className="inline-flex items-center text-sm theme-text-secondary hover:text-cyan-500 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Learn
            </Link>
            <h1 className="text-2xl font-semibold theme-text-primary">Knowledge Test</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <FileQuestion className="w-4 h-4 text-cyan-500" />
            </div>
            <div className="text-right">
              <div className="text-xs theme-text-secondary">Question</div>
              <div className="text-sm font-semibold theme-text-primary">
                {currentIndex + 1} / {total}
              </div>
            </div>
          </div>
        </div>

        {/* Progress */}
        <Progress value={progress} className="h-1.5" />

        {/* Question Card */}
        <Card className="glass-luxury-card border border-gray-200/10">
          <CardContent className="p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={current?.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <h2 className="text-lg font-semibold theme-text-primary mb-6">
                  {current?.question}
                </h2>

                <div className="space-y-3">
                  {current?.options.map((opt, idx) => {
                    const isSelected = selectedIndex === idx
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelect(idx)}
                        className={`w-full text-left rounded-lg border p-4 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 ${
                          isSelected
                            ? 'border-cyan-500 bg-cyan-500/10'
                            : 'border-gray-200/20 hover:border-gray-200/40 hover:bg-gray-500/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isSelected ? (
                            <CheckCircle2 className="w-5 h-5 text-cyan-500 flex-shrink-0" />
                          ) : (
                            <Circle className="w-5 h-5 theme-text-secondary flex-shrink-0" />
                          )}
                          <span className="text-sm theme-text-primary">{opt}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-8 flex items-center justify-between">
                  <Button variant="outline" onClick={handlePrev} disabled={currentIndex === 0}>
                    Previous
                  </Button>
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed}
                    className="bg-cyan-500 hover:bg-cyan-600 text-white disabled:opacity-50"
                  >
                    {currentIndex === total - 1 ? 'Submit' : 'Next'}
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
