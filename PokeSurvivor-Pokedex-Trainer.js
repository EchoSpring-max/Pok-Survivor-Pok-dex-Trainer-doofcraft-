// ==UserScript==
// @name         PokéSurvivor • Pokédex Trainer
// @namespace    https://github.com/EchoSpring-max/Pok-Survivor-Pok-dex-Trainer-doofcraft-
// @version      1.8.6
// @description  Unofficial Pokédex-style trainer featuring gameplay controls, AFK tools and customizable auto-upgrades.
// @author       EchoSpring-max
// @icon         data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAACP0lEQVR42u2bPU4DMRCFdy0XkVIBUiQQcABaThBRcwg67kDNHeg4RGrECWg5ACCQIgEVEh1UiSzHsT32G//FU0FY7Pme39gTyTsMPXrsdIwh/3R9cPxXIszd59vIJkCp0LFiiBbhKTmPIQNdzWZFQt8vl2QnjBT4UsFdQthEEK3Bm3K1lYNoDZ4qgmgRniKCpAyAiKP9Pecz71/fUBFMm6OXACmhtz2PFMN5CqgWQaw+FZzTFaoL1FNBlrDilDHRjhA1wHOOL2sB53KDqA0ePa+oFR41vxh2PETNq4/IQ9QOH5tPL4EWVj8mr513gMy1+uevHxufPZ0cQlxAaZBkasVN4PrfEEIUWQI2+JDnkgsQY38qVIwIlDxlqqRMcfvwuP755mIOnW8xnZR9Cqjwpt+b3ANcsDlE6J1gFyBDmDY82+dNOkCHzQEf1Qm+PNM2rNOzOXnFEXNAHaCerdTJqDAx8L49QPIS8IWiwmcpgVgRTA5KCR4swGI6GS5/ftcQoUkjYUPt3/uAUAFiNkN0xKw+zAG5REDMGyxAiNqcEZqPQE2a2gWx1mfZBFOJgJxHIqy3OhbV5DjOdBN4bCkKrvpDu4EDHtoJrpJBu4ELnK0V1ktCh/ARw+Ye9OmzcYcWeVNMFyLHMTcM22+IsX8ZMpVFaf2GdCmHuC+oQviIgYS23RI1loBeBohSyBU+1+aNx6D+oEvFWuGtfUDNIlBemOivzPgMXONLUz7w3q1wyPt4NcB7O6AWR9S4UD16ZI5/0YX0gyZhTxcAAAAASUVORK5CYII=
// @homepageURL  https://github.com/EchoSpring-max/Pok-Survivor-Pok-dex-Trainer-doofcraft-
// @supportURL   https://github.com/EchoSpring-max/Pok-Survivor-Pok-dex-Trainer-doofcraft-/issues
// @downloadURL  https://raw.githubusercontent.com/EchoSpring-max/Pok-Survivor-Pok-dex-Trainer-doofcraft-/main/PokeSurvivor-Pokedex-Trainer.user.js
// @updateURL    https://raw.githubusercontent.com/EchoSpring-max/Pok-Survivor-Pok-dex-Trainer-doofcraft-/main/PokeSurvivor-Pokedex-Trainer.user.js
// @match        https://pokesurvivor.doofcraft.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
(() => {
  'use strict';
  const NativeWorker = window.Worker;
  const damageSignature = /([A-Za-z_$][\w$]*=\(e,t\)=>t\.baseAttack\*t\.attackMul)\*/;
  const speedSignature = 'baseSpeed:a.speed,baseAttack:a.attack';
  let speed = Number(localStorage.getItem('ps-speed-multiplier') || '1');
  if (!Number.isFinite(speed) || speed < 1 || speed > 20) speed = 1;
  const candySignature = 'case`candy-corn`:t.sharedCandyCorn===!1?n.stats.candyCorn=(n.stats.candyCorn??0)+t.value:r.team.candyCorn=(r.team.candyCorn??0)+t.value;return;';
  let candy = Number(localStorage.getItem('ps-candy-multiplier') || '1');
  if (!Number.isInteger(candy) || candy < 1 || candy > 100) candy = 1;
  const godSignature = /(function [A-Za-z_$][\w$]*\(e,t,n,r,a\)\{if\()t\.hp-=n,/;
  let god = localStorage.getItem('ps-trainer-god') !== 'false';
  let status = 'Waiting for battle worker';
  const desktopClient = globalThis.__pokesurvivorDesktopScripts instanceof Map;
  let multiplier = Number(localStorage.getItem('ps-damage-multiplier') || '5');
  if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 1000) multiplier = 5;
  function update() { const el = document.getElementById('ps-damage-status'); if (el) el.textContent = status; }
  window.Worker = new Proxy(NativeWorker, {
    construct(Target, args) {
      let url;
      try { url = new URL(String(args[0]), location.href); } catch { return Reflect.construct(Target, args); }
      if (url.origin !== location.origin || !/\/worker-[\w-]+\.js$/.test(url.pathname)) return Reflect.construct(Target, args);
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url.href, false);
        xhr.send();
        if (xhr.status !== 200) {
          status = `Worker request failed (${xhr.status || 'network error'})`; update();
          return Reflect.construct(Target, args);
        }
        const applied = [];
        const missing = [];
        let source = xhr.responseText;
        if (damageSignature.test(source)) {
          source = source.replace(damageSignature, `$1*${multiplier}*`);
          applied.push(`damage ×${multiplier}`);
        } else missing.push('damage');
        if (source.includes(speedSignature)) {
          source = source.replace(speedSignature, `baseSpeed:a.speed*${speed},baseAttack:a.attack`);
          applied.push(`speed ×${speed}`);
        } else missing.push('speed');
        if (candy !== 1) {
          if (source.includes(candySignature)) {
            source = source.replace(candySignature, candySignature.replaceAll('t.value', `(t.value*${candy})`));
            applied.push(`candy pickups ×${candy}`);
          } else missing.push('candy');
        }
        if (god) {
          if (godSignature.test(source)) {
            source = source.replace(godSignature, '$1n=0,t.hp-=n,');
            applied.push('god mode');
          } else missing.push('god mode');
        }
        if (!applied.length) {
          status = `Worker found; no compatible patches (${missing.join(', ')})`; update();
          return Reflect.construct(Target, args);
        }
        const blobUrl = URL.createObjectURL(new Blob([source], {type:'text/javascript'}));
        const worker = Reflect.construct(Target, [blobUrl, args[1]]);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
        status = `Injected: ${applied.join(', ')}${missing.length ? ` · unavailable: ${missing.join(', ')}` : ''}`; update();
        return worker;
      } catch (error) {
        status = `Patch error: ${error.message}`; update();
        return Reflect.construct(Target, args);
      }
    }
  });
  function showMenu() {
    if (document.getElementById('ps-damage-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'ps-damage-panel';
    panel.classList.add('ps-pokedex');
    panel.style.cssText = 'position:fixed;top:80px;right:14px;z-index:2147483647;background:#161b2b;color:white;border:1px solid #64748b;border-radius:10px;padding:12px;font:13px Arial;min-width:230px;box-shadow:0 8px 30px #0009';
    const savedPosition = (() => { try { return JSON.parse(localStorage.getItem('ps-trainer-position') || 'null'); } catch { return null; } })();
    if (savedPosition && Number.isFinite(savedPosition.x) && Number.isFinite(savedPosition.y)) {
      panel.style.left = Math.max(0, Math.min(savedPosition.x, window.innerWidth - 120)) + 'px';
      panel.style.top = Math.max(0, Math.min(savedPosition.y, window.innerHeight - 35)) + 'px';
      panel.style.right = 'auto';
    }
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:move;user-select:none;touch-action:none';
    const title = document.createElement('strong'); title.textContent = 'POKÉDEX  //  TRAINER'; header.append(title);
    const minimize = document.createElement('button'); minimize.type = 'button'; minimize.style.cssText = 'cursor:pointer;padding:2px 8px';
    const minimized = localStorage.getItem('ps-trainer-minimized') === 'true';
    minimize.textContent = minimized ? '+' : '−'; minimize.title = minimized ? 'Expand trainer' : 'Minimize trainer';
    header.append(minimize); panel.append(header);
    const content = document.createElement('div'); panel.append(content);
    content.style.display = minimized ? 'none' : 'block';
    minimize.onclick = () => {
      const collapse = content.style.display !== 'none';
      content.style.display = collapse ? 'none' : 'block';
      minimize.textContent = collapse ? '+' : '−';
      minimize.title = collapse ? 'Expand trainer' : 'Minimize trainer';
      localStorage.setItem('ps-trainer-minimized', String(collapse));
    };
    header.addEventListener('pointerdown', e => {
      if (e.target === minimize || e.button !== 0) return;
      e.preventDefault();
      const rect = panel.getBoundingClientRect();
      const offsetX = e.clientX - rect.left, offsetY = e.clientY - rect.top;
      header.setPointerCapture(e.pointerId);
      const move = ev => {
        const x = Math.max(0, Math.min(ev.clientX - offsetX, window.innerWidth - panel.offsetWidth));
        const y = Math.max(0, Math.min(ev.clientY - offsetY, window.innerHeight - header.offsetHeight));
        panel.style.left = x + 'px'; panel.style.top = y + 'px'; panel.style.right = 'auto';
      };
      const stop = () => {
        header.removeEventListener('pointermove', move);
        header.removeEventListener('pointerup', stop);
        header.removeEventListener('pointercancel', stop);
        localStorage.setItem('ps-trainer-position', JSON.stringify({x:parseFloat(panel.style.left) || 0,y:parseFloat(panel.style.top) || 0}));
      };
      header.addEventListener('pointermove', move);
      header.addEventListener('pointerup', stop);
      header.addEventListener('pointercancel', stop);
    });
    const godRow = document.createElement('div'); godRow.style.marginTop = '12px';
    const godBox = document.createElement('input'); godBox.type = 'checkbox'; godBox.checked = god;
    const godLabel = document.createElement('label'); godLabel.append(godBox, document.createTextNode(' God mode (experimental)')); godRow.append(godLabel); content.append(godRow);
    const row = document.createElement('div'); row.style.marginTop = '12px';
    const label = document.createElement('label'); label.textContent = 'Damage multiplier: ×';
    const input = document.createElement('input'); input.type = 'number'; input.min = '1'; input.max = '1000'; input.step = '1'; input.value = String(multiplier); input.style.cssText = 'width:75px;margin-left:6px;padding:4px';
    row.append(label, input); content.append(row);
    const speedRow = document.createElement('div'); speedRow.style.marginTop = '12px';
    const speedLabel = document.createElement('label'); speedLabel.textContent = 'Movement speed: ×';
    const speedInput = document.createElement('input'); speedInput.type = 'number'; speedInput.min = '1'; speedInput.max = '20'; speedInput.step = '0.5'; speedInput.value = String(speed); speedInput.style.cssText = 'width:75px;margin-left:6px;padding:4px';
    speedRow.append(speedLabel, speedInput); content.append(speedRow);
    const candyRow = document.createElement('div'); candyRow.style.marginTop = '12px';
    const candyLabel = document.createElement('label'); candyLabel.textContent = 'Candy Corn pickups: ×';
    const candyInput = document.createElement('input'); candyInput.type = 'number'; candyInput.min = '1'; candyInput.max = '100'; candyInput.step = '1'; candyInput.value = String(candy); candyInput.style.cssText = 'width:75px;margin-left:6px;padding:4px';
    candyRow.append(candyLabel, candyInput); content.append(candyRow);
    const candyNote = document.createElement('div'); candyNote.textContent = 'Multiplies Candy Corn credited by the local game worker and included in the run result. The server may still validate the final reward.'; candyNote.style.cssText = 'font-size:11px;color:#fbbf24;margin-top:5px;max-width:240px'; content.append(candyNote);
    const apply = document.createElement('button'); apply.textContent = desktopClient ? 'Save settings' : 'Save & reload'; apply.style.cssText = 'margin-top:10px;padding:6px 12px;cursor:pointer';
    apply.onclick = () => {
      const n = Number(input.value);
      if (!Number.isInteger(n) || n < 1 || n > 1000) {status='Choose a whole number from 1 to 1000';update();return;}
      const sp = Number(speedInput.value);
      if (!Number.isFinite(sp) || sp < 1 || sp > 20) {status='Choose movement speed from 1 to 20';update();return;}
      const ca = Number(candyInput.value);
      if (!Number.isInteger(ca) || ca < 1 || ca > 100) {status='Choose Candy Corn multiplier from 1 to 100';update();return;}
      localStorage.setItem('ps-candy-multiplier', String(ca));
      localStorage.setItem('ps-speed-multiplier', String(sp));
      localStorage.setItem('ps-damage-multiplier', String(n));
      localStorage.setItem('ps-trainer-god', String(godBox.checked));
      if (desktopClient) {
        status = 'Settings saved. Press Run in the client once to apply them.';
        update();
      } else location.reload();
    };
    content.append(apply);
    const note = document.createElement('div'); note.id='ps-damage-status'; note.textContent=status; note.style.cssText='font-size:11px;color:#cbd5e1;margin-top:12px;max-width:240px'; content.append(note);
    const hint = document.createElement('div'); hint.textContent='Drag the title to move; use − to minimize. F8 toggles menu.'; hint.style.cssText='font-size:11px;color:#fbbf24;margin-top:8px'; content.append(hint);
    const hide = document.createElement('button'); hide.textContent='Hide (F8)'; hide.style.cssText='margin-top:8px'; hide.onclick=()=>panel.remove(); content.append(hide);

    // AFK controls: DOM-driven automation. Does not alter account inventory or send API calls.
    const tabs = document.createElement('div');
    tabs.style.cssText = 'display:flex;gap:6px;margin-top:10px';
    const cheatTab = document.createElement('button'); cheatTab.textContent = 'Cheats';
    const afkTab = document.createElement('button'); afkTab.textContent = 'AFK Farm';
    for (const b of [cheatTab, afkTab]) b.style.cssText='flex:1;padding:6px;cursor:pointer';
    tabs.append(cheatTab,afkTab);
    content.prepend(tabs);
    const cheatContent = document.createElement('div');
    while (tabs.nextSibling) cheatContent.append(tabs.nextSibling);
    content.append(cheatContent);
    const afkContent = document.createElement('div');
    afkContent.style.display='none'; afkContent.style.marginTop='10px';
    content.append(afkContent);
    const switchTab = name => {
      cheatContent.style.display = name==='cheats'?'block':'none';
      afkContent.style.display = name==='afk'?'block':'none';
      cheatTab.style.fontWeight = name==='cheats'?'bold':'normal';
      afkTab.style.fontWeight = name==='afk'?'bold':'normal';
      localStorage.setItem('ps-active-tab',name);
    };
    cheatTab.onclick=()=>switchTab('cheats'); afkTab.onclick=()=>switchTab('afk');
    const addText=(value)=>{const d=document.createElement('div');d.textContent=value;d.style.cssText='font-size:11px;color:#cbd5e1;margin:8px 0';afkContent.append(d);return d;};
    const addCheck=(label,key,def)=>{
      const l=document.createElement('label');l.style.cssText='display:block;margin:8px 0';
      const cb=document.createElement('input');cb.type='checkbox';cb.checked=localStorage.getItem(key)===null?def:localStorage.getItem(key)==='true';
      cb.onchange=()=>localStorage.setItem(key,String(cb.checked));l.append(cb,document.createTextNode(' '+label));afkContent.append(l);return cb;
    };
    addText('Pokémon name (must already be owned):');
    const monInput=document.createElement('input');monInput.placeholder='e.g. Crobat';monInput.value=localStorage.getItem('ps-afk-mon')||'';
    monInput.style.cssText='box-sizing:border-box;width:100%;padding:6px';
    monInput.onchange=()=>localStorage.setItem('ps-afk-mon',monInput.value.trim());afkContent.append(monInput);
    const scanBtn=document.createElement('button');scanBtn.textContent='List visible Pokémon';scanBtn.style.cssText='margin-top:6px;padding:5px';afkContent.append(scanBtn);
    const monSelect=document.createElement('select');monSelect.style.cssText='display:block;width:100%;margin-top:6px;padding:5px';afkContent.append(monSelect);
    scanBtn.onclick=()=>{
      monSelect.replaceChildren();
      const labels=[...document.querySelectorAll('button,[role="button"],img[alt]')]
        .filter(e=>!panel.contains(e)).map(e=>(e.getAttribute('alt')||e.textContent||'').trim())
        .filter(x=>x.length>1&&x.length<45&&!/^(play|normal|waves|sort|all)$/i.test(x));
      [...new Set(labels)].slice(0,120).forEach(x=>{const opt=document.createElement('option');opt.value=x;opt.textContent=x;monSelect.append(opt);});
      afkStatus.textContent=monSelect.options.length?'Select a visible Pokémon, or type its name.':'Open Pokémon selection first, then scan.';
    };
    monSelect.onchange=()=>{monInput.value=monSelect.value;localStorage.setItem('ps-afk-mon',monInput.value);};
    const modeLabel=document.createElement('label');modeLabel.textContent='Run mode: ';afkContent.append(modeLabel);
    const modeSelect=document.createElement('select');
    for(const [v,t] of [['waves','Halloween Waves'],['normal','Normal Solo']]){const o=document.createElement('option');o.value=v;o.textContent=t;modeSelect.append(o);}
    modeSelect.value=localStorage.getItem('ps-afk-mode')||'waves';modeSelect.onchange=()=>localStorage.setItem('ps-afk-mode',modeSelect.value);
    modeLabel.append(modeSelect);
    const restart=addCheck('Auto-start / restart runs','ps-afk-restart',true);
    const upgrades=addCheck('Auto-select upgrades','ps-afk-upgrades',true);
    addText('Upgrade strategy:');
    const strategy=document.createElement('select');
    [['damage','Damage'],['speed','Speed'],['tank','Survivability'],['balanced','Balanced'],['random','Random'],['custom','Custom priorities']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;strategy.append(o)});
    strategy.value=localStorage.getItem('ps-afk-strategy')||'damage';strategy.onchange=()=>localStorage.setItem('ps-afk-strategy',strategy.value);
    strategy.style.cssText='width:100%;padding:5px';afkContent.append(strategy);
    addText('Preferred upgrade names (comma-separated; first = highest priority):');
    const preferred=document.createElement('input');preferred.placeholder='e.g. Quick Attack, Sprint';preferred.value=localStorage.getItem('ps-afk-preferred')||'';
    preferred.style.cssText='width:100%;box-sizing:border-box;padding:5px';preferred.oninput=()=>localStorage.setItem('ps-afk-preferred',preferred.value);afkContent.append(preferred);
    addText('Never pick (comma-separated names):');
    const blocked=document.createElement('input');blocked.placeholder='e.g. Body Slam';blocked.value=localStorage.getItem('ps-afk-blocked')||'';
    blocked.style.cssText='width:100%;box-sizing:border-box;padding:5px';blocked.oninput=()=>localStorage.setItem('ps-afk-blocked',blocked.value);afkContent.append(blocked);
    const reroll=addCheck('Reroll if no preferred upgrade appears','ps-afk-reroll',false);
    const delayLabel=addText('Selection delay: 1.2 seconds');
    const delay=document.createElement('input');delay.type='range';delay.min='0';delay.max='5000';delay.step='250';delay.value=localStorage.getItem('ps-afk-delay')||'1200';
    delay.oninput=()=>{localStorage.setItem('ps-afk-delay',delay.value);delayLabel.textContent='Selection delay: '+(Number(delay.value)/1000).toFixed(2)+' seconds'};
    delayLabel.textContent='Selection delay: '+(Number(delay.value)/1000).toFixed(2)+' seconds';afkContent.append(delay);
    const movement=addCheck('Auto movement (experimental)','ps-afk-movement',false);
    addText('Auto-select reads visible upgrade cards. Damage/Speed/Tank scoring is heuristic; custom names override it. Works by clicking visible game controls. Auto movement uses synthetic keyboard events and may not be accepted by the game.');
    const afkStatus=addText('Stopped');
    const afkControls=document.createElement('div');afkControls.style.cssText='display:flex;gap:8px';afkContent.append(afkControls);
    const startBtn=document.createElement('button');startBtn.textContent='Start AFK';startBtn.style.cssText='padding:7px;flex:1';
    const stopBtn=document.createElement('button');stopBtn.textContent='Stop';stopBtn.style.cssText='padding:7px;flex:1';
    afkControls.append(startBtn,stopBtn);
    let timer=null, step=0, runs=0, lastAction=0, pressed=null, choiceSince=0, choiceKey="";
    const clickable=()=>[...document.querySelectorAll('button,[role="button"],a')].filter(el=>!panel.contains(el)&&el.getClientRects().length&&!el.disabled);
    const findButton=(pattern)=>clickable().find(el=>pattern.test((el.textContent||'').trim()));
    const doClick=(el)=>{if(!el||Date.now()-lastAction<1800)return false;lastAction=Date.now();el.click();return true;};
    const release=()=>{if(!pressed)return;for(const type of ['keyup'])window.dispatchEvent(new KeyboardEvent(type,{key:pressed,code:'Key'+pressed.toUpperCase(),bubbles:true}));pressed=null;};
    const tick=()=>{
      if(!timer)return;
      const text=document.body.innerText||'';
      const end=/you fell|back to menu|run complete|victory/i.test(text);
      if(end&&restart.checked){if(doClick(findButton(/back to menu|return to menu|continue/i)))runs++;}
      else if(upgrades.checked && document.querySelectorAll('button.ps-card[data-testid^="option-"]').length){
        const cards=[...document.querySelectorAll('button.ps-card[data-testid^="option-"]')].filter(el=>el.getClientRects().length&&!el.disabled);
        const heading=cards[0]?.parentElement?.parentElement?.querySelector('h2')?.textContent||'';
        const key=heading+'|'+cards.map(c=>c.textContent.trim()).join('|');
        if(key!==choiceKey){choiceKey=key;choiceSince=Date.now();}
        if(cards.length && Date.now()-choiceSince>=Number(delay.value)){
          const prefs=preferred.value.toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
          const bans=blocked.value.toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
          const ranked=cards.map((el,index)=>{
            const name=(el.querySelector('.nm')?.textContent||el.textContent||'').toLowerCase();
            const desc=(el.querySelector('.ds')?.textContent||'').toLowerCase();
            const text=name+' '+desc;
            if(bans.some(b=>name.includes(b)))return {el,score:-100000,index};
            let score=0;
            const p=prefs.findIndex(x=>name.includes(x));
            if(p>=0)score+=10000-p*500;
            const mode=strategy.value;
            if(mode==='random')score+=Math.random()*100;
            else if(mode==='damage'){
              if(/attack|damage|power|critical|crit|projectile|cooldown|quick attack|body slam|evolution/.test(text))score+=250;
              if(/speed|sprint|health|defense|armor|hp/.test(text))score-=40;
            }else if(mode==='speed'){
              if(/speed|sprint|haste|cooldown|movement|quick attack/.test(text))score+=250;
            }else if(mode==='tank'){
              if(/health|hp|defense|armor|shield|heal|regen|resist/.test(text))score+=250;
            }else if(mode==='balanced'){
              if(/upgrade|level|rare|epic|evolution/.test(text))score+=120;
            }
            if(/epic|legendary|unique/.test(text))score+=80;
            else if(/rare/.test(text))score+=35;
            if(/evolution/.test(text))score+=150;
            return {el,score,index};
          }).sort((a,b)=>b.score-a.score||a.index-b.index);
          const best=ranked[0];
          const rerollBtn=document.querySelector('button[data-testid="reroll"]');
          if(best && reroll.checked && prefs.length && !ranked.some(x=>x.score>=10000) && rerollBtn && !rerollBtn.disabled){
            if(doClick(rerollBtn)){choiceSince=Date.now();choiceKey='';}
          }else if(best && best.score>-100000){
            if(doClick(best.el)){choiceSince=Date.now();choiceKey='';}
          }
        }
      } else if(restart.checked){
        const wanted=monInput.value.trim().toLowerCase();
        const play=findButton(/^play$/i);
        if(play){
          if(wanted){const mon=clickable().find(el=>(el.textContent||'').trim().toLowerCase()===wanted);if(mon)doClick(mon);}
          if(Date.now()-lastAction>1900)doClick(play);
        }else if(modeSelect.value==='waves') doClick(findButton(/play waves/i));
        else doClick(findButton(/^solo$/i));
      }
      if(movement.checked&&/canvas/i.test([...document.querySelectorAll('canvas')].map(x=>x.tagName).join(' '))){
        const keys=['w','d','s','a']; const next=keys[Math.floor(step++/3)%4];
        if(next!==pressed){release();pressed=next;window.dispatchEvent(new KeyboardEvent('keydown',{key:next,code:'Key'+next.toUpperCase(),bubbles:true}));}
      }else release();
      afkStatus.textContent='Running · completed/restarted: '+runs+' · '+(movement.checked?'movement experimental':'movement off');
    };
    startBtn.onclick=()=>{if(timer)return;localStorage.setItem('ps-afk-mon',monInput.value.trim());timer=setInterval(tick,1200);afkStatus.textContent='Running. Keep this tab open.';};
    stopBtn.onclick=()=>{if(timer)clearInterval(timer);timer=null;release();afkStatus.textContent='Stopped · completed/restarted: '+runs;};
    window.addEventListener('pagehide',()=>{if(timer)clearInterval(timer);release();});
    // Scoped theme: never changes game controls outside the trainer.
    const theme = document.createElement('style');
    theme.textContent = `
      #ps-damage-panel.ps-pokedex {
        --pd-red:#e94046; --pd-dark:#172331; --pd-screen:#cce8db; --pd-ink:#153b3a;
        box-sizing:border-box !important; width:340px !important; min-width:300px !important;
        max-width:min(360px,calc(100vw - 16px)) !important;
        max-height:calc(100vh - 20px) !important; overflow-y:auto !important;
        padding:0 14px 16px !important; color:#f4f7f5 !important;
        border:4px solid #941e2b !important; border-bottom:9px solid #8e1d29 !important;
        border-radius:19px 19px 23px 23px !important;
        background:linear-gradient(145deg,#fb5556 0%,#d82e3e 43%,#b92135 100%) !important;
        box-shadow:inset 2px 2px 0 #ff9b95,inset -3px -3px 0 #7e1b2c,0 16px 35px #0009 !important;
        font:12px/1.45 'Trebuchet MS',Verdana,sans-serif !important;
        scrollbar-width:thin; scrollbar-color:#771e2d #df3947;
      }
      #ps-damage-panel.ps-pokedex *,#ps-damage-panel.ps-pokedex *::before,#ps-damage-panel.ps-pokedex *::after {box-sizing:border-box}
      #ps-damage-panel.ps-pokedex > div:first-of-type {
        min-height:73px; padding:13px 4px 12px 63px !important; margin:0 -3px 12px !important;
        border-bottom:3px solid #8d2231; position:relative;
      }
      #ps-damage-panel.ps-pokedex > div:first-of-type::before {
        content:'';position:absolute;left:5px;top:10px;width:43px;height:43px;
        border:5px solid #f2f8fb;border-radius:50%;
        background:radial-gradient(circle at 35% 27%,#e6ffff 0 12%,#69caff 28%,#1479ca 70%,#074775 100%);
        box-shadow:0 0 0 3px #6d202d,0 0 12px #84e8ff;
      }
      #ps-damage-panel.ps-pokedex > div:first-of-type::after {
        content:'';position:absolute;left:58px;top:13px;width:9px;height:9px;
        background:#f3545a;border:2px solid #83222e;border-radius:50%;
        box-shadow:15px 0 #ffdb56,30px 0 #5bd49a;
      }
      #ps-damage-panel.ps-pokedex > div:first-of-type strong {
        display:block;padding-top:14px;color:#fff !important;font-size:13px !important;
        font-weight:900;letter-spacing:1.2px;text-shadow:1px 2px #872331;
      }
      #ps-damage-panel.ps-pokedex > div:first-of-type button {
        background:#b72235 !important;color:white !important;border:2px solid #821d2d !important;
        border-radius:7px !important;min-width:29px;height:29px;font-weight:bold;
      }
      #ps-damage-panel.ps-pokedex > div:nth-of-type(2) {
        background:#1b2934 !important;border:5px solid #e6e5db !important;
        border-radius:13px 13px 22px 13px !important;
        padding:12px !important;box-shadow:0 5px 0 #7e1c2c, inset 0 0 0 2px #0b141c;
      }
      #ps-damage-panel.ps-pokedex > div:nth-of-type(2) > div:first-child {
        margin-top:0 !important;margin-bottom:12px !important;display:flex !important;
        background:#0c1721;padding:4px !important;border-radius:8px;gap:5px !important;
      }
      #ps-damage-panel.ps-pokedex button,#ps-damage-panel.ps-pokedex select,
      #ps-damage-panel.ps-pokedex input:not([type=checkbox]):not([type=range]) {
        font:inherit !important; border-radius:5px !important;
      }
      #ps-damage-panel.ps-pokedex button {
        background:#e7ece8 !important;color:#263d42 !important;
        border:2px solid #9aafb0 !important;box-shadow:0 2px 0 #53666b;
        padding:7px 9px !important;cursor:pointer !important;font-weight:800 !important;
      }
      #ps-damage-panel.ps-pokedex button:hover {filter:brightness(1.08)}
      #ps-damage-panel.ps-pokedex button:active {transform:translateY(1px);box-shadow:none}
      #ps-damage-panel.ps-pokedex input:not([type=checkbox]):not([type=range]),
      #ps-damage-panel.ps-pokedex select {
        background:#d6eadf !important;color:#193d39 !important;
        border:2px solid #759c91 !important;padding:7px 8px !important;
        min-height:32px;max-width:100%;outline-offset:2px;
      }
      #ps-damage-panel.ps-pokedex input[type=number] {width:95px !important;margin-left:0 !important}
      #ps-damage-panel.ps-pokedex input[type=checkbox] {accent-color:#5fc7e5;width:16px;height:16px;vertical-align:middle}
      #ps-damage-panel.ps-pokedex input[type=range] {width:100%;accent-color:#62d3dc}
      #ps-damage-panel.ps-pokedex label {color:#f5f6ec !important;line-height:1.8}
      #ps-damage-panel.ps-pokedex #ps-damage-status {background:#b9ddcc;color:#204940 !important;border-radius:6px;padding:8px;max-width:none !important;word-break:break-word}
      #ps-damage-panel.ps-pokedex > div:nth-of-type(2)::after {
        content:'●  SYSTEM ONLINE       ◉  POKÉDEX v1.8';display:block;
        color:#83d9b3;font-size:9px;letter-spacing:1px;margin-top:12px;text-align:center;
      }
    `;
    document.head.append(theme);
    switchTab(localStorage.getItem('ps-active-tab')==='afk'?'afk':'cheats');

    document.body.append(panel);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showMenu, {once:true}); else showMenu();
  document.addEventListener('keydown', e => {
    if (e.key !== 'F8' || e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
    e.preventDefault();
    e.stopPropagation();
    const panel = document.getElementById('ps-damage-panel');
    if (panel) panel.remove();
    else showMenu();
  }, true);
})();
