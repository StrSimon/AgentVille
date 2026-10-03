// ── Dwarf control: approvals, questions, orders, leash ───
// Bound to a village context; see village.mjs for the shared helpers.

import { permissionOutput, questionOutput } from './control.mjs';

/**
 * @param {{ data: any, rts: Map<string, any>, settings: any, control: any, now: () => number,
 *   fx: Function, pushAgent: Function, setActivity: Function, setAttention: Function,
 *   runtime: Function, hasViewers: () => boolean }} ctx
 */
export function createCommands(ctx) {
  const { control, settings } = ctx;

  function shouldHold() {
    if (settings.approvalMode === 'terminal') return false;
    return settings.approvalMode === 'village' || ctx.hasViewers();
  }

  function holdMs() {
    return settings.approvalMode === 'village' ? 10 * 60_000 : settings.approvalWaitSec * 1000;
  }

  function requestBase(id, p, kind) {
    return {
      agentId: id,
      sessionKey: `${p.source}:${p.session_id}`,
      source: p.source,
      kind,
      name: ctx.data.agents[id].name,
      project: p.project,
    };
  }

  function needsTerminal(id, attention) {
    ctx.setAttention(id, { ...attention, terminal: true });
    ctx.pushAgent(id);
    return undefined;
  }

  async function askPermission(id, p, c) {
    const detail = c?.detail || p.tool_name;
    const input = p.tool_input || {};
    const command = typeof input.command === 'string' ? input.command : (input.file_path || input.url || '');
    const attention = { kind: 'permission', tool: p.tool_name, text: detail };
    if (!shouldHold()) return needsTerminal(id, attention);

    const { id: requestId, promise } = control.open(
      { ...requestBase(id, p, 'permission'), tool: p.tool_name, detail, command },
      holdMs(),
    );
    ctx.setAttention(id, { ...attention, requestId });
    ctx.pushAgent(id);
    const answer = await promise;
    if (!answer) return needsTerminal(id, attention);

    ctx.setAttention(id, null);
    if (answer.decision === 'allow') ctx.setActivity(id, c?.activity || 'coding', detail);
    ctx.pushAgent(id);
    return permissionOutput(answer.decision, answer.message);
  }

  async function askQuestion(id, p) {
    const questions = Array.isArray(p.tool_input?.questions) ? p.tool_input.questions : [];
    const text = questions[0]?.question || 'has a question';
    const attention = { kind: 'question', text };
    // Only Claude Code accepts answers through a hook (PreToolUse updatedInput).
    if (p.source !== 'claude' || !questions.length || !shouldHold()) return needsTerminal(id, attention);

    const { id: requestId, promise } = control.open(
      { ...requestBase(id, p, 'question'), tool: p.tool_name, detail: text, questions },
      holdMs(),
    );
    ctx.setAttention(id, { ...attention, requestId });
    ctx.pushAgent(id);
    const answer = await promise;
    if (!answer?.answers) return needsTerminal(id, attention);

    ctx.setAttention(id, null);
    ctx.setActivity(id, 'planning', 'got an answer');
    ctx.pushAgent(id);
    return questionOutput(questions, answer.answers);
  }

  function takeOrders(id) {
    const rt = ctx.runtime(id);
    if (!rt.orders.length) return null;
    const orders = rt.orders.splice(0);
    ctx.changed?.();
    ctx.fx('order-delivered', { agentId: id, text: orders.join(' · ') });
    return orders;
  }

  async function waitForOrders(id, p) {
    const { promise } = control.open(
      { ...requestBase(id, p, 'orders'), detail: 'waiting for orders' },
      settings.leashWaitMin * 60_000,
    );
    const answer = await promise;
    if (answer?.orders?.length) {
      ctx.fx('order-delivered', { agentId: id, text: answer.orders.join(' · ') });
      return answer.orders;
    }
    return takeOrders(id);
  }

  /** Dashboard answered (or released) a pending request. */
  function respond(requestId, answer) {
    const req = control.get(requestId);
    if (!req) return false;
    if (answer?.decision) ctx.fx('decision', { agentId: req.agentId, text: answer.decision === 'allow' ? 'approved' : 'denied' });
    return control.settle(requestId, answer || null, answer ? 'answered' : 'released');
  }

  function sendOrder(agentId, text) {
    const rt = ctx.rts.get(agentId);
    const msg = String(text || '').trim().slice(0, 4000);
    if (!rt?.online || !msg) return false;
    const waiting = control.forAgent(agentId).find(r => r.kind === 'orders');
    if (waiting) return control.settle(waiting.id, { orders: [msg] });
    rt.orders.push(msg);
    ctx.fx('order', { agentId, text: msg });
    ctx.pushAgent(agentId);
    ctx.changed?.();
    return true;
  }

  function setLeash(agentId, on) {
    const rt = ctx.rts.get(agentId);
    if (!rt?.online) return false;
    rt.leash = !!on;
    if (!on) control.cancelWhere(r => r.agentId === agentId && r.kind === 'orders', 'unleashed');
    ctx.pushAgent(agentId);
    return true;
  }

  return { askPermission, askQuestion, takeOrders, waitForOrders, respond, sendOrder, setLeash };
}
