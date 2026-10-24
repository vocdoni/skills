/**
 * Product-mode election status badge for Tailwind + shadcn, matching
 * vocdoni-app's subtle Chakra tags (palette.100 background, palette.700 text,
 * 6px radius, 12px light text). Requires assets/tokens/product.tailwind.css.
 *
 *   <StatusBadge status='ongoing' />                       // "Ongoing", green
 *   <StatusBadge status='results' />                       // "Results available", teal
 *   <ResultsTag state='secret' />                          // "Hidden until the end", purple
 *
 * Pass translated labels through `label` in a real app; the defaults are the
 * English source strings.
 */
import * as React from 'react'

import { cn } from '@/lib/utils'

export type ElectionStatus = 'upcoming' | 'ongoing' | 'paused' | 'ended' | 'results' | 'canceled'
type Tone = 'green' | 'yellow' | 'gray' | 'teal' | 'red' | 'purple' | 'blue' | 'orange'

const TONE_CLASS: Record<Tone, string> = {
  green: 'bg-status-green text-status-green-foreground',
  yellow: 'bg-status-yellow text-status-yellow-foreground',
  gray: 'bg-status-gray text-status-gray-foreground',
  teal: 'bg-status-teal text-status-teal-foreground',
  red: 'bg-status-red text-status-red-foreground',
  purple: 'bg-status-purple text-status-purple-foreground',
  blue: 'bg-status-blue text-status-blue-foreground',
  orange: 'bg-status-orange text-status-orange-foreground',
}

/**
 * Process status, one mapping for every surface (lists, voting page,
 * dashboard, cards). This is the skill's normalization: vocdoni-app is not
 * fully consistent (its archive view paints upcoming gray, its admin results
 * tab paints "Results available" green).
 */
export const STATUS: Record<ElectionStatus, { tone: Tone; label: string }> = {
  upcoming: { tone: 'yellow', label: 'Upcoming' },
  ongoing: { tone: 'green', label: 'Ongoing' },
  paused: { tone: 'orange', label: 'Paused' },
  ended: { tone: 'gray', label: 'Ended' },
  results: { tone: 'teal', label: 'Results available' },
  canceled: { tone: 'red', label: 'Canceled' },
}

interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: Tone
}

export function Tag({ tone, className, ...props }: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-sm px-1 py-0.5 text-xs font-light leading-[18px]',
        TONE_CLASS[tone],
        className
      )}
      {...props}
    />
  )
}

interface StatusBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  status: ElectionStatus
  label?: string
}

export function StatusBadge({ status, label, ...props }: StatusBadgeProps) {
  const s = STATUS[status]
  return (
    <Tag tone={s.tone} {...props}>
      {label ?? s.label}
    </Tag>
  )
}

export type ResultsState = 'live' | 'secret' | 'awaiting' | 'available'

/**
 * Results disclosure: a second tag beside the status, or the badge on a results
 * tab. Omit it when the status badge already says "Results available".
 */
export const RESULTS: Record<ResultsState, { tone: Tone; label: string }> = {
  live: { tone: 'blue', label: 'Live results' },
  secret: { tone: 'purple', label: 'Hidden until the end' },
  awaiting: { tone: 'orange', label: 'Awaiting results' },
  available: { tone: 'teal', label: 'Results available' },
}

export function ResultsTag({ state, label }: { state: ResultsState; label?: string }) {
  const r = RESULTS[state]
  return <Tag tone={r.tone}>{label ?? r.label}</Tag>
}
