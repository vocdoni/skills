# Recipes: from blank file to a passing check

Two worked compositions, one per mode, in the stacks the real products use. Both files typecheck against `@chakra-ui/react` v3 / shadcn and pass `scripts/check-style.mjs` with zero findings. Use them as the shape of a first draft; the HTML examples show more patterns, and the table at the end translates their classes into each stack.

## Contents

- [Product: an admin page in Chakra UI v3](#product-an-admin-page-in-chakra-ui-v3)
- [Editorial: a vertical page in Tailwind v4 + shadcn](#editorial-a-vertical-page-in-tailwind-v4--shadcn)
- [Translating the HTML examples into a stack](#translating-the-html-examples-into-a-stack)
- [What a first draft usually gets wrong](#what-a-first-draft-usually-gets-wrong)

## Product: an admin page in Chakra UI v3

Steps:

1. Copy `assets/tokens/product.chakra.ts` to `src/theme/system.ts` and `assets/components/chakra/product.tsx` to `src/components/vocdoni/product.tsx`.
2. Wire the provider (`references/stacks.md`, Chakra UI v3): Inter 300-600, `next-themes` with `attribute='class'`, `createVocdoniProductSystem()` (no argument = Vocdoni's monochrome look; pass the organization's hex for white-label).
3. Compose the page from the kit: `PageHeader` (24px title, muted subtitle, one primary action top right), `Tabs.Root` (defaults to the gray pill rail), a bordered `DashboardBox` with the table, `DataListCard`s below 768px, `StatusBadge` for status, a kebab `Menu` for row actions, `ConfirmDialog` for anything irreversible.
4. Copy through i18n in a real app (`t('process.list.title', 'Voting processes')`); kept literal here for brevity.
5. Check: `node scripts/check-style.mjs --mode product src/` and render at 1440px and 390px next to `assets/reference/product-*.webp`.

```tsx
import { Box, Button, Link, Menu, Portal, Stack, Table, Tabs, Text, useBreakpointValue } from '@chakra-ui/react'
import { useState } from 'react'
import { LuEllipsisVertical, LuPlus } from 'react-icons/lu'
import {
  ConfirmDialog,
  DashboardBox,
  DataListCard,
  type ElectionStatus,
  PageHeader,
  StatusBadge,
} from '@/components/vocdoni/product' // assets/components/chakra/product.tsx

type Process = { id: string; title: string; ends: string; status: ElectionStatus; votes: number }

const PROCESSES: Process[] = [
  { id: '1', title: 'General assembly 2026', ends: '30 Oct 2026', status: 'ongoing', votes: 711 },
  { id: '2', title: 'Board renewal', ends: '9 Nov 2026', status: 'upcoming', votes: 0 },
  { id: '3', title: '2026 budget approval', ends: '8 Sept 2026', status: 'results', votes: 602 },
]

export function ProcessesPage() {
  const isMobile = useBreakpointValue({ base: true, md: false })
  const [ending, setEnding] = useState<Process | null>(null)

  const actions = (p: Process) => (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button variant='ghost' size='xs' aria-label={`Actions for ${p.title}`}>
          <LuEllipsisVertical />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item value='open'>Public voting page</Menu.Item>
            <Menu.Item value='end' color='fg.error' onClick={() => setEnding(p)}>
              End vote
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )

  return (
    <Box p={6}>
      <PageHeader
        title='Voting processes'
        subtitle='Every vote of your organization, past and present.'
        actions={
          <Button size='sm'>
            <LuPlus /> New vote
          </Button>
        }
      />
      {/* Tabs default to the "settings" pill rail in product.chakra.ts: no variant prop needed */}
      <Tabs.Root defaultValue='all' mb={4}>
        <Tabs.List>
          <Tabs.Trigger value='all'>All</Tabs.Trigger>
          <Tabs.Trigger value='ended'>Ended</Tabs.Trigger>
          <Tabs.Trigger value='drafts'>Drafts</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>

      {isMobile ? (
        <Stack gap={3}>
          {PROCESSES.map((p) => (
            <DataListCard key={p.id} title={<Link href={`/admin/process/${p.id}`}>{p.title}</Link>} menu={actions(p)}>
              <Box>
                <StatusBadge status={p.status} />
              </Box>
              <Text>Ends: {p.ends}</Text>
              <Text>Votes: {p.votes}</Text>
            </DataListCard>
          ))}
        </Stack>
      ) : (
        <DashboardBox p={0} overflow='hidden'>
          <Table.Root>
            <Table.Header>
              <Table.Row bg='bg.subtle'>
                <Table.ColumnHeader>Title</Table.ColumnHeader>
                <Table.ColumnHeader>End date</Table.ColumnHeader>
                <Table.ColumnHeader>Status</Table.ColumnHeader>
                <Table.ColumnHeader textAlign='end'>Votes</Table.ColumnHeader>
                <Table.ColumnHeader w='1'>
                  <Box srOnly>Actions</Box>
                </Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {PROCESSES.map((p) => (
                <Table.Row key={p.id}>
                  <Table.Cell>
                    <Link href={`/admin/process/${p.id}`}>{p.title}</Link>
                  </Table.Cell>
                  <Table.Cell>{p.ends}</Table.Cell>
                  <Table.Cell>
                    <StatusBadge status={p.status} />
                  </Table.Cell>
                  <Table.Cell textAlign='end' fontVariantNumeric='tabular-nums'>
                    {p.votes}
                  </Table.Cell>
                  <Table.Cell>{actions(p)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </DashboardBox>
      )}

      <ConfirmDialog
        open={!!ending}
        onOpenChange={(open) => !open && setEnding(null)}
        title='End vote'
        description={`Ending "${ending?.title}" is irreversible. Voters will no longer be able to vote.`}
        confirmLabel='End vote'
        onConfirm={() => setEnding(null)}
      />
    </Box>
  )
}
```

Why it looks right: weight 400 everywhere except Chakra's own semibold on menu/dialog titles, 6px controls, 8px boxes, zinc hairlines, black primary button, status as subtle badges with text, the destructive action named and explained in a red confirm, cards instead of a squeezed table on phones.

## Editorial: a vertical page in Tailwind v4 + shadcn

Steps:

1. Make `assets/tokens/editorial.tailwind.css` the global stylesheet (mind its 5px spacing base) and load Hanken Grotesk, Fraunces `full.css` and JetBrains Mono.
2. Copy `assets/components/shadcn/button.tsx` over `components/ui/button.tsx` and `brand.tsx` to `components/brand.tsx`.
3. Compose with `Section` (32/64/96px rhythm) + `Container`, open every band with `SectionHeader` (eyebrow, serif title, muted lede), alternate plain and `bg-muted/50` bands, use `Panel surface='raised'` only on tinted bands.
4. One green in-page CTA plus a quiet text link; the dark CTA stays in the navbar.
5. Check: `node scripts/check-style.mjs --mode editorial app/ components/` and compare with `assets/reference/editorial-*.webp`.

```tsx
import { ArrowRight, EyeOff, ScanSearch, ShieldCheck, Users } from 'lucide-react'
import { Container, Eyebrow, IconTile, Panel, Section, SectionHeader } from '@/components/brand' // assets/components/shadcn/brand.tsx
import { Button } from '@/components/ui/button' // assets/components/shadcn/button.tsx

const GUARANTEES = [
  { icon: EyeOff, title: 'A secret ballot', text: 'Identity and ballot are separated by the system itself, not by policy.' },
  { icon: ScanSearch, title: 'A result anyone can check', text: 'Members and auditors verify the count without seeing any vote.' },
  { icon: ShieldCheck, title: 'Evidence for your minutes', text: 'Every vote closes with an audit trail and a certified results document.' },
]

export function VerticalPage() {
  return (
    <main>
      {/* Hero: eyebrow with sector icon, serif headline, green CTA + quiet link, reassurance line */}
      <Section>
        <Container className='grid items-center gap-12 lg:grid-cols-2'>
          <div className='flex flex-col items-start gap-6'>
            <Eyebrow>
              <Users className='size-4' aria-hidden='true' />
              For cooperatives
            </Eyebrow>
            <h1 className='text-4xl sm:text-5xl lg:text-6xl'>General assemblies your members can verify</h1>
            <p className='max-w-xl text-lg leading-relaxed text-muted-foreground'>
              One member, one vote or weighted by shares, run remotely or hybrid, closed with a record that shows how the
              result was reached.
            </p>
            <div className='flex flex-wrap items-center gap-x-4 gap-y-3'>
              <Button size='lg' className='group'>
                Set up a test vote
                <ArrowRight className='transition-transform duration-200 group-hover:translate-x-0.5' aria-hidden='true' />
              </Button>
              <Button variant='link' className='text-muted-foreground hover:text-foreground'>
                Talk to an election expert
              </Button>
            </div>
            <p className='text-sm text-muted-foreground'>Free account, no credit card.</p>
          </div>
          <Panel surface='inset' padding='lg' aria-hidden='true' className='min-h-80' />
        </Container>
      </Section>

      {/* Tinted band with raised panels: raised only on a tinted section */}
      <Section className='bg-muted/50'>
        <Container className='max-w-5xl'>
          <SectionHeader
            size='section'
            eyebrow='What you can prove'
            title='Guarantees that hold without trusting us'
            lede='Each one is a property of the system, checkable by anyone.'
          />
          <ul className='mt-12 grid gap-4 sm:mt-16 md:grid-cols-3'>
            {GUARANTEES.map(({ icon: Icon, title, text }) => (
              <Panel as='li' key={title} surface='raised' padding='lg' className='flex flex-col gap-3'>
                <IconTile>
                  <Icon className='size-5' aria-hidden='true' />
                </IconTile>
                <h3 className='font-sans text-lg leading-snug font-semibold tracking-normal'>{title}</h3>
                <p className='text-sm leading-relaxed text-muted-foreground'>{text}</p>
              </Panel>
            ))}
          </ul>
        </Container>
      </Section>
    </main>
  )
}
```

Why it looks right: serif headings at weight 400 with the SOFT axis come from the base layer (no classes needed), the only yellow is the eyebrow dot, cards are sans 18px semibold titles over muted 14px text, panels follow the raised-on-tinted rule, and the hero's reassurance line sits under the CTA.

## Translating the HTML examples into a stack

| Example class | Tailwind + shadcn (editorial) | Chakra v3 (product) |
| --- | --- | --- |
| `vd-section` / `--muted` | `<Section className='bg-muted'>` | - |
| `vd-section-header` + `eyebrow` | `<SectionHeader eyebrow title lede />` | - |
| `vd-btn--dark` / `--primary` / `--outline` | `<Button variant='dark'>` / `<Button>` / `<Button variant='outline'>` | - |
| `vd-panel--raised` | `<Panel surface='raised' padding='lg'>` | - |
| `vd-icon-tile` | `<IconTile>` | - |
| `vp-btn` / `--outline` / `--subtle` / `--ghost` / `--danger` | - | `<Button>` / `variant='outline'` / `variant='subtle'` / `variant='ghost'` / `colorPalette='red'` |
| `vp-badge--green` (etc.) | `<Tag tone='green'>` (`status-badge.tsx`) | `<Badge colorPalette='green' variant='subtle'>` or `<StatusBadge>` |
| `vp-box` / `vp-section` | `rounded-md border p-4` / `rounded-md bg-muted p-4` | `<DashboardBox>` / `<DashboardSection>` |
| `vp-tabs` + `vp-tab` | shadcn `Tabs` with `bg-muted p-1 rounded-sm`, active `bg-background shadow-xs` | `<Tabs.Root>` (default variant) |
| `vp-tabs-line` | shadcn `Tabs` underline style | `<Tabs.Root variant='line' fitted>` |
| `vp-choice` | `label` card: `flex gap-3 rounded-md border p-3 has-[:checked]:border-foreground` | `RadioGroup`/`CheckboxGroup` items in a bordered `Box`, or `@vocdoni/react-components` |
| `vp-dialog` + footer | shadcn `AlertDialog` | `<ConfirmDialog>` |
| `vp-nav-item` | `rounded-sm px-2 h-8 text-sm hover:bg-muted aria-[current=page]:bg-brand-muted` | `<NavItem>` |
| `vp-security` | three equal pills, only the active one colored | `<SecurityLevel level>` |

## What a first draft usually gets wrong

Run the checker; these are the findings it raises most on a first pass, and the fix:

| Finding | Fix |
| --- | --- |
| `sentence-case` on buttons and dialog titles ("Add Member") | "Add member"; only the first word and proper nouns capitalized |
| `no-em-dash` in copy | " - ", a colon, or two sentences |
| `editorial-no-gray` / `editorial-no-white` | `text-muted-foreground`, `border-border`, `bg-background` |
| `editorial-serif-weight` | Drop `font-bold` from `h1`/`h2`; the base layer sets 400 |
| `fraunces-full` | `@fontsource-variable/fraunces/full.css` |
| `product-light-weights` | `fontWeight='normal'` on headings and buttons (renders 400) |
| `product-no-editorial` | No serif, eyebrow or dark CTA inside the app |
| `no-transition-all` | `transition-[color,background-color,box-shadow]` or Chakra `transitionProperty` |

And the things no checker sees: more than one primary action per view, a disabled button without the reason next to it, a destructive action without a confirm, a vote cast without the summary step, status shown by color alone.
