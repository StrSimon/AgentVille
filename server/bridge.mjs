import http from 'node:http';
import { getDwarfName, releaseName } from './dwarfNames.mjs';
import {
  getProfile, getStoredName, recordToolUse, recordBytes,
  recordSession, getEnrichedProfile, getAllProfiles, recordActivity,
  recordSubAgentSpawn,
} from './agentStore.mjs';
import {
  recordActivity as recordBuildingActivity,
  recordVisit as recordBuildingVisit,
  getEnrichedProfile as getEnrichedBuilding,
  getAllProfiles as getAllBuildingProfiles,
} from './buildingStore.mjs';

const PORT = process.env.AGENTVILLE_PORT || 4242;
const DESPAWN_TIMEOUT = 600_000; // 10min safety net (SessionEnd handles normal cleanup)

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

// ── Building XP helper ───────────────────────────────────
// Track previous building levels so we can detect level-ups.
const buildingPrevLevels = new Map();

function updateBuildingXP(buildingId) {
  const bp = getEnrichedBuilding(buildingId);
  if (!bp) return;
  const prevLevel = buildingPrevLevels.get(buildingId) || 1;
  buildingPrevLevels.set(buildingId, bp.level);
  if (bp.level > prevLevel) {
    console.log(`  🏰 ${buildingId} leveled up! Lv.${bp.level} ${bp.title}`);
  }
  broadcast({
    type: 'building:xp',
    buildingId,
    level: bp.level,
    title: bp.title,
    xp: bp.xp,
    nextLevelXP: bp.nextLevelXP,
    toolCalls: bp.toolCalls,
    uniqueVisitors: bp.uniqueVisitors,
  });
}

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

// Soft-idle timer removed — the Stop hook now handles this instantly.

