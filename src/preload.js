const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  listScripts: () => ipcRenderer.invoke('scripts:list'),
  importScript: () => ipcRenderer.invoke('scripts:import'),
  runScript: (id) => ipcRenderer.invoke('scripts:run', id),
  stopScript: (id) => ipcRenderer.invoke('scripts:stop', id),
  toggleScript: (id, enabled) => ipcRenderer.invoke('scripts:toggle', id, enabled),
  removeScript: (id) => ipcRenderer.invoke('scripts:remove', id),
  stopAll: () => ipcRenderer.invoke('scripts:stop-all'),
  openScriptsFolder: () => ipcRenderer.invoke('scripts:open-folder'),
  reloadGame: () => ipcRenderer.invoke('game:reload'),
  goHome: () => ipcRenderer.invoke('game:home'),
  openDevTools: () => ipcRenderer.invoke('game:devtools'),
  getGameStatus: () => ipcRenderer.invoke('game:status'),
  setSidebarCollapsed: (collapsed) => ipcRenderer.invoke('ui:set-sidebar-collapsed', collapsed),
  getRpcState: () => ipcRenderer.invoke('rpc:get-state'),
  configureRpc: (settings) => ipcRenderer.invoke('rpc:configure', settings),
  setAudio: (state) => ipcRenderer.invoke('audio:set', state),
  onScriptsChanged: (callback) => ipcRenderer.on('scripts-changed', (_event, scripts) => callback(scripts)),
  onScriptEvent: (callback) => ipcRenderer.on('script-event', (_event, entry) => callback(entry)),
  onGameStatus: (callback) => ipcRenderer.on('game-status', (_event, status) => callback(status)),
  onRpcState: (callback) => ipcRenderer.on('rpc-state', (_event, state) => callback(state))
});
