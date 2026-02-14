import http from 'node:http';
import { getDwarfName, releaseName } from './dwarfNames.mjs';
import {
  getProfile, getStoredName, recordToolUse, recordBytes,
  recordSession, getEnrichedProfile, getAllProfiles, recordActivity,
  recordSubAgentSpawn,
} from './agentStore.mjs';

const PORT = process.env.AGENTVILLE_PORT || 4242;
const DESPAWN_TIMEOUT = 120_000; // 2min no heartbeat = agent leaves

const sseClients = new Set();
const agents = new Map();

// ── Helpers ──────────────────────────────────────────────

function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    try {
      if (!client.writable) {
        sseClients.delete(client);
        continue;
      }
      client.write(data);
    } catch {
      // Dead client — remove silently
      sseClients.delete(client);
    }
  }
}

function readBody(req, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let body = '';
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error('Request body timeout'));
    }, timeoutMs);
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => { clearTimeout(timer); resolve(body); });
    req.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

const ACTIVITY_BUILDING = {
  planning: 'guild',
  coding: 'forge',
  testing: 'arena',
  researching: 'library',
  reviewing: 'tower',
  idle: 'campfire',
};

// ── Auto-despawn inactive agents ─────────────────────────

setInterval(() => {
  const now = Date.now();
  for (const [id, agent] of agents) {
    if (now - agent.lastSeen > DESPAWN_TIMEOUT) {
      console.log(`  💤 ${agent.name} timed out`);
      agents.delete(id);
      releaseName(id);
      broadcast({ type: 'agent:despawn', agentId: id });
    }
  }
}, 5000);

