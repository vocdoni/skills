#!/usr/bin/env node
/*
 * vocdoni-skills CLI
 *
 * Installs Anthropic-format skills from this marketplace into a target
 * directory, so they can be picked up by Claude Code or any other client
 * that loads skills from a filesystem path.
 *
 * Repository layout (multi-plugin marketplace):
 *
 *   plugins/<plugin-name>/.claude-plugin/plugin.json
 *   plugins/<plugin-name>/skills/<skill-name>/SKILL.md
 *
 * Default destination is ~/.claude/skills, which Claude Code reads at
 * user scope. Override with --dest for other clients (e.g. Cursor, Cline)
 * or for per-project installation. Use --plugin to scope an install to
 * one plugin (mirrors `claude plugin install <plugin>@vocdoni`).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO_ROOT = path.resolve(__dirname, '..');
const PLUGINS_DIR = path.join(REPO_ROOT, 'plugins');
const DEFAULT_DEST = path.join(os.homedir(), '.claude', 'skills');

function usage() {
  const exe = 'vocdoni-skills';
  process.stdout.write(
`Usage:
  ${exe} list                                       List bundled plugins and their skills.
  ${exe} install [skills...] [options]              Install skills (default: every skill in every plugin).
  ${exe} uninstall <skill...> [options]             Remove installed skills.
  ${exe} --help

Options:
  --plugin <name>     Scope to a single plugin (e.g. --plugin go for vocdoni-go).
                      The short form 'go' maps to 'vocdoni-go'.
  --dest <dir>        Target directory (default: ~/.claude/skills).
                      Use a project path like ./.claude/skills to install
                      at project scope.
  --symlink           Symlink each skill instead of copying. Useful while
                      authoring; updates in the repo are picked up live.
  --force             Overwrite existing skill directories at the target.
  --dry-run           Print what would happen, but make no changes.

Examples:
  ${exe} list
  ${exe} install                              # every skill in every plugin
  ${exe} install --plugin go                  # every skill in vocdoni-go
  ${exe} install go-modern                    # one skill, found in whichever plugin owns it
  ${exe} install --plugin go --dest ./.claude/skills --symlink
  ${exe} uninstall go-modern
`);
}

function parseArgs(argv) {
  const opts = {
    command: null,
    skills: [],
    plugin: null,
    dest: DEFAULT_DEST,
    symlink: false,
    force: false,
    dryRun: false,
    help: false,
  };

  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--plugin') { opts.plugin = argv[++i]; }
    else if (a === '--dest') { opts.dest = argv[++i]; }
    else if (a === '--symlink') opts.symlink = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (!opts.command) opts.command = a;
    else opts.skills.push(a);
    i++;
  }

  if (opts.dest) opts.dest = path.resolve(opts.dest);
  return opts;
}

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
}

function discoverPlugins() {
  // Returns: [{ name, dir, skills: [{ name, dir, description }] }, ...]
  if (!fs.existsSync(PLUGINS_DIR)) return [];
  const out = [];
  for (const entry of fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pluginDir = path.join(PLUGINS_DIR, entry.name);
    const manifest = readJSON(path.join(pluginDir, '.claude-plugin', 'plugin.json'));
    if (!manifest || !manifest.name) continue;

    const skillsDir = path.join(pluginDir, 'skills');
    const skills = [];
    if (fs.existsSync(skillsDir)) {
      for (const s of fs.readdirSync(skillsDir, { withFileTypes: true })) {
        if (!s.isDirectory()) continue;
        const skillPath = path.join(skillsDir, s.name);
        if (!fs.existsSync(path.join(skillPath, 'SKILL.md'))) continue;
        skills.push({
          name: s.name,
          dir: skillPath,
          description: readSkillDescription(skillPath),
        });
      }
    }
    skills.sort((a, b) => a.name.localeCompare(b.name));
    out.push({ name: manifest.name, dir: pluginDir, skills });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function readSkillDescription(skillDir) {
  try {
    const src = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
    const m = src.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!m) return '';
    for (const line of m[1].split('\n')) {
      const kv = line.match(/^description:\s*(.*)$/);
      if (kv) return kv[1].replace(/^['"]|['"]$/g, '');
    }
  } catch (_) { /* ignore */ }
  return '';
}

function resolvePluginName(short, plugins) {
  if (!short) return null;
  // Exact match wins.
  const exact = plugins.find((p) => p.name === short);
  if (exact) return exact;
  // Short form: 'go' -> 'vocdoni-go'
  const prefixed = plugins.find((p) => p.name === `vocdoni-${short}`);
  if (prefixed) return prefixed;
  return null;
}

function cmdList(plugins) {
  if (plugins.length === 0) {
    process.stdout.write('No plugins found under plugins/.\n');
    return 0;
  }
  process.stdout.write(`@vocdoni/skills — ${plugins.length} plugin(s):\n\n`);
  for (const p of plugins) {
    process.stdout.write(`▸ ${p.name}  (${p.skills.length} skill${p.skills.length === 1 ? '' : 's'})\n`);
    for (const s of p.skills) {
      const d = s.description || '';
      const truncated = d.length > 110 ? d.slice(0, 110) + '…' : d;
      process.stdout.write(`    ${s.name}\n`);
      if (truncated) process.stdout.write(`      ${truncated}\n`);
    }
    process.stdout.write('\n');
  }
  return 0;
}

