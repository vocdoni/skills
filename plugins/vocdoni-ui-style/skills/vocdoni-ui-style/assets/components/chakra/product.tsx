/**
 * Product-mode building blocks for Chakra UI v3, distilled from vocdoni-app.
 * Use with createVocdoniProductSystem() from assets/tokens/product.chakra.ts.
 *
 *   <PageHeader title='Voting processes' subtitle='All the votes of your organization'
 *     actions={<Button size='sm'><LuPlus /> New vote</Button>} />
 *   <DashboardBox>...</DashboardBox>
 *   <StatusBadge status='ongoing' />  <ResultsTag state='secret' />
 *   <NavItem icon={LuVote} href='/admin/processes' current>Voting processes</NavItem>
 *   <DataListCard title={<Link href='#'>General assembly</Link>} menu={<Kebab />}>...</DataListCard>
 *   <ResultBar label='Option A' votes={425} percent={59.8} />
 *   <SecurityLevel level='strong' />
 *   <ConfirmDialog open={open} onOpenChange={setOpen} title='End vote'
 *     description='Ending "General assembly 2026" is irreversible. Voters will no longer be able to vote.'
 *     confirmLabel='End vote' destructive onConfirm={endVote} />
 */
import {
  Badge,
  Box,
  type BoxProps,
  Button,
  Card,
  Dialog,
  Flex,
  Heading,
  Icon,
  Portal,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  useRecipe,
} from '@chakra-ui/react'
import type { ElementType, ReactNode } from 'react'

/* Everything here avoids custom variant names, so it typechecks without
   running Chakra typegen. */

/* ---------- Page header ---------- */

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <Flex align='flex-start' justify='space-between' gap={4} wrap='wrap' mb={6}>
      <Box>
        <Heading as='h1' size='2xl' display='flex' alignItems='center' gap={2}>
          {title}
        </Heading>
        {subtitle && (
          <Text fontSize='md' color='fg.muted' mt={1}>
            {subtitle}
          </Text>
        )}
      </Box>
      {actions && (
        <Flex gap={2} align='center'>
          {actions}
        </Flex>
      )}
    </Flex>
  )
}

/** Bordered container for a page section (radius md, p=4). */
export const DashboardBox = (props: BoxProps) => (
  <Box borderWidth='1px' borderColor='border' borderRadius='md' p={4} {...props} />
)

/** Subtle filled panel for grouped settings or summaries. */
export const DashboardSection = (props: BoxProps) => <Box bg='bg.muted' borderRadius='md' p={4} {...props} />

/* ---------- Status ---------- */

export type ElectionStatus = 'upcoming' | 'ongoing' | 'paused' | 'ended' | 'results' | 'canceled'

// The skill's normalized mapping (see references/brand-core.md, Status semantics).
const STATUS: Record<ElectionStatus, { palette: string; label: string }> = {
  upcoming: { palette: 'yellow', label: 'Upcoming' },
  ongoing: { palette: 'green', label: 'Ongoing' },
  paused: { palette: 'orange', label: 'Paused' },
  ended: { palette: 'gray', label: 'Ended' },
  results: { palette: 'teal', label: 'Results available' },
  canceled: { palette: 'red', label: 'Canceled' },
}

export function StatusBadge({ status, label }: { status: ElectionStatus; label?: string }) {
  const s = STATUS[status]
  return (
    <Badge colorPalette={s.palette} variant='subtle'>
      {label ?? s.label}
    </Badge>
  )
}

export type ResultsState = 'live' | 'secret' | 'awaiting' | 'available'

const RESULTS: Record<ResultsState, { palette: string; label: string }> = {
  live: { palette: 'blue', label: 'Live results' },
  secret: { palette: 'purple', label: 'Hidden until the end' },
  awaiting: { palette: 'orange', label: 'Awaiting results' },
  available: { palette: 'teal', label: 'Results available' },
}

/** Results disclosure, beside the status. Omit it when the status already says "Results available". */
export function ResultsTag({ state, label }: { state: ResultsState; label?: string }) {
  const r = RESULTS[state]
  return (
    <Badge colorPalette={r.palette} variant='subtle'>
      {label ?? r.label}
    </Badge>
  )
}

