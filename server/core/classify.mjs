// ── Tool → activity classification ───────────────────────
// Shared by Claude Code and Codex. Both send `tool_name` + `tool_input`;
// Codex mostly works through shell commands and `apply_patch`, so shell
// commands are inspected to tell reading, testing and reviewing apart.

/**
 * @typedef {'planning'|'delegating'|'coding'|'writing'|'testing'|'debugging'|'researching'|'browsing'|'reviewing'|'committing'|'installing'|'deploying'|'waiting'|'remembering'|'idle'} Activity
 */

/** Every activity has a home building in the village. */
export const ACTIVITY_BUILDING = {
  planning: 'guild',
  delegating: 'guild',
  coding: 'forge',
  writing: 'scriptorium',
  testing: 'arena',
  debugging: 'apothecary',
  researching: 'library',
  browsing: 'observatory',
  reviewing: 'tower',
  committing: 'post',
  installing: 'mine',
  deploying: 'gate',
  waiting: 'townhall',
  remembering: 'well',
  idle: 'campfire',
};

export const ACTIVITIES = Object.keys(ACTIVITY_BUILDING);

const DETAIL_MAX = 48;

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'apply_patch', 'write_file', 'edit_file']);
const READ_TOOLS = new Set(['Read', 'Glob', 'Grep', 'LS', 'NotebookRead', 'view_image', 'read_file', 'list_dir', 'ToolSearch', 'LSP']);
const WEB_TOOLS = new Set(['WebFetch', 'WebSearch', 'web_search', 'web_fetch']);
const PLAN_TOOLS = new Set(['EnterPlanMode', 'ExitPlanMode', 'update_plan', 'Skill']);
const DELEGATE_TOOLS = new Set(['Task', 'Agent', 'spawn_agent', 'Workflow', 'SendMessage', 'send_input']);
const SILENT_TOOLS = new Set(['TodoWrite', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet', 'TaskOutput', 'TaskStop', 'wait', 'Monitor']);
const ASK_TOOLS = new Set(['AskUserQuestion', 'request_user_input']);
const SHELL_TOOLS = new Set(['Bash', 'shell', 'exec_command', 'local_shell', 'unified_exec', 'container.exec', 'BashOutput', 'write_stdin']);

const DOC_RE = /\.(md|mdx|markdown|rst|txt|adoc)$/i;

/** Ordered shell rules — first match wins. Matched against the core command. */
const SHELL_RULES = [
  ['installing', /^(npm (i|install|ci|add|update|uninstall)|pnpm (i|install|add|remove|update)|yarn( add| install| remove|$)|bun (i|install|add|remove)|pip3? install|uv (add|sync|pip|lock)|poetry (add|install|lock)|brew (install|upgrade)|cargo (add|install|fetch)|go (get|mod)|gem install|bundle( install)?$|composer (install|require)|apt(-get)? install)\b/],
  ['deploying', /^(vercel|netlify|fly|flyctl|railway|heroku|wrangler|firebase deploy|gcloud (run|app|functions|builds)|kubectl|helm|terraform (apply|plan)|pulumi|docker (build|push|compose up)|npm publish|pnpm publish|eas (build|submit))\b|\bdeploy\b/],
  ['testing', /\b(node --test|npm (run )?test|pnpm (run )?test|yarn test|bun test|npx (vitest|jest|playwright)|vitest|jest|pytest|mocha|cargo test|go test|rspec|phpunit|tox|playwright test|tsc( |$)|--noEmit|eslint|biome (check|lint)|ruff|mypy|pyright|cargo (check|clippy)|npm run (lint|typecheck|check|build)|pnpm (run )?(lint|typecheck|build)|make (test|check|lint))/],
  ['committing', /^(git (add|commit|push|pull|merge|rebase|checkout|switch|branch|tag|stash|cherry-pick|reset|restore|fetch|worktree)|gh (pr|issue|release) (create|merge|close|edit|comment)|gh repo)\b/],
  ['reviewing', /^(git (diff|log|status|show|blame|shortlog|reflog)|gh (pr|issue|run) (view|diff|checks|list|status))\b/],
  ['debugging', /^(lsof|ps|kill|pkill|killall|top|htop|strace|dtrace|gdb|lldb|node --inspect|tail -f|journalctl|docker logs|kubectl logs|curl -[a-zA-Z]*v)\b|\b(debug|traceback|stack ?trace)\b/],
  ['browsing', /^(curl|wget|http|xh|playwright-cli|open https?:|lynx)\b/],
  ['remembering', /^pocket (memory|learn)\b/],
  ['researching', /^(cat|head|tail|less|more|rg|grep|egrep|find|fd|ls|tree|wc|sed -n|awk|jq|bat|file|stat|du|which|pwd|nl|sort|uniq|diff|pocket search|zoekt|man|tldr)\b/],
];

const SELF_RE = /\/api\/(hook|heartbeat|event|permission|orders)\b/;
const PATCH_FILE_RE = /\*\*\* (?:Add|Update|Delete) File: (.+)/;

function trim(s, max = DETAIL_MAX) {
  const str = String(s ?? '').replace(/\s+/g, ' ').trim();
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

export function basename(p) {
  const s = String(p ?? '').replace(/[\\/]+$/, '');
  const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
  return i >= 0 ? s.slice(i + 1) : s;
}

/** Strip `cd x &&` prefixes, env assignments and shell wrappers so the real command is visible. */
export function coreCommand(cmd) {
  let c = String(cmd ?? '').trim();
  for (let i = 0; i < 6; i++) {
    const next = c
      .replace(/^cd\s+("[^"]*"|'[^']*'|\S+)\s*(&&|;)\s*/, '')
      .replace(/^([A-Z_][A-Z0-9_]*=("[^"]*"|'[^']*'|\S*)\s+)+/, '')
      .replace(/^(\/bin\/|\/usr\/bin\/)?(bash|sh|zsh) -l?c\s+["']?/, '')
      .replace(/^(time|sudo|npx -y|npx|bunx|uvx|uv run|poetry run|pnpm exec|pnpm dlx)\s+/, '')
      .trim();
    if (next === c) break;
    c = next;
  }
  return c;
}

/** Find the first patched file name inside a Codex apply_patch input. */
export function patchFile(input) {
  const strings = typeof input === 'string' ? [input] : Object.values(input || {}).filter(v => typeof v === 'string');
  for (const s of strings) {
    const m = PATCH_FILE_RE.exec(s);
    if (m) return m[1].trim();
  }
  return '';
}

/** Classify a shell command line. Returns null for AgentVille's own traffic. */
export function classifyShell(cmd) {
  const core = coreCommand(cmd);
  if (SELF_RE.test(core)) return null;
  const detail = trim(core, 40);
  for (const [activity, re] of SHELL_RULES) {
    if (re.test(core)) return { activity, detail };
  }
  return { activity: 'coding', detail };
}

function editActivity(file) {
  return { activity: DOC_RE.test(file) ? 'writing' : 'coding', detail: basename(file) };
}

/**
 * Classify a tool call into a village activity.
 * Returns `null` for bookkeeping tools that should not move the villager.
 * @param {string} tool
 * @param {Record<string, any>} [input]
 * @returns {{ activity: Activity, detail: string } | null}
 */
export function classifyTool(tool, input = {}) {
  const inp = input && typeof input === 'object' ? input : {};
  const t = String(tool || '');

  if (SILENT_TOOLS.has(t)) return null;

  if (ASK_TOOLS.has(t)) {
    const q = inp.questions?.[0]?.question ?? inp.question ?? 'awaiting orders';
    return { activity: 'waiting', detail: trim(q) };
  }

  if (EDIT_TOOLS.has(t)) {
    const file = inp.file_path || inp.notebook_path || inp.path || patchFile(inp);
    return editActivity(file);
  }

  if (READ_TOOLS.has(t)) {
    const target = inp.file_path || inp.path || inp.notebook_path;
    return { activity: 'researching', detail: target ? basename(target) : trim(inp.pattern ?? inp.query ?? '') };
  }

  if (WEB_TOOLS.has(t)) {
    return { activity: 'browsing', detail: trim(inp.query ?? inp.url ?? inp.prompt ?? 'the web') };
  }

  if (DELEGATE_TOOLS.has(t)) {
    return { activity: 'delegating', detail: trim(inp.description ?? inp.subagent_type ?? inp.message ?? inp.prompt ?? '') };
  }

  if (PLAN_TOOLS.has(t)) {
    return { activity: 'planning', detail: trim(inp.skill ?? inp.explanation ?? inp.plan?.[0]?.step ?? '') };
  }

  if (SHELL_TOOLS.has(t)) {
    const cmd = Array.isArray(inp.command) ? inp.command.join(' ') : (inp.command ?? inp.cmd ?? inp.chars ?? '');
    if (/\*\*\* Begin Patch/.test(cmd)) return editActivity(patchFile(cmd));
    return classifyShell(cmd);
  }

  if (t.startsWith('mcp__')) {
    const parts = t.split('__');
    const server = (parts[1] || '').toLowerCase();
    const name = parts.slice(2).join('__') || t;
    const detail = trim(name.replace(/[_-]+/g, ' '));
    if (/(mem|memory)/.test(server)) return { activity: 'remembering', detail };
    if (/(playwright|browser|web|fetch|search|context7|docs)/.test(server + name)) return { activity: 'browsing', detail };
    const writes = /(create|update|edit|write|delete|send|post|insert|add|set|apply|save)/i.test(name);
    return { activity: writes ? 'coding' : 'researching', detail };
  }

  return { activity: 'coding', detail: trim(t) };
}
