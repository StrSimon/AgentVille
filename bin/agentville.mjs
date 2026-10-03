#!/usr/bin/env node
// AgentVille CLI — `npx agentville` starts the village and opens the dashboard.

import { spawn } from 'node:child_process';
import readline from 'node:readline/promises';
import { startServer, VERSION } from '../server/http.mjs';
import { integrationStatus, installIntegrations, uninstallIntegrations, refreshLauncher } from '../server/setup.mjs';

const args = process.argv.slice(2);
const cmd = args.find(a => !a.startsWith('-')) || 'start';
const flag = (name) => args.includes(`--${name}`);
const port = Number(args.find(a => a.startsWith('--port='))?.split('=')[1] || process.env.AGENTVILLE_PORT || 4242);

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m`,
  amber: (s) => `\x1b[38;5;214m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m`,
  teal: (s) => `\x1b[38;5;44m${s}\x1b[0m`, red: (s) => `\x1b[31m${s}\x1b[0m`,
};

function openBrowser(url) {
  const [bin, ...rest] = process.platform === 'darwin' ? ['open', url]
    : process.platform === 'win32' ? ['cmd', '/c', 'start', '""', url]
    : ['xdg-open', url];
  try { spawn(bin, rest, { stdio: 'ignore', detached: true }).unref(); } catch { /* headless */ }
}

async function running() {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(800) });
    const j = await res.json();
    return j.name === 'agentville' ? j : null;
  } catch {
    return null;
  }
}

function printStatus() {
  const s = integrationStatus();
  const line = (label, st) => `  ${label.padEnd(12)} ${!st.detected ? c.dim('not found') : st.installed ? c.green('● connected') : c.amber('○ not connected')}`;
  console.log(line('Claude Code', s.claude));
  console.log(line('Codex', s.codex));
}

async function ask(question) {
  if (!process.stdin.isTTY) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(question)).trim().toLowerCase();
  rl.close();
  return answer === '' || answer === 'y' || answer === 'j' || answer === 'yes' || answer === 'ja';
}

async function setup(targets) {
  const result = installIntegrations({ targets });
  if (!result.installed.length) {
    console.log(c.amber('  Neither Claude Code nor Codex was found on this machine.'));
    return;
  }
  for (const t of result.installed) console.log(`  ${c.green('✔')} ${t === 'claude' ? 'Claude Code' : 'Codex'} connected`);
  for (const n of result.notes) console.log(`  ${c.dim('›')} ${n}`);
  console.log(c.dim('  New sessions report to the village automatically.'));
}

async function start() {
  console.log(`\n  ${c.amber('⛏  AgentVille')} ${c.dim('v' + VERSION)}\n`);
  const existing = await running();
  const url = `http://localhost:${port}`;
  if (existing) {
    console.log(`  Already running at ${c.bold(url)} — opening the dashboard.`);
    if (!flag('no-open')) openBrowser(url + (cmd === 'demo' ? '/?demo' : ''));
    return;
  }

  const status = integrationStatus();
  const detected = ['claude', 'codex'].filter(t => status[t].detected);
  const missing = detected.filter(t => !status[t].installed);
  if (missing.length && !flag('no-setup')) {
    const names = missing.map(t => (t === 'claude' ? 'Claude Code' : 'Codex')).join(' + ');
    if (await ask(`  Connect ${c.bold(names)} to the village? ${c.dim('[Y/n]')} `)) await setup(missing);
    console.log('');
  } else {
    refreshLauncher();
  }

  const { close } = await startServer({ port });
  printStatus();
  console.log(`\n  Village:   ${c.bold(c.teal(url))}`);
  console.log(c.dim('  Press Ctrl+C to stop.\n'));
  if (!flag('no-open')) openBrowser(url + (cmd === 'demo' ? '/?demo' : ''));

  const stop = async () => { await close(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

const HELP = `
  ${c.amber('⛏  AgentVille')} — watch Claude Code & Codex agents live as dwarves

  Usage: npx agentville [command] [options]

  Commands
    start        Start the village and open the dashboard (default)
    demo         Start and open the demo village
    setup        Connect Claude Code and Codex (--claude / --codex to pick one)
    uninstall    Remove AgentVille hooks from Claude Code and Codex
    status       Show which tools are connected

  Options
    --port=4242  Port for the village (env AGENTVILLE_PORT)
    --no-open    Don't open the browser
    --no-setup   Skip the first-run connection prompt
`;

switch (cmd) {
  case 'start':
  case 'demo':
    await start();
    break;
  case 'setup': {
    const targets = ['claude', 'codex'].filter(t => flag(t));
    await setup(targets.length ? targets : undefined);
    break;
  }
  case 'uninstall':
    uninstallIntegrations({});
    console.log(`  ${c.green('✔')} AgentVille hooks removed. Your data stays in ~/.agentville.`);
    break;
  case 'status':
    printStatus();
    console.log(`  ${'Village'.padEnd(12)} ${(await running()) ? c.green('● running') : c.dim('stopped')}`);
    break;
  case 'merge-project': {
    // agentville merge-project <from> <to> — fold a sub-folder "project" into its repository
    const [, from, to] = args.filter(a => !a.startsWith('-'));
    if (await running()) { console.log(c.amber('  Quit AgentVille first, then run this again.')); break; }
    const { paths, loadData, writeJSON } = await import('../server/store.mjs');
    const { mergeProject } = await import('../server/core/profiles.mjs');
    const p = paths();
    const { data } = loadData(p);
    mergeProject(data, from, to);
    writeJSON(p.data, data);
    console.log(`  ${c.green('✔')} merged “${from}” into “${to}”`);
    break;
  }
  case 'version':
    console.log(VERSION);
    break;
  default:
    console.log(HELP);
}
