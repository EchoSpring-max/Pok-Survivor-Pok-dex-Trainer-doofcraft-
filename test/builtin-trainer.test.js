const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('desktop bundles the current standalone trainer', () => {
  const root = path.join(__dirname, '..');
  const standalone = fs.readFileSync(path.join(root, 'PokeSurvivor-Pokedex-Trainer.user.js'), 'utf8');
  const builtIn = fs.readFileSync(path.join(root, 'src', 'builtin-trainer.js'), 'utf8');

  assert.equal(builtIn, standalone);
  assert.match(builtIn, /@version\s+1\.10\.1/);
});
