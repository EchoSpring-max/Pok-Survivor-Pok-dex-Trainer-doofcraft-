const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('desktop bundles the current standalone trainer', () => {
  const root = path.join(__dirname, '..');
  const standalone = fs.readFileSync(path.join(root, 'PokeSurvivor-Pokedex-Trainer.user.js'), 'utf8');
  const builtIn = fs.readFileSync(path.join(root, 'src', 'builtin-trainer.js'), 'utf8');

  assert.equal(builtIn, standalone);
  assert.match(builtIn, /@version\s+1\.11\.0/);
  assert.match(builtIn, /Game time scale/);
  assert.match(builtIn, /dynamic time scale/);
  assert.match(builtIn, /overflow:hidden !important/);
  assert.match(builtIn, /min-height:0;overflow-y:auto;overscroll-behavior:contain/);
});
