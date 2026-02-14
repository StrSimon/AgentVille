import type { AgentEvent } from './types'
import { getDwarfName, releaseDwarfName } from './dwarfNames'

type EventHandler = (event: AgentEvent) => void;

const AGENT_ROLES = [
  'Orchestrator', 'Coder Alpha', 'Coder Beta', 'Coder Gamma',
  'Tester', 'Researcher', 'Reviewer', 'Scout',
  'Architect', 'Debugger', 'Deployer', 'Analyst',
];

// Fake file names for thought bubbles
const FAKE_FILES = [
  'App.tsx', 'index.ts', 'utils.ts', 'api.ts', 'config.mjs',
  'auth.ts', 'hooks.ts', 'types.ts', 'server.mjs', 'routes.ts',
  'schema.sql', 'middleware.ts', 'layout.tsx', 'Button.tsx',
];

const FAKE_SEARCHES = [
  'handleSubmit', 'useEffect', 'useState', 'fetchUser',
  'AuthContext', 'API_URL', 'validateForm', 'parseJSON',
  'middleware', 'ErrorBoundary', 'useMemo', 'router.get',
];

const FAKE_TESTS = [
  'npm test', 'vitest run', 'jest --watch', 'bun test',
];

const FAKE_PLANS = [
  'refactor auth flow', 'add validation', 'update API routes',
  '5 tasks remaining', 'design review', 'sprint planning',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function spawnEvent(agentId: string, role: string, parentId?: string): AgentEvent {
  const level = 1 + Math.floor(Math.random() * 5);
  const titles = ['Apprentice', 'Journeyman', 'Craftsman', 'Smith', 'Master'];
  const xpBases = [0, 50, 200, 500, 1200];
  const nextXPs = [50, 200, 500, 1200, 3000];
  const event: AgentEvent = {
    type: 'agent:spawn', agentId, agentName: getDwarfName(agentId), agentRole: role,
    level,
    title: titles[level - 1],
    xp: xpBases[level - 1] + Math.floor(Math.random() * (nextXPs[level - 1] - xpBases[level - 1])),
    nextLevelXP: nextXPs[level - 1],
  };
  if (parentId) event.parentId = parentId;
  return event;
}

function despawnEvent(agentId: string): AgentEvent {
  releaseDwarfName(agentId);
  return { type: 'agent:despawn', agentId };
}

function workEvent(agentId: string, activity: AgentEvent['activity'], building: string, detail?: string): AgentEvent {
  return { type: 'agent:work', agentId, activity, targetBuilding: building, detail };
}

export function createSimulator(onEvent: EventHandler) {
  const timeouts = new Set<number>();
  const intervals = new Set<number>();
  let running = false;
  let cycleCounter = 0;

  function schedule(event: AgentEvent, delay: number) {
    const timer = window.setTimeout(() => {
      timeouts.delete(timer);
      if (running) onEvent(event);
    }, delay);
    timeouts.add(timer);
  }

  // A realistic agent workflow cycle
  function runWorkflowCycle(startDelay: number) {
    const id = cycleCounter++;
    const p = (suffix: string) => `c${id}-${suffix}`;

    // Phase 1: Orchestrator spawns and plans
    schedule(
      spawnEvent(p('orch'), 'Orchestrator'),
      startDelay,
    );
    schedule(
      workEvent(p('orch'), 'planning', 'guild', pick(FAKE_PLANS)),
      startDelay + 800,
    );

    // Phase 2: Spawn coders (as sub-agents of orchestrator)
    const coderCount = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < coderCount; i++) {
      const role = AGENT_ROLES[1 + (i % 3)];
      const delay = startDelay + 3500 + i * 600;
      schedule(
        spawnEvent(p(`coder-${i}`), role, p('orch')),
        delay,
      );
      schedule(
        workEvent(p(`coder-${i}`), 'coding', 'forge', pick(FAKE_FILES)),
        delay + 500,
      );
      // Coders change files periodically
      if (i === 0) {
        schedule(
          workEvent(p(`coder-${i}`), 'coding', 'forge', pick(FAKE_FILES)),
          delay + 3000,
        );
      }
    }

    // Orchestrator moves to campfire to oversee
    schedule(
      workEvent(p('orch'), 'idle', 'campfire'),
      startDelay + 5000,
    );

    // Phase 3: Maybe spawn a researcher (sub-agent)
    if (Math.random() > 0.3) {
      schedule(
        spawnEvent(p('research'), 'Researcher', p('orch')),
        startDelay + 6000,
      );
      schedule(
        workEvent(p('research'), 'researching', 'library', pick(FAKE_SEARCHES)),
        startDelay + 6500,
      );
      schedule(
        workEvent(p('research'), 'researching', 'library', pick(FAKE_SEARCHES)),
        startDelay + 9000,
      );
      // Researcher finishes and leaves
      schedule(
        workEvent(p('research'), 'idle', 'campfire'),
        startDelay + 14000,
      );
      schedule(
        despawnEvent(p('research')),
        startDelay + 16000,
      );
    }

    // Phase 4: Coders finish and tests begin
    for (let i = 0; i < coderCount; i++) {
      const finishDelay = startDelay + 11000 + i * 1500 + Math.random() * 2000;
      // First coder goes to test
      if (i === 0) {
        schedule(
          workEvent(p(`coder-${i}`), 'testing', 'arena', pick(FAKE_TESTS)),
          finishDelay,
        );
      } else {
        schedule(
          workEvent(p(`coder-${i}`), 'idle', 'campfire'),
          finishDelay,
        );
      }
    }

    // Spawn a dedicated tester (sub-agent)
    schedule(
      spawnEvent(p('tester'), 'Tester', p('orch')),
      startDelay + 13000,
    );
    schedule(
      workEvent(p('tester'), 'testing', 'arena', pick(FAKE_TESTS)),
      startDelay + 13500,
    );

    // Phase 5: Tests pass, review phase
    schedule(
      despawnEvent(p('tester')),
      startDelay + 18000,
    );
    schedule(
      workEvent(p('coder-0'), 'idle', 'campfire'),
      startDelay + 18500,
    );

    // Orchestrator reviews
    schedule(
      workEvent(p('orch'), 'reviewing', 'tower', 'PR #42'),
      startDelay + 19000,
    );

    // Phase 6: Cleanup - everyone leaves
    const cleanupBase = startDelay + 22000;
    for (let i = 0; i < coderCount; i++) {
      schedule(
        despawnEvent(p(`coder-${i}`)),
        cleanupBase + i * 400,
      );
    }
    schedule(
      despawnEvent(p('orch')),
      cleanupBase + 2000,
    );
  }

  // A hotfix: quick spawn-code-test-despawn cycle for urgent patches
  function runHotfix(startDelay: number) {
    const id = cycleCounter++;
    const p = (suffix: string) => `h${id}-${suffix}`;
    const roles = ['Debugger', 'Coder Gamma', 'Coder Beta', 'Deployer'];
    const role = pick(roles);
    const file = pick(FAKE_FILES);

    schedule(
      spawnEvent(p('fixer'), role),
      startDelay,
    );
    schedule(
      workEvent(p('fixer'), 'coding', 'forge', file),
      startDelay + 400,
    );
    schedule(
      workEvent(p('fixer'), 'testing', 'arena', pick(FAKE_TESTS)),
      startDelay + 2500 + Math.random() * 1000,
    );
    schedule(
      despawnEvent(p('fixer')),
      startDelay + 4500 + Math.random() * 1500,
    );
  }

  // A small side-quest: quick research or fix
  function runSideQuest(startDelay: number) {
    const id = cycleCounter++;
    const p = (suffix: string) => `q${id}-${suffix}`;
    const roles = ['Scout', 'Debugger', 'Analyst', 'Deployer'];
    const role = pick(roles);

    const activities: Array<{ activity: AgentEvent['activity']; building: string; detail: string }> = [
      { activity: 'researching', building: 'library', detail: pick(FAKE_SEARCHES) },
      { activity: 'testing', building: 'arena', detail: pick(FAKE_TESTS) },
      { activity: 'coding', building: 'forge', detail: pick(FAKE_FILES) },
    ];
    const chosen = pick(activities);

    schedule(
      spawnEvent(p('solo'), role),
      startDelay,
    );
    schedule(
      workEvent(p('solo'), chosen.activity, chosen.building, chosen.detail),
      startDelay + 600,
    );
    schedule(
      workEvent(p('solo'), 'idle', 'campfire'),
      startDelay + 6000 + Math.random() * 5000,
    );
    schedule(
      despawnEvent(p('solo')),
      startDelay + 12000 + Math.random() * 3000,
    );
  }

  return {
    start() {
      running = true;

      // Initial workflow
      runWorkflowCycle(500);
      // Overlapping second workflow for wusel effect
      runWorkflowCycle(7000);
      // A side quest
      runSideQuest(4000);
      // An early hotfix for immediate action
      runHotfix(2000);

      // Keep spawning overlapping workflows
      const mainLoop = window.setInterval(() => {
        if (!running) return;
        runWorkflowCycle(0);
        // Random side quests for extra activity
        if (Math.random() > 0.4) {
          runSideQuest(2000 + Math.random() * 5000);
        }
        // Sometimes a second overlapping workflow
        if (Math.random() > 0.5) {
          runWorkflowCycle(5000 + Math.random() * 5000);
        }
        // Hotfixes pop in for quick bursts
        if (Math.random() > 0.3) {
          runHotfix(1000 + Math.random() * 3000);
        }
      }, 25000);

      intervals.add(mainLoop);

      // Extra side quests sprinkled in
      const sideLoop = window.setInterval(() => {
        if (!running) return;
        runSideQuest(0);
      }, 10000 + Math.random() * 5000);

      intervals.add(sideLoop);

      // Frequent hotfix loop for dynamic bursts
      const hotfixLoop = window.setInterval(() => {
        if (!running) return;
        if (Math.random() > 0.5) {
          runHotfix(0);
        }
      }, 8000 + Math.random() * 4000);

      intervals.add(hotfixLoop);
    },

    stop() {
      running = false;
      for (const t of timeouts) clearTimeout(t);
      for (const t of intervals) clearInterval(t);
      timeouts.clear();
      intervals.clear();
    },
  };
}