function ensureDir(dir, dryRun) {
  if (fs.existsSync(dir)) return;
  if (dryRun) {
    process.stdout.write(`would mkdir -p ${dir}\n`);
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
}

function rimrafSync(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function copyDirSync(src, dest) {
  if (typeof fs.cpSync === 'function') {
    fs.cpSync(src, dest, { recursive: true });
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(from, to);
    else if (entry.isSymbolicLink()) fs.symlinkSync(fs.readlinkSync(from), to);
    else fs.copyFileSync(from, to);
  }
}

function cmdInstall(opts, plugins) {
  if (plugins.length === 0) {
    process.stderr.write('No plugins found to install from.\n');
    return 1;
  }

  // Build the pool of candidate skills, filtered by --plugin if given.
  let pool;
  if (opts.plugin) {
    const p = resolvePluginName(opts.plugin, plugins);
    if (!p) {
      process.stderr.write(`Unknown plugin: ${opts.plugin}\n`);
      process.stderr.write(`Available: ${plugins.map((x) => x.name).join(', ')}\n`);
      return 1;
    }
    pool = p.skills.map((s) => ({ ...s, plugin: p.name }));
  } else {
    pool = [];
    for (const p of plugins) for (const s of p.skills) pool.push({ ...s, plugin: p.name });
  }

  // Pick the skills to install.
  let chosen;
  if (opts.skills.length > 0) {
    chosen = [];
    for (const name of opts.skills) {
      const matches = pool.filter((s) => s.name === name);
      if (matches.length === 0) {
        process.stderr.write(`Unknown skill: ${name}\n`);
        if (opts.plugin) {
          process.stderr.write(`Plugin '${opts.plugin}' has: ${pool.map((s) => s.name).join(', ') || '(none)'}\n`);
        } else {
          process.stderr.write(`Available: ${pool.map((s) => s.name).join(', ')}\n`);
        }
        return 1;
      }
      if (matches.length > 1) {
        process.stderr.write(`Ambiguous skill '${name}' — owned by: ${matches.map((m) => m.plugin).join(', ')}. Disambiguate with --plugin.\n`);
        return 1;
      }
      chosen.push(matches[0]);
    }
  } else {
    chosen = pool;
  }

  if (chosen.length === 0) {
    process.stderr.write('No skills to install.\n');
    return 1;
  }

  ensureDir(opts.dest, opts.dryRun);

  let installed = 0;
  let skipped = 0;
  for (const s of chosen) {
    const dst = path.join(opts.dest, s.name);
    if (fs.existsSync(dst)) {
      if (!opts.force) {
        process.stdout.write(`skip ${s.name} (already at ${dst}; use --force to overwrite)\n`);
        skipped++;
        continue;
      }
      if (opts.dryRun) process.stdout.write(`would remove ${dst}\n`);
      else rimrafSync(dst);
    }
    if (opts.symlink) {
      if (opts.dryRun) process.stdout.write(`would symlink ${s.dir} -> ${dst}\n`);
      else fs.symlinkSync(s.dir, dst, 'dir');
    } else {
      if (opts.dryRun) process.stdout.write(`would copy ${s.dir} -> ${dst}\n`);
      else copyDirSync(s.dir, dst);
    }
    installed++;
    process.stdout.write(`installed ${s.name} (from ${s.plugin}) -> ${dst}${opts.symlink ? ' (symlink)' : ''}\n`);
  }

  process.stdout.write(`\n${installed} installed, ${skipped} skipped. Target: ${opts.dest}\n`);
  if (opts.dest === DEFAULT_DEST) {
    process.stdout.write('Claude Code reads ~/.claude/skills automatically. Restart your session to pick up changes.\n');
  }
  return 0;
}

function cmdUninstall(opts) {
  if (opts.skills.length === 0) {
    process.stderr.write('uninstall: specify at least one skill name.\n');
    return 1;
  }
  let removed = 0;
  for (const name of opts.skills) {
    const dst = path.join(opts.dest, name);
    if (!fs.existsSync(dst)) {
      process.stdout.write(`skip ${name} (not at ${dst})\n`);
      continue;
    }
    if (opts.dryRun) process.stdout.write(`would remove ${dst}\n`);
    else rimrafSync(dst);
    process.stdout.write(`removed ${dst}\n`);
    removed++;
  }
  process.stdout.write(`\n${removed} removed.\n`);
  return 0;
}

function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help || (!opts.command && opts.skills.length === 0)) {
    usage();
    return 0;
  }
  const plugins = discoverPlugins();
  switch (opts.command) {
    case 'list': return cmdList(plugins);
    case 'install': return cmdInstall(opts, plugins);
    case 'uninstall': return cmdUninstall(opts);
    default:
      process.stderr.write(`Unknown command: ${opts.command}\n\n`);
      usage();
      return 1;
  }
}

process.exit(main(process.argv.slice(2)));
