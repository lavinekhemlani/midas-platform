// src/app/(main)/components/report/ReportCard.tsx
import * as React from "react"
import { cn } from "@/lib/utils"

// Report-specific Card component without rounded borders
function ReportCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="report-card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 border py-6 shadow-sm",
        className
      )}
      {...props}
    />
  )
}

function ReportCardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="report-card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

function ReportCardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="report-card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function ReportCardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="report-card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function ReportCardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="report-card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

export {
  ReportCard,
  ReportCardHeader,
  ReportCardTitle,
  ReportCardDescription,
  ReportCardContent,
}