#!/usr/bin/env node
// Vocdoni UI style checker. Zero dependencies, Node >= 18.
//
//   node check-style.mjs [--mode editorial|product|both] [--json] [--ignore <glob>]... <file|dir>...
//   node check-style.mjs --self-test
//
// Flags mechanical violations of the Vocdoni look (see references/*.md):
// em dashes and Title Case in UI copy, `transition-all`, Fraunces without the
// SOFT axis, and per-mode token misuse. It reads source text, not a rendered
// DOM, so warnings are prompts to look, not verdicts. Exit code 1 on any error.
//
// What is scanned:
//   code (.tsx .jsx .ts .js .mjs .vue .svelte .astro .html)  copy + class/token rules
//   styles (.css)                                             token rules
//   docs (.md .mdx .mdoc)                                     copy rules on prose only (code is skipped)
//   locale JSON (path contains locale/i18n/lang/messages/translation, or passed explicitly)
//                                                             copy rules on every decoded string value
// Comments are blanked before any rule runs, so a comment naming an
// anti-pattern never fails the check.
import { lstatSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(HERE, 'check-style-fixtures')

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const o = { mode: 'both', json: false, ignore: [], targets: [], selfTest: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--mode') o.mode = argv[++i]
    else if (a.startsWith('--mode=')) o.mode = a.slice(7)
    else if (a === '--json') o.json = true
    else if (a === '--ignore') o.ignore.push(argv[++i])
    else if (a.startsWith('--ignore=')) o.ignore.push(a.slice(9))
    else if (a === '--self-test') o.selfTest = true
    else if (a === '-h' || a === '--help') usage(0)
    else o.targets.push(a)
  }
  if (!['editorial', 'product', 'both'].includes(o.mode)) usage(2)
  if (!o.selfTest && o.targets.length === 0) usage(2)
  return o
}

function usage(code) {
  console.log('usage: check-style.mjs [--mode editorial|product|both] [--json] [--ignore <glob>]... <file|dir>...')
  console.log('       check-style.mjs --self-test')
  process.exit(code)
}

/* ------------------------------------------------------------------ */
/* Files                                                               */
/* ------------------------------------------------------------------ */

const CODE = new Set(['.tsx', '.jsx', '.ts', '.js', '.mjs', '.cjs', '.vue', '.svelte', '.astro', '.html'])
const DOCS = new Set(['.md', '.mdx', '.mdoc'])
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.vike', '.svelte-kit', 'coverage', '.turbo', 'check-style-fixtures'])
const LOCALE_PATH = /(^|[\\/])(locales?|i18n|lang|langs|messages|translations?)([\\/]|$)/i

// Globs match paths relative to the current working directory.
// `**/` = any number of leading directories, a trailing `**` = everything below.
const globToRegExp = (g) =>
  new RegExp(
    '^' +
      g
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*\//g, '\u0000')
        .replace(/\*\*/g, '\u0001')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]')
        .replace(/\u0000/g, '(?:.*/)?')
        .replace(/\u0001/g, '.*') +
      '$'
  )

function kindOf(path, explicit) {
  const ext = extname(path)
  if (CODE.has(ext)) return 'code'
  if (ext === '.css') return 'css'
  if (DOCS.has(ext)) return 'docs'
  if (ext === '.json' && (explicit || LOCALE_PATH.test(path))) return 'json'
  return null
}

function* walk(path, ignore, io, explicit = true) {
  const rel = relative(process.cwd(), resolve(path)).split('\\').join('/')
  if (ignore.some((re) => re.test(rel) || re.test(rel + '/'))) return
  let st
  try {
    st = lstatSync(path)
  } catch (e) {
    io.push({ file: path, line: 0, level: 'warn', rule: 'io', msg: `cannot read: ${e.code || e.message}` })
    return
  }
  if (st.isSymbolicLink()) return // links found while walking are never followed (no cycles); paths you pass are taken as given
  if (st.isDirectory()) {
    let entries = []
    try {
      entries = readdirSync(path)
    } catch (e) {
      io.push({ file: path, line: 0, level: 'warn', rule: 'io', msg: `cannot list: ${e.code || e.message}` })
      return
    }
    for (const e of entries) if (!SKIP_DIRS.has(e)) yield* walk(join(path, e), ignore, io, false)
    return
  }
  if (path.endsWith('.min.js') || path.endsWith('.d.ts')) return
  const kind = kindOf(path, explicit)
  if (kind) yield { path, kind }
}

