// src/components/ui/dateRangePicker.tsx
"use client"

import * as React from "react"
import { Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DatePickerWithRangeProps {
  value?: { from: Date; to: Date }
  onChange?: (value: { from: Date; to: Date } | undefined) => void
  className?: string
}

export function DatePickerWithRange({
  value,
  onChange,
  className,
}: DatePickerWithRangeProps) {
  // Simple date range picker - you can enhance this with a proper calendar library
  return (
    <Button
      variant="outline"
      className={cn(
        "justify-start text-left font-normal border-amber-500/30",
        !value && "text-muted-foreground",
        className
      )}
    >
      <Calendar className="mr-2 h-4 w-4" />
      {value?.from ? (
        <>
          {value.from.toLocaleDateString()} - {value.to?.toLocaleDateString() || "..."}
        </>
      ) : (
        <span>Pick a date range</span>
      )}
    </Button>
  )
}