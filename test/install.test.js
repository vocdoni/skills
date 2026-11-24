'use strict';

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const BIN = path.join(REPO_ROOT, 'bin', 'install.js');
const PLUGINS_DIR = path.join(REPO_ROOT, 'plugins');

// install.js reads HOME when it loads (CACHE_DIR, DEFAULT_DEST), so point it at
// a temp dir first: in-process calls must never touch the real cache or ~/.claude.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vocdoni-skills-test-'));
process.env.HOME = path.join(tmpRoot, 'home');
process.env.USERPROFILE = process.env.HOME;
fs.mkdirSync(process.env.HOME);

const {
  parseArgs,
  readSkillMeta,
  skillsFromManifest,
  resolveRemoteSource,
  isRemoteSource,
  resolvePluginName,
  discoverPlugins,
} = require(BIN);

after(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function tmpDir(label) {
  return fs.mkdtempSync(path.join(tmpRoot, `${label}-`));
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function writeSkill(dir, name, description = 'A test skill.') {
  writeFile(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n---\n\nBody.\n`,
  );
}

// Run the real CLI with HOME pointed at a temp dir, so nothing touches the
// real ~/.claude/skills or ~/.cache/vocdoni-skills.
function runCli(args) {
  const home = tmpDir('home');
  return spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
}

describe('parseArgs', () => {
  test('reads the command, positional skills and every flag', () => {
    const opts = parseArgs([
      'install', 'go-modern', 'comments',
      '--plugin', 'go',
      '--dest', '/tmp/skills-x',
      '--symlink', '--force', '--dry-run', '--offline',
    ]);
    assert.equal(opts.command, 'install');
    assert.deepEqual(opts.skills, ['go-modern', 'comments']);
    assert.equal(opts.plugin, 'go');
    assert.equal(opts.dest, path.resolve('/tmp/skills-x'));
    assert.equal(opts.symlink, true);
    assert.equal(opts.force, true);
    assert.equal(opts.dryRun, true);
    assert.equal(opts.offline, true);
    assert.equal(opts.help, false);
  });

  test('defaults to ~/.claude/skills and all flags off', () => {
    const opts = parseArgs(['list']);
    assert.equal(opts.command, 'list');
    assert.deepEqual(opts.skills, []);
    assert.equal(opts.plugin, null);
    assert.equal(opts.dest, path.join(os.homedir(), '.claude', 'skills'));
    assert.equal(opts.symlink, false);
    assert.equal(opts.force, false);
    assert.equal(opts.dryRun, false);
    assert.equal(opts.offline, false);
  });

  test('treats the first bare word as the command, later words as skills', () => {
    const opts = parseArgs(['uninstall', 'a', '--force', 'b']);
    assert.equal(opts.command, 'uninstall');
    assert.deepEqual(opts.skills, ['a', 'b']);
  });

  test('recognises --help and -h', () => {
    assert.equal(parseArgs(['--help']).help, true);
    assert.equal(parseArgs(['-h']).help, true);
  });
});

describe('readSkillMeta', () => {
  test('reads name and description from frontmatter', () => {
    const dir = tmpDir('meta');
    writeSkill(dir, 'demo-skill', 'Does demo things.');
    assert.deepEqual(readSkillMeta(dir), {
      name: 'demo-skill',
      description: 'Does demo things.',
    });
  });

  test('strips surrounding quotes from values', () => {
    const dir = tmpDir('quoted');
    writeFile(
      path.join(dir, 'SKILL.md'),
      '---\nname: "quoted-skill"\ndescription: \'Single quoted.\'\n---\n',
    );
    assert.deepEqual(readSkillMeta(dir), {
      name: 'quoted-skill',
      description: 'Single quoted.',
    });
  });

  test('ignores keys outside the frontmatter block', () => {
    const dir = tmpDir('body');
    writeFile(
      path.join(dir, 'SKILL.md'),
      '---\nname: real\n---\n\nname: not-frontmatter\n',
    );
    assert.equal(readSkillMeta(dir).name, 'real');
  });

  test('parses CRLF line endings', () => {
    const dir = tmpDir('crlf');
    writeFile(
      path.join(dir, 'SKILL.md'),
      '---\r\nname: crlf-skill\r\ndescription: Has CRLF.\r\n---\r\n\r\nBody.\r\n',
    );
    assert.deepEqual(readSkillMeta(dir), {
      name: 'crlf-skill',
      description: 'Has CRLF.',
    });
  });

  test('returns empty fields when there is no frontmatter', () => {
    const dir = tmpDir('nofm');
    writeFile(path.join(dir, 'SKILL.md'), '# Just a heading\n');
    assert.deepEqual(readSkillMeta(dir), { name: '', description: '' });
  });

  test('returns empty fields when SKILL.md is missing', () => {
    assert.deepEqual(readSkillMeta(tmpDir('absent')), { name: '', description: '' });
  });
});

describe('skillsFromManifest', () => {
  test('resolves a string array of skill paths', () => {
    const root = tmpDir('array');
    writeSkill(path.join(root, 'skills', 'alpha'), 'alpha');
    writeSkill(path.join(root, 'skills', 'beta'), 'beta');
    const skills = skillsFromManifest(
      { skills: ['./skills/beta', './skills/alpha'] },
      root,
    );
    assert.deepEqual(skills.map((s) => s.name), ['alpha', 'beta']);
    assert.equal(skills[0].dir, path.join(root, 'skills', 'alpha'));
    assert.equal(skills[0].description, 'A test skill.');
  });

  test('accepts the legacy object form and prefers the frontmatter name', () => {
    const root = tmpDir('legacy');
    writeSkill(path.join(root, 'skills', 'dir-name'), 'frontmatter-name');
    const skills = skillsFromManifest(
      { skills: [{ name: 'ignored', path: './skills/dir-name' }] },
      root,
    );
    assert.deepEqual(skills.map((s) => s.name), ['frontmatter-name']);
  });

  test('accepts a bare string path and scans it for skill directories', () => {
    const root = tmpDir('bare');
    writeSkill(path.join(root, 'custom', 'skills', 'one'), 'one');
    writeSkill(path.join(root, 'custom', 'skills', 'two'), 'two');
    const skills = skillsFromManifest({ skills: './custom/skills/' }, root);
    assert.deepEqual(skills.map((s) => s.name), ['one', 'two']);
  });

  test('scans skills/ implicitly when no skills field is declared', () => {
    const root = tmpDir('implicit');
    writeSkill(path.join(root, 'skills', 'gamma'), 'gamma');
    writeSkill(path.join(root, 'skills', 'delta'), 'delta');
    writeFile(path.join(root, 'skills', 'not-a-skill', 'README.md'), 'no SKILL.md here\n');
    const skills = skillsFromManifest({ name: 'plug' }, root);
    assert.deepEqual(skills.map((s) => s.name), ['delta', 'gamma']);
  });

  test('uses a root-level SKILL.md when there is no skills/ directory', () => {
    const root = tmpDir('rootskill');
    writeSkill(root, 'single-root');
    const skills = skillsFromManifest({ name: 'plug' }, root);
    assert.deepEqual(skills.map((s) => s.name), ['single-root']);
    assert.equal(skills[0].dir, root);
  });

  test('does not scan plugin subdirectories when the root has no SKILL.md', () => {
    const root = tmpDir('decoy');
    writeSkill(path.join(root, 'examples'), 'decoy');
    assert.deepEqual(skillsFromManifest({ name: 'plug' }, root), []);
  });

  test('ignores declared paths that escape the plugin root', () => {
    const base = tmpDir('escape');
    const root = path.join(base, 'plugin');
    fs.mkdirSync(root, { recursive: true });
    writeSkill(path.join(base, 'outside'), 'outside');
    writeSkill(path.join(root, 'skills', 'inside'), 'inside');
    const skills = skillsFromManifest(
      { skills: ['../outside', path.join(base, 'outside'), './skills/inside'] },
      root,
    );
    assert.deepEqual(skills.map((s) => s.name), ['inside']);
  });

  test('deduplicates a skill reached through two declared paths', () => {
    const root = tmpDir('dedupe');
    writeSkill(path.join(root, 'skills', 'once'), 'once');
    const skills = skillsFromManifest(
      { skills: ['./skills/once', './skills/'] },
      root,
    );
    assert.deepEqual(skills.map((s) => s.name), ['once']);
  });
});

describe('resolveRemoteSource and isRemoteSource', () => {
  test('github object becomes a GitHub clone URL with ref', () => {
    const source = { source: 'github', repo: 'vocdoni/some-plugin', ref: 'v1.2.0' };
    assert.deepEqual(resolveRemoteSource(source), {
      url: 'https://github.com/vocdoni/some-plugin.git',
      ref: 'v1.2.0',
      subdir: null,
    });
    assert.equal(isRemoteSource(source), true);
  });

  test('sha takes precedence over ref', () => {
    const source = { source: 'github', repo: 'vocdoni/x', ref: 'main', sha: 'abc123' };
    assert.equal(resolveRemoteSource(source).ref, 'abc123');
  });

  test('url object keeps the URL and ref', () => {
    const source = { source: 'url', url: 'https://gitlab.com/team/plugin.git', ref: 'v2.0.0' };
    assert.deepEqual(resolveRemoteSource(source), {
      url: 'https://gitlab.com/team/plugin.git',
      ref: 'v2.0.0',
      subdir: null,
    });
  });

  test('git object behaves like url', () => {
    const source = { source: 'git', url: 'git@example.com:team/plugin.git' };
    assert.deepEqual(resolveRemoteSource(source), {
      url: 'git@example.com:team/plugin.git',
      ref: null,
      subdir: null,
    });
  });

  test('git-subdir keeps the path inside the repository', () => {
    const source = {
      source: 'git-subdir',
      url: 'https://github.com/vocdoni/monorepo.git',
      path: 'plugins/inner',
      ref: 'main',
    };
    assert.deepEqual(resolveRemoteSource(source), {
      url: 'https://github.com/vocdoni/monorepo.git',
      ref: 'main',
      subdir: 'plugins/inner',
    });
  });

  test('legacy bare https and git@ strings are still treated as remote', () => {
    assert.deepEqual(resolveRemoteSource('https://gitlab.com/a/b.git'), {
      url: 'https://gitlab.com/a/b.git',
      ref: null,
      subdir: null,
    });
    assert.equal(isRemoteSource('git@github.com:a/b.git'), true);
  });

  test('local relative path strings are not remote', () => {
    assert.equal(resolveRemoteSource('./plugins/vocdoni-go'), null);
    assert.equal(isRemoteSource('./plugins/vocdoni-go'), false);
  });

  test('malformed objects are not remote', () => {
    assert.equal(resolveRemoteSource({ source: 'github' }), null);
    assert.equal(resolveRemoteSource({ source: 'url' }), null);
    assert.equal(resolveRemoteSource({ source: 'unknown', url: 'https://x' }), null);
    assert.equal(resolveRemoteSource(null), null);
    assert.equal(isRemoteSource(undefined), false);
  });
});

describe('resolvePluginName', () => {
  const plugins = [{ name: 'agentic-dev' }, { name: 'vocdoni-go' }, { name: 'vocdoni-sdk' }];

  test('maps the short form to its vocdoni- prefixed name', () => {
    assert.equal(resolvePluginName('go', plugins).name, 'vocdoni-go');
    assert.equal(resolvePluginName('sdk', plugins).name, 'vocdoni-sdk');
  });

  test('accepts exact names, including non-prefixed ones', () => {
    assert.equal(resolvePluginName('agentic-dev', plugins).name, 'agentic-dev');
    assert.equal(resolvePluginName('vocdoni-go', plugins).name, 'vocdoni-go');
  });

  test('returns null for unknown or empty names', () => {
    assert.equal(resolvePluginName('nope', plugins), null);
    assert.equal(resolvePluginName('', plugins), null);
    assert.equal(resolvePluginName(null, plugins), null);
  });
});

describe('discoverPlugins against the real repo', () => {
  // offline: true only reads the cache, so this never touches the network.
  const plugins = discoverPlugins(true);

  test('finds the local plugins with their skills', () => {
    const go = plugins.find((p) => p.name === 'vocdoni-go');
    assert.ok(go, 'vocdoni-go is discovered');
    assert.ok(go.skills.some((s) => s.name === 'go-modern'));
    assert.ok(plugins.some((p) => p.name === 'agentic-dev'));
  });

  test('skips the nested pi-subagent plugin', () => {
    assert.equal(plugins.some((p) => p.name === 'pi-subagent'), false);
  });

  test('returns plugins sorted by name', () => {
    const names = plugins.map((p) => p.name);
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe('CLI end to end', () => {
  test('list --offline exits 0 and lists plugins and skills', () => {
    const r = runCli(['list', '--offline']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /plugin\(s\):/);
    assert.match(r.stdout, /▸ vocdoni-go\s+\(\d+ skills?\)/);
    assert.match(r.stdout, /▸ agentic-dev/);
    assert.match(r.stdout, /^\s+go-modern$/m);
  });

  test('install --dry-run --offline exits 0 and writes nothing', () => {
    const dest = path.join(tmpDir('dry'), 'skills');
    const r = runCli(['install', '--dest', dest, '--dry-run', '--offline']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /would copy .* -> /);
    assert.match(r.stdout, /would mkdir -p /);
    assert.equal(fs.existsSync(dest), false);
  });

  test('install of one skill copies its SKILL.md into --dest', () => {
    const dest = path.join(tmpDir('real'), 'skills');
    const r = runCli(['install', 'go-modern', '--dest', dest, '--offline']);
    assert.equal(r.status, 0, r.stderr);
    const source = path.join(PLUGINS_DIR, 'vocdoni-go', 'skills', 'go-modern', 'SKILL.md');
    const copied = path.join(dest, 'go-modern', 'SKILL.md');
    assert.equal(fs.readFileSync(copied, 'utf8'), fs.readFileSync(source, 'utf8'));
    assert.match(r.stdout, /1 installed, 0 skipped/);
  });

  test('install of an unknown skill exits 1 and installs nothing', () => {
    const dest = path.join(tmpDir('unknown'), 'skills');
    const r = runCli(['install', 'no-such-skill', '--dest', dest, '--offline']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Unknown skill: no-such-skill/);
    assert.equal(fs.existsSync(dest), false);
  });

  test('uninstall removes an installed skill', () => {
    const dest = path.join(tmpDir('uninstall'), 'skills');
    assert.equal(runCli(['install', 'go-modern', '--dest', dest, '--offline']).status, 0);
    const r = runCli(['uninstall', 'go-modern', '--dest', dest]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(fs.existsSync(path.join(dest, 'go-modern')), false);
  });
});
