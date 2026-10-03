import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTool, classifyShell, coreCommand, patchFile, ACTIVITY_BUILDING, ACTIVITIES } from './classify.mjs';

describe('classifyTool — Claude Code tools', () => {
  it('should map Edit on a source file to coding with the basename', () => {
    assert.deepEqual(classifyTool('Edit', { file_path: '/a/b/App.tsx' }), { activity: 'coding', detail: 'App.tsx' });
  });

  it('should map Write on markdown to writing', () => {
    assert.equal(classifyTool('Write', { file_path: '/a/README.md' }).activity, 'writing');
  });

  it('should map Read/Grep to researching', () => {
    assert.equal(classifyTool('Read', { file_path: '/x/y.ts' }).detail, 'y.ts');
    assert.equal(classifyTool('Grep', { pattern: 'useState' }).activity, 'researching');
  });

  it('should map web tools to browsing', () => {
    assert.deepEqual(classifyTool('WebSearch', { query: 'pixi v8' }), { activity: 'browsing', detail: 'pixi v8' });
  });

  it('should map the Agent tool to delegating with its description', () => {
    assert.deepEqual(classifyTool('Agent', { description: 'Find auth code' }), { activity: 'delegating', detail: 'Find auth code' });
  });

  it('should map AskUserQuestion to waiting', () => {
    const r = classifyTool('AskUserQuestion', { questions: [{ question: 'Which DB?' }] });
    assert.deepEqual(r, { activity: 'waiting', detail: 'Which DB?' });
  });

  it('should ignore task bookkeeping tools', () => {
    assert.equal(classifyTool('TodoWrite', {}), null);
    assert.equal(classifyTool('TaskUpdate', {}), null);
  });

  it('should classify MCP tools by server and verb', () => {
    assert.equal(classifyTool('mcp__mem-search__search', {}).activity, 'remembering');
    assert.equal(classifyTool('mcp__context7__query-docs', {}).activity, 'browsing');
    assert.equal(classifyTool('mcp__jira__createIssue', {}).activity, 'coding');
    assert.equal(classifyTool('mcp__jira__getIssue', {}).activity, 'researching');
  });

  it('should fall back to coding for unknown tools', () => {
    assert.equal(classifyTool('SomethingNew', {}).activity, 'coding');
  });
});

describe('classifyTool — Codex tools', () => {
  it('should extract the file from apply_patch input', () => {
    const patch = '*** Begin Patch\n*** Update File: src/main.rs\n@@\n-a\n+b\n*** End Patch';
    assert.deepEqual(classifyTool('apply_patch', { command: patch }), { activity: 'coding', detail: 'main.rs' });
  });

  it('should treat a heredoc patch through Bash as an edit', () => {
    const cmd = "apply_patch <<'EOF'\n*** Begin Patch\n*** Add File: docs/guide.md\n+hi\n*** End Patch\nEOF";
    assert.equal(classifyTool('Bash', { command: cmd }).activity, 'writing');
  });

  it('should accept array commands', () => {
    assert.equal(classifyTool('shell', { command: ['bash', '-lc', 'rg foo'] }).activity, 'researching');
  });

  it('should map update_plan to planning', () => {
    assert.equal(classifyTool('update_plan', { explanation: 'x' }).activity, 'planning');
  });
});

describe('classifyShell', () => {
  const cases = [
    ['npm install pixi.js', 'installing'],
    ['pnpm add -D vitest', 'installing'],
    ['uv sync', 'installing'],
    ['vercel --prod', 'deploying'],
    ['kubectl apply -f x.yaml', 'deploying'],
    ['npm test', 'testing'],
    ['npx vitest run', 'testing'],
    ['cargo clippy', 'testing'],
    ['npx tsc --noEmit', 'testing'],
    ['git commit -m "x"', 'committing'],
    ['git push origin main', 'committing'],
    ['gh pr create --fill', 'committing'],
    ['git diff HEAD~1', 'reviewing'],
    ['gh pr view 12', 'reviewing'],
    ['lsof -i :4242', 'debugging'],
    ['curl https://example.com', 'browsing'],
    ['cat package.json', 'researching'],
    ['sed -n 1,40p src/App.tsx', 'researching'],
    ['mkdir -p src/world', 'coding'],
  ];
  for (const [cmd, expected] of cases) {
    it(`should classify "${cmd}" as ${expected}`, () => {
      assert.equal(classifyShell(cmd).activity, expected);
    });
  }

  it('should look through cd prefixes and env vars', () => {
    assert.equal(classifyShell('cd /repo && CI=1 npm test').activity, 'testing');
  });

  it('should ignore AgentVille traffic', () => {
    assert.equal(classifyShell('curl -X POST http://localhost:4242/api/hook'), null);
  });
});

describe('helpers', () => {
  it('coreCommand should unwrap bash -lc', () => {
    assert.equal(coreCommand("bash -lc 'git status'"), "git status'");
  });

  it('patchFile should return empty string without a patch', () => {
    assert.equal(patchFile({ command: 'ls' }), '');
  });

  it('every activity should have a building', () => {
    for (const a of ACTIVITIES) assert.ok(ACTIVITY_BUILDING[a], a);
    assert.equal(ACTIVITIES.length, 15);
  });
});
