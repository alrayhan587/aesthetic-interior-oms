'use client'

import { useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type LeadDatePreset = 'THIS_MONTH' | 'LAST_7_DAYS' | 'LAST_MONTH' | 'LAST_YEAR' | 'LIFETIME' | 'CUSTOM'

type LeadDateRangeFilterProps = {
  preset: LeadDatePreset
  createdFrom: string
  createdTo: string
  onPresetChange: (preset: LeadDatePreset) => void
  onCreatedFromChange: (value: string) => void
  onCreatedToChange: (value: string) => void
  onReset: () => void
}

const PRESET_OPTIONS: Array<{ value: LeadDatePreset; label: string }> = [
  { value: 'THIS_MONTH', label: 'This Month' },
  { value: 'LAST_7_DAYS', label: 'Last 7 Days' },
  { value: 'LAST_MONTH', label: 'Last Month' },
  { value: 'LAST_YEAR', label: 'Last Year' },
  { value: 'LIFETIME', label: 'Lifetime' },
]

function formatRangeLabel(from: string, to: string): string {
  if (!from && !to) return 'Custom'
  if (from && to) return `${from} - ${to}`
  if (from) return `From ${from}`
  return `Until ${to}`
}

export function LeadDateRangeFilter({
  preset,
  createdFrom,
  createdTo,
  onPresetChange,
  onCreatedFromChange,
  onCreatedToChange,
  onReset,
}: LeadDateRangeFilterProps) {
  const [open, setOpen] = useState(false)

  const triggerLabel = useMemo(() => {
    const presetLabel = PRESET_OPTIONS.find((item) => item.value === preset)?.label
    return presetLabel ?? formatRangeLabel(createdFrom, createdTo)
  }, [createdFrom, createdTo, preset])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 min-w-[180px] justify-start text-left font-normal">
          <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
          <span className="truncate">Created: {triggerLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px]">
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">LEAD CREATED DATE</p>

          <div className="flex flex-wrap gap-2">
            {PRESET_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={preset === option.value ? 'default' : 'outline'}
                className="h-7 px-2.5 text-xs"
                onClick={() => {
                  onPresetChange(option.value)
                  setOpen(false)
                }}
              >
                {option.label}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant={preset === 'CUSTOM' ? 'default' : 'outline'}
              className="h-7 px-2.5 text-xs"
              onClick={() => onPresetChange('CUSTOM')}
            >
              Custom
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={createdFrom}
              onChange={(event) => {
                onPresetChange('CUSTOM')
                onCreatedFromChange(event.target.value)
              }}
            />
            <Input
              type="date"
              value={createdTo}
              onChange={(event) => {
                onPresetChange('CUSTOM')
                onCreatedToChange(event.target.value)
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onReset}>
              Reset This Month
            </Button>
            <Button type="button" size="sm" className="h-8 text-xs" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
