const path = require('node:path');
const {
  app,
  BaseWindow,
  WebContentsView,
  ipcMain,
  powerSaveBlocker,
  shell,
  session
} = require('electron');
const { DiscordPresence } = require('./discord-presence');

const GAME_URL = 'https://pokesurvivor.doofcraft.com/';
const GAME_ORIGIN = new URL(GAME_URL).origin;
const GAME_PARTITION = 'persist:pokesurvivor-desktop';
const SIDEBAR_WIDTH = 344;
const COLLAPSED_SIDEBAR_WIDTH = 52;
const MIN_GAME_WIDTH = 720;

app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

let window;
let shellView;
let gameView;
let gameSession;
let discordPresence;
let currentGameStatus = { state: 'loading' };
let sidebarCollapsed = false;
let storageFlushedForQuit = false;
let audioState = { muted: false, volume: 1 };
let powerSaveBlockerId = null;

function emit(channel, payload) {
  if (!shellView?.webContents.isDestroyed()) shellView.webContents.send(channel, payload);
}

function setGameStatus(status) {
  currentGameStatus = status;
  emit('game-status', status);
}

async function applyAudioState() {
  if (!gameView || gameView.webContents.isDestroyed()) return;
  gameView.webContents.setAudioMuted(audioState.muted || audioState.volume === 0);
  const volume = audioState.volume;
  const source = `(() => {
    const volume = ${volume};
    globalThis.__pokesurvivorDesktopVolume = volume;
    if (globalThis.Howler?.volume) globalThis.Howler.volume(volume);
    for (const media of document.querySelectorAll('audio, video')) media.volume = volume;
    if (!globalThis.__pokesurvivorDesktopVolumeObserver) {
      const apply = (node) => {
        if (node instanceof HTMLMediaElement) node.volume = globalThis.__pokesurvivorDesktopVolume ?? 1;
        if (node.querySelectorAll) {
          for (const media of node.querySelectorAll('audio, video')) media.volume = globalThis.__pokesurvivorDesktopVolume ?? 1;
        }
      };
      globalThis.__pokesurvivorDesktopVolumeObserver = new MutationObserver((records) => {
        for (const record of records) for (const node of record.addedNodes) apply(node);
      });
      globalThis.__pokesurvivorDesktopVolumeObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
  })()`;
  try { await gameView.webContents.executeJavaScript(source, true); } catch {}
}

function layout() {
  if (!window || window.isDestroyed()) return;
  const { width, height } = window.getContentBounds();
  const sidebarWidth = sidebarCollapsed
    ? COLLAPSED_SIDEBAR_WIDTH
    : Math.min(SIDEBAR_WIDTH, Math.max(280, width - MIN_GAME_WIDTH));
  shellView.setBounds({ x: 0, y: 0, width: sidebarWidth, height });
  gameView.setBounds({ x: sidebarWidth, y: 0, width: width - sidebarWidth, height });
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
  ipcMain.handle('game:reload', () => gameView.webContents.reloadIgnoringCache());
  ipcMain.handle('game:home', () => gameView.webContents.loadURL(GAME_URL));
  ipcMain.handle('game:devtools', () => gameView.webContents.openDevTools({ mode: 'detach' }));
  ipcMain.handle('trainer:toggle', async () => {
    await gameView.webContents.executeJavaScript("document.dispatchEvent(new KeyboardEvent('keydown',{key:'F8',code:'F8',bubbles:true,cancelable:true}))", true);
    return { ok: true };
  });
  ipcMain.handle('game:status', () => currentGameStatus);
  ipcMain.handle('ui:set-sidebar-collapsed', (_event, collapsed) => {
    sidebarCollapsed = Boolean(collapsed);
    layout();
    return { collapsed: sidebarCollapsed };
  });
  ipcMain.handle('rpc:get-state', () => discordPresence.publicState());
  ipcMain.handle('rpc:configure', (_event, settings) => discordPresence.configure(settings));
  ipcMain.handle('audio:set', async (_event, state) => {
    const volume = Math.min(1, Math.max(0, Number(state.volume)));
    audioState = {
      muted: Boolean(state.muted),
      volume: Number.isFinite(volume) ? volume : 1
    };
    await applyAudioState();
    return audioState;
  });
}

async function createWindow() {
  window = new BaseWindow({
    title: 'PokéSurvivor Desktop',
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 680,
    backgroundColor: '#101519',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
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
      preload: path.join(__dirname, 'builtin-trainer.js'),
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: true,
      partition: GAME_PARTITION,
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false
    }
  });

  window.contentView.addChildView(shellView);
  window.contentView.addChildView(gameView);
  gameView.webContents.setBackgroundThrottling(false);
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
    discordPresence.setPage(gameView.webContents.getURL());
    await applyAudioState();
  });
  gameView.webContents.on('did-stop-loading', () => {
    setGameStatus({ state: 'ready', url: gameView.webContents.getURL() });
    discordPresence.setPage(gameView.webContents.getURL());
  });
  gameView.webContents.on('did-navigate-in-page', (_event, url) => discordPresence.setPage(url));
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

app.whenReady().then(async () => {
  discordPresence = new DiscordPresence(path.join(app.getPath('userData'), 'discord-rpc.json'), (state) => emit('rpc-state', state));
  gameSession = session.fromPartition(GAME_PARTITION);
  if (!gameSession.isPersistent()) {
    throw new Error('The PokéSurvivor game session must use persistent storage.');
  }
  gameSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  registerIpc();
  await createWindow();
  powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
  discordPresence.start();
  app.on('activate', async () => { if (!window) await createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', (event) => {
  if (storageFlushedForQuit || !gameSession) return;
  event.preventDefault();
  if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
    powerSaveBlocker.stop(powerSaveBlockerId);
    powerSaveBlockerId = null;
  }
  gameSession.flushStorageData();
  Promise.all([
    gameSession.cookies.flushStore().catch((error) => console.error('Could not flush the game cookie store:', error)),
    discordPresence?.stop()
  ])
    .finally(() => {
      storageFlushedForQuit = true;
      app.quit();
    });
});

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault());
});