// ── Server ───────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS — Allow-Private-Network lets HTTPS sites (e.g. Vercel) reach localhost
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

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
      if (agent.waiting) {
        res.write(
          `data: ${JSON.stringify({
            type: 'agent:waiting',
            agentId: id,
            waiting: true,
          })}\n\n`,
        );
      }
    }

    // Send stored-but-offline agents as idle residents (main + sub-agents)
    const allProfiles = getAllProfiles();
    for (const profile of allProfiles) {
      if (agents.has(profile.agentId)) continue; // already sent as active
      res.write(`data: ${JSON.stringify({
        type: 'agent:spawn',
        agentId: profile.agentId,
        agentName: profile.name,
        agentRole: '',
        parentId: profile.parentId || undefined,
        level: profile.level || 1,
        title: profile.title || 'Apprentice',
        xp: profile.xp || 0,
        nextLevelXP: profile.nextLevelXP,
        totalInputBytes: profile.totalInputBytes || 0,
        totalOutputBytes: profile.totalOutputBytes || 0,
        subAgentsSpawned: profile.subAgentsSpawned || 0,
        recentActivity: [],
        clan: profile.clan || null,
        offline: true,
      })}\n\n`);
    }

    // Send building state to newly connected dashboard
    for (const bp of getAllBuildingProfiles()) {
      res.write(`data: ${JSON.stringify({
        type: 'building:state',
        buildingId: bp.buildingId,
        level: bp.level,
        title: bp.title,
        xp: bp.xp,
        nextLevelXP: bp.nextLevelXP,
        toolCalls: bp.toolCalls,
        uniqueVisitors: bp.uniqueVisitors,
      })}\n\n`);
    }

    sseClients.add(res);

    // SSE keepalive — prevents proxies/browsers from dropping idle connections
    const keepalive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(keepalive);
      sseClients.delete(res);
    });
    return;
  }

  // ── Heartbeat (simple API for agents) ──────────────────
  if (url.pathname === '/api/heartbeat' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const data = JSON.parse(body);
      const rawName = data.agent || 'Unknown Agent';
      const agentId = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const activity = data.activity || null;
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
        const spawnActivity = activity || 'idle';

        // Initialize/update persistent profile
        getProfile(agentId, dwarfName, parentId, project);
        recordSession(agentId);
        // Count the first tool call (previously missed on spawn)
        if (spawnActivity !== 'idle') {
          recordToolUse(agentId);
        }
        if (inputBytes || outputBytes) {
          recordBytes(agentId, inputBytes, outputBytes);
        }
        if (isSubAgent && parentId) {
          recordSubAgentSpawn(parentId);
        }
        const enriched = getEnrichedProfile(agentId);

        console.log(`  ⬆ ${dwarfName} joined (${spawnActivity}) Lv.${enriched?.level || 1} ${enriched?.title || ''}${isSubAgent ? ` [child of ${parentId}]` : ''} [${rawName}]`);
        // Restore historical byte totals from store
        const histInputBytes = enriched?.totalInputBytes || 0;
        const histOutputBytes = enriched?.totalOutputBytes || 0;

        agents.set(agentId, {
          name: dwarfName,
          role: rawName,
          activity: spawnActivity,
          detail,
          project,
          busy: !!data.busy,
          waiting: !!data.waiting,
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
        if (spawnActivity !== 'idle') {
          recordActivity(agentId, spawnActivity, detail);
        }
        // Track building XP on spawn
        const spawnBuilding = ACTIVITY_BUILDING[spawnActivity] || 'campfire';
        recordBuildingVisit(spawnBuilding, agentId);
        if (spawnActivity !== 'idle') {
          recordBuildingActivity(spawnBuilding, 1, inputBytes, outputBytes);
        }
        updateBuildingXP(spawnBuilding);

        broadcast({
          type: 'agent:work',
          agentId,
          activity: spawnActivity,
          detail,
          targetBuilding: spawnBuilding,
        });
      } else {
        // Sub-agent reusing a roster dwarf — count as new spawn for parent
        if (data.newSpawn && parentId) {
          recordSubAgentSpawn(parentId);
          recordSession(agentId);
          if (parentId !== existing.parentId) existing.parentId = parentId;
          console.log(`  ⬆ ${existing.name} re-activated [child of ${parentId}]`);
        }

        // Only update activity if explicitly provided (null = PostToolUse, keep current)
        const effectiveActivity = activity || existing.activity;
        const activityChanged = activity !== null && existing.activity !== activity;
        const detailChanged = detail && existing.detail !== detail;
        if (activity) existing.activity = activity;
        if (detail) existing.detail = detail;
        if (project) existing.project = project;
        if (data.busy !== undefined) existing.busy = !!data.busy;
        existing.lastSeen = Date.now();

        // Track waiting state (set by AskUserQuestion, cleared by any non-idle activity)
        const wasWaiting = existing.waiting;
        if (data.waiting) {
          existing.waiting = true;
        } else if (activity && activity !== 'idle') {
          existing.waiting = false;
        }

        // Track persistent stats
        const prevEnriched = getEnrichedProfile(agentId);
        const prevLevel = prevEnriched?.level || 1;

        if (inputBytes || outputBytes) {
          // PostToolUse — record bytes
          recordBytes(agentId, inputBytes, outputBytes);
          existing.totalInputBytes = (existing.totalInputBytes || 0) + inputBytes;
          existing.totalOutputBytes = (existing.totalOutputBytes || 0) + outputBytes;
          broadcast({
            type: 'agent:tokens',
            agentId,
            totalInputBytes: existing.totalInputBytes,
            totalOutputBytes: existing.totalOutputBytes,
          });
          // Credit bytes to the building the agent is working in
          const bytesBuilding = ACTIVITY_BUILDING[effectiveActivity] || 'campfire';
          recordBuildingActivity(bytesBuilding, 0, inputBytes, outputBytes);
          updateBuildingXP(bytesBuilding);
        }
        if (activity && activity !== 'idle') {
          // PreToolUse — record tool call
          recordToolUse(agentId);

          // Credit tool call to the building
          const toolBuilding = ACTIVITY_BUILDING[activity] || 'campfire';
          recordBuildingActivity(toolBuilding, 1, 0, 0);
          recordBuildingVisit(toolBuilding, agentId);
          updateBuildingXP(toolBuilding);

          // Check achievement milestones
          const updatedProfile = getEnrichedProfile(agentId);
          if (updatedProfile) {
            const tc = updatedProfile.toolCalls;
            const milestones = [100, 500, 1000, 2500, 5000, 10000];
            if (milestones.includes(tc)) {
              console.log(`  🏆 ${existing.name} reached ${tc} tool calls!`);
              broadcast({
                type: 'agent:achievement',
                agentId,
                agentName: existing.name,
                achievement: `${existing.name} reached ${tc} tool calls!`,
              });
            }
          }
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

        // Broadcast waiting state changes
        if (existing.waiting !== wasWaiting) {
          if (existing.waiting) {
            console.log(`  ⏳ ${existing.name} is waiting for input`);
          }
          broadcast({
            type: 'agent:waiting',
            agentId,
            waiting: existing.waiting,
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
          busy: false,
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
      } else if (event.type === 'agent:failure') {
        const agent = agents.get(event.agentId);
        if (agent) {
          agent.lastSeen = Date.now();
          console.log(`  💥 ${agent.name} failed: ${event.detail || 'unknown'}`);
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
        busy: agent.busy || false,
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
