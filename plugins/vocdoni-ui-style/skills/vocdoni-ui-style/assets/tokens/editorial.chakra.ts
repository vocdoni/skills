/**
 * Vocdoni editorial mode for Chakra UI v3. vocdoni.io itself is Tailwind +
 * shadcn; this ports the same tokens and component looks to a Chakra system so
 * a Chakra codebase can build marketing/landing/docs surfaces in the brand.
 *
 *   import { ChakraProvider } from '@chakra-ui/react'
 *   import { editorialSystem } from './editorial.chakra'
 *   <ChakraProvider value={editorialSystem}>...</ChakraProvider>
 *
 *   <Button variant='dark' size='lg'>Start for free</Button>        // the one top-level CTA
 *   <Button>Set up a test vote</Button>                              // green, in-page
 *   <Text textStyle='eyebrow'><Box as='span' layerStyle='eyebrowDot' />About Vocdoni</Text>
 *   <Heading as='h2' textStyle='display'>Trust is not a promise</Heading>
 *
 * Fonts: import '@fontsource-variable/hanken-grotesk/wght.css',
 *        '@fontsource-variable/fraunces/full.css' (full = SOFT/WONK axes),
 *        '@fontsource-variable/jetbrains-mono/wght.css'.
 * Light-only like vocdoni.io; the dark values are provided for completeness.
 */
import { createSystem, defaultConfig, defineConfig, defineRecipe, defineSlotRecipe } from '@chakra-ui/react'
import { cardAnatomy } from '@chakra-ui/react/anatomy'

const INK = 'oklch(0.24 0.013 106)'
const inkA = (a: number) => `oklch(0.24 0.013 106 / ${a})`

const button = defineRecipe({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2.5',
    fontFamily: 'body',
    fontWeight: 'medium',
    borderRadius: 'md',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    transitionProperty: 'color, background-color, border-color, box-shadow, scale',
    transitionDuration: '150ms',
    _active: { scale: '0.96' },
    _focusVisible: { outline: '2px solid', outlineColor: 'ring', outlineOffset: '2px' },
    _disabled: { opacity: 0.5, pointerEvents: 'none' },
    '& svg': { boxSize: '20px', flexShrink: 0 }, // size-4 on vocdoni.io's 5px base
  },
  variants: {
    variant: {
      // In-page CTAs and form submits
      solid: {
        bg: 'primary',
        color: 'primary.fg',
        boxShadow: 'button',
        _hover: { bg: 'primary/90' },
      },
      // The ONE top-level CTA per surface (navbar sign-in, hero primary)
      dark: {
        bg: 'surfaceDark',
        color: 'surfaceDark.fg',
        fontWeight: 'semibold',
        boxShadow: 'insetTop',
        _hover: { bg: 'surfaceDark/90' },
      },
      outline: {
        bg: 'bg',
        borderWidth: '1px',
        borderColor: 'border',
        color: 'fg',
        _hover: { bg: 'accent' },
      },
      secondary: { bg: 'bg.secondary', color: 'fg', _hover: { bg: 'bg.secondary/80' } },
      ghost: { bg: 'transparent', color: 'fg', _hover: { bg: 'accent' } },
      link: {
        bg: 'transparent',
        color: 'primary',
        h: 'auto',
        px: 0,
        _hover: { textDecoration: 'underline', textUnderlineOffset: '4px' },
        _active: { scale: '1' },
      },
    },
    size: {
      sm: { h: '9', px: '3.5', fontSize: 'sm' },
      md: { h: '45px', px: '26px', fontSize: 'sm' }, // navbar CTA as rendered
      lg: { h: '54px', px: '30px', fontSize: 'md' }, // hero / in-page CTA
      icon: { h: '50px', w: '50px', p: 0, borderRadius: 'full' }, // h-10 on the 5px base
    },
    pill: { true: { borderRadius: 'full' } },
  },
  defaultVariants: { variant: 'solid', size: 'md' },
})

// Chakra's default Heading recipe sets fontWeight 'semibold' on a class, which
// beats the element-level h1-h6 rule below; restate the display voice here.
const heading = defineRecipe({
  base: {
    fontFamily: 'heading',
    fontWeight: '400',
    fontVariationSettings: "'SOFT' 100, 'WONK' 0",
    letterSpacing: '-0.03em',
    lineHeight: '1.02',
    textWrap: 'balance',
  },
})