/* ------------------------------------------------------------------ */
/* Comment / code stripping (preserves offsets and newlines)           */
/* ------------------------------------------------------------------ */

const blank = (s) => s.replace(/[^\n]/g, ' ')

// A `/` starts a regex literal (not division) after these tokens.
const REGEX_PREV = /(?:^|[(,=:[!&|?{};+\-*%~^]|\b(?:return|typeof|case|in|of|new|delete|void|throw|yield|await))\s*$/
const isRegexStart = (out) => REGEX_PREV.test(out.slice(-40))

// JS/TS/JSX: blank // and /* */ comments outside string, template and regex literals.
function stripJs(src) {
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    const d = src[i + 1]
    if (c === '/' && d === '/') {
      const j = src.indexOf('\n', i)
      const end = j === -1 ? n : j
      out += blank(src.slice(i, end))
      i = end
    } else if (c === '/' && d === '*') {
      const j = src.indexOf('*/', i + 2)
      const end = j === -1 ? n : j + 2
      out += blank(src.slice(i, end))
      i = end
    } else if (c === '/' && isRegexStart(out)) {
      // Regex literal: copy it verbatim so `/[/*]/` never opens a comment.
      let j = i + 1
      let inClass = false
      while (j < n && src[j] !== '\n') {
        if (src[j] === '\\') j++
        else if (src[j] === '[') inClass = true
        else if (src[j] === ']') inClass = false
        else if (src[j] === '/' && !inClass) break
        j++
      }
      if (src[j] === '/') {
        j++
        while (j < n && /[a-z]/i.test(src[j])) j++
        out += src.slice(i, j)
        i = j
      } else {
        out += c
        i++
      }
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1
      while (j < n && src[j] !== c) {
        if (src[j] === '\\') j++
        else if (c !== '`' && src[j] === '\n') break // unterminated: likely JSX text with an apostrophe
        j++
      }
      if (j < n && src[j] === c) {
        out += src.slice(i, j + 1)
        i = j + 1
      } else {
        out += c
        i++
      }
    } else {
      out += c
      i++
    }
  }
  return out
}
const stripBlock = (src, open, close) =>
  src.replace(new RegExp(`${open}[\\s\\S]*?${close}`, 'g'), (m) => blank(m))
const stripHtmlComments = (src) => stripBlock(src, '<!--', '-->')
const stripCssComments = (src) => stripBlock(src, '/\\*', '\\*/')
// <script>/<style> bodies inside HTML-like files get their own comment rules.
function stripMarkup(src) {
  let s = stripHtmlComments(src)
  s = s.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (_, a, body, b) => a + stripJs(body) + b)
  s = s.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, a, body, b) => a + stripCssComments(body) + b)
  return s
}
// Markdown: blank fenced blocks, inline code and HTML comments; keep prose.
function stripDocs(src) {
  let s = stripHtmlComments(src)
  s = s.replace(/(^|\n)(```|~~~)[^\n]*\n[\s\S]*?\n\2[^\n]*(?=\n|$)/g, (m) => blank(m))
  s = s.replace(/`[^`\n]*`/g, (m) => blank(m))
  return s
}

function lineAt(src, index) {
  let line = 1
  for (let i = 0; i < index && i < src.length; i++) if (src.charCodeAt(i) === 10) line++
  return line
}

/* ------------------------------------------------------------------ */
/* Copy rules                                                          */
/* ------------------------------------------------------------------ */

// Words that stay capitalized mid-phrase, so they do not make a string Title Case.
const PROPER = new Set(
  'Vocdoni DAVINCI Davinci Decidim SDK API APIs GDPR CSV CSP PDF ID IDs SMS URL OAuth Google GitHub WhatsApp EU UI UX ZK QR I OK AGM AGMs Stripe Chakra Tailwind React Next.js Vite Inter Fraunces Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July August September October November December Jan Feb Mar Apr Jun Jul Aug Sep Sept Oct Nov Dec Mon Tue Wed Thu Fri Sat Sun'.split(
    ' '
  )
)
const SMALL = new Set('a an and as at but by for in of on or the to vs via with from per your our is are be it if'.split(' '))
// A capitalized word right after one of these is the classic "Add Member" label.
const UI_VERBS = new Set(
  'Add Create Delete Confirm Edit Remove Save Import Export View Manage Select Upload Download Reset Resend Send Configure Set New Open Close Cancel Start Go Back Sign Log Invite Update Change Verify Request Schedule Book Contact Learn See Show Hide Enable Disable Upgrade Unlock Search Filter Publish End Pause Resume Clone Copy Share Submit Continue Next Previous Try Get Join Read Watch Leave Link Unlink Apply Choose Pick Enter Identify Vote'.split(
    ' '
  )
)

export function isTitleCase(s) {
  const words = s
    .replace(/\{\{?[^}]*\}?\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}]+|[^\p{L}.]+$/gu, ''))
    .filter(Boolean)
  if (words.length < 2 || words.length > 9) return false
  if (/[.!?:]\s|[.!?]$/.test(s.trim()) && words.length > 5) return false // a sentence, not a label
  let cap = 0
  let lower = 0
  let prev = words[0]
  for (const w of words.slice(1)) {
    const afterBrand = prev === 'Vocdoni' // product names: Vocdoni App, Vocdoni SDK
    prev = w
    if (afterBrand || PROPER.has(w) || /^[A-Z0-9]+$/.test(w) || /\.$/.test(w)) continue
    if (SMALL.has(w.toLowerCase())) continue
    if (/^\p{Lu}/u.test(w)) cap++
    else lower++
  }
  if (lower > 0) return false
  return cap >= 2 || (cap === 1 && UI_VERBS.has(words[0]))
}

