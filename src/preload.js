const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  reloadGame: () => ipcRenderer.invoke('game:reload'),
  goHome: () => ipcRenderer.invoke('game:home'),
  openDevTools: () => ipcRenderer.invoke('game:devtools'),
  toggleTrainer: () => ipcRenderer.invoke('trainer:toggle'),
  getGameStatus: () => ipcRenderer.invoke('game:status'),
  setSidebarCollapsed: (collapsed) => ipcRenderer.invoke('ui:set-sidebar-collapsed', collapsed),
  getRpcState: () => ipcRenderer.invoke('rpc:get-state'),
  configureRpc: (settings) => ipcRenderer.invoke('rpc:configure', settings),
  setAudio: (state) => ipcRenderer.invoke('audio:set', state),
  onGameStatus: (callback) => ipcRenderer.on('game-status', (_event, status) => callback(status)),
  onRpcState: (callback) => ipcRenderer.on('rpc-state', (_event, state) => callback(state))
});
