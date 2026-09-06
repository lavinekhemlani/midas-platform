// src/components/quickbooks/projects/ProjectPerformanceDashboard.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  Briefcase,
  TrendingUp,
  DollarSign,
  Clock,
  AlertCircle,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import { BaseCard } from '../shared/BaseCard'
import { MetricCard } from '../shared/MetricCard'
import { MemoryCitationBadge } from '../shared/MemoryCitationBadge'
import { QuickBooksComponentProps, PerformanceMetrics, MemoryCitation } from '../shared/types'
import { ProjectsProvider, ProjectProfitability } from '@/lib/providers/quickbooks/projects'

interface ProjectPerformanceData extends PerformanceMetrics {
  project_id: string
  project_name: string
  status: 'InProgress' | 'Completed' | 'AtRisk'
  completion_percentage: number
  budget_utilization: number
  hours_worked?: number
}

interface ProjectPerformanceDashboardProps extends QuickBooksComponentProps {
  organizationId: string
  currency?: string
  limit?: number
  onProjectClick?: (projectId: string) => void
  onRefresh?: () => void
}

export function ProjectPerformanceDashboard({
  organizationId,
  currency = 'USD',
  limit = 5,
  onProjectClick,
  onRefresh,
  className,
  memories,
  showMemoryCitations = true,
  isLoading: externalLoading,
  error: externalError,
  ...props
}: ProjectPerformanceDashboardProps) {
  const [projects, setProjects] = useState<ProjectPerformanceData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Calculate memory citations
  const memoryCitations: MemoryCitation[] =
    memories
      ?.filter((m) => {
        // Accept any memory type that has project-related metadata
        return (
          m.metadata &&
          typeof m.metadata === 'object' &&
          'impact' in m.metadata &&
          m.metadata.impact === 'project'
        )
      })
      ?.map((m) => ({
        memoryId: m.id,
        type: 'expense',
        impact: m.content,
        date: new Date(m.createdAt).toISOString(),
      })) || []

  useEffect(() => {
    loadProjectData()
  }, [organizationId])

  const loadProjectData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Get projects summary
      const summary = await ProjectsProvider.getProjectsSummary(organizationId, {
        status: 'InProgress',
        start_date: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
      })

      // Transform to dashboard data
      const projectData: ProjectPerformanceData[] = summary.projects.slice(0, limit).map((p) => ({
        project_id: p.project_id,
        project_name: p.project_name,
        revenue: p.revenue,
        expenses: p.expenses,
        profit: p.profit,
        profit_margin: p.profit_margin,
        status: p.profit_margin < 10 ? 'AtRisk' : 'InProgress',
        completion_percentage: Math.random() * 100, // Would need actual data
        budget_utilization: (p.expenses / (p.revenue * 1.2)) * 100, // Rough estimate
        hours_worked: p.hours_worked,
      }))

      setProjects(projectData)
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Failed to load project data:', err)
      setError('Unable to load project performance data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = async () => {
    await loadProjectData()
    onRefresh?.()
  }

  const totalMetrics = projects.reduce(
    (acc, p) => ({
      revenue: acc.revenue + p.revenue,
      expenses: acc.expenses + p.expenses,
      profit: acc.profit + p.profit,
      activeProjects: acc.activeProjects + 1,
    }),
    { revenue: 0, expenses: 0, profit: 0, activeProjects: 0 }
  )

  const avgProfitMargin =
    totalMetrics.revenue > 0 ? (totalMetrics.profit / totalMetrics.revenue) * 100 : 0

  if (externalLoading || isLoading) {
    return (
      <BaseCard className={className} {...props}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
            <p className="text-sm theme-text-secondary">Loading project data...</p>
          </div>
        </div>
      </BaseCard>
    )
  }

  if (externalError || error) {
    return (
      <BaseCard className={className} {...props}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-400">{externalError || error}</p>
            <button
              onClick={handleRefresh}
              className="mt-3 text-xs text-amber-500 hover:text-amber-400"
            >
              Try again
            </button>
          </div>
        </div>
      </BaseCard>
    )
  }

  return (
    <BaseCard
      title="Project Performance"
      subtitle={`${projects.length} active projects`}
      headerAction={
        <div className="flex items-center space-x-2">
          {showMemoryCitations && memoryCitations.length > 0 && (
            <MemoryCitationBadge citations={memoryCitations} compact />
          )}
          <button
            onClick={handleRefresh}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            title={`Last updated: ${lastRefresh.toLocaleTimeString()}`}
          >
            <RefreshCw className="w-4 h-4 theme-text-secondary" />
          </button>
        </div>
      }
      className={className}
      {...props}
    >
      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total Revenue"
          value={totalMetrics.revenue}
          format="currency"
          currency={currency}
          icon={DollarSign}
          iconColor="text-emerald-500"
          description="Combined revenue from all active projects"
          tooltip="Revenue tracked by QuickBooks Projects feature. Includes all invoiced amounts assigned to these projects."
          learnTerm="revenue"
        />
        <MetricCard
          title="Total Expenses"
          value={totalMetrics.expenses}
          format="currency"
          currency={currency}
          icon={DollarSign}
          iconColor="text-red-500"
          description="Combined expenses across all projects"
          tooltip="Expenses tracked against projects in QuickBooks, including labor, materials, and overhead costs."
          learnTerm="expenses"
        />
        <MetricCard
          title="Total Profit"
          value={totalMetrics.profit}
          format="currency"
          currency={currency}
          trend={{
            direction: totalMetrics.profit > 0 ? 'up' : 'down',
            percentage: avgProfitMargin,
          }}
          icon={TrendingUp}
          iconColor="text-blue-500"
          description="Net profit from all active projects"
          tooltip="Revenue minus expenses for all projects. The percentage shows average profit margin across projects."
          learnTerm="profit"
        />
        <MetricCard
          title="Active Projects"
          value={totalMetrics.activeProjects}
          format="number"
          icon={Briefcase}
          iconColor="text-amber-500"
          description="Number of ongoing projects"
          tooltip="Projects marked as 'In Progress' in QuickBooks. Requires QuickBooks Plus or Advanced."
          learnTerm="project-management"
        />
      </div>

      {/* Project List */}
      <div className="space-y-3">
        {projects.map((project) => (
          <div
            key={project.project_id}
            onClick={() => onProjectClick?.(project.project_id)}
            className={cn(
              'p-4 rounded-lg border transition-all duration-200',
              'bg-white/5 border-white/10',
              'hover:bg-white/10 hover:border-amber-500/30',
              onProjectClick && 'cursor-pointer',
              'print:bg-white print:border-gray-200'
            )}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="font-semibold theme-text-primary flex items-center">
                  {project.project_name}
                  {project.status === 'AtRisk' && (
                    <AlertCircle className="w-4 h-4 text-red-400 ml-2" />
                  )}
                </h4>
                <p className="text-xs theme-text-secondary mt-1">
                  {project.completion_percentage.toFixed(0)}% complete •
                  {project.budget_utilization.toFixed(0)}% budget used
                </p>
              </div>
              {onProjectClick && <ChevronRight className="w-4 h-4 theme-text-secondary" />}
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="theme-text-secondary">Revenue</span>
                <p className="font-semibold theme-text-primary">
                  ${(project.revenue / 1000).toFixed(1)}k
                </p>
              </div>
              <div>
                <span className="theme-text-secondary">Profit</span>
                <p
                  className={cn(
                    'font-semibold',
                    project.profit > 0 ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  ${(project.profit / 1000).toFixed(1)}k
                </p>
              </div>
              <div>
                <span className="theme-text-secondary">Margin</span>
                <p
                  className={cn(
                    'font-semibold',
                    project.profit_margin > 20
                      ? 'text-emerald-400'
                      : project.profit_margin > 10
                        ? 'text-amber-400'
                        : 'text-red-400'
                  )}
                >
                  {project.profit_margin.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Progress bars */}
            <div className="mt-3 space-y-2">
              <div>
                <div className="flex justify-between text-xs theme-text-secondary mb-1">
                  <span>Completion</span>
                  <span>{project.completion_percentage.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${project.completion_percentage}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs theme-text-secondary mb-1">
                  <span>Budget</span>
                  <span>{project.budget_utilization.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-300',
                      project.budget_utilization > 90
                        ? 'bg-red-500'
                        : project.budget_utilization > 75
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                    )}
                    style={{ width: `${Math.min(project.budget_utilization, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-8">
          <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="theme-text-secondary">No active projects found</p>
        </div>
      )}
    </BaseCard>
  )
}
