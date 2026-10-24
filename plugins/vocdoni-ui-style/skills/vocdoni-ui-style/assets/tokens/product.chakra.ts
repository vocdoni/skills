/**
 * Vocdoni product mode for Chakra UI v3 - a self-contained port of the
 * vocdoni-app theme (src/theme/{colors,tokens,semantic,palette,system}.ts and
 * the recipes that define its look).
 *
 *   import { ChakraProvider } from '@chakra-ui/react'
 *   import { createVocdoniProductSystem } from './product.chakra'
 *   const system = createVocdoniProductSystem()            // monochrome (Vocdoni default)
 *   const system = createVocdoniProductSystem('#1a73e8')   // white-label accent
 *   <ChakraProvider value={system}>...</ChakraProvider>
 *
 * Fonts: import '@fontsource/inter/300.css', '400.css', '500.css', '600.css'.
 * Color mode: next-themes with attribute='class' (see references/stacks.md).
 * Custom variant names (button 'listmenu', card 'data-list-item', tabs
 * 'settings') only typecheck after `npx @chakra-ui/cli typegen ./product.chakra.ts`.
 * assets/components/chakra/product.tsx wraps them (NavItem, DataListCard) so
 * pages compile without typegen; tabs default to 'settings'.
 */
import { createSystem, defaultConfig, defineRecipe, defineSemanticTokens, defineSlotRecipe, defineTokens } from '@chakra-ui/react'
import { cardAnatomy, tabsAnatomy } from '@chakra-ui/react/anatomy'

/* ------------------------------------------------------------------ */
/* Palette generation from one brand color (OKLab tints/shades)        */
/* ------------------------------------------------------------------ */

type Step = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950
export type PaletteScale = Record<Step, string>
type Rgb = [number, number, number]
type Lab = [number, number, number]

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

export const normalizeHex = (value?: string): string | undefined => {
  const m = typeof value === 'string' ? HEX.exec(value.trim()) : null
  if (!m) return undefined
  const h = m[1].toLowerCase()
  return `#${h.length === 3 ? [...h].map((c) => c + c).join('') : h}`
}

const hexToRgb = (hex: string): Rgb => {
  const v = normalizeHex(hex)
  if (!v) throw new Error(`Invalid hex color: ${hex}`)
  return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16) / 255) as Rgb
}
const rgbToHex = (rgb: Rgb) =>
  `#${rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('')}`
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const fromLinear = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)

const rgbToLab = (rgb: Rgb): Lab => {
  const [r, g, b] = rgb.map(toLinear)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}
const labToRgb = ([L, a, b]: Lab): Rgb => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(fromLinear) as Rgb
}
// Mix t of white (1) or black (0) into the color; chroma fades with it.
const mix = ([L, a, b]: Lab, target: 0 | 1, t: number): Lab => [L * (1 - t) + target * t, a * (1 - t), b * (1 - t)]

const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const contrastRatio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const TINTS: Array<[Step, number]> = [[50, 0.95], [100, 0.9], [200, 0.8], [300, 0.6], [400, 0.3]]
const SHADES: Array<[Step, number]> = [[600, 0.15], [700, 0.3], [800, 0.45], [900, 0.6], [950, 0.75]]

/** 50..950 scale; 500 is the configured color verbatim. */
export const generatePaletteScale = (baseHex: string): PaletteScale => {
  const base = normalizeHex(baseHex)
  if (!base) throw new Error(`Invalid hex color: ${baseHex}`)
  const lab = rgbToLab(hexToRgb(base))
  const scale = { 500: base } as PaletteScale
  for (const [step, t] of TINTS) scale[step] = rgbToHex(labToRgb(mix(lab, 1, t)))
  for (const [step, t] of SHADES) scale[step] = rgbToHex(labToRgb(mix(lab, 0, t)))
  return scale
}

/** White unless it fails 4.5:1; then black (which then always passes). */
export const contrastColor = (hex: string): '#ffffff' | '#000000' =>
  contrastRatio(hex, '#ffffff') >= 4.5 ? '#ffffff' : '#000000'

