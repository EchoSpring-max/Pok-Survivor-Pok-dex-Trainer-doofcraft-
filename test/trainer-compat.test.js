const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const candySignature = 'case`candy-corn`:t.sharedCandyCorn===!1?n.stats.candyCorn=(n.stats.candyCorn??0)+t.value:r.team.candyCorn=(r.team.candyCorn??0)+t.value;return;';

function runTrainer(workerSource, settings = {}) {
  let patchedSource = '';
  const values = new Map([
    ['ps-damage-multiplier', settings.damage ?? '7'],
    ['ps-speed-multiplier', settings.speed ?? '2'],
    ['ps-time-scale', settings.timeScale ?? '1'],
    ['ps-candy-multiplier', settings.candy ?? '3'],
    ['ps-trainer-god', settings.god ?? 'true'],
    ['ps-afk-rifts', settings.rifts ?? 'false']
  ]);

  class FakeWorker {
    constructor(url, options) {
      this.url = url;
      this.options = options;
      this.messages = [];
    }
    postMessage(message) { this.messages.push(message); }
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
  return { patchedSource, worker };
}

test('trainer patches the current minified worker signatures', () => {
  const workerSource = [
    'jy=(e,t)=>t.baseAttack*t.attackMul*Ay(t,`attack`)',
    'Fy=e=>e.speedMul*Ay(e,`speed`)',
    candySignature,
    'function Yy(e,t,n,r,a){if(t.hp-=n,aS(e,t,n,a))return}'
  ].join(';');
  const { patchedSource, worker } = runTrainer(workerSource);

  assert.equal(worker.url, 'blob:patched-worker');
  assert.match(patchedSource, /baseAttack\*t\.attackMul\*\(globalThis\.__psTrainerConfig\?\.damage\?\?1\)\*/);
  assert.match(patchedSource, /speedMul\*Ay\(e,`speed`\)\*\(globalThis\.__psTrainerConfig\?\.speed\?\?1\)/);
  assert.match(patchedSource, /t\.value\*\(globalThis\.__psTrainerConfig\?\.candy\?\?1\)/);
  assert.match(patchedSource, /function Yy\(e,t,n,r,a\)\{if\(globalThis\.__psTrainerConfig\?\.god&&\(n=0\),t\.hp-=n,/);
});

test('candy patch still applies when unrelated signatures are unavailable', () => {
  const { patchedSource, worker } = runTrainer(candySignature);

  assert.equal(worker.url, 'blob:patched-worker');
  assert.match(patchedSource, /t\.value\*\(globalThis\.__psTrainerConfig\?\.candy\?\?1\)/);
});

test('AFK rifts are gated by the trainer control message and solo play', () => {
  const riftSource = 'o(n).find(e=>!e.dead&&U(e.x,e.y,c.x,c.y-10)<900)&&Gm(e)';
  const { patchedSource, worker } = runTrainer(riftSource + ';ww=()=>Cw.performance.now()', { rifts: 'true' });

  assert.equal(worker.url, 'blob:patched-worker');
  assert.equal(JSON.stringify(worker.messages), JSON.stringify([{__psTrainerControl:{
    damage:7,
    speed:2,
    timeScale:1,
    candy:3,
    god:true,
    autoRifts:true,
    afk:false
  }}]));
  assert.match(patchedSource, /__psTrainerControl/);
  assert.match(patchedSource, /__psTrainerConfig\?\.autoRifts&&globalThis\.__psTrainerConfig\?\.afk&&o\(n\)\.length===1/);
  assert.match(patchedSource, /o\(n\)\.some\(e=>!e\.dead&&U\(e\.x,e\.y,c\.x,c\.y-10\)<900\)\)\&\&Gm\(e\)/);
  assert.match(patchedSource, /ww=\(\)=>\{/);
  assert.match(patchedSource, /p\.game\+=\(n-p\.real\)\*p\.scale/);
});

test('auto movement uses a configurable short pulse for each square step', () => {
  const trainer = fs.readFileSync(path.join(__dirname, '..', 'PokeSurvivor-Pokedex-Trainer.js'), 'utf8');

  assert.match(trainer, /ps-afk-movement-step-ms/);
  assert.match(trainer, /movementStep\.min='100'/);
  assert.match(trainer, /movementStep\.value=localStorage\.getItem\([^)]*\)\|\|'300'/);
  assert.match(trainer, /movementReleaseTimer=setTimeout/);
  assert.doesNotMatch(trainer, /Math\.floor\(step\+\+\/3\)/);
});