const DASH = /[\u2014\u2013]/

function checkCopy(report, file, line, s) {
  if (DASH.test(s)) report(file, line, 'error', 'no-em-dash', `em/en dash in copy: "${s.slice(0, 60)}" (use " - ", a colon, or two sentences)`)
  if (isTitleCase(s)) report(file, line, 'warn', 'sentence-case', `Title Case copy: "${s.slice(0, 60)}" (sentence case: only the first word capitalized)`)
}

// UI copy candidates in code: t('key', 'Default') (any whitespace, newlines),
// label-like props, and JSX/HTML text nodes. Positions are offsets into `src`.
function copyInCode(src) {
  const out = []
  const push = (text, index) => {
    const t = text.replace(/\s+/g, ' ').trim()
    if (!t || /^[\w-]+(\.[\w-]+)+$/.test(t)) return // i18n key
    if (/[()|[\]=;]|=>|\$\{/.test(t)) return // code-looking fragment
    out.push([t, index])
  }
  for (const m of src.matchAll(/\bt\(\s*(['"`])[^'"`]+\1\s*,\s*(['"`])((?:(?!\2)[\s\S])+?)\2/g)) push(m[3], m.index)
  for (const m of src.matchAll(/\b(?:defaultValue|title|label|placeholder|aria-label|confirmLabel|cancelLabel|subtitle|description|alt)\s*[=:]\s*(['"])((?:\\.|(?!\1)[^\\]){1,400}?)\1/g))
    push(m[2].replace(/\\(['"])/g, '$1'), m.index)
  for (const m of src.matchAll(/>([^<>{}]*\p{L}[^<>{}]*)</gu)) push(m[1], m.index + 1)
  return out
}

/* ------------------------------------------------------------------ */
/* Token / class rules (code and CSS, line by line on stripped text)   */
/* ------------------------------------------------------------------ */

function tokenRules(report, file, n, line, kind, mode) {
  if (/\btransition-all\b|transition(?:-property)?\s*:\s*all\b/.test(line)) report(file, n, 'error', 'no-transition-all', 'transition: all: list the animated properties')

  const both = mode === 'both'
  if (mode === 'editorial' || both) {
    const tag = both ? '[editorial] ' : ''
    const level = both ? 'warn' : 'error'
    if (/\b(?:bg|text|border|ring|from|to|via|fill|stroke)-(?:gray|slate|neutral|stone)-\d{2,3}\b/.test(line))
      report(file, n, level, 'editorial-no-gray', `${tag}Tailwind gray ramp: use ink tiers (text-foreground, text-muted-foreground, text-faint, border-border)`)
    if (/\bbg-white\b/.test(line))
      report(file, n, 'warn', 'editorial-no-white', `${tag}bg-white: surfaces are cream (bg-background); white is only for tiles behind third-party logos`)
    if (
      /<h[1-3]\b[^>]*\bfont-(?:bold|black|extrabold)\b/.test(line) ||
      /\bfont-(?:bold|black|extrabold)\b[^"'`]*\btext-(?:[3-9]xl)\b|\btext-(?:[3-9]xl)\b[^"'`]*\bfont-(?:bold|black|extrabold)\b/.test(line)
    )
      report(file, n, 'error', 'editorial-serif-weight', `${tag}bold display heading: the Fraunces display voice is weight 400`)
    if (/\bbg-signal\b/.test(line) && !/\b(?:size-[1-3]|h-[1-3]\b|w-[1-3]\b|eyebrow-dot|rounded-full)/.test(line))
      report(file, n, 'warn', 'editorial-signal-dot-only', `${tag}bg-signal outside a small dot: the yellow is punctuation, never a surface`)
    if (mode === 'editorial' && kind === 'code' && /class(?:Name)?=[^>]*#[0-9a-fA-F]{3,8}\b/.test(line))
      report(file, n, 'warn', 'editorial-no-hex', 'hex literal in classes: use tokens')
    if (mode === 'editorial' && kind === 'css' && /:\s*#[0-9a-fA-F]{3,8}\b/.test(line) && !/--[\w-]+\s*:/.test(line))
      report(file, n, 'warn', 'editorial-no-hex', 'hex color outside a token definition')
  }
  if (mode === 'product') {
    if (/Fraunces|Hanken|\bfont-serif\b|\beyebrow\b|\bbg-signal\b|\bbg-surface-dark\b/.test(line))
      report(file, n, 'error', 'product-no-editorial', 'editorial element in product mode (serif, Hanken, eyebrow, signal, dark CTA)')
    if (/\bfont-(?:bold|extrabold|black)\b|font-weight\s*:\s*(?:bold|[7-9]00)\b/.test(line))
      report(file, n, 'warn', 'product-light-weights', 'heavy weight: product headings and buttons are 400; 600 only for question/choice labels and dialog titles')
    if (/<(?:Button|button|Input|input)\b[^>]*\brounded-(?:lg|xl|2xl|3xl)\b/.test(line))
      report(file, n, 'warn', 'product-control-radius', 'large radius on a control: buttons and inputs are 6px (rounded-sm)')
    if (/oklch\(0\.98\d* 0\.01|#fdfbf3/i.test(line)) report(file, n, 'warn', 'product-no-cream', 'cream surface in product mode: product surfaces are white / near-black')
  }
}

// Font loading is checked on the stripped text, imports included.
function fontRules(report, file, n, line) {
  if (/@fontsource-variable\/fraunces(?:\/(?:index|wght|wght-italic)\.css)?['"]/.test(line))
    report(file, n, 'error', 'fraunces-full', "Fraunces loaded without the SOFT axis: import '@fontsource-variable/fraunces/full.css'")
  if (/fonts\.googleapis\.com[^"'\s]*family=Fraunces(?![^"'&\s]*SOFT)/.test(line))
    report(file, n, 'error', 'fraunces-full', 'Google Fonts Fraunces URL without the SOFT axis (family=Fraunces:opsz,wght,SOFT,WONK@...)')
}

/* ------------------------------------------------------------------ */
/* Runner                                                              */
/* ------------------------------------------------------------------ */

function checkFile({ path, kind }, mode, report) {
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch (e) {
    report(path, 0, 'warn', 'io', `cannot read: ${e.code || e.message}`)
    return
  }

  if (kind === 'json') {
    let data
    try {
      data = JSON.parse(raw)
    } catch {
      report(path, 0, 'warn', 'io', 'invalid JSON, skipped')
      return
    }
    const visit = (v, key) => {
      if (typeof v === 'string') {
        const enc = JSON.stringify(v).slice(1, -1)
        let idx = raw.indexOf(enc)
        if (idx === -1 && key) idx = raw.indexOf(`"${key}"`)
        checkCopy(report, path, idx === -1 ? 0 : lineAt(raw, idx), v)
      } else if (Array.isArray(v)) v.forEach((x) => visit(x, key))
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) visit(x, k)
    }
    visit(data)
    return
  }

  if (kind === 'docs') {
    const text = stripDocs(raw)
    text.split('\n').forEach((l, i) => {
      if (!l.trim()) return
      if (DASH.test(l)) report(path, i + 1, 'error', 'no-em-dash', `em/en dash in prose: "${l.trim().slice(0, 60)}"`)
      const h = l.match(/^#{1,6}\s+(.+)$/)
      if (h && isTitleCase(h[1])) report(path, i + 1, 'warn', 'sentence-case', `Title Case heading: "${h[1].slice(0, 60)}"`)
    })
    return
  }

  const ext = extname(path)
  const text = kind === 'css' ? stripCssComments(raw) : ['.html', '.vue', '.svelte', '.astro'].includes(ext) ? stripMarkup(raw) : stripJs(raw)
  text.split('\n').forEach((l, i) => {
    fontRules(report, path, i + 1, l)
    tokenRules(report, path, i + 1, l, kind, mode)
  })
  if (kind === 'code') {
    // Copy: drop import lines and <style> bodies so they never read as text.
    const copySrc = text
      .replace(/^\s*import\s[^\n]*$/gm, (m) => blank(m))
      .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, a, body, b) => a + blank(body) + b)
    for (const [s, idx] of copyInCode(copySrc)) checkCopy(report, path, lineAt(copySrc, idx), s)
  }
}

export function run({ mode, ignore = [], targets }) {
  const findings = []
  const seen = new Set()
  const report = (file, line, level, rule, msg) => {
    const k = `${file}:${line}:${rule}:${msg}`
    if (!seen.has(k)) {
      seen.add(k)
      findings.push({ file, line, level, rule, msg })
    }
  }
  const io = []
  const ig = ignore.map(globToRegExp)
  for (const t of targets) for (const f of walk(t, ig, io)) checkFile(f, mode, report)
  return [...io, ...findings]
}

/* ------------------------------------------------------------------ */
/* Self-test against check-style-fixtures/                             */
/* ------------------------------------------------------------------ */

function selfTest() {
  // Each fixture declares its expectations on the first line:
  //   EXPECT mode=<mode> rules=<rule,rule,...|none>
  const files = readdirSync(FIXTURES).sort()
  let failed = 0
  for (const name of files) {
    const path = join(FIXTURES, name)
    const head = readFileSync(path, 'utf8').split('\n')[0]
    const m = head.match(/EXPECT mode=(\w+) rules=([\w,-]+)/)
    if (!m) continue
    const want = m[2] === 'none' ? [] : m[2].split(',').sort()
    const got = [...new Set(run({ mode: m[1], targets: [path] }).map((f) => f.rule))].sort()
    const ok = JSON.stringify(want) === JSON.stringify(got)
    if (!ok) failed++
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}  want [${want}]  got [${got}]`)
  }
  console.log(failed ? `\n${failed} fixture(s) failed` : '\nall fixtures pass')
  process.exit(failed ? 1 : 0)
}

/* ------------------------------------------------------------------ */

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.selfTest) selfTest()
  const findings = run(opts)
  if (opts.json) {
    console.log(JSON.stringify(findings, null, 2))
  } else {
    for (const f of findings) console.log(`${f.file}:${f.line}: ${f.level} ${f.rule}: ${f.msg}`)
    const errors = findings.filter((f) => f.level === 'error').length
    console.log(`\n${errors} error(s), ${findings.length - errors} warning(s) [mode: ${opts.mode}]`)
  }
  process.exit(findings.some((f) => f.level === 'error') ? 1 : 0)
}