const PAGE_BG = { light: '#ffffff', dark: '#0a0a0a' }
const LIGHT_SOLID: Step[] = [500, 600, 700, 800, 900, 950]
const DARK_SOLID: Step[] = [500, 400, 300, 200, 100, 50]
// A filled surface must reach 3:1 (WCAG non-text) against the page; accent
// text must reach 4.5:1 (WCAG AA text).
const readableStep = (scale: PaletteScale, steps: Step[], bg: string, min = 3) =>
  steps.find((s) => contrastRatio(scale[s], bg) >= min) ?? steps[steps.length - 1]
const LIGHT_FG: Step[] = [700, 800, 900, 950]
const DARK_FG: Step[] = [300, 200, 100, 50]

const brandSemanticTokens = (scale: PaletteScale) => {
  const light = readableStep(scale, LIGHT_SOLID, PAGE_BG.light)
  const dark = readableStep(scale, DARK_SOLID, PAGE_BG.dark)
  // vocdoni-app fixes fg at 700/300, which fails AA for pale brands (a white or
  // yellow brand gives ~2.7:1); walking the scale keeps the same result for
  // ordinary colors and fixes the extremes.
  const lightFg = readableStep(scale, LIGHT_FG, PAGE_BG.light, 4.5)
  const darkFg = readableStep(scale, DARK_FG, PAGE_BG.dark, 4.5)
  const ref = (s: Step) => `{colors.brand.${s}}`
  const slot = (l: string, d: string) => ({ value: { _light: l, _dark: d } })
  return {
    solid: slot(ref(light), ref(dark)),
    contrast: slot(contrastColor(scale[light]), contrastColor(scale[dark])),
    fg: slot(ref(lightFg), ref(darkFg)),
    muted: slot(ref(200), ref(800)),
    subtle: slot(ref(100), ref(900)),
    emphasized: slot(ref(300), ref(700)),
    focusRing: slot(ref(light), ref(dark)),
    // Easy to miss: outline recipes read colorPalette.border and silently
    // fall back to a near-white hairline when it is absent.
    border: slot(ref(light), ref(dark)),
  }
}

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const colors = {
  // Near-black neutrals for dark-mode surfaces; never tinted by the brand.
  ink: {
    500: { value: '#000000' },
    550: { value: '#262626' },
    600: { value: '#353535' },
    650: { value: '#0a0a0a' },
    700: { value: '#2e2e2e' },
    800: { value: '#3f3f3f' },
  },
  // Partial override of Chakra's zinc gray; other steps merge through.
  gray: {
    50: { value: '#fcfcfc' },
    100: { value: '#f5f5f5' },
    400: { value: '#b2b2b2' },
    500: { value: '#737373' },
  },
  dashboardMenu: { light: { value: '#fbfbfb' }, dark: { value: '#18181b' } },
  separator: { value: 'rgba(135, 140, 189, 0.3)' },
}

const tokens = {
  colors,
  fonts: {
    body: { value: `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif` },
    heading: { value: `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif` },
    mono: { value: `'Menlo', monospace` },
  },
  // Shifted one step light on purpose: "bold" renders 400.
  fontWeights: {
    normal: { value: '300' },
    medium: { value: '300' },
    bold: { value: '400' },
    bolder: { value: '500' },
  },
  radii: {
    none: { value: '0rem' },
    xxs: { value: '2px' },
    xs: { value: '4px' },
    sm: { value: '6px' },
    md: { value: '8px' },
    lg: { value: '10px' },
    xl: { value: '12px' },
    '2xl': { value: '16px' },
    '3xl': { value: '20px' },
    '4xl': { value: '24px' },
    full: { value: '9999px' },
  },
  sizes: {
    'dashboard-menu': { default: { value: '255px' }, reduced: { value: '48px' } },
    'max-content-width': { value: '1200px' },
    'max-window-width': { value: '2560px' },
    'user-profile': { value: '280px' },
    voting: {
      sidebar: { value: '320px' },
      contents: { min: { value: 'calc(640px + 320px)' }, max: { value: '1560px' } },
    },
  },
  zIndex: {
    background: { value: 0 },
    contents: { value: 1 },
    sidebar: { value: 2 },
    topbar: { value: 3 },
    modal: { value: 1400 },
    hovering: { value: 1500 },
    top: { value: 9999 },
  },
}

