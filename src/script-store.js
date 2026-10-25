const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SCRIPT_EXTENSION = '.js';

function scriptId(contents) {
  return crypto.createHash('sha256').update(contents).digest('hex').slice(0, 16);
}

function safeFilename(filename) {
  const base = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '-');
  return base.toLowerCase().endsWith(SCRIPT_EXTENSION) ? base : `${base}${SCRIPT_EXTENSION}`;
}

function readTitle(contents, fallback) {
  const match = contents.match(/^\s*\/\/\s*@name\s+(.+)$/m);
  return match?.[1]?.trim().slice(0, 80) || path.basename(fallback, SCRIPT_EXTENSION);
}

function readRunAt(contents) {
  const match = contents.match(/^\s*\/\/\s*@run-at\s+([^\s]+)\s*$/m);
  return match?.[1]?.trim().toLowerCase() || 'document-idle';
}

class ScriptStore {
  constructor(rootDirectory) {
    this.rootDirectory = rootDirectory;
    this.scriptsDirectory = path.join(rootDirectory, 'scripts');
    this.settingsPath = path.join(rootDirectory, 'scripts.json');
    fs.mkdirSync(this.scriptsDirectory, { recursive: true });
  }

  readSettings() {
    try {
      const value = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  writeSettings(settings) {
    const temporaryPath = `${this.settingsPath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(settings, null, 2));
    fs.renameSync(temporaryPath, this.settingsPath);
  }

  list() {
    const settings = this.readSettings();
    return fs.readdirSync(this.scriptsDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(SCRIPT_EXTENSION))
      .map((entry) => {
        const filePath = path.join(this.scriptsDirectory, entry.name);
        const contents = fs.readFileSync(filePath, 'utf8');
        const id = scriptId(contents);
        return {
          id,
          filename: entry.name,
          name: readTitle(contents, entry.name),
          runAt: readRunAt(contents),
          enabled: settings[id]?.enabled === true,
          size: Buffer.byteLength(contents),
          modifiedAt: fs.statSync(filePath).mtime.toISOString()
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  import(sourcePath) {
    if (path.extname(sourcePath).toLowerCase() !== SCRIPT_EXTENSION) {
      throw new Error('Only .js files can be imported.');
    }
    const contents = fs.readFileSync(sourcePath, 'utf8');
    if (Buffer.byteLength(contents) > 1024 * 1024) {
      throw new Error('Scripts must be 1 MB or smaller.');
    }
    const base = safeFilename(path.basename(sourcePath));
    const parsed = path.parse(base);
    let destination = path.join(this.scriptsDirectory, base);
    let index = 2;
    while (fs.existsSync(destination)) {
      if (fs.readFileSync(destination, 'utf8') === contents) return scriptId(contents);
      destination = path.join(this.scriptsDirectory, `${parsed.name}-${index}${parsed.ext}`);
      index += 1;
    }
    fs.copyFileSync(sourcePath, destination);
    return scriptId(contents);
  }

  find(id) {
    return this.list().find((script) => script.id === id);
  }

  read(id) {
    const script = this.find(id);
    if (!script) throw new Error('Script not found.');
    return { ...script, contents: fs.readFileSync(path.join(this.scriptsDirectory, script.filename), 'utf8') };
  }

  setEnabled(id, enabled) {
    if (!this.find(id)) throw new Error('Script not found.');
    const settings = this.readSettings();
    settings[id] = { ...settings[id], enabled: Boolean(enabled) };
    this.writeSettings(settings);
  }

  remove(id) {
    const script = this.find(id);
    if (!script) throw new Error('Script not found.');
    fs.unlinkSync(path.join(this.scriptsDirectory, script.filename));
    const settings = this.readSettings();
    delete settings[id];
    this.writeSettings(settings);
  }
}

module.exports = { ScriptStore, readRunAt, readTitle, safeFilename, scriptId };
