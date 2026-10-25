const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('trainer patches the current minified worker signatures', () => {
  const workerSource = [
    'jy=(e,t)=>t.baseAttack*t.attackMul*Ay(t,`attack`)',
    '({baseSpeed:a.speed,baseAttack:a.attack})',
    'case`candy-corn`:t.sharedCandyCorn===!1?n.stats.candyCorn=(n.stats.candyCorn??0)+t.value:r.team.candyCorn=(r.team.candyCorn??0)+t.value;return;',
    'function Yy(e,t,n,r,a){if(t.hp-=n,aS(e,t,n,a))return}'
  ].join(';');
  let patchedSource = '';
  const values = new Map([
    ['ps-damage-multiplier', '7'],
    ['ps-speed-multiplier', '2'],
    ['ps-candy-multiplier', '3'],
    ['ps-trainer-god', 'true']
  ]);

  class FakeWorker {
    constructor(url, options) {
      this.url = url;
      this.options = options;
    }
  }
  class FakeXhr {
    open() {}
    send() {
      this.status = 200;
      this.responseText = workerSource;
    }
  }
  class FakeUrl extends URL {
    static createObjectURL(blob) {
      patchedSource = blob.parts.join('');
      return 'blob:patched-worker';
    }
    static revokeObjectURL() {}
  }
  class FakeBlob {
    constructor(parts) {
      this.parts = parts;
    }
  }

  const context = {
    Blob: FakeBlob,
    URL: FakeUrl,
    XMLHttpRequest: FakeXhr,
    document: {
      readyState: 'loading',
      addEventListener() {},
      getElementById() { return null; }
    },
    localStorage: {
      getItem(key) { return values.get(key) ?? null; },
      setItem(key, value) { values.set(key, String(value)); }
    },
    location: { href: 'https://pokesurvivor.doofcraft.com/', origin: 'https://pokesurvivor.doofcraft.com' },
    setTimeout() {},
    window: { Worker: FakeWorker }
  };
  context.globalThis = context;
  vm.createContext(context);
  const trainer = fs.readFileSync(path.join(__dirname, '..', 'PokeSurvivor-Pokedex-Trainer.js'), 'utf8');
  vm.runInContext(trainer, context);

  const worker = new context.window.Worker('/worker-BOmdoHt1.js', { type: 'module' });
  assert.equal(worker.url, 'blob:patched-worker');
  assert.match(patchedSource, /baseAttack\*t\.attackMul\*7\*/);
  assert.match(patchedSource, /baseSpeed:a\.speed\*2,baseAttack:a\.attack/);
  assert.match(patchedSource, /candyCorn=\(n\.stats\.candyCorn\?\?0\)\+\(t\.value\*3\)/);
  assert.match(patchedSource, /function Yy\(e,t,n,r,a\)\{if\(n=0,t\.hp-=n,/);
});
