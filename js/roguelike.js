'use strict';
function resetRun(){
  const baseHp = powers().maxHp;
  run = { hp:baseHp, maxHp:baseHp, gold:0, stage:0, pipesInStage:0, totalPipes:0, upgrades:[], relics:[], legends:[], vampUsed:0, bloodUsed:0, phaseCount:0, boss:null, path:1 };
  if(skinById(save.selected).id === 'demon') run.upgrades.push('vampire','vampire');
  if(skinById(save.selected).id === 'alien') run.upgrades.push('midas','midas','midas');
  stageClearT = 0;
  pendingDraft = null;
chestReward = null;
  chestOpened = false;
  map = null;
}

function hasUpgrade(id){ return run && run.upgrades.includes(id); }
function hasRelic(id){ return run && run.relics.includes(id); }

function mods(){
  const pw = powers();
  const m = { grav:pw.grav, speed:pw.speed, mult:pw.mult, bonus:pw.bonus||0, shield:pw.shield, feverEvery:30, maxHp:pw.maxHp, radius:pw.radius, magnet:pw.magnet, god:pw.god, roll:pw.roll };
  if(run){
    for(const u of run.upgrades){
      if(u==='feather') m.grav *= 0.9;
      if(u==='midas') m.bonus += 1;
      if(u==='shield') m.shield += 1;
      if(u==='chip') m.feverEvery -= 10;
      if(u==='slow') m.speed *= 0.9;
      if(u==='tough') m.maxHp += 1;
    }
    for(const r of run.relics){
      if(r==='prism') m.speed *= 0.85;
      if(r==='star') m.maxHp += 1;
    }
    m.grav = Math.max(0.5, m.grav);
    m.speed = Math.max(0.6, m.speed);
    m.feverEvery = Math.max(10, m.feverEvery);
  }
  return m;
}

function refreshRlHud(){
  show('#rlHud', !!run);
  show('#runItems', !!run);
  if(!run) return;
  const maxHp = mods().maxHp;
  const heartsEl = $('#rlHearts');
  if(maxHp > 12){
    heartsEl.textContent = '♥ ' + Math.max(0, run.hp) + '/' + maxHp;
    heartsEl.style.fontSize = '';
  } else {
    heartsEl.textContent = '♥'.repeat(Math.max(0, run.hp)) + '♡'.repeat(Math.max(0, maxHp - run.hp));
    heartsEl.style.fontSize = maxHp > 9 ? '10px' : maxHp > 6 ? '12px' : '';
  }
  $('#rlGold').textContent = '🪙' + run.gold;
  $('#rlStage').textContent = T('stage') + ' ' + Math.max(1, run.stage);
  renderRunItems();
}

function renderRunItems(){
  for(const el of [$('#runItems'), $('#merchRunItems'), $('#draftRunItems')]){
    if(!el) continue;
    el.innerHTML = '';
    renderItemsInto(el);
  }
}

function renderItemsInto(el){
  const add = (icon, name, desc, badge) => {
    const s = document.createElement('span');
    s.className = 'itemIcon';
    s.textContent = icon;
    if(badge){ const b = document.createElement('span'); b.className = 'itemBadge'; b.textContent = badge; s.appendChild(b); }
    if(canHover){
      s.addEventListener('mouseenter', () => showTip(s, name, desc));
      s.addEventListener('mouseleave', hideTip);
    } else {
      s.addEventListener('touchstart', () => {
        if(tipCard === s) hideTip();
        else showTip(s, name, desc);
      }, { passive:true });
    }
    el.appendChild(s);
  };
  const counts = {};
  for(const u of run.upgrades) counts[u] = (counts[u]||0)+1;
  for(const id in counts){
    const c = CARDS.find(x => x.id === id);
    if(c){
      const n = id === 'shield' ? shield : counts[id];
      add(c.icon, c.name + (counts[id] > 1 ? ' ×' + counts[id] : ''), c.desc, n);
    }
  }
  for(const r of run.relics){
    const rel = RELICS.find(x => x.id === r);
    if(rel) add(rel.icon, rel.name, rel.desc);
  }
  for(const l of (run.legends || [])){
    const info = legendInfo(l);
    add(info.icon, info.name, info.desc);
  }
}

function rollCards(){
  const pool = CARDS.filter(c => !c.p2 || (run && run.path === 2)).slice(), picks = [];
  while(picks.length < 3 && pool.length){
    picks.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  }
  return picks;
}

function renderCards(grid, cards, clickable){
  grid.innerHTML = '';
  for(const c of cards){
    const el = document.createElement('button');
    el.className = 'draftCard';
    const owned = run ? run.upgrades.filter(u => u === c.id).length : 0;
    el.innerHTML = `<span class="dcName">${c.icon ? c.icon + ' ' : ''}${c.name}</span><span class="dcDesc">${c.desc}</span>` +
      (owned ? `<span class="dcOwned">${T('ownedBadge').replace('{n}', owned)}</span>` : '');
    if(clickable) el.addEventListener('click', () => {
      const now = performance.now();
      if(now - draftGuardT < 400){ draftGuardT = now; return; }
      draftGuardT = now;
      pickCard(c.id);
    });
    else el.disabled = true;
    grid.appendChild(el);
  }
}

function openDraft(cards){
  state = 'draft';
  draftGuardT = performance.now();
  renderCards($('#draftCards'), cards || rollCards(), true);
  show('#draft', true);
}

let merchOffers = [];
function openMerchant(){
  state = 'shop';
  luckyUsed = false;
  pendingDraft = rollCards();
  const pool = ['heal','shield','tough','chip','coin','reroll'].concat(run.path === 2 ? ['phoenix','anchor'] : []);
  merchOffers = pool.sort(() => Math.random() - 0.5).slice(0, 3);
  refreshMerchant();
  show('#merchant', true);
}