const semanticColors = {
  bg: {
    DEFAULT: { value: { _light: '{colors.white}', _dark: '{colors.ink.650}' } },
    muted: { value: { _light: '{colors.gray.100}', _dark: '{colors.ink.800}' } },
  },
  auth: {
    bg: { value: { _light: '{colors.gray.50}', _dark: '{colors.ink.550}' } },
    showcase: {
      fg: { DEFAULT: { value: '{colors.white}' }, muted: { value: '{colors.gray.400}' } },
      rule: { value: 'rgba(255, 255, 255, 0.16)' },
    },
  },
  dashboard: { menu: { value: { _light: '{colors.dashboardMenu.light}', _dark: '{colors.dashboardMenu.dark}' } } },
  input: { placeholder: { value: '{colors.gray.500}' } },
  tabs: {
    bg: { value: { _light: '{colors.gray.100}', _dark: '{colors.ink.700}' } },
    tab: {
      color: { value: { _light: '{colors.gray.500}', _dark: '{colors.gray.400}' } },
      active: {
        color: { value: { _light: '{colors.brand.fg}', _dark: '{colors.white}' } },
        bg: { value: { _light: '{colors.white}', _dark: '{colors.ink.500}' } },
      },
    },
  },
}

/* ------------------------------------------------------------------ */
/* Recipes (the subset that defines the look)                          */
/* ------------------------------------------------------------------ */

const button = defineRecipe({
  base: { minW: 0, fontWeight: 'bold', borderRadius: 'sm', fontSize: 'sm' },
  variants: {
    variant: {
      // Sidebar navigation item
      listmenu: {
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'center',
        fontWeight: 'normal',
        borderRadius: 'sm',
        _hover: { bg: 'bg.muted' },
        _currentPage: { bg: { _light: 'colorPalette.200', _dark: 'colorPalette.800' }, fontWeight: 'bold' },
      },
      link: { textAlign: 'left', w: 'auto', h: 'auto', p: 0, _hover: { textDecoration: 'underline' } },
    },
  },
})

const heading = defineRecipe({
  base: { fontWeight: 'bold' },
  variants: { variant: { header: { fontWeight: 'extrabold' } } },
})

const link = defineRecipe({
  base: {
    color: 'gray.800',
    textDecoration: 'underline',
    textDecorationThickness: 'from-font',
    textUnderlineOffset: '0.15em',
    _hover: { color: 'gray.500' },
    _dark: { color: 'gray.400', _hover: { color: 'gray.200' } },
  },
  variants: {
    variant: {
      plain: { _hover: { textDecorationColor: 'currentColor', textUnderlineOffset: '0.15em' } },
      unstyled: { textDecoration: 'none', _hover: { textDecoration: 'none' } },
      footer: { textDecoration: 'none', color: 'fg.muted', _hover: { textDecoration: 'underline' } },
    },
  },
})

const formLabel = defineRecipe({ base: { fontSize: 'sm', fontWeight: 'normal' } })

// iOS Safari zooms focused inputs under 16px: 16px on mobile, 14px from md.
const mobileSafe = { fontSize: { base: 'md', md: 'sm' }, _placeholder: { fontSize: { base: 'md', md: 'sm' } } }
const input = defineRecipe({
  base: { _placeholder: { color: 'input.placeholder' } },
  variants: {
    size: { sm: { borderRadius: 'sm', ...mobileSafe }, md: { borderRadius: 'sm', ...mobileSafe } },
    variant: {
      borderless: {
        border: 'none',
        px: 0,
        bg: 'transparent',
        // no border means no border-based focus: keep a visible ring
        _focusVisible: { outline: '2px solid', outlineColor: 'colorPalette.focusRing', outlineOffset: '4px', borderRadius: '2px' },
      },
    },
  },
})

