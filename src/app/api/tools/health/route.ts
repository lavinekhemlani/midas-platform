/**
 * Tool Health Status Endpoint
 * Provides visibility into circuit breaker states and tool reliability metrics
 */

import { getActiveCircuits, getCircuitMetrics } from '@/ai/circuit-breaker'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const metrics = getCircuitMetrics()
    const activeCircuits = getActiveCircuits()

    const openCircuits = activeCircuits.filter((c) => c.isOpen)
    const closedCircuits = activeCircuits.filter((c) => !c.isOpen)

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      summary: {
        totalCircuits: activeCircuits.length,
        openCircuits: openCircuits.length,
        closedCircuits: closedCircuits.length,
        totalFailures: metrics.totalFailures,
        totalSuccesses: metrics.totalSuccesses,
        circuitOpens: metrics.circuitOpens,
        circuitCloses: metrics.circuitCloses,
      },
      byTool: metrics.byTool,
      activeCircuits: activeCircuits.map((c) => ({
        key: c.key,
        tool: c.tool,
        userId: c.userId ? `${c.userId.slice(0, 8)}...` : undefined, // Mask userId for privacy
        isOpen: c.isOpen,
        failures: c.failures,
        lastFailure: c.lastFailure,
        lastFailureAgo: c.lastFailure
          ? `${Math.round((Date.now() - c.lastFailure) / 1000)}s ago`
          : undefined,
        retryAfterMs: c.retryAfterMs,
        retryAfter: c.retryAfterMs ? `${Math.ceil(c.retryAfterMs / 1000)}s` : undefined,
      })),
      openCircuitDetails: openCircuits.map((c) => ({
        tool: c.tool,
        userId: c.userId ? `${c.userId.slice(0, 8)}...` : undefined,
        failures: c.failures,
        retryAfter: c.retryAfterMs ? `${Math.ceil(c.retryAfterMs / 1000)}s` : undefined,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
