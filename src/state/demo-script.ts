// Scripted sessions for the demo village. Each step is a hook payload (minus
// session fields) plus a delay; the demo runner feeds them into the real village.

export interface Step {
  event: string;
  tool?: string;
  input?: Record<string, unknown>;
  agent?: { id: string; type: string };
  wait: number;
  tokens?: number;
}

export interface DemoSession {
  id: string;
  source: 'claude' | 'codex';
  project: string;
  model: string;
  script: () => Step[];
}

const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
const t = (event: string, tool: string, input: Record<string, unknown>, wait = 2200, tokens = 18_000): Step =>
  ({ event, tool, input, wait, tokens });

const FILES = ['checkout.ts', 'Cart.tsx', 'api/orders.ts', 'schema.prisma', 'useAuth.ts', 'payment.ts', 'Header.tsx', 'router.ts'];
const SEARCH = ['handleSubmit', 'TODO', 'stripe', 'useEffect', 'OrderStatus', 'retry'];

function work(n: number, agent?: Step['agent']): Step[] {
  const out: Step[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    const step = r < 0.3 ? t('PreToolUse', 'Read', { file_path: `/src/${pick(FILES)}` })
      : r < 0.45 ? t('PreToolUse', 'Grep', { pattern: pick(SEARCH) })
        : r < 0.8 ? t('PreToolUse', 'Edit', { file_path: `/src/${pick(FILES)}` }, 2600, 30_000)
          : t('PreToolUse', 'Bash', { command: pick(['npm test', 'npx tsc --noEmit', 'git diff --stat', 'ls src']) }, 3200);
    out.push({ ...step, agent }, { event: 'PostToolUse', tool: step.tool, input: {}, wait: 500, agent });
  }
  return out;
}

export const DEMO_SESSIONS: DemoSession[] = [
  {
    id: 'demo-shop', source: 'claude', project: 'storefront', model: 'claude-opus-5-5',
    script: () => [
      { event: 'UserPromptSubmit', wait: 1500 },
      ...work(4),
      t('PreToolUse', 'Agent', { description: 'Map the checkout flow', subagent_type: 'Explore' }, 800),
      { event: 'SubagentStart', agent: { id: 'x1', type: 'Explore' }, wait: 1200 },
      ...work(3, { id: 'x1', type: 'Explore' }),
      { event: 'SubagentStop', agent: { id: 'x1', type: 'Explore' }, wait: 800 },
      ...work(3),
      t('PermissionRequest', 'Bash', { command: 'git push origin feature/checkout' }, 2000),
      t('PreToolUse', 'Bash', { command: 'git push origin feature/checkout' }, 2500),
      { event: 'Stop', wait: 26_000 },
    ],
  },
  {
    id: 'demo-api', source: 'codex', project: 'payments-api', model: 'gpt-5.6-sol',
    script: () => [
      { event: 'UserPromptSubmit', wait: 1200 },
      t('PreToolUse', 'Bash', { command: 'rg "refund" src' }),
      t('PreToolUse', 'apply_patch', { command: '*** Begin Patch\n*** Update File: src/refunds.rs\n*** End Patch' }, 3000, 40_000),
      t('PreToolUse', 'Bash', { command: 'cargo test' }, 4200),
      t('PreToolUse', 'Bash', { command: 'cargo clippy' }, 2600),
      t('PreToolUse', 'apply_patch', { command: '*** Begin Patch\n*** Update File: docs/refunds.md\n*** End Patch' }, 2400),
      t('PreToolUse', 'Bash', { command: 'git commit -am "refunds: idempotency keys"' }, 2200),
      { event: 'Stop', wait: 18_000 },
    ],
  },
  {
    id: 'demo-infra', source: 'codex', project: 'infra', model: 'gpt-5.5',
    script: () => [
      { event: 'UserPromptSubmit', wait: 3000 },
      t('PreToolUse', 'Bash', { command: 'npm install @aws-sdk/client-s3' }, 3500),
      t('PreToolUse', 'Bash', { command: 'terraform plan' }, 4000),
      t('PermissionRequest', 'Bash', { command: 'terraform apply -auto-approve' }, 1500),
      t('PreToolUse', 'Bash', { command: 'terraform apply -auto-approve' }, 5000),
      t('PreToolUse', 'Bash', { command: 'curl -v https://status.internal/health' }, 2500),
      { event: 'Stop', wait: 30_000 },
    ],
  },
  {
    id: 'demo-docs', source: 'claude', project: 'handbook', model: 'claude-sonnet-5-5',
    script: () => [
      { event: 'UserPromptSubmit', wait: 2000 },
      t('PreToolUse', 'WebSearch', { query: 'PixiJS v8 render groups' }, 3000),
      t('PreToolUse', 'mcp__context7__query-docs', {}, 2600),
      t('PreToolUse', 'Write', { file_path: '/docs/rendering.md' }, 3200, 26_000),
      t('PreToolUse', 'AskUserQuestion', {
        questions: [{ question: 'Which tone should the guide use?', header: 'Tone', options: [{ label: 'Friendly', description: 'Casual, with examples' }, { label: 'Reference', description: 'Terse API docs' }] }],
      }, 2500),
      t('PreToolUse', 'Edit', { file_path: '/docs/README.md' }, 2600),
      { event: 'PreCompact', wait: 3000 },
      { event: 'Stop', wait: 40_000 },
    ],
  },
  {
    id: 'demo-mobile', source: 'claude', project: 'mobile-app', model: 'claude-opus-5-5',
    script: () => [
      { event: 'UserPromptSubmit', wait: 4000 },
      ...work(2),
      t('PreToolUse', 'Bash', { command: 'pnpm add expo-haptics' }, 3000),
      ...work(3),
      t('PreToolUse', 'Bash', { command: 'eas build --platform ios' }, 5000),
      { event: 'Stop', wait: 22_000 },
    ],
  },
];

/** Offline residents so the village feels inhabited from the first second. */
export const DEMO_RESIDENTS = [
  { id: 'claude-r1', name: 'Grimdur', source: 'claude', clan: 'storefront', toolCalls: 4120, cost: 182.4 },
  { id: 'claude-r2', name: 'Thorvald', source: 'claude', clan: 'handbook', toolCalls: 960, cost: 31.2 },
  { id: 'codex-r1', name: 'Brokmir', source: 'codex', clan: 'payments-api', toolCalls: 2310, cost: 64.9 },
  { id: 'codex-r2', name: 'Svarnar', source: 'codex', clan: 'infra', toolCalls: 540, cost: 12.7 },
  { id: 'sub-r1', name: 'Kragbor', source: 'claude', clan: 'storefront', toolCalls: 380, cost: 9.1, kind: 'sub', agentType: 'Explore' },
] as const;