const MERCH_BASE = { heal:15, shield:25, tough:30, chip:25, coin:20, phoenix:40, anchor:35, reroll:10 };
function merchPrice(key){
  const base = MERCH_BASE[key];
  return hasLegend('favor') ? (key === 'reroll' ? 0 : Math.ceil(base/2)) : base;
}
function refreshMerchant(){
  $('#merchantGold').textContent = '🪙 ' + run.gold;
  $('#merchHeal').disabled = run.hp >= mods().maxHp || run.gold < merchPrice('heal');
  $('#merchShield').disabled = run.gold < merchPrice('shield');
  $('#merchTough').disabled = run.gold < merchPrice('tough');
  $('#merchChip').disabled = run.gold < merchPrice('chip');
  $('#merchCoin').disabled = run.gold < merchPrice('coin') || luckyUsed;
  show('#merchHeal', merchOffers.includes('heal'));
  show('#merchShield', merchOffers.includes('shield'));
  show('#merchTough', merchOffers.includes('tough'));
  show('#merchChip', merchOffers.includes('chip'));
  show('#merchCoin', merchOffers.includes('coin'));
  show('#merchPhoenix', merchOffers.includes('phoenix'));
  $('#merchPhoenix').disabled = run.gold < merchPrice('phoenix') || run.relics.includes('phoenix');
  show('#merchAnchor', merchOffers.includes('anchor'));
  $('#merchAnchor').disabled = run.gold < merchPrice('anchor') || run.relics.includes('anchor');
  show('#merchReroll', merchOffers.includes('reroll'));
  $('#merchReroll').disabled = run.gold < merchPrice('reroll');
  if(hasLegend('favor')){
    const s = (sel, txt) => { $(sel).querySelector('.dcDesc').textContent = txt; };
    s('#merchHeal', merchPrice('heal') + 'g');
    s('#merchShield', T('shieldDesc').replace('25g', merchPrice('shield') + 'g'));
    s('#merchTough', T('toughDesc').replace('30g', merchPrice('tough') + 'g'));
    s('#merchChip', T('chipDesc').replace('25g', merchPrice('chip') + 'g'));
    s('#merchCoin', T('coinDesc').replace('20g', merchPrice('coin') + 'g'));
    s('#merchPhoenix', T('phoenixDesc').replace('40g', merchPrice('phoenix') + 'g'));
    s('#merchAnchor', T('anchorDesc').replace('35g', merchPrice('anchor') + 'g'));
    s('#merchReroll', lang === 'pt' ? 'Grátis!' : 'Free!');
  }
  renderCards($('#merchantDraft'), pendingDraft, false);
}

function gainUpgrade(id){
  const first = !run.upgrades.includes(id);
  run.upgrades.push(id);
  if(first){ const c = CARDS.find(x=>x.id===id); if(c) showToast(c.icon + ' ' + c.name + ' — ' + c.desc); }
}

function gainRelic(id){
  const rel = RELICS.concat(RELICS2, RELICS3).find(x=>x.id===id);
  if(!rel || run.relics.includes(id)) return false;
  run.relics.push(id);
  showToast(rel.icon + ' ' + rel.name + ' — ' + rel.desc);
  return true;
}

function pickCard(id){
  AudioFX.click();
  gainUpgrade(id);
  if(id === 'tough'){ run.maxHp++; }
  if(id === 'titan'){ run.maxHp++; run.hp = Math.min(run.maxHp, run.hp + 1); shield++; }
  if(id === 'shield'){ shield++; }
  show('#draft', false);
  refreshRlHud();
  showMap();
}

const PATHS = [
  null,
  { rows:16, widths:[2,2,3,2,3,2,3,2,3,2,3,2,3,2,2,1], bossRows:[3,7,11] },
  { rows:14, widths:[2,2,3,2,3,2,3,2,3,2,3,2,2,1], bossRows:[3,7,11] },
  { rows:16, widths:[2,2,3,2,3,2,3,2,3,2,3,2,3,2,2,1], bossRows:[3,7,11] }
];
function pathCfg(){ return PATHS[run.path || 1]; }
const BOSSES = [
  [ { name:'GAPLORD',      passes:7,  relic:'golden', colors:[150,45,80, 90,20,50, 210,80,120], eye:'#ff8090', phases:[{pattern:'sine', amp:120, spd:2.2}] },
    { name:'PIPESNAKE',    passes:6,  relic:'golden', colors:[40,120,50, 20,80,30, 110,200,110], eye:'#70ff90', phases:[{pattern:'zigzag', amp:100, spd:2.4}] } ],
 [ { name:'GAPLORD II',   passes:8, relic:'heart',  colors:[120,50,160, 80,30,110, 180,110,220], eye:'#c070ff', phases:[{pattern:'sine', amp:120, spd:2.6},{pattern:'mirror', rate:1.0}] },
    { name:'MIDNIGHT',     passes:8, relic:'heart',  colors:[30,50,90, 15,30,60, 70,110,170], eye:'#70a0ff', phases:[{pattern:'squeeze', spd:2.4},{pattern:'step', spd:1.4, tele:0.4}] } ],
  [ { name:'GAPLORD III',  passes:10,  relic:'coin',   colors:[200,90,30, 140,60,20, 240,150,70], eye:'#ffb040', phases:[{pattern:'sine', amp:130, spd:3.0},{pattern:'pulse', spd:3.2}] },
    { name:'STORMFEATHER', passes:10,  relic:'coin',   colors:[20,110,130, 10,70,90, 90,210,230], eye:'#60e0ff', phases:[{pattern:'zigzag', amp:120, spd:3.2},{pattern:'hunt', rate:1.2, amp:90}] } ],
  [ { name:'FINAL BOSS',   passes:14, relic:'prism',  colors:[45,45,55, 25,25,35, 90,90,110], eye:'#ffd700', phases:[{pattern:'sine', amp:120, spd:2.4},{pattern:'mirror', rate:1.1},{pattern:'pulse', spd:3.6}] },
    { name:'THE ENDLESS',  passes:17, relic:'prism',  colors:[70,20,30, 40,10,20, 150,50,70], eye:'#ff4050', phases:[{pattern:'squeeze', spd:3.0},{pattern:'hunt', rate:1.4, amp:100},{pattern:'labyrinth', amp:260, spd:2.8, bspd:1.9, fog:true}] } ],
];
const ELITES = [
  { name:'ELITE',   passes:6, colors:[30,140,90, 15,90,60, 90,222,150], eye:'#40ff90', phases:[{pattern:'drift', spd:70}] },
  { name:'BRUISER', passes:8, colors:[140,60,40, 90,35,25, 200,110,80], eye:'#ff9070', phases:[{pattern:'shrink', rate:0.08}] },
  { name:'DART',    passes:4, colors:[160,140,30, 110,95,20, 230,200,70], eye:'#ffe060', phases:[{pattern:'step', spd:1.2, tele:0.35}] },
  { name:'PHANTOM', passes:6, colors:[90,60,140, 55,35,95, 150,110,210], eye:'#c090ff', phases:[{pattern:'blink', spd:1.0, tele:0.3}] },
];
const BOSSES2 = [
  [ { name:'GAPLORD IV',   passes:11,  relic:'anchor',  colors:[20,110,140, 10,70,90, 80,200,230], eye:'#40e0ff', phases:[{pattern:'pulse', spd:3.4},{pattern:'drift', spd:80}] },
    { name:'TIDEWRAITH',   passes:11,  relic:'anchor',  colors:[15,80,110, 8,50,75, 60,170,200], eye:'#50d0e0', phases:[{pattern:'zigzag', amp:130, spd:3.0},{pattern:'blink', spd:1.1, tele:0.35}] } ],
  [ { name:'GAPLORD V',    passes:12, relic:'phoenix', colors:[150,30,60, 90,15,35, 230,70,110], eye:'#ff5070', phases:[{pattern:'sine', amp:150, spd:3.4},{pattern:'mirror', rate:1.4},{pattern:'pulse', spd:4.0}] },
    { name:'EMBERLORD',    passes:12, relic:'phoenix', colors:[170,70,20, 110,45,15, 240,130,50], eye:'#ff9040', phases:[{pattern:'squeeze', spd:3.6},{pattern:'hunt', rate:1.4, amp:100}] } ],
  [ { name:'THE WARDEN',   passes:12, relic:'void',    colors:[110,95,60, 70,60,40, 180,160,110], eye:'#ffe9a0', phases:[{pattern:'pulse', spd:3.8},{pattern:'labyrinth', amp:260, spd:2.6, bspd:1.7},{pattern:'mirror', rate:1.6}] },
    { name:'NULLKNIGHT',   passes:12, relic:'void',    colors:[70,70,85, 45,45,55, 130,130,150], eye:'#b0b0d0', phases:[{pattern:'hunt', rate:1.5, amp:100},{pattern:'labyrinth', amp:260, spd:2.8, bspd:1.9}] } ],
  [ { name:'VOIDLORD',     passes:17, relic:'prism',   colors:[60,30,90, 35,15,55, 130,70,190], eye:'#e0b0ff', phases:[{pattern:'sine', amp:160, spd:3.6},{pattern:'wind', g:1.2},{pattern:'labyrinth', amp:280, spd:3.0, bspd:2.0},{pattern:'chase', rate:1.8}] },
     { name:'OMEGA GAPLORD',passes:19, relic:'prism',   colors:[200,190,160, 140,130,100, 250,240,210], eye:'#fff8d0', phases:[{pattern:'squeeze', spd:4.0},{pattern:'labyrinth', amp:280, spd:3.2, bspd:2.2},{pattern:'hunt', rate:1.8, amp:110},{pattern:'wind', g:0.8, fog:true}] } ],
 ];
