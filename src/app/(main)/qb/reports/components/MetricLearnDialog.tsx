import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { LearnSheetContent } from '@/components/learn/core/LearnSheetContent'
import { BookOpen, type LucideIcon } from 'lucide-react'

interface MetricLearnDialogProps {
  termId: string
  icon: LucideIcon
  iconColor?: 'amber' | 'cyan' | 'green' | 'red' | 'blue' | 'purple' | 'orange' | 'emerald'
  label: string
  contextData?: Record<string, any>
  className?: string
}

export function MetricLearnDialog({
  termId,
  icon,
  iconColor = 'amber',
  label,
  contextData,
  className = '',
}: MetricLearnDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`w-4 h-4 p-0 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${className}`}
        >
          <BookOpen className="w-3 h-3 text-amber-500" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:w-[560px] sm:max-w-none p-0 learn-modal-dialog shadow-2xl">
        <DialogHeader className="p-0 h-0 overflow-hidden">
          <DialogTitle className="sr-only">Learn: {label}</DialogTitle>
        </DialogHeader>
        <LearnSheetContent
          termId={termId}
          icon={icon}
          iconColor={iconColor}
          onClose={() => {}}
          startCloseAnimation={() => {}}
          contextData={contextData}
        />
      </DialogContent>
    </Dialog>
  )
}
