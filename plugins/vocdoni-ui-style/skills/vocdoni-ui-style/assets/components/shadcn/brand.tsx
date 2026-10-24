/**
 * Editorial-mode building blocks from vocdoni.io (Tailwind v4 + shadcn).
 * Requires assets/tokens/editorial.tailwind.css (eyebrow classes, rounded-card,
 * py-section tokens, signal color) and shadcn's `cn` helper at '@/lib/utils'.
 *
 * Compose every section the same way:
 *
 *   <Section className='bg-muted'>
 *     <Container>
 *       <SectionHeader eyebrow='Comparison' title='Why organizations choose Vocdoni'
 *         lede='Most digital voting tools ask you to trust their results. Vocdoni gives you proof.' />
 *       <div className='mt-12 grid gap-4 md:grid-cols-3'>
 *         <Panel as='article' surface='raised' padding='lg'>...</Panel>
 *       </div>
 *     </Container>
 *   </Section>
 */
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

/* ---------- Layout ---------- */

export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)} {...props} />
}

/** 32 / 64 / 96px vertical rhythm. Alternate plain and `bg-muted` (or `bg-muted/50`) bands. */
export const Section = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <section ref={ref} className={cn('py-section sm:py-section-md lg:py-section-lg', className)} {...props} />
  )
)
Section.displayName = 'Section'

/* ---------- Eyebrow + section header ---------- */

interface EyebrowProps extends React.HTMLAttributes<HTMLSpanElement> {
  withHalo?: boolean
}

/** 8px signal-yellow dot + uppercase label. The only place the yellow appears. */
export function Eyebrow({ withHalo = false, className, children, ...props }: EyebrowProps) {
  return (
    <span className={cn('eyebrow', className)} {...props}>
      <span className={cn('eyebrow-dot', withHalo && 'eyebrow-dot-halo')} aria-hidden='true' />
      {children}
    </span>
  )
}

const HEADING_SIZE = {
  display: 'text-4xl sm:text-5xl lg:text-6xl', // page-opening sections
  section: 'text-3xl sm:text-4xl lg:text-[2.75rem]', // long pages with many sections
} as const

interface SectionHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  lede?: React.ReactNode
  headingLevel?: 'h1' | 'h2' | 'h3'
  align?: 'center' | 'left'
  size?: keyof typeof HEADING_SIZE
  titleClassName?: string
}

/** Eyebrow, serif display heading, muted lede capped at max-w-2xl. */
export function SectionHeader({
  eyebrow,
  title,
  lede,
  headingLevel = 'h2',
  align = 'center',
  size = 'display',
  titleClassName,
  className,
  ...props
}: SectionHeaderProps) {
  const centered = align === 'center'
  return (
    <div className={cn('flex flex-col gap-4', centered && 'items-center text-center', className)} {...props}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      {React.createElement(headingLevel, { className: cn(HEADING_SIZE[size], titleClassName) }, title)}
      {lede && <p className={cn('max-w-2xl text-lg text-muted-foreground', centered && 'mx-auto')}>{lede}</p>}
    </div>
  )
}

/* ---------- Panel: the single card vocabulary ---------- */

const panelVariants = cva('rounded-card', {
  variants: {
    /**
     * raised  - only on a tinted (bg-muted) section
     * outline - only on a plain section
     * inset   - only on a plain section, for secondary groupings
     * ledger  - many rows reading as one document; the 1px gap draws hairlines
     * A panel never carries a shadow it cannot cast.
     */
    surface: {
      raised: 'bg-background border shadow-sm',
      outline: 'border',
      inset: 'bg-muted/50 border',
      ledger: 'bg-border border grid gap-px overflow-hidden',
    },
    padding: { none: '', md: 'p-6', lg: 'p-6 sm:p-8' },
    interactive: {
      true: 'hover:border-primary/40 focus-within:border-primary/40 transition-colors',
      false: '',
    },
  },
  defaultVariants: { surface: 'raised', padding: 'md', interactive: false },
})

type PanelTag = 'div' | 'li' | 'article' | 'section'
export interface PanelProps extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof panelVariants> {
  as?: PanelTag
}

export function Panel({ as: Tag = 'div', surface, padding, interactive, className, ...props }: PanelProps) {
  return <Tag className={cn(panelVariants({ surface, padding, interactive }), className)} {...props} />
}

/** Green-tinted rounded square that holds a lucide icon at size-5. */
export function IconTile({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-primary/10 text-primary inline-flex size-11 items-center justify-center rounded-lg', className)}
      {...props}
    />
  )
}

/* ---------- Badge ---------- */

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground',
        success: 'border-success/30 bg-success/10 text-success',
        warning: 'border-warning/40 bg-warning/10 text-warning',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

/* ---------- Logo ---------- */

interface VocdoniLogoProps extends React.SVGProps<SVGSVGElement> {
  /** Mark only (navbar below xl, favicons, collapsed sidebars). */
  minimal?: boolean
}