const BOSSES3 = [
  [ { name:'LUNAR',       passes:12, relic:'corona',  colors:[170,175,195, 105,110,135, 225,228,245], eye:'#e8ecff', phases:[{pattern:'sine', amp:140, spd:2.8},{pattern:'pulse', spd:3.4}] } ],
  [ { name:'ASTRAEL',     passes:13, relic:'star',    colors:[200,160,60, 130,95,35, 250,210,110], eye:'#ffe9a0', phases:[{pattern:'zigzag', amp:130, spd:3.4},{pattern:'hunt', rate:1.5, amp:100},{pattern:'mirror', rate:1.6}] } ],
  [ { name:'NEBULAWN',    passes:14, relic:'comet',   colors:[140,60,160, 85,35,105, 200,120,230], eye:'#e0a0ff', phases:[{pattern:'drift', spd:90},{pattern:'labyrinth', amp:270, spd:2.8, bspd:1.9},{pattern:'blink', spd:1.2, tele:0.35}] } ],
  [ { name:'THE ECLIPSE', passes:20, relic:'singularity', colors:[40,25,50, 20,10,30, 110,70,150], eye:'#ffb040', phases:[{pattern:'sine', amp:150, spd:3.2},{pattern:'mirror', rate:1.5},{pattern:'labyrinth', amp:280, spd:3.0, bspd:2.1},{pattern:'chase', rate:2.0, fog:true}] } ],
];
const LABYRINTHS = [
  { name:'LABYRINTH', passes:7, colors:[70,90,70, 45,60,45, 140,170,140], eye:'#90ff90', phases:[{pattern:'labyrinth', amp:240, spd:2.6, bspd:1.7}] },
  { name:'CRAWL',     passes:10, colors:[60,80,50, 40,55,35, 120,150,100], eye:'#a0d080', phases:[{pattern:'labyrinth', amp:200, spd:2.2, bspd:1.4}] },
  { name:'GALE',      passes:6, colors:[80,95,110, 50,60,75, 150,175,200], eye:'#a0d0ff', phases:[{pattern:'labyrinth', amp:260, spd:3.2, bspd:2.2}] },
];
const SERPENTS = [
  { name:'SERPENT', passes:28, colors:[60,40,80, 40,25,55, 130,90,170], eye:'#b080ff' },
  { name:'VIPER',   passes:36, colors:[40,70,60, 25,45,40, 100,160,140], eye:'#70ff90' },
  { name:'MEDUSA',  passes:44, colors:[80,60,30, 55,40,20, 170,140,80], eye:'#ffd060' },
];
const NODE_ICONS = { stage:'🎯', boss:'💀', merchant:'🪙', chest:'📦', final:'👑', elite:'⚔️', labyrinth:'🌀', serpent:'🐍' };
const NODE_NAMES = { stage:'Stage — pipes & gold', boss:'Boss — big gold or LEGENDARY', merchant:'Merchant — heal, shield, HP, chip, coins, reroll', chest:'Chest — mystery reward', final:'FINAL BOSS', elite:'Elite — mini-boss, +20g + relic', labyrinth:'Labyrinth — shifting walls, +25g + relic', serpent:'Serpent — zigzag axe passage, guaranteed LEGENDARY' };
const LEGENDS = [
  { id:'bloodpact',  icon:'🩸', name:'Blood Pact',     desc:'Near-miss: +2 HP, -5 gold (once per stage)' },
  { id:'phaseshift', icon:'🌀', name:'Phase Shift',    desc:'3s invulnerability every 20 pipes' },
  { id:'favor',      icon:'🤝', name:"Merchant's Favor", desc:'Merchant items 50% off, free reroll' },
  { id:'headband',   icon:'🥷', name:'Ninja Headband',   desc:'35% chance to roll-dodge pipe hits' }
];
const LEGENDS_PT = {
  bloodpact:  { name:'Pacto de Sangue',  desc:'Quase-toque: +2 PV, -5 ouro (1x por fase)' },
  phaseshift: { name:'Deslocamento',     desc:'Invulnerabilidade de 3s a cada 20 canos' },
  favor:      { name:'Favor do Mercador', desc:'Itens do mercador 50% mais baratos, reroll grátis' },
  headband:   { name:'Turbante Ninja', desc:'35% de chance de rolar e evitar o dano de canos' }
};
function legendInfo(id){
  const l = LEGENDS.find(x => x.id === id);
  const pt = LEGENDS_PT[id];
  return { icon:l.icon, name: lang === 'pt' ? pt.name : l.name, desc: lang === 'pt' ? pt.desc : l.desc };
}
function hasLegend(id){ return !!(run && run.legends && run.legends.includes(id)); }

