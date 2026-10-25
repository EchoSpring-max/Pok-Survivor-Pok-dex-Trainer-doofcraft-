const path = require('node:path');
const {
  app,
  BaseWindow,
  WebContentsView,
  dialog,
  ipcMain,
  shell,
  session
} = require('electron');
const { ScriptStore } = require('./script-store');

const GAME_URL = 'https://pokesurvivor.doofcraft.com/';
const GAME_ORIGIN = new URL(GAME_URL).origin;
const SIDEBAR_WIDTH = 344;
const MIN_GAME_WIDTH = 720;
const REGISTRY_KEY = '__pokesurvivorDesktopScripts';

let window;
let shellView;
let gameView;
let store;
let currentGameStatus = { state: 'loading' };

function emit(channel, payload) {
  if (!shellView?.webContents.isDestroyed()) shellView.webContents.send(channel, payload);
}

function setGameStatus(status) {
  currentGameStatus = status;
  emit('game-status', status);
}

function layout() {
  if (!window || window.isDestroyed()) return;
  const { width, height } = window.getContentBounds();
  const sidebarWidth = Math.min(SIDEBAR_WIDTH, Math.max(280, width - MIN_GAME_WIDTH));
  shellView.setBounds({ x: 0, y: 0, width: sidebarWidth, height });
  gameView.setBounds({ x: sidebarWidth, y: 0, width: width - sidebarWidth, height });
}

function buildInjection(script) {
  const id = JSON.stringify(script.id);
  const filename = script.filename.replace(/[^a-zA-Z0-9._-]/g, '-');
  return `
    (async () => {
      const registryKey = ${JSON.stringify(REGISTRY_KEY)};
      const registry = globalThis[registryKey] ||= new Map();
      const previous = registry.get(${id});
      if (previous?.cleanup) await previous.cleanup();
      const cleanup = await (async () => {
        "use strict";
        ${script.contents}
      })();
      registry.set(${id}, { cleanup: typeof cleanup === "function" ? cleanup : null });
      return { ok: true };
    })()
    //# sourceURL=pokesurvivor-desktop://${filename}
  `;
}

async function runScript(id, reason = 'manual') {
  if (!gameView || gameView.webContents.isDestroyed()) throw new Error('Game view is not ready.');
  const script = store.read(id);
  try {
    await gameView.webContents.executeJavaScript(buildInjection(script), true);
    emit('script-event', { level: 'success', message: `${script.name} ran (${reason}).` });
    return { ok: true };
  } catch (error) {
    emit('script-event', { level: 'error', message: `${script.name}: ${error.message}` });
    return { ok: false, error: error.message };
  }
}

async function stopScript(id) {
  const source = `(async () => {
    const registry = globalThis[${JSON.stringify(REGISTRY_KEY)}];
    const entry = registry?.get(${JSON.stringify(id)});
    if (entry?.cleanup) await entry.cleanup();
    registry?.delete(${JSON.stringify(id)});
  })()`;
  await gameView.webContents.executeJavaScript(source, true);
}

async function stopAllScripts() {
  const source = `(async () => {
    const registry = globalThis[${JSON.stringify(REGISTRY_KEY)}];
    if (!registry) return;
    for (const entry of registry.values()) {
      if (entry?.cleanup) {
        try { await entry.cleanup(); } catch (error) { console.error(error); }
      }
    }
    registry.clear();
  })()`;
  await gameView.webContents.executeJavaScript(source, true);
  emit('script-event', { level: 'info', message: 'Stopped all scripts.' });
}

async function runEnabledScripts() {
  const enabled = store.list().filter((script) => script.enabled);
  for (const script of enabled) await runScript(script.id, 'autorun');
  emit('scripts-changed', store.list());
}

function isAllowedGameUrl(targetUrl) {
  try {
    return new URL(targetUrl).origin === GAME_ORIGIN;
  } catch {
    return false;
  }
}