/* ---------- Navigation ---------- */

/** Sidebar item: 32px, 16px icon + 14px label, hover bg.muted, current = palette 200. */
export function NavItem({
  icon,
  href,
  current,
  children,
}: {
  icon: ElementType
  href: string
  current?: boolean
  children: ReactNode
}) {
  return (
    <Button
      asChild
      size='xs'
      w='full'
      justifyContent='flex-start'
      gap={2}
      variant='ghost'
      colorPalette='gray'
      fontWeight='normal'
      fontSize='sm'
      bg={current ? 'colorPalette.muted' : undefined}
      _hover={{ bg: current ? 'colorPalette.muted' : 'bg.muted' }}
    >
      <a href={href} aria-current={current ? 'page' : undefined}>
        <Icon as={icon} boxSize={4} />
        {children}
      </a>
    </Button>
  )
}

/* ---------- Tables on mobile ---------- */

/** One table row as a card below 768px: title + kebab, then badges and "Label: value" lines. */
export function DataListCard({ title, menu, children }: { title: ReactNode; menu?: ReactNode; children: ReactNode }) {
  return (
    <Card.Root w='full' bg='transparent' borderWidth='1px' borderColor='border' borderRadius='sm' p={4} gap={2}>
      <Flex align='flex-start' justify='space-between' gap={2}>
        <Box minW={0} lineClamp={2}>
          {title}
        </Box>
        {menu}
      </Flex>
      <Stack gap={1} fontSize='sm' color='fg.muted'>
        {children}
      </Stack>
    </Card.Root>
  )
}

/* ---------- Results ---------- */

/** One choice: label left, "votes · percent" right, thin bar under it. The label names the bar. */
export function ResultBar({ label, votes, percent }: { label: ReactNode; votes: number; percent: number }) {
  return (
    <Progress.Root value={percent} size='xs' colorPalette='teal'>
      <Flex justify='space-between' gap={2} fontSize='md' mb={1.5}>
        <Progress.Label minW={0} overflowWrap='anywhere' fontWeight='normal'>
          {label}
        </Progress.Label>
        <Text color='fg.muted' flexShrink={0} fontVariantNumeric='tabular-nums'>
          {votes} · {percent.toFixed(1)}%
        </Text>
      </Flex>
      <Progress.Track borderRadius='full'>
        <Progress.Range />
      </Progress.Track>
    </Progress.Root>
  )
}

/* ---------- Voter-authentication strength ---------- */

const LEVELS = ['weak', 'mid', 'strong'] as const
type Level = (typeof LEVELS)[number]

/** Three pills; only the current level is colored (recipe `securityLevel`). */
export function SecurityLevel({ level, labels }: { level: Level; labels?: Record<Level, string> }) {
  const recipe = useRecipe({ key: 'securityLevel' })
  const text = labels ?? { weak: 'Weak', mid: 'Mid', strong: 'Strong' }
  return (
    <SimpleGrid columns={3} gap={2}>
      {LEVELS.map((l) => (
        <Box key={l} css={recipe({ variant: l === level ? l : 'inactive' })} fontSize='sm' aria-current={l === level}>
          {text[l]}
        </Box>
      ))}
    </SimpleGrid>
  )
}

/* ---------- Confirmation ---------- */

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description: ReactNode
  confirmLabel: ReactNode
  cancelLabel?: ReactNode
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
}

/** Centered dialog. Cancel (ghost) left of the confirm; red confirm when destructive. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = true,
  loading,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)} placement='center' role='alertdialog'>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              {/* 600 is the skill's normalization: the app asks for extrabold but only loads Inter up to 500 */}
              <Dialog.Title fontWeight='semibold'>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Dialog.Description fontSize='sm' color='fg.muted'>
                {description}
              </Dialog.Description>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant='ghost'>{cancelLabel}</Button>
              </Dialog.ActionTrigger>
              <Button colorPalette={destructive ? 'red' : undefined} loading={loading} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