function genMap(path){
  const cfg = PATHS[path || 1];
  const pool = (path === 2 ? BOSSES2 : (path === 3 ? BOSSES3 : BOSSES));
  const elitePool = [...ELITES].sort(() => Math.random() - 0.5);
   const labyPool = [...LABYRINTHS].sort(() => Math.random() - 0.5);
    const serpentPool = [...SERPENTS].sort(() => Math.random() - 0.5);
    let eI = 0, lI = 0, sI = 0;
  const rows = [];
  for(let r=0;r<cfg.rows;r++){
    const row = [];
    for(let i=0;i<cfg.widths[r];i++){
      let type;
    if(r === cfg.rows-1) type = 'final';
    else if(cfg.bossRows.includes(r) && Math.random() < 0.5) type = 'boss';
      if(!type){
        const roll = Math.random();
        if(cfg.widths[r] >= 2 && roll >= 0.85){
          if(path === 1 || r <= cfg.bossRows[0]) type = 'elite';
          else type = Math.random() < 0.5 ? 'labyrinth' : 'serpent';
        }
        else type = roll < 0.55 ? 'stage' : roll < 0.75 ? 'chest' : 'merchant';
      }
      row.push({ type, visited:false });
    }
    if(cfg.bossRows.includes(r) && !row.some(n => n.type === 'boss'))
      row[Math.floor(Math.random()*row.length)].type = 'boss';
    if(r >= cfg.bossRows[0] && !rows.some(row2 => row2.some(n => n.type === 'merchant')))
      row[Math.floor(Math.random()*row.length)].type = 'merchant';
    for(const n of row){
      if(n.type === 'boss'){ const g = pool[Math.floor(r/4)]; n.def = g[Math.floor(Math.random()*g.length)]; }
      else if(n.type === 'final'){ const g = pool[3]; n.def = g[Math.floor(Math.random()*g.length)]; }
      else if(n.type === 'elite') n.def = elitePool[eI++ % elitePool.length];
      else if(n.type === 'labyrinth') n.def = labyPool[lI++ % labyPool.length];
      else if(n.type === 'serpent') n.def = serpentPool[sI++ % serpentPool.length];
    }
    rows.push(row);
  }
  const edges = [];
  for(let r=0;r<cfg.rows-1;r++){
    const a = rows[r].length, b = rows[r+1].length;
    const tight = r > 0 && b > 1 && Math.random() < 0.35;
    for(let i=0;i<a;i++){
      if(tight){
        const out = Array.from({ length:a }, () => new Set());
        for(let j=0;j<b;j++) out[Math.floor(Math.random()*a)].add(j);
        for(let i=0;i<a;i++)
          while(out[i].size === 0) out[i].add(Math.floor(Math.random()*b));
        for(let i=0;i<a;i++) for(const j of out[i]) edges.push({ r, i, j });
      } else {
        for(let j=0;j<b;j++) edges.push({ r, i, j });
      }
    }
  }
  return { rows, edges, pos:{ row:-1, idx:0 }, cfg, path: path || 1, mini:false };
}

function mapXY(r, i){
  const v = map.view, cfg = map.cfg;
  const span = Math.max(1, v.end - v.start);
  return { x:(i+0.5)/cfg.widths[r]*100, y:90 - (r - v.start)*80/span };
}

