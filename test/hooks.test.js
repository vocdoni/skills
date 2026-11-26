'use strict';

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const PLUGINS_DIR = path.join(REPO_ROOT, 'plugins');

// Claude Code caps hook additionalContext at 10,000 characters and replaces anything longer with a file path
// and a short preview, so the rules would silently stop reaching the model.
const MAX_CONTEXT_LENGTH = 10000;

// Plugins whose SessionStart hook injects the body of the skill with the same name.
const BODY_SKILLS = {
  'vocdoni-comments': 'comments',
  'vocdoni-contributing': 'contributing',
};

const SKIP = process.platform === 'win32' ? 'the hooks are bash scripts' : false;

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vocdoni-hooks-test-'));

after(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function hookPlugins() {
  return fs
    .readdirSync(PLUGINS_DIR)
    .filter((name) => fs.existsSync(path.join(PLUGINS_DIR, name, 'hooks', 'hooks.json')))
    .sort();
}

function sessionStartScripts(pluginDir) {
  const config = JSON.parse(fs.readFileSync(path.join(pluginDir, 'hooks', 'hooks.json'), 'utf8'));
  const scripts = [];
  for (const group of config.hooks?.SessionStart ?? []) {
    for (const hook of group.hooks ?? []) {
      if (hook.type !== 'command') continue;
      const match = /\$\{CLAUDE_PLUGIN_ROOT\}\/([^"'\s]+)/.exec(hook.command);
      assert.ok(match, `SessionStart command does not use \${CLAUDE_PLUGIN_ROOT}: ${hook.command}`);
      scripts.push(path.join(pluginDir, match[1]));
    }
  }
  return scripts;
}

// Runs the script the way Claude Code does (bash, JSON on stdin) and returns the injected context.
function runSessionStart(script, env) {
  const cwd = fs.mkdtempSync(path.join(tmpRoot, 'cwd-'));
  const result = spawnSync('bash', [script], { cwd, env, input: '{}', encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput?.hookEventName, 'SessionStart');
  const context = output.hookSpecificOutput.additionalContext;
  assert.equal(typeof context, 'string');
  assert.ok(context.length > 0, 'additionalContext is empty');
  return context;
}

// The SKILL.md body as the hook injects it: CRs removed, frontmatter dropped, leading and trailing blank lines dropped.
function skillBody(skillFile) {
  const lines = fs.readFileSync(skillFile, 'utf8').replace(/\r/g, '').split('\n');
  let start = 0;
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    assert.notEqual(end, -1, `frontmatter is not closed in ${skillFile}`);
    start = end + 1;
  }
  return lines.slice(start).join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
}

const plugins = hookPlugins();

describe('plugin SessionStart hooks', { skip: SKIP }, () => {
  test('every body-injecting plugin has a hook', () => {
    for (const plugin of Object.keys(BODY_SKILLS)) {
      assert.ok(plugins.includes(plugin), `${plugin} has no hooks/hooks.json`);
    }
  });

  for (const plugin of plugins) {
    const pluginDir = path.join(PLUGINS_DIR, plugin);

    describe(plugin, () => {
      test('SessionStart hooks reference existing executable scripts', () => {
        const scripts = sessionStartScripts(pluginDir);
        assert.ok(scripts.length > 0, 'no SessionStart command hook');
        for (const script of scripts) {
          assert.ok(fs.existsSync(script), `missing script: ${script}`);
          assert.ok(fs.statSync(script).mode & 0o111, `script is not executable: ${script}`);
        }
      });

      test('SessionStart output is valid JSON with context under the cap', () => {
        const env = { ...process.env, CLAUDE_PLUGIN_ROOT: pluginDir };
        for (const script of sessionStartScripts(pluginDir)) {
          const context = runSessionStart(script, env);
          assert.ok(
            context.length < MAX_CONTEXT_LENGTH,
            `additionalContext is ${context.length} characters, the cap is ${MAX_CONTEXT_LENGTH}`,
          );
        }
      });

      if (plugin === 'vocdoni-comments') {
        test('drops control characters that would break the JSON', () => {
          const root = fs.mkdtempSync(path.join(tmpRoot, 'root-'));
          const skillFile = path.join(root, 'skills', 'comments', 'SKILL.md');
          fs.mkdirSync(path.dirname(skillFile), { recursive: true });
          fs.writeFileSync(skillFile, '---\nname: comments\n---\n\nA\x01B\x0cC\x1bD\r\n\tE "q" \\ F\n');
          const script = path.join(pluginDir, 'hooks', 'session-start.sh');
          const context = runSessionStart(script, { ...process.env, CLAUDE_PLUGIN_ROOT: root });
          assert.ok(context.endsWith('ABCD\n\tE "q" \\ F'), JSON.stringify(context));
        });
      }

      if (BODY_SKILLS[plugin]) {
        const skill = BODY_SKILLS[plugin];
        const skillFile = path.join(pluginDir, 'skills', skill, 'SKILL.md');

        test(`injects the ${skill} SKILL.md body`, () => {
          const body = skillBody(skillFile);
          const env = { ...process.env, CLAUDE_PLUGIN_ROOT: pluginDir };
          for (const script of sessionStartScripts(pluginDir)) {
            const context = runSessionStart(script, env);
            assert.ok(context.endsWith(body), 'additionalContext does not end with the SKILL.md body');
            assert.ok(!context.includes(`name: ${skill}`), 'additionalContext includes the frontmatter');
          }
        });

        test(`injects the ${skill} body when CLAUDE_PLUGIN_ROOT is unset`, () => {
          const body = skillBody(skillFile);
          const env = { ...process.env };
          delete env.CLAUDE_PLUGIN_ROOT;
          for (const script of sessionStartScripts(pluginDir)) {
            const context = runSessionStart(script, env);
            assert.ok(context.endsWith(body), 'additionalContext does not end with the SKILL.md body');
            assert.ok(!context.includes(`name: ${skill}`), 'additionalContext includes the frontmatter');
          }
        });
      }
    });
  }
});
