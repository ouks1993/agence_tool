"use client"

import * as React from "react"
import {
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
} from "date-fns"
import { ArrowRight, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { DateRange } from "react-day-picker"

const ISO_DATE = "yyyy-MM-dd"

interface DateRangePickerProps {
  startDate: string // YYYY-MM-DD or ""
  endDate: string // YYYY-MM-DD or ""
  onSelect: (start: string, end: string) => void
  startLabel?: string // default "Check-in"
  endLabel?: string | undefined // default "Check-out"; undefined → single-date mode
  disabled?: boolean
  className?: string
}

/** Parse a YYYY-MM-DD string into a local Date, or undefined when empty. */
function parse(value: string): Date | undefined {
  if (!value) return undefined
  const parsed = parseISO(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function DateRangePicker({
  startDate,
  endDate,
  onSelect,
  startLabel = "Check-in",
  endLabel,
  disabled = false,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Single-date mode (e.g. one-way flights): caller omits endLabel entirely.
  // Note: we must NOT default endLabel, otherwise an explicit `undefined`
  // (passed for one-way) would be replaced by the default and break detection.
  const single = endLabel === undefined
  const endLabelText = endLabel ?? "Check-out"

  const start = parse(startDate)
  const end = parse(endDate)
  const today = startOfDay(new Date())

  // Number of nights between selected dates, shown as a badge when both set.
  const nights = React.useMemo(() => {
    if (!start || !end) return 0
    return Math.max(0, differenceInCalendarDays(end, start))
  }, [start, end])

  const handleRangeSelect = (range: DateRange | undefined) => {
    const nextStart = range?.from ? format(range.from, ISO_DATE) : ""
    const nextEnd = range?.to ? format(range.to, ISO_DATE) : ""
    onSelect(nextStart, nextEnd)
  }

  const handleSingleSelect = (day: Date | undefined) => {
    onSelect(day ? format(day, ISO_DATE) : "", "")
  }

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect("", "")
  }

  const hasValue = Boolean(start) || (!single && Boolean(end))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "border-input bg-background ring-offset-background flex h-9 w-full items-center gap-2 rounded-md border px-3 text-sm shadow-xs transition-colors",
            "focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
            "disabled:pointer-events-none disabled:opacity-50",
            "dark:bg-input/30",
            className
          )}
        >
          <CalendarDays className="text-muted-foreground size-4 shrink-0" />
          {hasValue ? (
            <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
              <span className="truncate">
                {start ? format(start, "MMM d") : startLabel}
              </span>
              {!single && (
                <>
                  <ArrowRight className="text-muted-foreground size-3 shrink-0" />
                  <span className="truncate">
                    {end ? format(end, "MMM d") : endLabelText}
                  </span>
                  {nights > 0 && (
                    <span className="bg-primary text-primary-foreground ml-1 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold">
                      {nights} {nights === 1 ? "night" : "nights"}
                    </span>
                  )}
                </>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground flex-1 text-left">
              Add date
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {single ? (
          <Calendar
            mode="single"
            selected={start}
            onSelect={handleSingleSelect}
            defaultMonth={start ?? today}
            disabled={{ before: today }}
            numberOfMonths={1}
            autoFocus
          />
        ) : (
          <Calendar
            mode="range"
            selected={{ from: start, to: end }}
            onSelect={handleRangeSelect}
            defaultMonth={start ?? today}
            disabled={{ before: today }}
            numberOfMonths={2}
            autoFocus
          />
        )}
        <div className="flex items-center justify-between border-t px-4 py-3">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0"
            onClick={clear}
            disabled={!hasValue}
          >
            Clear
          </Button>
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            Confirm
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