const badge = defineRecipe({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '1',
    borderRadius: 'full',
    borderWidth: '1px',
    borderColor: 'transparent',
    px: '2.5',
    py: '0.5',
    fontSize: 'xs',
    fontWeight: 'semibold',
  },
  variants: {
    variant: {
      solid: { bg: 'primary', color: 'primary.fg' },
      secondary: { bg: 'bg.secondary', color: 'fg' },
      outline: { borderColor: 'border', color: 'fg' },
      success: { bg: 'success/10', borderColor: 'success/30', color: 'success' },
      warning: { bg: 'warning/10', borderColor: 'warning/40', color: 'warning' },
    },
  },
  defaultVariants: { variant: 'secondary' },
})

const card = defineSlotRecipe({
  slots: cardAnatomy.keys(),
  base: {
    root: { bg: 'bg', borderWidth: '1px', borderColor: 'border', borderRadius: 'card', boxShadow: 'sm' },
    header: { p: '6', display: 'flex', flexDirection: 'column', gap: '1.5' },
    body: { p: '6', pt: 0 },
    footer: { p: '6', pt: 0, display: 'flex', alignItems: 'center' },
    title: { fontFamily: 'body', fontSize: 'lg', fontWeight: 'semibold', lineHeight: 'snug', letterSpacing: 'normal' },
    description: { fontSize: 'sm', color: 'fg.muted' },
  },
  variants: {
    // vocdoni.io panel vocabulary: raised only on tinted sections,
    // outline/inset only on plain ones.
    surface: {
      raised: {},
      outline: { root: { boxShadow: 'none' } },
      inset: { root: { bg: 'bg.muted/50', boxShadow: 'none' } },
    },
    interactive: {
      true: {
        root: {
          transitionProperty: 'transform, box-shadow',
          transitionDuration: '300ms',
          _hover: { transform: 'translateY(-4px)', boxShadow: 'xl' },
        },
      },
    },
  },
  defaultVariants: { surface: 'raised' },
})

