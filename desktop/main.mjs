// ── AgentVille desktop app (Electron main process) ───────
// Runs the bridge in-process (or attaches to a running `agentville` CLI),
// shows the village in a window, and keeps working from the tray: native
// notifications let you approve tool calls while the window is closed.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, shell } from 'electron';
import { installIntegrations, refreshLauncher } from '../server/setup.mjs';
import { connectBackend } from './backend.mjs';
import { createNotifier } from './notify.mjs';
import { createTracker, statusLine } from './state.mjs';
import { createTray, installAppMenu } from './tray.mjs';

const isMac = process.platform === 'darwin';
const PORT = Number(process.env.AGENTVILLE_PORT || 4242);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

app.setName('AgentVille');

/** Bundled images: extraResources when packaged, ./build in development. */
const iconPath = (name) => (app.isPackaged ? path.join(process.resourcesPath, name) : path.join(ROOT, 'build', name));

/** @type {BrowserWindow | null} */
let win = null;
/** @type {{ mode: string, url: string, respond: Function, close: () => Promise<void> } | null} */
let backend = null;
let tray = null;
let quitting = false;
let backendClosed = false;

const tracker = createTracker();
const notifier = createNotifier({
  isWindowFocused: () => !!win && win.isVisible() && win.isFocused(),
  showWindow,
  respond: (id, answer) => (backend ? backend.respond(id, answer) : Promise.resolve(false)),
});

// ── village events → tray, badge, notifications ──────────

let uiTimer = null;
function scheduleUi() {
  if (uiTimer) return;
  uiTimer = setTimeout(() => {
    uiTimer = null;
    const counts = tracker.counts();
    tray?.update({ status: statusLine(counts), attention: counts.attention });
    if (isMac || process.platform === 'linux') app.setBadgeCount(counts.attention);
  }, 100);
}

function onEvent(msg) {
  const fx = tracker.apply(msg);
  if (fx.opened) notifier.requestOpened(fx.opened);
  if (fx.closedId) notifier.requestClosed(fx.closedId);
  if (fx.done) notifier.agentDone(fx.done);
  if (msg?.type === 'snapshot' || msg?.type === 'agent' || fx.opened || fx.closedId) scheduleUi();
}

// ── window ───────────────────────────────────────────────

function createWindow({ show = true } = {}) {
  win = new BrowserWindow({
    ...(isMac ? {} : { icon: iconPath('icon.png') }),
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 680,
    show: false,
    title: 'AgentVille',
    backgroundColor: '#0b1020',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    autoHideMenuBar: !isMac,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  const origin = new URL(backend.url).origin;
  const openExternal = (url) => {
    if (/^https?:|^mailto:/i.test(url)) shell.openExternal(url).catch(() => {});
  };
  win.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => {
    if (new URL(url).origin !== origin) { e.preventDefault(); openExternal(url); }
  });
  // The bridge may still be coming up after a takeover — retry quietly.
  win.webContents.on('did-fail-load', (_e, code, _desc, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) setTimeout(() => win && !win.isDestroyed() && win.loadURL(backend.url), 1500);
  });

  // Closing hides the window; the app keeps running in the tray.
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    win.hide();
  });
  win.on('closed', () => { win = null; });
  win.once('ready-to-show', () => { if (show) win.show(); });
  win.loadURL(backend.url);
}

function showWindow() {
  if (!backend) return;
  if (!win) createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// ── tray actions ─────────────────────────────────────────

async function connectTools() {
  let message;
  let detail;
  try {
    const result = installIntegrations();
    const names = result.installed.map(t => (t === 'claude' ? 'Claude Code' : 'Codex'));
    message = names.length ? `${names.join(' & ')} connected` : 'Neither Claude Code nor Codex was found';
    detail = names.length
      ? [...result.notes, 'New sessions report to the village automatically.'].join('\n\n')
      : 'Install Claude Code or Codex first, then try again.';
  } catch (err) {
    message = 'Could not connect';
    detail = err?.message || String(err);
  }
  await dialog.showMessageBox({ type: 'info', message, detail, buttons: ['OK'] });
}

const loginItem = process.platform === 'linux' ? null : {
  get: () => app.getLoginItemSettings().openAtLogin,
  set: (on) => app.setLoginItemSettings({ openAtLogin: on, args: ['--hidden'] }),
};

// ── lifecycle ────────────────────────────────────────────

async function boot() {
  try { refreshLauncher(); } catch { /* hooks keep working with the old launcher */ }

  try {
    backend = await connectBackend({
      port: PORT,
      onEvent,
      onSwitch: (next, err) => {
        if (!next) { showPortError(err); return; }
        backend = next;
        win?.loadURL(backend.url);
      },
    });
  } catch (err) {
    await showPortError(err);
    return;
  }

  installAppMenu({ appName: app.getName(), openVillage: showWindow });
  tray = createTray({ iconPath, openVillage: showWindow, connect: connectTools, quit: () => app.quit(), loginItem });
  scheduleUi();

  const startHidden = process.argv.includes('--hidden') || (isMac && app.getLoginItemSettings().wasOpenedAtLogin);
  createWindow({ show: !startHidden });
}

async function showPortError(err) {
  const inUse = err?.code === 'EADDRINUSE';
  await dialog.showMessageBox({
    type: 'error',
    message: inUse ? `Port ${PORT} is already in use` : 'AgentVille could not start',
    detail: inUse
      ? `Another program (not AgentVille) is listening on port ${PORT}. Quit it, or start AgentVille with a different AGENTVILLE_PORT, and try again.`
      : (err?.message || String(err)),
    buttons: ['Quit'],
  });
  quitting = true;
  app.quit();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.on('activate', showWindow);
  // Keep running in the tray when the window is gone.
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => { quitting = true; });
  // Stop the bridge cleanly (flushes village.json) before the process exits.
  app.on('will-quit', (e) => {
    if (!backend || backendClosed) return;
    e.preventDefault();
    backendClosed = true;
    const timeout = new Promise(r => setTimeout(r, 3000));
    // app.exit, not app.quit: a second quit from inside will-quit is ignored on macOS.
    Promise.race([backend.close(), timeout]).catch(() => {}).finally(() => app.exit(0));
  });
  app.whenReady().then(boot);
}