/** Inherits color from `currentColor`: text-foreground on cream, white on dark panels. */
export function VocdoniLogo({ minimal = false, className, ...props }: VocdoniLogoProps) {
  return (
    <svg
      viewBox={minimal ? '0 0 251.37 215' : '0 0 1000 215'}
      fill='currentColor'
      xmlns='http://www.w3.org/2000/svg'
      className={cn('h-7 w-auto text-foreground', className)}
      {...props}
    >
      <g transform='translate(-460,-433.082)'>
        <path d='m 648.53,548.952 -62.85,36.29 -62.84,-36.28 -62.84,-36.29 v 62.85 l 62.84,36.28 62.84,36.28 62.84,-36.28 62.85,-36.28 v -62.85 z' />
        <path d='m 614.16,433.082 -62.84,36.28 v 62.85 l 62.84,-36.29 z' />
        {!minimal && (
          <>
            <path d='m 875.09,512.702 -50.43,97.7 -50.45,-97.7 h 29.28 l 21.17,41.08 21.17,-41.08 z' />
            <path d='m 878.57,559.802 c 0,-14 4.8,-25.76 14.22,-35.18 9.62,-9.42 21.54,-14.22 35.57,-14.22 14.03,0 26,4.8 35.37,14.22 9.613,9.42 14.42,21.147 14.42,35.18 0,14 -4.81,25.76 -14.23,35.18 -9.42,9.42 -21.33,14 -35.56,14 -14.23,0 -26.15,-4.62 -35.57,-14 -9.42,-9.38 -14.22,-21.14 -14.22,-35.18 z m 27.87,0 c 0,6.92 2.12,12.69 6.16,17.11 2.037,2.127 4.483,3.82 7.192,4.977 2.708,1.156 5.623,1.752 8.568,1.752 2.945,0 5.86,-0.596 8.568,-1.752 2.709,-1.157 5.155,-2.85 7.192,-4.977 4,-4.42 6.15,-10.19 6.15,-17.11 0,-6.92 -2.11,-12.68 -6.15,-17.11 -2.039,-2.125 -4.485,-3.815 -7.194,-4.97 -2.708,-1.155 -5.622,-1.75 -8.566,-1.75 -2.944,0 -5.858,0.595 -8.567,1.75 -2.708,1.155 -5.155,2.845 -7.193,4.97 -4.04,4.43 -6.16,10.19 -6.16,17.11 z' />
            <path d='m 1084.23,589.022 c -10.19,13.27 -23.83,20 -41.33,20 -14.22,0 -26.14,-4.62 -35.56,-14 -9.42,-9.38 -14.23,-21.14 -14.23,-35.18 0,-14.04 4.81,-25.76 14.23,-35.18 9.61,-9.42 21.53,-14.22 35.56,-14.22 15,0 28.07,6.34 39.41,18.84 l -18.48,17.84 c -6,-7.31 -12.69,-11 -20,-11 -13.07,0 -22.87,9.8 -22.87,23.64 0,13.84 9.8,23.65 22.87,23.65 8.27,0 15.57,-4 21.92,-12.3 z' />
            <path d='m 1107.94,524.242 c 9,-9.23 20.38,-13.84 33.64,-13.84 9.81,0 17.88,2.69 24.22,8.26 v -46.52 h 27.3 v 134.76 h -26.91 v -6.73 c -6.15,6 -14.42,8.85 -24.61,8.85 -13.26,0 -24.61,-4.42 -33.64,-13.46 -9.03,-9.04 -13.46,-21 -13.46,-35.76 0,-14.61 4.42,-26.52 13.46,-35.56 z m 58.25,35.56 c 0,-7.11 -2.12,-13.07 -6.35,-17.68 -1.91,-2.245 -4.3,-4.032 -7,-5.229 -2.69,-1.198 -5.62,-1.776 -8.57,-1.691 -2.97,-0.065 -5.92,0.521 -8.65,1.717 -2.72,1.195 -5.15,2.971 -7.11,5.203 -4,4.61 -6.15,10.57 -6.15,17.68 0,7.11 2.11,13.08 6.15,17.69 1.97,2.231 4.39,4.006 7.12,5.201 2.72,1.195 5.67,1.782 8.64,1.719 2.95,0.083 5.88,-0.496 8.57,-1.693 2.69,-1.198 5.09,-2.984 7,-5.227 4.23,-4.61 6.35,-10.57 6.35,-17.69 z' />
            <path d='m 1210,559.802 c 0,-14 4.81,-25.76 14.23,-35.18 9.61,-9.42 21.53,-14.22 35.57,-14.22 14.04,0 26,4.8 35.37,14.22 9.61,9.42 14.42,21.147 14.42,35.18 0,14 -4.81,25.76 -14.23,35.18 -9.42,9.42 -21.34,14 -35.56,14 -14.22,0 -26.15,-4.62 -35.57,-14 -9.42,-9.38 -14.23,-21.14 -14.23,-35.18 z m 27.88,0 c 0,6.92 2.11,12.69 6.15,17.11 2.04,2.128 4.48,3.821 7.19,4.977 2.71,1.157 5.63,1.753 8.57,1.753 2.95,0 5.87,-0.596 8.58,-1.753 2.7,-1.156 5.15,-2.849 7.19,-4.977 4,-4.42 6.15,-10.19 6.15,-17.11 0,-6.92 -2.11,-12.68 -6.15,-17.11 -2.04,-2.125 -4.49,-3.816 -7.2,-4.971 -2.71,-1.154 -5.62,-1.75 -8.57,-1.75 -2.94,0 -5.85,0.596 -8.56,1.75 -2.71,1.155 -5.16,2.846 -7.2,4.971 -4.04,4.43 -6.15,10.19 -6.15,17.11 z' />
            <path d='m 1324.83,512.702 h 46.09 c 11.07,0.003 21.68,4.402 29.51,12.229 7.82,7.828 12.22,18.443 12.22,29.511 v 52.46 h -27.52 v -52.32 c -0.07,-4.423 -1.87,-8.643 -5.02,-11.756 -3.14,-3.113 -7.38,-4.873 -11.8,-4.904 h -16.21 v 69 h -27.27 z' />
            <path d='m 1432.51,606.902 v -94.2 H 1460 v 94.2 z' />
            <path d='m 1460,472.152 h -27.44 v 27.44 H 1460 Z' />
          </>
        )}
      </g>
    </svg>
  )
}
