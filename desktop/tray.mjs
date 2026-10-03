// ── Tray icon + menu ─────────────────────────────────────
// Lives in the macOS menu bar / Windows notification area / Linux tray and
// keeps the village reachable after the window is closed.

import { Tray, Menu, nativeImage } from 'electron';

const isMac = process.platform === 'darwin';

/**
 * @param {{ iconPath: (name: string) => string, openVillage: () => void,
 *   connect: () => void, quit: () => void,
 *   loginItem: { get: () => boolean, set: (on: boolean) => void } | null }} deps
 */
export function createTray({ iconPath, openVillage, connect, quit, loginItem }) {
  const image = nativeImage.createFromPath(iconPath(isMac ? 'tray/trayTemplate.png' : 'tray/tray.png'));
  if (isMac) image.setTemplateImage(true);
  const tray = new Tray(image);
  let status = 'The village is quiet';
  let attention = 0;

  function render() {
    const menu = Menu.buildFromTemplate([
      { label: 'Open Village', click: openVillage },
      { label: status, enabled: false },
      { type: 'separator' },
      { label: 'Connect Claude Code & Codex', click: connect },
      // Login items are not supported on Linux.
      ...(loginItem ? [{
        label: 'Start at login',
        type: 'checkbox',
        checked: loginItem.get(),
        click: (item) => { loginItem.set(item.checked); render(); },
      }] : []),
      { type: 'separator' },
      { label: 'Quit AgentVille', accelerator: isMac ? 'Command+Q' : undefined, click: quit },
    ]);
    tray.setContextMenu(menu);
    tray.setToolTip(attention ? `AgentVille — ${attention} ${attention === 1 ? 'dwarf needs' : 'dwarves need'} you` : `AgentVille — ${status}`);
    if (isMac) tray.setTitle(attention ? `❗${attention}` : '', { fontType: 'monospacedDigit' });
  }

  // Windows/Linux: a left click should open the village, the menu is on right click.
  if (!isMac) tray.on('click', openVillage);
  render();

  return {
    /** Update the status line and attention count. */
    update(next) {
      if (next.status === status && next.attention === attention) return;
      status = next.status;
      attention = next.attention;
      render();
    },
    refresh: render,
    destroy: () => tray.destroy(),
  };
}

/** Standard app menu so copy/paste, reload, devtools and window roles work. */
export function installAppMenu({ appName, openVillage }) {
  const template = [
    ...(isMac ? [{
      label: appName,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : [{
      label: 'File',
      submenu: [{ label: 'Open Village', click: openVillage }, { type: 'separator' }, { role: 'quit' }],
    }]),
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