function showMap(){
  state = 'map';
  const intro = map.pos.row === -1;
  const animate = intro;
  const start = Math.max(0, map.pos.row);
  const end = Math.min(map.cfg.rows - 1, Math.max(0, map.pos.row) + 4);
  map.view = { start, end };
  const box = $('#mapBox');
  box.innerHTML = '';
  const nextR = map.pos.row + 1;
  const avail = map.pos.row === -1
    ? map.rows[0].map((_, j) => j)
    : map.edges.filter(e => e.r === map.pos.row && e.i === map.pos.idx).map(e => e.j);
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  const defs = document.createElementNS(svgNS, 'defs');
  const glow = document.createElementNS(svgNS, 'filter');
  glow.setAttribute('id', 'mapGlow');
  glow.setAttribute('filterUnits', 'userSpaceOnUse');
  glow.setAttribute('x', '0'); glow.setAttribute('y', '0');
  glow.setAttribute('width', '100'); glow.setAttribute('height', '100');
  const gb = document.createElementNS(svgNS, 'feGaussianBlur');
  gb.setAttribute('stdDeviation', '1.2'); gb.setAttribute('result', 'b');
  const merge = document.createElementNS(svgNS, 'feMerge');
  const m1 = document.createElementNS(svgNS, 'feMergeNode'); m1.setAttribute('in', 'b');
  const m2 = document.createElementNS(svgNS, 'feMergeNode'); m2.setAttribute('in', 'SourceGraphic');
  merge.appendChild(m1); merge.appendChild(m2); glow.appendChild(gb); glow.appendChild(merge);
  defs.appendChild(glow); svg.appendChild(defs);
  let edgeIdx = 0, nodeIdx = 0;
  for(const e of map.edges){
    if(e.r < start || e.r >= end) continue;
    const a = mapXY(e.r, e.i), b = mapXY(e.r+1, e.j);
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
    const active = map.pos.row >= 0 && e.r === map.pos.row && e.i === map.pos.idx;
    if(active){
      line.setAttribute('class', 'mapEdge active');
      line.setAttribute('stroke', '#ffd93b');
      line.setAttribute('stroke-width', '3');
      line.setAttribute('filter', 'url(#mapGlow)');
      const dash = document.createElementNS(svgNS, 'line');
      dash.setAttribute('x1', a.x); dash.setAttribute('y1', a.y);
      dash.setAttribute('x2', b.x); dash.setAttribute('y2', b.y);
      dash.setAttribute('class', 'mapEdgeDash');
      dash.style.animationDelay = (Math.random() * 1.5) + 's';
      svg.appendChild(dash);
    } else {
      line.setAttribute('class', animate ? 'mapEdge' : 'mapEdge static');
      line.setAttribute('stroke', 'rgba(255,255,255,.16)');
      line.setAttribute('stroke-width', '1.5');
      if(animate) line.style.animationDelay = (edgeIdx++ * 0.03) + 's';
    }
    svg.appendChild(line);
  }
  box.appendChild(svg);
  if(intro){
    const startEl = document.createElement('canvas');
    startEl.width = 48; startEl.height = 48;
    startEl.className = 'mapStart';
    startEl.style.left = 'calc(50% - 24px)';
    startEl.style.bottom = '6px';
    const sc = startEl.getContext('2d');
    sc.save(); sc.translate(24,24);
    const ss = skinById(save.selected);
    if(ss.ghost) sc.globalAlpha = 0.75;
    drawBirdBody(sc, ss, 0.5, 0, false);
    sc.restore();
    box.appendChild(startEl);
  }
  for(let r=start;r<=end;r++)
    for(let i=0;i<map.rows[r].length;i++){
      const n = map.rows[r][i];
      const { x, y } = mapXY(r, i);
      const el = document.createElement('button');
      const isAvail = r === nextR && avail.includes(i);
      el.className = 'mapNode t-' + n.type + (animate ? '' : ' noIntro') + (n.visited ? ' visited' : (isAvail ? ' avail' : ''));
      el.textContent = NODE_ICONS[n.type];
      el.title = n.def ? n.def.name : nodeNames()[n.type];
      el.style.left = `calc(${x}% - 24px)`;
      el.style.top = `calc(${y}% - 24px)`;
      if(animate) el.style.animationDelay = (0.15 + nodeIdx++ * 0.04) + 's';
      if(isAvail) el.addEventListener('click', () => clickNode(r, i));
      box.appendChild(el);
    }
  if(end < map.cfg.rows - 1){
    const fog = document.createElement('div');
    fog.className = 'mapFog';
    fog.textContent = '👑 ' + (map.cfg.rows - 1 - end);
    box.appendChild(fog);
  }
  if(map.pos.row >= 0){
    const pc = document.createElement('canvas');
    pc.width = 48; pc.height = 48;
    pc.className = 'mapPlayer';
    const { x, y } = mapXY(map.pos.row, map.pos.idx);
    pc.style.left = `calc(${x}% - 24px)`;
    pc.style.top = `calc(${y}% - 24px)`;
    const pc2 = pc.getContext('2d');
    pc2.save(); pc2.translate(24,24); pc2.scale(1,1);
    const ps = skinById(save.selected);
    if(ps.ghost) pc2.globalAlpha = 0.75;
    drawBirdBody(pc2, ps, 0.5, 0, false);
    pc2.restore();
    box.appendChild(pc);
  }
  const mini = $('#mapMini');
  mini.innerHTML = '';
  show('#mapMini', map.mini);
  show('#map .card', !map.mini);
  const xOf = (r, i) => (i + 0.5) / map.cfg.widths[r] * 100;
  const yOf = r => 100 - (r + 0.5) / map.cfg.rows * 100;
  const msvg = document.createElementNS(svgNS, 'svg');
  msvg.setAttribute('viewBox', '0 0 100 100');
  msvg.setAttribute('preserveAspectRatio', 'none');
  for(const e of map.edges){
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', xOf(e.r, e.i)); line.setAttribute('y1', yOf(e.r));
    line.setAttribute('x2', xOf(e.r+1, e.j)); line.setAttribute('y2', yOf(e.r+1));
    line.setAttribute('stroke', 'rgba(255,255,255,.15)');
    line.setAttribute('stroke-width', '1.5');
    msvg.appendChild(line);
  }
  mini.appendChild(msvg);
  for(let r=0;r<map.cfg.rows;r++)
    for(let i=0;i<map.rows[r].length;i++){
      const n = map.rows[r][i];
      const d = document.createElement('span');
      d.textContent = NODE_ICONS[n.type];
      d.className = 'mapMiniDot t-' + n.type + (r === map.pos.row && i === map.pos.idx ? ' current' : '');
      d.style.left = xOf(r, i) + '%';
      d.style.top = yOf(r) + '%';
      mini.appendChild(d);
    }
  if(map.pos.row >= 0){
    const pc = document.createElement('canvas');
    pc.width = 24; pc.height = 24;
    pc.className = 'mapMiniPlayer';
    pc.style.left = xOf(map.pos.row, map.pos.idx) + '%';
    pc.style.top = yOf(map.pos.row) + '%';
    const pc2 = pc.getContext('2d');
    pc2.save(); pc2.translate(12,12); pc2.scale(0.5,0.5);
    const ps = skinById(save.selected);
    if(ps.ghost) pc2.globalAlpha = 0.75;
    drawBirdBody(pc2, ps, 0.5, 0, false);
    pc2.restore();
    mini.appendChild(pc);
  }
  show('#map', true);
}

