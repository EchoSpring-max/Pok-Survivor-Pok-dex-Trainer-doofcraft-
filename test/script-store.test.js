const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ScriptStore, readTitle, safeFilename, scriptId } = require('../src/script-store');

test('metadata helpers normalize names and derive stable ids', () => {
  assert.equal(safeFilename('../My unsafe script.js'), 'My-unsafe-script.js');
  assert.equal(readTitle('// @name Better HUD\nconsole.log(1)', 'fallback.js'), 'Better HUD');
  assert.equal(scriptId('hello'), scriptId('hello'));
});

test('imports, enables, reads, and removes scripts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pokesurvivor-desktop-'));
  const source = path.join(root, 'sample.js');
  fs.writeFileSync(source, '// @name Sample\nreturn () => {};');
  const store = new ScriptStore(path.join(root, 'data'));
  const id = store.import(source);
  assert.equal(store.list()[0].name, 'Sample');
  assert.equal(store.read(id).contents.includes('return'), true);
  store.setEnabled(id, true);
  assert.equal(store.list()[0].enabled, true);
  store.remove(id);
  assert.deepEqual(store.list(), []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('rejects non-JavaScript files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pokesurvivor-desktop-'));
  const source = path.join(root, 'sample.txt');
  fs.writeFileSync(source, 'hello');
  const store = new ScriptStore(path.join(root, 'data'));
  assert.throws(() => store.import(source), /Only \.js/);
  fs.rmSync(root, { recursive: true, force: true });
});
