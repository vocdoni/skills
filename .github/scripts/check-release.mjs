#!/usr/bin/env node
// Pre-publish checks for @vocdoni/skills. Zero dependencies, Node >= 18.
//
//   node .github/scripts/check-release.mjs [tag]
//
// Fails (exit 1) when:
//   - a tag is given and it is not v<package.json version>;
//   - a local marketplace entry has no plugin.json, or disagrees with it on
//     name, license or version (CLAUDE.md: they must stay in lockstep);
//   - a remote marketplace entry declares a version (it would mask the remote
//     plugin.json);
//   - a plugin under plugins/ is missing from marketplace.json (the npx CLI
//     would ship it, Claude Code would not see it);
//   - a SKILL.md has a `name` that differs from its directory, or a missing or
//     over-long (> 1024 chars) `description`.
//
// `node bin/install.js list` is not enough here: it skips broken plugins
// silently and always exits 0.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const errors = [];
const fail = (msg) => errors.push(msg);
const readJSON = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

const pkg = readJSON('package.json');
const tag = process.argv[2];
if (tag && tag.replace(/^v/, '') !== pkg.version) {
  fail(`tag ${tag} does not match package.json version ${pkg.version} (expected v${pkg.version})`);
}

const marketplace = readJSON('.claude-plugin/marketplace.json');
const listed = new Set();
for (const entry of marketplace.plugins) {
  if (typeof entry.source !== 'string') {
    if (entry.version) fail(`${entry.name}: remote marketplace entry must not declare a version`);
    continue;
  }
  const dir = path.normalize(entry.source);
  listed.add(dir.split(path.sep).slice(0, 2).join(path.sep));
  const file = path.join(dir, '.claude-plugin', 'plugin.json');
  if (!fs.existsSync(path.join(root, file))) {
    fail(`${entry.name}: ${file} not found`);
    continue;
  }
  const manifest = readJSON(file);
  for (const field of ['name', 'license', 'version']) {
    if (field === 'version' && !entry.version) continue;
    if (manifest[field] !== entry[field]) {
      fail(`${entry.name}: ${field} is ${JSON.stringify(entry[field])} in marketplace.json but ${JSON.stringify(manifest[field])} in ${file}`);
    }
  }
}

for (const name of fs.readdirSync(path.join(root, 'plugins'))) {
  const dir = path.join('plugins', name);
  if (fs.existsSync(path.join(root, dir, '.claude-plugin', 'plugin.json')) && !listed.has(dir)) {
    fail(`${dir}: has a plugin.json but no entry in .claude-plugin/marketplace.json`);
  }
}

const skillFiles = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) walk(rel);
    else if (e.name === 'SKILL.md') skillFiles.push(rel);
  }
};
walk('plugins');

for (const file of skillFiles) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!fm) {
    fail(`${file}: no frontmatter`);
    continue;
  }
  const field = (key) => {
    const m = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(fm[1]);
    return m ? m[1].trim().replace(/^(["'])(.*)\1$/, '$2') : '';
  };
  const dirName = path.basename(path.dirname(file));
  const name = field('name');
  const description = field('description');
  if (name !== dirName) fail(`${file}: name "${name}" does not match directory "${dirName}"`);
  if (!description) fail(`${file}: missing description`);
  else if (description.length > 1024) fail(`${file}: description is ${description.length} chars (max 1024)`);
}

if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  process.exit(1);
}
console.log(`ok: ${pkg.name}@${pkg.version}, ${marketplace.plugins.length} marketplace entries, ${skillFiles.length} skills`);