function clickNode(r, i){
  AudioFX.click();
  map.rows[r][i].visited = true;
  map.pos = { row:r, idx:i };
  run.stage++;
  show('#map', false);
  const type = map.rows[r][i].type;
  if(type === 'stage') startStage();
  else if(type === 'boss'){ const d = map.rows[r][i].def; run.boss = { passes:0, max:d.passes, final:false, phaseIdx:0, def:d }; startStage(); }
  else if(type === 'elite'){ let d = map.rows[r][i].def; if(Math.random() < 0.5) d = { ...d, phases:[...d.phases, Math.random() < 0.5 ? {pattern:'chase', rate:1.0} : {pattern:'squeeze', spd:2.6}] }; run.boss = { passes:0, max:d.passes, final:false, elite:true, phaseIdx:0, def:d }; startStage(); }
   else if(type === 'labyrinth'){ const d = map.rows[r][i].def; run.boss = { passes:0, max:d.passes, final:false, labyrinth:true, phaseIdx:0, def:d }; startStage(); }
    else if(type === 'serpent'){ const d = map.rows[r][i].def; const n = d.passes + Math.floor(Math.random()*17); run.boss = { passes:0, max:n, final:false, serpent:true, phaseIdx:0, def:d, path:genSerpentPath(n) }; startStage(); }
  else if(type === 'final'){ const d = map.rows[r][i].def; run.boss = { passes:0, max:d.passes, final:true, phaseIdx:0, def:d }; startStage(); }
  else if(type === 'merchant') openMerchant();
  else openChest();
}

let revealPaused = false;
function showReveal(icon, title, desc, legendary){
  const card = $('#revealCard');
  card.classList.toggle('legendary', !!legendary);
  $('#revealIcon').textContent = icon;
  $('#revealTitle').textContent = title;
  $('#revealDesc').textContent = desc;
  show('#revealBtn', !!legendary);
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = legendary ? 'revealHold .6s cubic-bezier(.2,1.4,.4,1) forwards' : '';
  show('#reveal', true);
  clearTimeout(showReveal._t);
  if(legendary){
    revealPaused = state === 'play' && !paused;
    if(revealPaused) paused = true;
    showReveal._t = setTimeout(closeReveal, 15000);
  } else {
    showReveal._t = setTimeout(() => show('#reveal', false), 2400);
  }
}
function closeReveal(){
  clearTimeout(showReveal._t);
  show('#reveal', false);
  if(revealPaused){ paused = false; revealPaused = false; }
}

function showVictory(){
  state = 'victory';
  AudioFX.startMusic('victory');
  if(run.path === 2){
    save.rl.ascensions = (save.rl.ascensions || 0) + 1;
    $('#victoryTitle').textContent = T('punishment');
    $('#victoryStats').textContent = T('ascensionStats').replace('{n}', run.totalPipes).replace('{g}', run.gold).replace('{a}', save.rl.ascensions);
  } else if(run.path === 3){
    save.punishmentCleared = true;
    save.rl.victories = (save.rl.victories || 0) + 1;
    $('#victoryTitle').textContent = T('trueVictory');
    $('#victoryStats').textContent = T('victoryStats').replace('{s}', run.stage).replace('{n}', run.totalPipes).replace('{g}', run.gold).replace('{v}', save.rl.victories);
  } else {
    save.rl.victories = (save.rl.victories || 0) + 1;
    $('#victoryTitle').textContent = T('victory');
    $('#victoryStats').textContent = T('victoryStats').replace('{s}', run.stage).replace('{n}', run.totalPipes).replace('{g}', run.gold).replace('{v}', save.rl.victories);
  }
  persist();
  show('#continueBtn', run.path < 3);
  $('#continueBtn').textContent = T(run.path === 1 ? 'continueP2' : 'continueP3');
  show('#victory', true);
}

function openChest(){
  state = 'chest';
  chestOpened = false;
  const roll = Math.random();
  if(roll < 0.4) chestReward = { gold: 15 + Math.floor(Math.random()*11) };
  else if(roll < 0.75){
    const missing = relicPool().filter(r => !run.relics.includes(r.id));
    chestReward = missing.length ? { relic: missing[Math.floor(Math.random()*missing.length)].id } : { gold: 25 };
  } else chestReward = { hp: 1 };
  const box = $('#chestBox');
  box.textContent = '📦';
  box.classList.remove('opening', 'opened');
  const rew = $('#chestReward');
  rew.textContent = '???';
  rew.classList.remove('revealed');
  $('#chestOpen').textContent = T('open');
  show('#chest', true);
}

const PATH_THEMES = [null, ['forest','city','desert','snow','ocean'], ['inferno','storm','abyss','necropolis','ashes'], ['eclipse','asteroid','nebula','void','singularity']];
const THEME_TRACKS = { forest:'forest', city:'city', desert:'sunset', snow:'dream', ocean:'ocean', inferno:'inferno', storm:'storm', abyss:'abyss', necropolis:'necropolis', ashes:'ashes', eclipse:'eclipse', asteroid:'asteroid', nebula:'nebula', void:'void', singularity:'singularity' };
function startStage(){
  pipes = []; particles = []; popups = []; trail = [];
  bird.y = H*0.45; bird.vy = 0; bird.rot = 0;
  combo = 0;
  const list = PATH_THEMES[run.path] || PATH_THEMES[1];
  setTheme(list[Math.max(0, run.stage-1) % list.length]);
  popups.push({ x:BIRD_X, y:bird.y-80, txt:theme.toUpperCase()+'!', life:1.5, max:1.5 });
  AudioFX.startMusic(THEME_TRACKS[theme]);
  nextMusicSwitch = t + rand(25,40);
  run.pipesInStage = 0;
  run.vampUsed = 0;
  run.bloodUsed = 0;
  run.phaseCount = 0;
  if(hasRelic('heart')) run.hp = Math.min(mods().maxHp, run.hp + 1);
  if(run.boss){
    bossIntroT0 = t;
    shake = 18; flash = 0.6; AudioFX.scream();
    popups.push({ x:BIRD_X, y:bird.y-60, txt:run.boss.final ? 'FINAL BATTLE' : run.boss.def.name + ' APPROACHES', life:2, max:2 });
  }
  state = 'ready';
  refreshRlHud();
}

