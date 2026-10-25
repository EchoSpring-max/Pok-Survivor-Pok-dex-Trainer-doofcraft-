const elements = {
  list: document.querySelector('#script-list'),
  empty: document.querySelector('#empty-state'),
  log: document.querySelector('#log'),
  statusText: document.querySelector('#status-text'),
  statusDot: document.querySelector('#status-dot'),
  sidebarToggle: document.querySelector('#toggle-sidebar'),
  rpcEnabled: document.querySelector('#rpc-enabled'),
  rpcClientId: document.querySelector('#rpc-client-id'),
  rpcStatus: document.querySelector('#rpc-status'),
  rpcDot: document.querySelector('#rpc-dot')
};

const SIDEBAR_STORAGE_KEY = 'pokesurvivor-desktop:sidebar-collapsed';

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
    meta.textContent = `${formatSize(script.size)} · ${script.enabled ? 'autorun on' : 'manual'}`;
    info.append(name, meta);
    const toggle = makeButton('', `switch${script.enabled ? ' active' : ''}`, async () => {
      await window.desktop.toggleScript(script.id, !script.enabled);
      addLog(`${script.name}: autorun ${script.enabled ? 'disabled' : 'enabled'}.`);
    });
    toggle.title = script.enabled ? 'Disable autorun' : 'Enable autorun';
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
  if (document.activeElement !== elements.rpcClientId) elements.rpcClientId.value = state.clientId || '';
  elements.rpcDot.className = `rpc-dot ${state.status}`;
  elements.rpcStatus.textContent = state.message;
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
  if (!result.canceled) addLog('Script imported. Review it before enabling autorun.', 'success');
}));
document.querySelector('#home').addEventListener('click', () => window.desktop.goHome());
document.querySelector('#reload').addEventListener('click', () => window.desktop.reloadGame());
document.querySelector('#devtools').addEventListener('click', () => window.desktop.openDevTools());
document.querySelector('#stop-all').addEventListener('click', () => withError(() => window.desktop.stopAll()));
document.querySelector('#folder').addEventListener('click', () => window.desktop.openScriptsFolder());
document.querySelector('#clear-log').addEventListener('click', () => elements.log.replaceChildren());
document.querySelector('#rpc-save').addEventListener('click', () => withError(async () => {
  const state = await window.desktop.configureRpc({
    enabled: elements.rpcEnabled.checked,
    clientId: elements.rpcClientId.value
  });
  renderRpcState(state);
  addLog(state.enabled ? 'Discord Rich Presence settings saved.' : 'Discord Rich Presence disabled.', 'info');
}));
elements.rpcEnabled.addEventListener('change', () => withError(async () => {
  renderRpcState(await window.desktop.configureRpc({
    enabled: elements.rpcEnabled.checked,
    clientId: elements.rpcClientId.value
  }));
}));
document.querySelector('#rpc-portal').addEventListener('click', () => window.desktop.openDiscordDeveloperPortal());
elements.sidebarToggle.addEventListener('click', () => {
  withError(() => setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed')));
});

window.desktop.onScriptsChanged(renderScripts);
window.desktop.onScriptEvent((entry) => addLog(entry.message, entry.level));
window.desktop.onGameStatus(renderGameStatus);
window.desktop.onRpcState(renderRpcState);

withError(async () => {
  await setSidebarCollapsed(localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true');
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
