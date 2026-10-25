const fs = require('node:fs');

const RETRY_DELAY_MS = 15_000;
const DEFAULT_CLIENT_ID = '1563797886087463012';

function isValidClientId(value) {
  return /^\d{17,20}$/.test(String(value || '').trim());
}

function activityStateFromUrl(url) {
  let hash = '';
  try { hash = new URL(url).hash.toLowerCase(); } catch { return 'In the desktop client'; }
  if (hash.includes('login') || hash.includes('signup')) return 'At the login screen';
  if (hash.includes('menu')) return 'In the main menu';
  if (hash.includes('multiplayer')) return 'Playing multiplayer';
  if (hash.includes('game') || hash.includes('battle') || hash.includes('run')) return 'Surviving the dungeon';
  return 'Playing PokéSurvivor';
}

class DiscordPresence {
  constructor(settingsPath, onState) {
    this.settingsPath = settingsPath;
    this.onState = onState;
    this.settings = this.readSettings();
    this.client = null;
    this.retryTimer = null;
    this.generation = 0;
    this.startedAt = new Date();
    this.pageUrl = 'https://pokesurvivor.doofcraft.com/';
    this.status = 'disabled';
    this.message = 'Discord Rich Presence is off.';
  }

  readSettings() {
    try {
      const value = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
      return {
        enabled: value.enabled !== false,
        clientId: DEFAULT_CLIENT_ID
      };
    } catch {
      return { enabled: true, clientId: DEFAULT_CLIENT_ID };
    }
  }

  saveSettings() {
    const temporaryPath = `${this.settingsPath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(this.settings, null, 2));
    fs.renameSync(temporaryPath, this.settingsPath);
  }

  publicState() {
    return { ...this.settings, status: this.status, message: this.message };
  }

  publishState(status, message) {
    this.status = status;
    this.message = message;
    this.onState?.(this.publicState());
  }

  async configure({ enabled }) {
    this.settings = { enabled: Boolean(enabled), clientId: DEFAULT_CLIENT_ID };
    this.saveSettings();
    await this.disconnect();
    this.start();
    return this.publicState();
  }

  setPage(url) {
    this.pageUrl = url;
    if (this.status === 'connected') this.updateActivity();
  }

  start() {
    if (!this.settings.enabled) {
      this.publishState('disabled', 'Discord Rich Presence is off.');
      return;
    }
    this.connect();
  }

  async connect() {
    const generation = ++this.generation;
    this.clearRetry();
    this.publishState('connecting', 'Connecting to the Discord desktop app…');
    const DiscordRPC = require('discord-rpc');
    const client = new DiscordRPC.Client({ transport: 'ipc' });
    this.client = client;

    client.on('ready', () => {
      if (generation !== this.generation) return;
      this.publishState('connected', 'Rich Presence is active.');
      this.updateActivity();
    });
    client.on('disconnected', () => {
      if (generation !== this.generation) return;
      this.client = null;
      this.publishState('waiting', 'Discord closed. Waiting to reconnect…');
      this.scheduleRetry();
    });

    try {
      await client.login({ clientId: this.settings.clientId });
    } catch (error) {
      if (generation !== this.generation) return;
      this.client = null;
      this.publishState('waiting', 'Discord unavailable or the Application ID is invalid.');
      try { client.destroy(); } catch {}
      this.scheduleRetry();
    }
  }

  async updateActivity() {
    if (!this.client || this.status !== 'connected') return;
    try {
      await this.client.setActivity({
        details: 'Playing PokéSurvivor',
        state: activityStateFromUrl(this.pageUrl),
        startTimestamp: this.startedAt,
        largeImageKey: 'pokeicon-large',
        largeImageText: 'PokéSurvivor Desktop',
        buttons: [{ label: 'Play PokéSurvivor', url: 'https://pokesurvivor.doofcraft.com/' }],
        instance: false
      });
    } catch {
      this.publishState('waiting', 'Could not update Discord. Retrying…');
      this.scheduleRetry();
    }
  }

  scheduleRetry() {
    if (!this.settings.enabled || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, RETRY_DELAY_MS);
  }

  clearRetry() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  async disconnect() {
    this.generation += 1;
    this.clearRetry();
    const client = this.client;
    this.client = null;
    if (!client) return;
    try { await client.clearActivity(); } catch {}
    try { client.destroy(); } catch {}
  }

  async stop() {
    this.settings.enabled = false;
    await this.disconnect();
  }
}

module.exports = { DEFAULT_CLIENT_ID, DiscordPresence, activityStateFromUrl, isValidClientId };
