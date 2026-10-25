const elements = {
  list: document.querySelector('#script-list'),
  empty: document.querySelector('#empty-state'),
  log: document.querySelector('#log'),
  statusText: document.querySelector('#status-text'),
  statusDot: document.querySelector('#status-dot'),
  sidebarToggle: document.querySelector('#toggle-sidebar'),
  rpcEnabled: document.querySelector('#rpc-enabled'),
  rpcStatus: document.querySelector('#rpc-status'),
  rpcDot: document.querySelector('#rpc-dot')
};

const SIDEBAR_STORAGE_KEY = 'pokesurvivor-desktop:sidebar-collapsed';
const AUDIO_STORAGE_KEY = 'pokesurvivor-desktop:audio';
let audioUpdateTimer;

function formatSize(bytes) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function addLog(message, level = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${level}`;
  entry.textContent = `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}  ${message}`;
  elements.log.prepend(entry);
}

async function withError(action) {
  try {
    return await action();
  } catch (error) {
    addLog(error.message || String(error), 'error');
  }
}

function makeButton(label, className, onClick) {
  const button = document.createElement('button');
  button.textContent = label;
  if (className) button.className = className;
  button.addEventListener('click', () => withError(onClick));
  return button;
}

function renderScripts(scripts) {
  elements.list.replaceChildren();
  elements.empty.hidden = scripts.length > 0;
  for (const script of scripts) {
    const item = document.createElement('article');
    item.className = 'script-item';

    const top = document.createElement('div');
    top.className = 'script-top';
    const info = document.createElement('div');
    info.style.minWidth = '0';
    const name = document.createElement('div');
    name.className = 'script-name';
    name.textContent = script.name;
    name.title = script.filename;
    const meta = document.createElement('div');
    meta.className = 'script-meta';
    meta.textContent = `${formatSize(script.size)} · ${script.enabled ? 'run at startup' : 'manual'}`;
    info.append(name, meta);
    const toggle = makeButton('', `switch${script.enabled ? ' active' : ''}`, async () => {
      await window.desktop.toggleScript(script.id, !script.enabled);
      addLog(`${script.name}: startup ${script.enabled ? 'disabled' : 'enabled'}.`);
    });
    toggle.title = script.enabled ? 'Do not run at next client startup' : 'Run at next client startup';
    top.append(info, toggle);

    const controls = document.createElement('div');
    controls.className = 'script-controls';
    controls.append(
      makeButton('▶ Run', '', () => window.desktop.runScript(script.id)),
      makeButton('■ Stop', '', () => window.desktop.stopScript(script.id)),
      makeButton('×', 'remove', async () => {
        if (!window.confirm(`Remove ${script.name} from this client?`)) return;
        await window.desktop.removeScript(script.id);
        addLog(`${script.name} removed.`);
      })
    );
    item.append(top, controls);
    elements.list.append(item);
  }
}

function renderGameStatus(status) {
  elements.statusDot.className = `status-dot ${status.state}`;
  elements.statusText.textContent = status.state === 'ready'
    ? 'Connected'
    : status.state === 'loading' ? 'Loading game…' : status.message || 'Connection error';
}

function renderRpcState(state) {
  elements.rpcEnabled.checked = state.enabled;
  elements.rpcDot.className = `rpc-dot ${state.status}`;
  const labels = {
    connected: 'Active',
    connecting: 'Connecting',
    waiting: 'Waiting',
    disabled: 'Off'
  };
  elements.rpcStatus.textContent = labels[state.status] || 'Unavailable';
  elements.rpcStatus.title = state.message;
}

function readAudioState() {
  try {
    const stored = JSON.parse(localStorage.getItem(AUDIO_STORAGE_KEY));
    const volume = Math.min(1, Math.max(0, Number(stored.volume)));
    return { muted: stored.muted === true, volume: Number.isFinite(volume) ? volume : 1 };
  } catch {
    return { muted: false, volume: 1 };
  }
}

async function setAudioState(state) {
  const applied = await window.desktop.setAudio(state);
  localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(applied));
  const muteButton = document.querySelector('#audio-mute');
  const slider = document.querySelector('#audio-volume');
  const value = document.querySelector('#audio-value');
  muteButton.classList.toggle('muted', applied.muted);
  muteButton.textContent = applied.muted ? '×' : '♪';
  muteButton.title = applied.muted ? 'Unmute game audio' : 'Mute game audio';
  muteButton.setAttribute('aria-pressed', String(applied.muted));
  slider.value = String(Math.round(applied.volume * 100));
  value.textContent = `${Math.round(applied.volume * 100)}%`;
}

async function setSidebarCollapsed(collapsed) {
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  elements.sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
  elements.sidebarToggle.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  await window.desktop.setSidebarCollapsed(collapsed);
}

document.querySelector('#import').addEventListener('click', () => withError(async () => {
  const result = await window.desktop.importScript();
  if (!result.canceled) addLog('Script imported. Review it before enabling startup.', 'success');
}));
document.querySelector('#home').addEventListener('click', () => window.desktop.goHome());
document.querySelector('#reload').addEventListener('click', () => window.desktop.reloadGame());
document.querySelector('#devtools').addEventListener('click', () => window.desktop.openDevTools());
document.querySelector('#stop-all').addEventListener('click', () => withError(() => window.desktop.stopAll()));
document.querySelector('#folder').addEventListener('click', () => window.desktop.openScriptsFolder());
document.querySelector('#clear-log').addEventListener('click', () => elements.log.replaceChildren());
document.querySelector('#audio-mute').addEventListener('click', () => withError(() => {
  const current = readAudioState();
  return setAudioState({ ...current, muted: !current.muted });
}));
document.querySelector('#audio-volume').addEventListener('input', (event) => {
  const current = readAudioState();
  const volume = Number(event.target.value) / 100;
  document.querySelector('#audio-value').textContent = `${Math.round(volume * 100)}%`;
  clearTimeout(audioUpdateTimer);
  audioUpdateTimer = setTimeout(() => withError(() => setAudioState({ ...current, volume })), 50);
});
elements.rpcEnabled.addEventListener('change', () => withError(async () => {
  renderRpcState(await window.desktop.configureRpc({
    enabled: elements.rpcEnabled.checked
  }));
}));
elements.sidebarToggle.addEventListener('click', () => {
  withError(() => setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed')));
});

window.desktop.onScriptsChanged(renderScripts);
window.desktop.onScriptEvent((entry) => addLog(entry.message, entry.level));
window.desktop.onGameStatus(renderGameStatus);
window.desktop.onRpcState(renderRpcState);

withError(async () => {
  await setSidebarCollapsed(localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true');
  await setAudioState(readAudioState());
  const [scripts, gameStatus, rpcState] = await Promise.all([
    window.desktop.listScripts(),
    window.desktop.getGameStatus(),
    window.desktop.getRpcState()
  ]);
  renderScripts(scripts);
  renderGameStatus(gameStatus);
  renderRpcState(rpcState);
  addLog('Desktop client ready.');
});