function secureGameContents(webContents) {
  webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  webContents.on('will-navigate', (event, url) => {
    if (!isAllowedGameUrl(url)) {
      event.preventDefault();
      if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    }
  });
  webContents.on('will-redirect', (event, url) => {
    if (!isAllowedGameUrl(url)) event.preventDefault();
  });
}

function registerIpc() {
  ipcMain.handle('scripts:list', () => store.list());
  ipcMain.handle('scripts:import', async () => {
    const result = await dialog.showOpenDialog(window, {
      title: 'Import a local JavaScript file',
      properties: ['openFile'],
      filters: [{ name: 'JavaScript', extensions: ['js'] }]
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const id = store.import(result.filePaths[0]);
    emit('scripts-changed', store.list());
    return { canceled: false, id };
  });
  ipcMain.handle('scripts:run', (_event, id) => runScript(id));
  ipcMain.handle('scripts:stop', async (_event, id) => {
    await stopScript(id);
    emit('script-event', { level: 'info', message: 'Script cleanup requested.' });
    return { ok: true };
  });
  ipcMain.handle('scripts:toggle', async (_event, id, enabled) => {
    store.setEnabled(id, enabled);
    if (!enabled) await stopScript(id);
    emit('scripts-changed', store.list());
    return { ok: true };
  });
  ipcMain.handle('scripts:remove', async (_event, id) => {
    await stopScript(id);
    store.remove(id);
    emit('scripts-changed', store.list());
    return { ok: true };
  });
  ipcMain.handle('scripts:stop-all', () => stopAllScripts());
  ipcMain.handle('scripts:open-folder', () => shell.openPath(store.scriptsDirectory));
  ipcMain.handle('game:reload', () => gameView.webContents.reloadIgnoringCache());
  ipcMain.handle('game:home', () => gameView.webContents.loadURL(GAME_URL));
  ipcMain.handle('game:devtools', () => gameView.webContents.openDevTools({ mode: 'detach' }));
  ipcMain.handle('game:status', () => currentGameStatus);
}

function createWindow() {
  window = new BaseWindow({
    title: 'PokéSurvivor Desktop',
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 680,
    backgroundColor: '#101519',
    autoHideMenuBar: true
  });

  shellView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  gameView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: 'persist:pokesurvivor-desktop',
      autoplayPolicy: 'no-user-gesture-required'
    }
  });

  window.contentView.addChildView(shellView);
  window.contentView.addChildView(gameView);
  secureGameContents(gameView.webContents);

  shellView.webContents.loadFile(path.join(__dirname, 'index.html'));
  shellView.webContents.once('did-finish-load', () => {
    setGameStatus(gameView.webContents.isLoading()
      ? { state: 'loading' }
      : { state: 'ready', url: gameView.webContents.getURL() });
  });
  gameView.webContents.loadURL(GAME_URL);
  gameView.webContents.on('did-start-loading', () => setGameStatus({ state: 'loading' }));
  gameView.webContents.on('did-finish-load', async () => {
    setGameStatus({ state: 'ready', url: gameView.webContents.getURL() });
    await runEnabledScripts();
  });
  gameView.webContents.on('did-stop-loading', () => {
    setGameStatus({ state: 'ready', url: gameView.webContents.getURL() });
  });
  gameView.webContents.on('did-fail-load', (_event, code, description, validatedUrl, isMainFrame) => {
    if (isMainFrame) setGameStatus({ state: 'error', message: `${description} (${code})`, url: validatedUrl });
  });

  window.on('resize', layout);
  window.on('closed', () => {
    shellView.webContents.close();
    gameView.webContents.close();
    window = null;
  });
  layout();
}

app.whenReady().then(() => {
  store = new ScriptStore(app.getPath('userData'));
  const gameSession = session.fromPartition('persist:pokesurvivor-desktop');
  gameSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  registerIpc();
  createWindow();
  app.on('activate', () => { if (!window) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault());
});
