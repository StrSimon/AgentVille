// ── Remote control: approvals, questions, orders ─────────
// When a dwarf needs the user (permission prompt, question), the hook call is
// held open while the village decides. If nobody answers in time, the hook
// returns without a decision and the normal terminal dialog appears.

let requestCounter = 0;

/**
 * @typedef {{ id: string, agentId: string, sessionKey: string, source: string,
 *   kind: 'permission'|'question'|'orders', tool?: string, detail?: string,
 *   command?: string, questions?: any[], createdAt: number, deadline: number }} PendingRequest
 */

export function createControl({ now, setTimer, clearTimer, onChange }) {
  /** @type {Map<string, PendingRequest & { resolve: (v: any) => void, timer: any }>} */
  const pending = new Map();

  function open(req, waitMs) {
    const id = `req-${now().toString(36)}-${(requestCounter++).toString(36)}`;
    const createdAt = now();
    return {
      id,
      promise: new Promise((resolve) => {
        const entry = { ...req, id, createdAt, deadline: createdAt + waitMs, resolve, timer: null };
        entry.timer = setTimer(() => settle(id, null, 'timeout'), waitMs);
        pending.set(id, entry);
        onChange('open', publicView(entry));
      }),
    };
  }

  function settle(id, answer, reason = 'answered') {
    const entry = pending.get(id);
    if (!entry) return false;
    pending.delete(id);
    clearTimer(entry.timer);
    entry.resolve(answer);
    onChange('close', { id, agentId: entry.agentId, reason });
    return true;
  }

  function cancelWhere(pred, reason) {
    for (const entry of [...pending.values()]) {
      if (pred(entry)) settle(entry.id, null, reason);
    }
  }

  function publicView(e) {
    const { resolve, timer, ...rest } = e;
    return rest;
  }

  return {
    open,
    settle,
    cancelWhere,
    get: (id) => pending.get(id),
    list: () => [...pending.values()].map(publicView),
    forAgent: (agentId) => [...pending.values()].filter(e => e.agentId === agentId).map(publicView),
  };
}

// ── Hook output builders (shared shape for Claude Code + Codex) ──

export function permissionOutput(decision, message) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: decision === 'allow'
        ? { behavior: 'allow' }
        : { behavior: 'deny', message: message || 'Denied from AgentVille.' },
    },
  };
}

/** Claude Code: answer AskUserQuestion from a PreToolUse hook. */
export function questionOutput(questions, answers) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      updatedInput: { questions, answers },
    },
  };
}

export function orderContextOutput(event, orders) {
  return {
    hookSpecificOutput: {
      hookEventName: event,
      additionalContext: formatOrders(orders),
    },
  };
}

export function stopWithOrdersOutput(orders) {
  return { decision: 'block', reason: formatOrders(orders) };
}

export function formatOrders(orders) {
  const body = orders.length === 1 ? orders[0] : orders.map((o, i) => `${i + 1}. ${o}`).join('\n');
  return `New instructions from the user (sent via the AgentVille dashboard):\n${body}`;
}