const config = defineConfig({
  globalCss: {
    html: { scrollPaddingTop: '5.5rem', colorPalette: 'green' },
    body: {
      bg: 'bg',
      color: 'fg',
      fontFamily: 'body',
      overflowX: 'clip',
      textRendering: 'optimizeLegibility',
      textWrap: 'pretty',
    },
    'h1, h2, h3, h4, h5, h6': {
      fontFamily: 'heading',
      fontWeight: '400',
      fontVariationSettings: "'SOFT' 100, 'WONK' 0",
      letterSpacing: '-0.03em',
      lineHeight: '1.02',
      textWrap: 'balance',
    },
    '*::selection': { bg: 'primary/20' },
    '*, *::before, *::after': {
      _motionReduce: {
        animationDuration: '0.01ms !important',
        animationIterationCount: '1 !important',
        transitionDuration: '0.01ms !important',
        scrollBehavior: 'auto !important',
      },
    },
  },
  theme: {
    tokens: {
      fonts: {
        body: { value: "'Hanken Grotesk Variable', 'Hanken Grotesk', 'Noto Sans Devanagari Variable', system-ui, sans-serif" },
        heading: { value: "'Fraunces Variable', 'Fraunces', 'Noto Sans Devanagari Variable', Georgia, serif" },
        mono: { value: "'JetBrains Mono Variable', 'JetBrains Mono', monospace" },
      },
      radii: {
        sm: { value: '10px' },
        md: { value: '12px' },
        lg: { value: '16px' },
        xl: { value: '20px' },
        card: { value: '20px' },
      },
      shadows: {
        sm: { value: '0px 1px 2px 0px rgb(0 0 0 / 0.08)' },
        lg: { value: '0px 4px 14px 0px rgb(0 0 0 / 0.16)' },
        xl: { value: '0px 8px 24px -4px rgb(0 0 0 / 0.16), 0px 2px 6px -2px rgb(0 0 0 / 0.08)' },
        panel: { value: `0px 12px 32px -8px ${inkA(0.16)}, 0px 2px 6px -2px ${inkA(0.08)}` },
        insetTop: { value: 'inset 0 1px 1px rgb(255 255 255 / 0.14)' },
        button: { value: `0px 2px 3px -1px ${inkA(0.12)}, 0px 1px 0px 0px ${inkA(0.03)}, 0px 0px 0px 1px ${inkA(0.1)}` },
      },
      spacing: {
        section: { value: '2rem' },
        sectionMd: { value: '4rem' },
        sectionLg: { value: '6rem' },
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          DEFAULT: { value: { _light: 'oklch(0.988 0.011 97)', _dark: 'oklch(0.22 0.012 106)' } },
          secondary: { value: { _light: 'oklch(0.962 0.022 97)', _dark: 'oklch(0.27 0.014 106)' } },
          muted: { value: { _light: 'oklch(0.936 0.033 97)', _dark: 'oklch(0.29 0.016 106)' } },
          panel: { value: { _light: 'oklch(0.988 0.011 97)', _dark: 'oklch(0.25 0.013 106)' } },
        },
        fg: {
          DEFAULT: { value: { _light: INK, _dark: 'oklch(0.95 0.012 97)' } },
          muted: { value: { _light: inkA(0.64), _dark: 'oklch(0.95 0.012 97 / 0.66)' } },
          faint: { value: { _light: inkA(0.68), _dark: 'oklch(0.95 0.012 97 / 0.5)' } },
        },
        border: { DEFAULT: { value: { _light: inkA(0.1), _dark: 'oklch(1 0 0 / 0.1)' } } },
        accent: { value: { _light: inkA(0.07), _dark: 'oklch(1 0 0 / 0.07)' } },
        primary: {
          DEFAULT: { value: { _light: 'oklch(0.47 0.085 158)', _dark: 'oklch(0.62 0.09 158)' } },
          fg: { value: { _light: 'oklch(0.985 0.012 97)', _dark: 'oklch(0.2 0.012 106)' } },
        },
        ring: { value: { _light: 'oklch(0.47 0.085 158)', _dark: 'oklch(0.62 0.09 158)' } },
        surfaceDark: {
          DEFAULT: { value: 'oklch(0.235 0.012 107)' },
          fg: { value: 'oklch(0.985 0.012 97)' },
        },
        // Butter yellow: eyebrow and status dots ONLY, never a surface.
        signal: { DEFAULT: { value: 'oklch(0.93 0.11 102)' }, halo: { value: 'oklch(0.93 0.11 102 / 0.18)' } },
        success: { value: { _light: 'oklch(0.45 0.12 152)', _dark: 'oklch(0.65 0.12 152)' } },
        warning: { value: { _light: 'oklch(0.48 0.17 45)', _dark: 'oklch(0.78 0.15 50)' } },
        destructive: { value: 'oklch(0.577 0.215 27.3)' }, // #dc2626: AA with white
      },
    },
    textStyles: {
      // Large sizes are display text in this mode: tight serif leading and
      // tracking (Chakra's defaults would reset them on <Heading size>).
      ...Object.fromEntries(
        (['2xl', '3xl', '4xl', '5xl', '6xl', '7xl'] as const).map((k) => [
          k,
          { value: { fontSize: k, lineHeight: '1.02', letterSpacing: '-0.03em' } },
        ])
      ),
      eyebrow: {
        value: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2.5',
          fontFamily: 'body',
          fontSize: 'sm',
          fontWeight: 'medium',
          textTransform: 'uppercase',
          letterSpacing: '0.11em',
          color: 'fg.muted',
        },
      },
      display: { value: { fontSize: { base: '4xl', sm: '5xl', lg: '6xl' } } },
      section: { value: { fontSize: { base: '3xl', sm: '4xl', lg: '2.75rem' } } },
      lede: { value: { fontSize: 'lg', lineHeight: 'relaxed', color: 'fg.muted', maxW: '2xl' } },
      label: {
        value: { fontSize: '11px', fontWeight: 'semibold', textTransform: 'uppercase', letterSpacing: 'wider', color: 'fg.faint' },
      },
    },
    layerStyles: {
      eyebrowDot: { value: { display: 'inline-block', boxSize: '10px', flexShrink: 0, borderRadius: 'full', bg: 'signal' } },
      imageOutline: { value: { boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.1)' } },
    },
    recipes: { button, badge, heading },
    slotRecipes: { card },
  },
})

export const editorialSystem = createSystem(defaultConfig, config)