// ── Server ───────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ── SSE stream for dashboard ───────────────────────────
  if (url.pathname === '/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // Send current state to newly connected dashboard
    for (const [id, agent] of agents) {
      const enriched = getEnrichedProfile(id);
      const spawnEvent = {
        type: 'agent:spawn',
        agentId: id,
        agentName: agent.name,
        agentRole: agent.role,
        level: enriched?.level || 1,
        title: enriched?.title || 'Apprentice',
        xp: enriched?.xp || 0,
        nextLevelXP: enriched?.nextLevelXP,
        totalInputBytes: agent.totalInputBytes || 0,
        totalOutputBytes: agent.totalOutputBytes || 0,
        subAgentsSpawned: enriched?.subAgentsSpawned || 0,
        recentActivity: enriched?.recentActivity || [],
      };
      if (agent.parentId) spawnEvent.parentId = agent.parentId;
      if (agent.project) spawnEvent.project = agent.project;
      spawnEvent.clan = enriched?.clan || agent.project || null;
      res.write(`data: ${JSON.stringify(spawnEvent)}\n\n`);

      if (agent.activity && agent.activity !== 'idle') {
        res.write(
          `data: ${JSON.stringify({
            type: 'agent:work',
            agentId: id,
            activity: agent.activity,
            targetBuilding: ACTIVITY_BUILDING[agent.activity] || 'campfire',
            detail: agent.detail || '',
          })}\n\n`,
        );
      }
      if (agent.totalInputBytes || agent.totalOutputBytes) {
        res.write(
          `data: ${JSON.stringify({
            type: 'agent:tokens',
            agentId: id,
            totalInputBytes: agent.totalInputBytes || 0,
            totalOutputBytes: agent.totalOutputBytes || 0,
          })}\n\n`,
        );
      }
    }

    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // ── Heartbeat (simple API for agents) ──────────────────
  if (url.pathname === '/api/heartbeat' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const data = JSON.parse(body);
      const rawName = data.agent || 'Unknown Agent';
      const agentId = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const activity = data.activity || 'idle';
      const detail = data.detail || '';
      const project = data.project || '';
      const inputBytes = parseInt(data.inputBytes) || 0;
      const outputBytes = parseInt(data.outputBytes) || 0;
      const existing = agents.get(agentId);

      // Resolve parent agent ID if provided
      let parentId = null;
      if (data.parentAgent) {
        parentId = data.parentAgent.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      }

      if (!existing) {
        // Use stored name if available, otherwise generate new one
        const storedName = getStoredName(agentId);
        const dwarfName = storedName || getDwarfName(agentId);
        const isSubAgent = !!parentId;

        // Initialize/update persistent profile
        getProfile(agentId, dwarfName, parentId, project);
        recordSession(agentId);
        // Count the first tool call (previously missed on spawn)
        if (activity && activity !== 'idle') {
          recordToolUse(agentId);
        }
        if (inputBytes || outputBytes) {
          recordBytes(agentId, inputBytes, outputBytes);
        }
        if (isSubAgent && parentId) {
          recordSubAgentSpawn(parentId);
        }
        const enriched = getEnrichedProfile(agentId);

        console.log(`  ⬆ ${dwarfName} joined (${activity}) Lv.${enriched?.level || 1} ${enriched?.title || ''}${isSubAgent ? ` [child of ${parentId}]` : ''} [${rawName}]`);
        // Restore historical byte totals from store
        const histInputBytes = enriched?.totalInputBytes || 0;
        const histOutputBytes = enriched?.totalOutputBytes || 0;

        agents.set(agentId, {
          name: dwarfName,
          role: rawName,
          activity,
          detail,
          project,
          totalInputBytes: histInputBytes + inputBytes,
          totalOutputBytes: histOutputBytes + outputBytes,
          spawnedAt: Date.now(),
          lastSeen: Date.now(),
          parentId,
        });
        const spawnEvent = {
          type: 'agent:spawn', agentId, agentName: dwarfName, agentRole: rawName,
          level: enriched?.level || 1,
          title: enriched?.title || 'Apprentice',
          xp: enriched?.xp || 0,
          nextLevelXP: enriched?.nextLevelXP,
          totalInputBytes: histInputBytes + inputBytes,
          totalOutputBytes: histOutputBytes + outputBytes,
          subAgentsSpawned: enriched?.subAgentsSpawned || 0,
          recentActivity: enriched?.recentActivity || [],
        };
        if (parentId) spawnEvent.parentId = parentId;
        if (project) spawnEvent.project = project;
        spawnEvent.clan = enriched?.clan || project || null;
        broadcast(spawnEvent);
        if (activity && activity !== 'idle') {
          recordActivity(agentId, activity, detail);
        }
        broadcast({
          type: 'agent:work',
          agentId,
          activity,
          detail,
          targetBuilding: ACTIVITY_BUILDING[activity] || 'campfire',
        });
      } else {
        const isPostToolUse = !!(inputBytes || outputBytes) && activity === 'idle';
        const effectiveActivity = isPostToolUse ? existing.activity : activity;
        const activityChanged = existing.activity !== effectiveActivity;
        const detailChanged = detail && existing.detail !== detail;
        if (!isPostToolUse) existing.activity = effectiveActivity;
        if (detail) existing.detail = detail;
        if (project) existing.project = project;
        existing.lastSeen = Date.now();

        // Track persistent stats
        const prevEnriched = getEnrichedProfile(agentId);
        const prevLevel = prevEnriched?.level || 1;

        if (inputBytes || outputBytes) {
          // PostToolUse — record bytes (don't change activity)
          recordBytes(agentId, inputBytes, outputBytes);
          existing.totalInputBytes = (existing.totalInputBytes || 0) + inputBytes;
          existing.totalOutputBytes = (existing.totalOutputBytes || 0) + outputBytes;
          broadcast({
            type: 'agent:tokens',
            agentId,
            totalInputBytes: existing.totalInputBytes,
            totalOutputBytes: existing.totalOutputBytes,
          });
        } else if (activity && activity !== 'idle') {
          // PreToolUse — record tool call
          recordToolUse(agentId);
        }

        // Broadcast XP update (every heartbeat, so dashboard stays current)
        const newEnriched = getEnrichedProfile(agentId);
        if (newEnriched) {
          if (newEnriched.level > prevLevel) {
            console.log(`  🎉 ${existing.name} leveled up! Lv.${newEnriched.level} ${newEnriched.title}`);
          }
          broadcast({
            type: 'agent:xp',
            agentId,
            level: newEnriched.level,
            title: newEnriched.title,
            xp: newEnriched.xp,
            nextLevelXP: newEnriched.nextLevelXP,
          });
        }

        if (activityChanged || detailChanged) {
          if (activityChanged && effectiveActivity !== 'idle') {
            recordActivity(agentId, effectiveActivity, detail || existing.detail);
          }
          if (activityChanged) {
            console.log(`  ⚡ ${existing.name} → ${effectiveActivity}${detail ? ` (${detail})` : ''}`);
          }
          broadcast({
            type: 'agent:work',
            agentId,
            activity: effectiveActivity,
            detail: existing.detail,
            targetBuilding: ACTIVITY_BUILDING[effectiveActivity] || 'campfire',
          });
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, agentId }));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
    return;
  }

  // ── Direct event (advanced) ────────────────────────────
  if (url.pathname === '/api/event' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const event = JSON.parse(body);

      if (event.type === 'agent:spawn') {
        agents.set(event.agentId, {
          name: event.agentName || event.agentId,
          activity: 'idle',
          detail: '',
          lastSeen: Date.now(),
          parentId: event.parentId || null,
        });
      } else if (event.type === 'agent:despawn') {
        agents.delete(event.agentId);
        releaseName(event.agentId);
      } else if (event.type === 'agent:work') {
        const agent = agents.get(event.agentId);
        if (agent) {
          agent.activity = event.activity || agent.activity;
          if (event.detail) agent.detail = event.detail;
          agent.lastSeen = Date.now();
        }
      }

      broadcast(event);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
    return;
  }

  // ── Status ─────────────────────────────────────────────
  if (url.pathname === '/api/status' && req.method === 'GET') {
    const agentList = {};
    for (const [id, agent] of agents) {
      agentList[id] = {
        name: agent.name,
        role: agent.role,
        activity: agent.activity,
        detail: agent.detail,
        project: agent.project || '',
        parentId: agent.parentId,
        totalInputBytes: agent.totalInputBytes || 0,
        totalOutputBytes: agent.totalOutputBytes || 0,
        spawnedAt: agent.spawnedAt,
      };
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({ agents: agentList, dashboardClients: sseClients.size }),
    );
    return;
  }

  // ── Leaderboard (all-time agent stats) ─────────────────
  if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
    const profiles = getAllProfiles()
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 50);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ leaderboard: profiles }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('');
  console.log('  \x1b[36m\x1b[1m🏘  AgentVille Bridge\x1b[0m');
  console.log(`  \x1b[2m   http://localhost:${PORT}\x1b[0m`);
  console.log('');
  console.log('  \x1b[2mEndpoints:\x1b[0m');
  console.log(`    POST /api/heartbeat  — Agent check-in`);
  console.log(`    POST /api/event      — Raw event`);
  console.log(`    GET  /events         — SSE stream (dashboard)`);
  console.log(`    GET  /api/status     — Current state`);
  console.log('');
  console.log('  \x1b[2mWaiting for agents...\x1b[0m');
  console.log('');
});