/* ================= audio ================= */
const AudioFX = {
  ctx:null, muted:false,
  init(){
    if(this.ctx){ if(this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.22; this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.5; this.sfxGain.connect(this.master);
    this.applyMute();
  },
  applyMute(){ if(this.master) this.master.gain.value = this.muted ? 0 : 1; },
  tone(o){
    if(!this.ctx) return;
    const { f=440, d=0.15, type='sine', v=1, slide=0, at=0, dest=null } = o;
    const t = this.ctx.currentTime + at;
    const osc = this.ctx.createOscillator(), g = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f, t);
    if(slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, f+slide), t+d);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t+d);
    osc.connect(g); g.connect(dest || this.sfxGain);
    osc.start(t); osc.stop(t+d+0.05);
  },
  noise(o){
    if(!this.ctx) return;
    const { d=0.1, v=0.4, f=1200, q=1, at=0, dest=null } = o;
    const t = this.ctx.currentTime + at;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate*d));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for(let i=0;i<len;i++) data[i] = (Math.random()*2-1)*Math.pow(1-i/len,1.5);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const flt = this.ctx.createBiquadFilter(); flt.type='bandpass'; flt.frequency.value=f; flt.Q.value=q;
    const g = this.ctx.createGain(); g.gain.value = v;
    src.connect(flt); flt.connect(g); g.connect(dest || this.sfxGain);
    src.start(t);
  },
  flap(){ this.noise({d:0.07, v:0.35, f:2200, q:0.8}); this.tone({f:340, d:0.07, type:'triangle', v:0.2, slide:260}); },
  roll(){
    this.tone({f:260, d:0.35, type:'sawtooth', v:0.22, slide:540});
    this.noise({d:0.3, v:0.3, f:1600, q:0.6});
    this.tone({f:1568, d:0.14, type:'sine', v:0.3, at:0.3});
  },
  score(){ this.tone({f:784, d:0.08, type:'sine', v:0.45}); this.tone({f:1174.7, d:0.16, type:'sine', v:0.4, at:0.07}); },
  hit(){ this.tone({f:150, d:0.22, type:'square', v:0.5, slide:-90}); this.noise({d:0.18, v:0.5, f:500, q:0.7}); },
  die(){ this.tone({f:500, d:0.6, type:'sawtooth', v:0.3, slide:-380, at:0.15}); },
  boom(){ this.tone({f:90, d:0.35, type:'sine', v:0.7, slide:-40}); this.noise({d:0.25, v:0.4, f:300, q:0.5}); },
  scream(){
    this.tone({f:1100, d:0.9, type:'sawtooth', v:0.5, slide:-750});
    this.tone({f:1150, d:0.9, type:'sawtooth', v:0.35, slide:-800, at:0.02});
    this.noise({d:0.8, v:0.3, f:1800, q:0.5});
  },
  unlock(){ [523.25,659.25,783.99,1046.5].forEach((f,i)=>this.tone({f, d:0.22, type:'triangle', v:0.35, at:i*0.09})); },
  reveal(){ [660, 880, 1108.7].forEach((f,i)=>this.tone({f, d:0.18, type:'triangle', v:0.4, at:i*0.08})); },
  legendary(){
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f,i)=>this.tone({f, d:0.3, type:'triangle', v:0.4, at:i*0.1}));
    this.tone({f:1568, d:0.7, type:'sine', v:0.25, at:0.5});
    this.noise({d:0.5, v:0.2, f:4000, q:0.4, at:0.5});
  },
  click(){ this.tone({f:700, d:0.05, type:'square', v:0.12}); },
  /* --- music sequencer --- */
  timer:null, step:0, nextTime:0, mode:null,
  TRACKS:{
    day:    { bpm:150, melType:'triangle', melV:0.5,  hat:4,
      mel:[76,79,81,79,76,74,76,0, 74,76,74,71,74,76,74,0],
      bas:[48,0,55,0, 57,0,55,0, 51,0,55,0, 48,0,55,0] },
    night:  { bpm:96,  melType:'sine', melV:0.35, hat:4,
      mel:[69,72,74,72,69,71,69,0, 67,69,67,64,67,69,64,0],
      bas:[45,0,52,0, 50,0,52,0, 43,0,50,0, 45,0,52,0] },
    chill:  { bpm:104, melType:'sine', melV:0.4, hat:4,
      mel:[64,0,0,67, 71,0,69,0, 67,0,0,64, 62,0,0,0],
      bas:[48,0,55,0, 45,0,52,0, 43,0,50,0, 41,0,48,0] },
   hype:   { bpm:160, melType:'square', melV:0.28, hat:2,
       mel:[76,76,79,76, 81,79,76,74, 76,76,79,76, 83,81,79,76],
       bas:[48,48,55,48, 57,57,55,48, 51,51,55,51, 53,53,55,53] },
    inferno:{ bpm:170, melType:'square', melV:0.26, hat:2,
       mel:[76,79,76,81, 83,81,79,76, 76,79,76,81, 84,83,81,79],
       bas:[48,48,48,48, 55,55,55,55, 51,51,51,51, 53,53,53,53] },
    rush:   { bpm:168, melType:'square', melV:0.24, hat:2,
       mel:[74,77,79,77, 74,77,79,81, 74,77,79,77, 76,79,81,79],
       bas:[50,50,50,50, 48,48,48,48, 47,47,47,47, 48,48,48,48] },
    mystery:{ bpm:112, melType:'triangle', melV:0.4, hat:4,
      mel:[69,0,72,0, 74,0,72,0, 71,0,74,0, 72,0,71,0],
      bas:[45,0,52,0, 50,0,52,0, 43,0,50,0, 45,0,52,0] },
    sunset: { bpm:118, melType:'triangle', melV:0.35, hat:4,
      mel:[69,0,72,0, 74,0,76,0, 74,0,72,0, 69,0,71,0],
      bas:[45,0,45,0, 50,0,50,0, 43,0,43,0, 45,0,45,0] },
    forest: { bpm:92,  melType:'sine', melV:0.3, hat:4,
      mel:[65,0,67,0, 69,0,0,67, 65,0,64,0, 62,0,0,0],
      bas:[48,0,0,0, 45,0,0,0, 43,0,0,0, 41,0,0,0] },
    city:   { bpm:126, melType:'triangle', melV:0.32, hat:2,
      mel:[72,74,76,74, 72,74,76,79, 77,76,74,76, 74,72,71,72],
      bas:[48,48,55,48, 45,45,52,45, 43,43,50,43, 48,48,55,48] },
    storm:  { bpm:132, melType:'square', melV:0.2, hat:2,
      mel:[74,74,77,74, 79,77,74,77, 74,74,77,74, 81,79,77,74],
      bas:[50,50,50,53, 48,48,48,51, 50,50,50,53, 43,43,43,47] },
   dream:  { bpm:84,  melType:'sine', melV:0.28, hat:4,
       mel:[69,0,0,72, 0,0,74,0, 76,0,0,74, 72,0,0,0],
       bas:[45,0,0,0, 41,0,0,0, 43,0,0,0, 48,0,0,0] },
    ocean:  { bpm:100, melType:'sine', melV:0.3, hat:4,
       mel:[65,0,69,0, 72,0,69,0, 71,0,69,0, 65,0,0,0],
       bas:[45,0,0,0, 48,0,0,0, 43,0,0,0, 41,0,0,0] },
    candy:  { bpm:140, melType:'triangle', melV:0.35, hat:2,
       mel:[76,79,76,79, 76,79,81,79, 76,79,76,79, 83,81,79,76],
       bas:[48,0,48,0, 55,0,55,0, 50,0,50,0, 52,0,52,0] },
    space:  { bpm:88,  melType:'sine', melV:0.3, hat:4,
       mel:[69,0,0,0, 72,0,0,0, 74,0,0,0, 76,0,0,0],
       bas:[45,0,0,0, 41,0,0,0, 43,0,0,0, 48,0,0,0] },
    jungle: { bpm:136, melType:'square', melV:0.22, hat:2,
       mel:[74,74,77,74, 79,77,74,77, 76,76,74,76, 77,77,74,77],
       bas:[50,0,50,0, 48,0,48,0, 43,0,43,0, 47,0,47,0] },
    meadow: { bpm:110, melType:'triangle', melV:0.35, hat:4,
        mel:[69,72,74,72, 76,74,72,74, 71,74,72,71, 69,71,72,0],
        bas:[48,0,55,0, 50,0,57,0, 43,0,50,0, 45,0,52,0] },
     gameover:{ bpm:72, melType:'sine', melV:0.4, hat:16, melD:0.5,
         mel:[69,0,0,67, 0,0,64,0, 62,0,0,60, 0,0,57,0],
         bas:[45,0,0,0, 41,0,0,0, 43,0,0,0, 41,0,0,0] },
      victory:{ bpm:150, melType:'square', melV:0.3, hat:2,
         mel:[76,0,79,0, 81,0,83,0, 84,0,83,81, 79,81,83,84],
         bas:[48,0,48,0, 50,0,50,0, 52,0,52,0, 55,0,55,0] },
   abyss:  { bpm:84,  melType:'square', melV:0.2, hat:8,
        mel:[60,0,0,0, 61,0,0,0, 59,0,0,0, 60,0,0,0],
        bas:[36,36,0,36, 35,35,0,35, 34,34,0,34, 36,36,0,36] },
     necropolis:{ bpm:88,  melType:'square', melV:0.2, hat:8,
        mel:[62,0,63,0, 62,0,0,0, 61,0,62,0, 63,0,62,0],
        bas:[37,37,0,37, 36,36,0,36, 35,35,0,35, 37,37,0,37] },
     ashes:  { bpm:90,  melType:'square', melV:0.22, hat:4,
         mel:[62,0,62,0, 61,0,62,0, 60,0,61,0, 62,0,60,0],
         bas:[38,38,0,38, 37,37,0,37, 36,36,0,36, 38,38,0,38] },
     eclipse:{ bpm:80,  melType:'square', melV:0.18, hat:8,
         mel:[60,0,0,0, 60,0,61,0, 60,0,0,0, 59,0,60,0],
         bas:[36,36,0,36, 36,36,0,36, 35,35,0,35, 34,34,0,34] },
    asteroid:{ bpm:84,  melType:'square', melV:0.18, hat:8,
         mel:[62,0,0,0, 62,0,65,0, 63,0,0,0, 62,0,63,0],
         bas:[37,37,0,37, 34,34,0,34, 36,36,0,36, 35,35,0,35] },
      nebula:{ bpm:76,  melType:'square', melV:0.16, hat:16,
         mel:[64,0,0,0, 67,0,0,0, 65,0,0,0, 64,0,67,0],
         bas:[38,38,0,38, 41,41,0,41, 39,39,0,39, 38,38,0,38] },
        void:{ bpm:72,  melType:'square', melV:0.16, hat:16,
         mel:[59,0,0,0, 0,0,59,0, 58,0,0,0, 0,0,59,0],
         bas:[34,34,0,34, 33,33,0,33, 34,34,0,34, 32,32,0,32] },
  singularity:{ bpm:68,  melType:'square', melV:0.15, hat:16,
         mel:[60,0,0,0, 59,0,0,0, 58,0,0,0, 57,0,0,0],
         bas:[34,34,0,34, 33,33,0,33, 32,32,0,32, 31,31,0,31] },
    },
   POOL:['day','night','chill','hype','mystery','sunset','forest','city','storm','dream','ocean','candy','space','jungle','meadow'],
    FEVER_POOL:['hype','inferno','rush','candy','jungle'],
    PATH1_POOL:['forest','city','sunset','dream','ocean'],
    PATH2_POOL:['inferno','storm','abyss','necropolis','ashes'],
     PATH3_POOL:['eclipse','asteroid','nebula','void','singularity'],
   randomTrack(){ return this.POOL[Math.floor(Math.random()*this.POOL.length)]; },
   randomFever(){ return this.FEVER_POOL[Math.floor(Math.random()*this.FEVER_POOL.length)]; },
  startMusic(mode){
    this.stopMusic();
    if(!this.ctx) return;
    this.mode = mode; this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(()=>this.schedule(), 100);
  },
  stopMusic(){ if(this.timer){ clearInterval(this.timer); this.timer=null; } },
  schedule(){
    const tr = this.TRACKS[this.mode] || this.TRACKS.day;
    const stepDur = 60/tr.bpm/2;
    while(this.nextTime < this.ctx.currentTime + 0.3){
      this.playStep(this.step, this.nextTime);
      this.nextTime += stepDur; this.step++;
    }
  },
  playStep(step, t){
    const M = m => 440*Math.pow(2,(m-69)/12);
    const tr = this.TRACKS[this.mode] || this.TRACKS.day;
    const mel = tr.mel[step%16];
    const bas = tr.bas[step%16];
    const at = t - this.ctx.currentTime;
    if(mel) this.tone({f:M(mel), d:tr.melD||0.16, type:tr.melType, v:tr.melV, at, dest:this.musicGain});
    if(bas) this.tone({f:M(bas), d:0.3,  type:'sine', v:0.5, at, dest:this.musicGain});
    if(step % tr.hat === tr.hat/2) this.noise({d:0.03, v:0.05, f:6000, q:1, at, dest:this.musicGain});
  },
};

