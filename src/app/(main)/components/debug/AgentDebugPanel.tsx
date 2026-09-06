// src/app/(main)/components/debug/AgentDebugPanel.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Eye, EyeOff, Activity, BarChart3, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DebugInfo {
  toolCalls: Array<{
    tool: string;
    timestamp: Date;
    hasVisualizationHints?: boolean;
    hintsCount?: number;
  }>;
  visualizations: Array<{
    type: string;
    timestamp: Date;
    autoRendered?: boolean;
  }>;
  pendingHints: number;
}

export function AgentDebugPanel({ className }: { className?: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    toolCalls: [],
    visualizations: [],
    pendingHints: 0
  });

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  useEffect(() => {
    // Listen for debug events (you'd emit these from your agent processing)
    const handleDebugEvent = (event: CustomEvent) => {
      setDebugInfo(prev => ({
        ...prev,
        ...event.detail
      }));
    };

    window.addEventListener('agent-debug' as any, handleDebugEvent);
    return () => {
      window.removeEventListener('agent-debug' as any, handleDebugEvent);
    };
  }, []);

  if (!isVisible) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsVisible(true)}
        className={cn(
          "fixed bottom-4 left-4 z-50",
          "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20",
          className
        )}
      >
        <Activity className="w-4 h-4 mr-2" />
        Agent Debug
      </Button>
    );
  }

  return (
    <Card className={cn(
      "fixed bottom-4 left-4 z-50 w-96",
      "glass-luxury-card border-amber-500/30",
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Agent Debug Panel</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
            className="h-6 w-6 p-0"
          >
            <EyeOff className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Tool Calls */}
        <div>
          <h4 className="text-xs font-medium theme-text-secondary mb-2">Tool Calls</h4>
          <div className="space-y-1">
            {debugInfo.toolCalls.slice(-5).map((call, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="theme-text-primary">{call.tool}</span>
                {call.hasVisualizationHints && (
                  <Badge variant="outline" className="text-xs bg-blue-500/10">
                    {call.hintsCount} hints
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Visualizations */}
        <div>
          <h4 className="text-xs font-medium theme-text-secondary mb-2">Rendered Visualizations</h4>
          <div className="space-y-1">
            {debugInfo.visualizations.slice(-5).map((viz, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="theme-text-primary flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" />
                  {viz.type}
                </span>
                {viz.autoRendered ? (
                  <Badge variant="outline" className="text-xs bg-amber-500/10">
                    auto
                  </Badge>
                ) : (
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="pt-2 border-t border-amber-500/10">
          <div className="flex items-center justify-between text-xs">
            <span className="theme-text-secondary">Pending Hints</span>
            <span className={cn(
              "font-medium",
              debugInfo.pendingHints > 0 ? "text-amber-400" : "text-emerald-400"
            )}>
              {debugInfo.pendingHints}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}