const badge = defineRecipe({
  variants: {
    size: {
      xs: { fontSize: 'xs', lineHeight: 'xs', px: 1, py: 0.5 },
      sm: { fontSize: 'sm', lineHeight: 'sm', px: 2, py: 1 },
      md: { fontSize: 'md', lineHeight: 'md', px: 3, py: 2 },
    },
  },
  defaultVariants: { size: 'xs' },
})

// Settings tabs: a gray pill rail with a white raised active tab.
const tabs = defineSlotRecipe({
  slots: tabsAnatomy.keys(),
  variants: {
    variant: {
      settings: {
        root: { '--tabs-height': 'auto' },
        list: { p: 1, bgColor: 'tabs.bg', borderRadius: 'sm', w: 'fit-content', maxW: 'full', overflowX: 'auto' },
        trigger: {
          py: 1.5,
          px: 3,
          whiteSpace: 'nowrap',
          borderRadius: 'sm',
          fontWeight: 'medium', // = 300 in this system
          color: 'tabs.tab.color',
          fontSize: 'sm',
          _selected: { bgColor: 'tabs.tab.active.bg', color: 'tabs.tab.active.color', boxShadow: 'xs' },
        },
        content: { borderRadius: 'md', p: 6 },
      },
    },
  },
  // Default, as in vocdoni-app: <Tabs.Root> gets the pill rail with no variant
  // prop (so no typegen needed). Use variant='line' for fitted content tabs.
  defaultVariants: { variant: 'settings' },
})

// Mobile replacement for table rows.
const card = defineSlotRecipe({
  slots: cardAnatomy.keys(),
  variants: {
    variant: {
      'data-list-item': {
        root: { w: 'full', bg: 'transparent', border: '1px solid', borderColor: 'border', borderRadius: 'sm', p: 4, gap: 2 },
        header: { p: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 },
        body: { p: 0, gap: 1, fontSize: 'sm', color: 'fg.muted' },
      },
    },
  },
})

// Voter-authentication strength (weak / mid / strong).
export const securityLevelRecipe = defineRecipe({
  base: {
    border: '2px solid',
    borderColor: 'border',
    borderRadius: 'md',
    py: 2,
    px: 4,
    fontWeight: 'bold',
    textAlign: 'center',
    w: 'full',
    color: 'white',
    textTransform: 'uppercase',
  },
  variants: {
    variant: {
      weak: { bg: 'red.800', borderColor: 'red.600' },
      mid: { bg: 'orange.800', borderColor: 'orange.600' },
      strong: { bg: 'green.800', borderColor: 'green.600' },
      inactive: { bg: 'gray.900' },
    },
  },
})

/* ------------------------------------------------------------------ */
/* System                                                              */
/* ------------------------------------------------------------------ */

export const createVocdoniProductSystem = (primaryColor?: string) => {
  const brand = normalizeHex(primaryColor)
  const scale = generatePaletteScale(brand ?? '#000000')
  const brandTokens = Object.fromEntries(Object.entries(scale).map(([k, value]) => [k, { value }]))

  return createSystem(defaultConfig, {
    // Without a brand the stock gray palette drives every colorPalette-aware
    // component (gray.solid = #18181b); with one, `brand` takes over.
    globalCss: {
      html: { colorPalette: brand ? 'brand' : 'gray' },
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
      tokens: defineTokens({ ...tokens, colors: { ...colors, brand: brandTokens } }),
      semanticTokens: defineSemanticTokens({
        colors: { ...semanticColors, brand: brandSemanticTokens(scale) },
      }),
      recipes: { button, heading, link, formLabel, input, badge, securityLevel: securityLevelRecipe },
      slotRecipes: { tabs, card },
    },
  })
}

export const system = createVocdoniProductSystem()
